-- M2/M3: ratings, comments, it_notes + rating eligibility + stats view

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  toelichting text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, user_id)
);

create index ratings_ticket_idx on public.ratings (ticket_id);
create index ratings_user_idx on public.ratings (user_id);

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

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

  if t.systeem <> 'NetSuite'
     or t.type not in ('wijziging', 'idee')
     or t.status in ('afgerond', 'afgewezen') then
    raise exception 'rating not allowed on this ticket';
  end if;

  return new;
end;
$$;

create trigger ratings_enforce_eligibility
  before insert or update on public.ratings
  for each row execute function public.enforce_rating_eligibility();

create or replace view public.ticket_rating_stats
with (security_invoker = true)
as
select
  t.id as ticket_id,
  coalesce(round(avg(r.score)::numeric, 2), 0) as rating_avg,
  count(r.id)::int as rating_count
from public.tickets t
left join public.ratings r on r.ticket_id = t.id
group by t.id;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid references public.profiles (id),
  body text not null,
  source public.comment_source not null default 'portal',
  external_message_id text,
  in_reply_to text,
  created_at timestamptz not null default now(),
  constraint comments_portal_needs_user
    check (source <> 'portal' or user_id is not null)
);

create index comments_ticket_created_idx on public.comments (ticket_id, created_at);
create unique index comments_external_message_id_uidx
  on public.comments (external_message_id)
  where external_message_id is not null;

create table public.it_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index it_notes_ticket_created_idx on public.it_notes (ticket_id, created_at);

create trigger it_notes_set_updated_at
  before update on public.it_notes
  for each row execute function public.set_updated_at();
