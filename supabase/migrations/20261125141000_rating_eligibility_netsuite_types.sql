-- Align DB rating eligibility with the widened Ranglijst rules:
-- any systeem whose name contains 'Netsuite', types wijziging/idee/procesverbetering.
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

  -- Privé / spoed / closed stay off; Netsuite* + ranglijst types only.
  if t.vertrouwelijk
     or t.prioriteit = 'spoed'
     or position('netsuite' in lower(t.systeem::text)) = 0
     or t.type not in ('wijziging', 'idee', 'procesverbetering')
     or t.status in ('afgerond', 'afgewezen') then
    raise exception 'rating not allowed on this ticket';
  end if;

  return new;
end;
$$;
