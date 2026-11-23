-- Tickets can have multiple afdelingen; managers see tickets for their afdeling.
-- IT (uitvoerder) may already change melder_id via tickets_update_uitvoerder + protect trigger.

-- ---------------------------------------------------------------------------
-- Junction: ticket ↔ departments
-- ---------------------------------------------------------------------------
create table public.ticket_departments (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  department_id uuid not null references public.departments (id),
  primary key (ticket_id, department_id)
);

create index ticket_departments_department_idx
  on public.ticket_departments (department_id);

insert into public.ticket_departments (ticket_id, department_id)
select id, afdeling_id
from public.tickets
where afdeling_id is not null
on conflict do nothing;

alter table public.tickets drop column afdeling_id;

-- ---------------------------------------------------------------------------
-- Helpers: manager of a department / ticket
-- ---------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol = 'manager' and actief from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.manager_shares_ticket_department(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.ticket_departments td
      on td.department_id = p.afdeling_id
     and td.ticket_id = p_ticket_id
    where p.id = auth.uid()
      and p.rol = 'manager'
      and p.actief
      and p.afdeling_id is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- can_view_ticket: managers see tickets that include their afdeling
-- ---------------------------------------------------------------------------
create or replace function public.can_view_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        public.is_uitvoerder()
        or not t.vertrouwelijk
        or t.melder_id = auth.uid()
        or t.eigenaar_id = auth.uid()
        or public.manager_shares_ticket_department(t.id)
        or exists (
          select 1 from public.ticket_acl a
          where a.ticket_id = t.id and a.user_id = auth.uid()
        )
      )
  );
$$;

-- Align tickets SELECT with can_view_ticket (incl. manager afdeling + vertrouwelijk)
drop policy if exists tickets_select_visible on public.tickets;
create policy tickets_select_visible
  on public.tickets for select to authenticated
  using (
    public.is_uitvoerder()
    or not vertrouwelijk
    or melder_id = auth.uid()
    or eigenaar_id = auth.uid()
    or public.manager_shares_ticket_department(id)
    or exists (
      select 1 from public.ticket_acl a
      where a.ticket_id = id and a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS for ticket_departments
-- ---------------------------------------------------------------------------
alter table public.ticket_departments enable row level security;

create policy ticket_departments_select
  on public.ticket_departments for select to authenticated
  using (public.can_view_ticket(ticket_id));

create policy ticket_departments_insert
  on public.ticket_departments for insert to authenticated
  with check (
    public.is_uitvoerder()
    or (
      public.is_manager_or_uitvoerder()
      and exists (
        select 1 from public.tickets t
        where t.id = ticket_id
          and t.melder_id = auth.uid()
      )
    )
  );

create policy ticket_departments_update
  on public.ticket_departments for update to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

create policy ticket_departments_delete
  on public.ticket_departments for delete to authenticated
  using (
    public.is_uitvoerder()
    or (
      exists (
        select 1 from public.tickets t
        where t.id = ticket_id
          and t.melder_id = auth.uid()
          and t.status = 'nieuw'
      )
    )
  );

grant select, insert, update, delete on public.ticket_departments to authenticated;

revoke all on function public.is_manager() from public;
revoke all on function public.manager_shares_ticket_department(uuid) from public;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.manager_shares_ticket_department(uuid) to authenticated;
revoke all on function public.is_manager() from anon;
revoke all on function public.manager_shares_ticket_department(uuid) from anon;
