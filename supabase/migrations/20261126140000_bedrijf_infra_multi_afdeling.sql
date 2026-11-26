-- Infra department, Bedrijf on profiles/tickets, multi-afdeling users,
-- and bedrijf-scoped ticket visibility.

-- ---------------------------------------------------------------------------
-- Infra afdeling (UI sorts alphabetically by naam)
-- ---------------------------------------------------------------------------
insert into public.departments (code, naam, sort_order, actief)
select 'infra', 'Infra', 45, true
where not exists (
  select 1 from public.departments d
  where d.code = 'infra' or d.naam = 'Infra'
);

update public.departments
set actief = false
where naam not in (
  'Administratie',
  'Directie',
  'HR',
  'Infra',
  'Inkoop',
  'IT',
  'Marketing',
  'Terrein',
  'Transport',
  'Verkoop'
);

-- Mark afdelingen that always force Bedrijfsbreed on tickets.
alter table public.departments
  add column if not exists force_bedrijfsbreed boolean not null default false;

update public.departments
set force_bedrijfsbreed = true
where naam in (
  'Administratie',
  'Directie',
  'HR',
  'Infra',
  'IT',
  'Marketing'
);

-- ---------------------------------------------------------------------------
-- Bedrijf enums + columns
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'bedrijf') then
    create type public.bedrijf as enum ('TEBI', 'VK', 'SPL');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_bedrijf') then
    create type public.ticket_bedrijf as enum ('TEBI', 'VK', 'SPL', 'bedrijfsbreed');
  end if;
end $$;

alter table public.profiles
  add column if not exists bedrijf public.bedrijf;

update public.profiles
set bedrijf = 'TEBI'
where bedrijf is null;

alter table public.profiles
  alter column bedrijf set default 'TEBI'::public.bedrijf;

alter table public.profiles
  alter column bedrijf set not null;

alter table public.tickets
  add column if not exists bedrijf public.ticket_bedrijf;

update public.tickets
set bedrijf = 'TEBI'
where bedrijf is null;

alter table public.tickets
  alter column bedrijf set default 'TEBI'::public.ticket_bedrijf;

alter table public.tickets
  alter column bedrijf set not null;

create index if not exists tickets_bedrijf_status_idx
  on public.tickets (bedrijf, status);

-- ---------------------------------------------------------------------------
-- Multi-afdeling: profile_departments
-- ---------------------------------------------------------------------------
create table if not exists public.profile_departments (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id),
  primary key (profile_id, department_id)
);

create index if not exists profile_departments_department_idx
  on public.profile_departments (department_id);

insert into public.profile_departments (profile_id, department_id)
select p.id, p.afdeling_id
from public.profiles p
where p.afdeling_id is not null
on conflict do nothing;

alter table public.profile_departments enable row level security;

drop policy if exists profile_departments_select on public.profile_departments;
create policy profile_departments_select
  on public.profile_departments for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_uitvoerder()
  );

drop policy if exists profile_departments_write on public.profile_departments;
create policy profile_departments_write
  on public.profile_departments for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- Managers share a ticket when any of their departments matches.
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
    join public.profile_departments pd
      on pd.profile_id = p.id
    join public.ticket_departments td
      on td.department_id = pd.department_id
     and td.ticket_id = p_ticket_id
    where p.id = auth.uid()
      and p.rol = 'manager'
      and p.actief
  );
$$;

-- True when the viewer’s bedrijf may see this ticket’s bedrijf scope.
create or replace function public.shares_ticket_bedrijf(p_ticket_bedrijf public.ticket_bedrijf)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_uitvoerder()
    or p_ticket_bedrijf = 'bedrijfsbreed'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.actief
        and p.bedrijf::text = p_ticket_bedrijf::text
    );
$$;

-- Non-privé tickets are visible within the same bedrijf (or bedrijfsbreed).
-- Privé remains melder + IT only. Uitvoerders see everything.
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
        or t.melder_id = auth.uid()
        or (
          not t.vertrouwelijk
          and public.shares_ticket_bedrijf(t.bedrijf)
        )
      )
  );
$$;

drop policy if exists tickets_select_visible on public.tickets;
create policy tickets_select_visible
  on public.tickets for select to authenticated
  using (
    public.is_uitvoerder()
    or melder_id = auth.uid()
    or (
      not vertrouwelijk
      and public.shares_ticket_bedrijf(bedrijf)
    )
  );

revoke all on function public.shares_ticket_bedrijf(public.ticket_bedrijf) from public;
grant execute on function public.shares_ticket_bedrijf(public.ticket_bedrijf) to authenticated;

-- Force Bedrijfsbreed when any linked afdeling has force_bedrijfsbreed.
create or replace function public.enforce_ticket_bedrijfsbreed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.ticket_departments td
    join public.departments d on d.id = td.department_id
    where td.ticket_id = new.id
      and d.force_bedrijfsbreed
  ) then
    new.bedrijf := 'bedrijfsbreed';
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_enforce_bedrijfsbreed on public.tickets;
create trigger tickets_enforce_bedrijfsbreed
  before insert or update of bedrijf on public.tickets
  for each row
  execute function public.enforce_ticket_bedrijfsbreed();

-- Also re-check when ticket_departments change (after insert/delete).
create or replace function public.sync_ticket_bedrijf_from_departments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  tid := coalesce(new.ticket_id, old.ticket_id);
  if exists (
    select 1
    from public.ticket_departments td
    join public.departments d on d.id = td.department_id
    where td.ticket_id = tid
      and d.force_bedrijfsbreed
  ) then
    update public.tickets
    set bedrijf = 'bedrijfsbreed'
    where id = tid
      and bedrijf is distinct from 'bedrijfsbreed';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ticket_departments_sync_bedrijf on public.ticket_departments;
create trigger ticket_departments_sync_bedrijf
  after insert or delete on public.ticket_departments
  for each row
  execute function public.sync_ticket_bedrijf_from_departments();
