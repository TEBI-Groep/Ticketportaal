-- Retire Impact as a product field: keep the column for existing rows,
-- but new inserts get a neutral default so the app can stop collecting Impact.

alter table public.tickets
  alter column impact set default 'wens'::public.ticket_impact;

comment on column public.tickets.impact is
  'Legacy severity field; UI uses prioriteit. Default wens for new tickets.';
