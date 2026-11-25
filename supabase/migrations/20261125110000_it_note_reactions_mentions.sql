-- IT note reactions (thumbs-up) + structured mentions for Beheerder notifications.

create table public.it_note_reactions (
  note_id uuid not null references public.it_notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'thumbs_up'
    check (kind in ('thumbs_up')),
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index it_note_reactions_user_idx on public.it_note_reactions (user_id);

create table public.it_note_mentions (
  note_id uuid not null references public.it_notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index it_note_mentions_user_idx on public.it_note_mentions (user_id);

-- Unread inbox lookup for the shell bell.
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.it_note_reactions enable row level security;
alter table public.it_note_mentions enable row level security;

-- Same gate as it_notes: Beheerder (uitvoerder) only.
create policy it_note_reactions_all_uitvoerder
  on public.it_note_reactions for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

create policy it_note_mentions_all_uitvoerder
  on public.it_note_mentions for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

grant select, insert, delete on public.it_note_reactions to authenticated;
grant select, insert, delete on public.it_note_mentions to authenticated;
