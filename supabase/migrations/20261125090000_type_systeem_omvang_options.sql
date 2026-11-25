-- Expand ticket type / systeem / omvang option lists to match product.
-- Rename existing systeem values so current rows stay valid.

-- New ticket type
alter type public.ticket_type add value if not exists 'procesverbetering';

-- Omvang: XL / XXL
alter type public.ticket_size add value if not exists 'XL';
alter type public.ticket_size add value if not exists 'XXL';

-- Systeem: rename legacy product names, then add missing options
alter type public.ticket_systeem rename value 'NetSuite' to 'Netsuite';
alter type public.ticket_systeem rename value 'WMS' to 'Netsuite WMS';
alter type public.ticket_systeem rename value 'Transportplanning' to 'Netsuite transportplanning';
alter type public.ticket_systeem add value if not exists 'Software';
alter type public.ticket_systeem add value if not exists 'Telefonie';
alter type public.ticket_systeem add value if not exists 'Werkplek';

-- Rating eligibility still targets main Netsuite wijziging/idee (not WMS/transport).
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
     or t.systeem <> 'Netsuite'
     or t.type not in ('wijziging', 'idee')
     or t.status in ('afgerond', 'afgewezen') then
    raise exception 'rating not allowed on this ticket';
  end if;

  return new;
end;
$$;
