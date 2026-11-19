-- Align systeem / status / prioriteit enums and afdelingen with product list.
-- Also allow HEIC + Word MIME types on ticket-attachments Storage bucket.

-- ---------------------------------------------------------------------------
-- Systeem: casing + Artikelen / Transportplanning
-- ---------------------------------------------------------------------------
alter type public.ticket_systeem rename value 'hardware' to 'Hardware';
alter type public.ticket_systeem rename value 'overig' to 'Overig';
alter type public.ticket_systeem add value if not exists 'Artikelen';
alter type public.ticket_systeem add value if not exists 'Transportplanning';

-- ---------------------------------------------------------------------------
-- Status: add wacht_op_publicatie
-- ---------------------------------------------------------------------------
alter type public.ticket_status add value if not exists 'wacht_op_publicatie';

-- ---------------------------------------------------------------------------
-- Prioriteit: spoed / hoog / gemiddeld / laag (replace voorrang/belangrijk/normaal)
-- ---------------------------------------------------------------------------
alter table public.tickets alter column prioriteit drop default;

create type public.ticket_priority_new as enum ('spoed', 'hoog', 'gemiddeld', 'laag');

alter table public.tickets
  alter column prioriteit type public.ticket_priority_new
  using (
    case prioriteit::text
      when 'spoed' then 'spoed'
      when 'voorrang' then 'hoog'
      when 'belangrijk' then 'gemiddeld'
      when 'normaal' then 'laag'
      else 'laag'
    end
  )::public.ticket_priority_new;

alter table public.sla_policies
  alter column prioriteit type public.ticket_priority_new
  using (
    case prioriteit::text
      when 'spoed' then 'spoed'
      when 'voorrang' then 'hoog'
      when 'belangrijk' then 'gemiddeld'
      when 'normaal' then 'laag'
      else 'laag'
    end
  )::public.ticket_priority_new;

drop type public.ticket_priority;
alter type public.ticket_priority_new rename to ticket_priority;

alter table public.tickets
  alter column prioriteit set default 'laag'::public.ticket_priority;

-- ---------------------------------------------------------------------------
-- Afdelingen: rename existing (keep FKs) + add missing
-- ---------------------------------------------------------------------------
update public.departments
set naam = 'Administratie', code = 'administratie', sort_order = 20, actief = true
where naam = 'Finance' or code = 'finance';

update public.departments
set naam = 'Terrein', code = 'terrein', sort_order = 60, actief = true
where naam = 'Magazijn' or code = 'magazijn';

update public.departments
set naam = 'Verkoop', code = 'verkoop', sort_order = 80, actief = true
where naam = 'Sales' or code = 'sales';

update public.departments
set sort_order = 10, actief = true
where naam = 'Directie' or code = 'directie';

update public.departments
set sort_order = 30, actief = true
where naam = 'HR' or code = 'hr';

update public.departments
set sort_order = 40, actief = true
where naam = 'Inkoop' or code = 'inkoop';

update public.departments
set sort_order = 50, actief = true
where naam = 'IT' or code = 'it';

insert into public.departments (code, naam, sort_order, actief)
select v.code, v.naam, v.sort_order, true
from (values
  ('hr', 'HR', 30),
  ('transport', 'Transport', 70),
  ('marketing', 'Marketing', 90)
) as v(code, naam, sort_order)
where not exists (
  select 1 from public.departments d
  where d.code = v.code or d.naam = v.naam
);

update public.departments
set actief = false
where naam not in (
  'Directie',
  'Administratie',
  'HR',
  'Inkoop',
  'IT',
  'Terrein',
  'Transport',
  'Verkoop',
  'Marketing'
);

-- ---------------------------------------------------------------------------
-- Attachments: HEIC + Word
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'ticket-attachments';
