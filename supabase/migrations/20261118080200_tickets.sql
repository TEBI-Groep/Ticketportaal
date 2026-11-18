-- M1: tickets + ticketnummer + eigenaar guard

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticketnummer text not null unique default public.next_ticketnummer(),
  onderwerp text not null,
  omschrijving text not null,
  afdeling_id uuid not null references public.departments (id),
  type public.ticket_type not null,
  systeem public.ticket_systeem not null,
  impact public.ticket_impact not null,
  categorie text,
  status public.ticket_status not null default 'nieuw',
  prioriteit public.ticket_priority not null default 'normaal',
  melder_id uuid not null references public.profiles (id),
  eigenaar_id uuid references public.profiles (id),
  streefdatum date,
  omvang public.ticket_size,
  oplossing_samenvatting text,
  -- Reserved for later phases
  vertrouwelijk boolean not null default false,
  closed_at timestamptz,
  melder_bevestigd_at timestamptz,
  netsuite_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tickets_status_idx on public.tickets (status);
create index tickets_systeem_type_status_idx on public.tickets (systeem, type, status);
create index tickets_melder_idx on public.tickets (melder_id);
create index tickets_eigenaar_idx on public.tickets (eigenaar_id) where eigenaar_id is not null;
create index tickets_prioriteit_impact_idx on public.tickets (prioriteit, impact);
create index tickets_created_at_idx on public.tickets (created_at desc);
create index tickets_afdeling_idx on public.tickets (afdeling_id);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- Eigenaar must be an active uitvoerder (or null)
create or replace function public.enforce_ticket_eigenaar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.eigenaar_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.eigenaar_id
        and p.rol = 'uitvoerder'
        and p.actief
    ) then
      raise exception 'eigenaar_id must reference an active uitvoerder';
    end if;
  end if;

  if new.status in ('afgerond', 'afgewezen') and new.closed_at is null then
    new.closed_at = now();
  end if;

  if new.status not in ('afgerond', 'afgewezen') then
    new.closed_at = null;
  end if;

  return new;
end;
$$;

create trigger tickets_enforce_eigenaar
  before insert or update of eigenaar_id, status on public.tickets
  for each row execute function public.enforce_ticket_eigenaar();
