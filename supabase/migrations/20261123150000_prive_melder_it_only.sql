-- Privé (vertrouwelijk): only melder and IT may see the ticket.
-- Also block ratings on privé tickets (not on the public Ranglijst).

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
      )
  );
$$;

drop policy if exists tickets_select_visible on public.tickets;
create policy tickets_select_visible
  on public.tickets for select to authenticated
  using (
    public.is_uitvoerder()
    or not vertrouwelijk
    or melder_id = auth.uid()
  );

create or replace function public.enforce_rating_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets%rowtype;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if not found then
    raise exception 'ticket not found';
  end if;

  -- Privé tickets are not on the public Ranglijst and cannot be rated.
  if t.vertrouwelijk
     or t.prioriteit = 'spoed'
     or t.systeem <> 'NetSuite'
     or t.type not in ('wijziging', 'idee')
     or t.status in ('afgerond', 'afgewezen') then
    raise exception 'rating not allowed on this ticket';
  end if;

  return new;
end;
$$;
