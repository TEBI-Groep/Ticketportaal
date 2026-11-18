-- Future phases: empty structures so we do not redesign later

-- Fase 2
create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  kind public.attachment_kind not null default 'other',
  created_at timestamptz not null default now()
);

create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

create table public.ticket_status_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index ticket_status_events_ticket_idx
  on public.ticket_status_events (ticket_id, created_at);

create table public.ticket_links (
  id uuid primary key default gen_random_uuid(),
  from_ticket_id uuid not null references public.tickets (id) on delete cascade,
  to_ticket_id uuid not null references public.tickets (id) on delete cascade,
  link_type public.ticket_link_type not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (from_ticket_id, to_ticket_id, link_type),
  check (from_ticket_id <> to_ticket_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel public.notification_channel not null,
  status text not null default 'pending',
  provider_ref text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ticket_watchers (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create table public.ticket_acl (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (ticket_id, user_id)
);

-- Fase 3
create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  prioriteit public.ticket_priority not null unique,
  first_response_hours int,
  resolve_hours int,
  actief boolean not null default true
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  approver_id uuid not null references public.profiles (id),
  kind text not null,
  status public.approval_status not null default 'pending',
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index approval_requests_ticket_idx on public.approval_requests (ticket_id);

-- Fase 4
create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  body text not null,
  systeem public.ticket_systeem,
  tags text[] not null default '{}',
  related_ticket_id uuid references public.tickets (id),
  published boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger knowledge_articles_set_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  external_id text not null unique,
  from_address text,
  subject text,
  body_text text,
  received_at timestamptz not null,
  processed_at timestamptz,
  ticket_id uuid references public.tickets (id),
  comment_id uuid references public.comments (id),
  status text not null default 'pending',
  error text,
  raw jsonb
);

create table public.recurring_ticket_templates (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  cadence_cron text not null,
  payload jsonb not null,
  actief boolean not null default true,
  last_spawned_at timestamptz
);

-- Auto-log status changes (usable from day 1)
create or replace function public.log_ticket_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into public.ticket_status_events (ticket_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger tickets_log_status
  after insert or update of status on public.tickets
  for each row execute function public.log_ticket_status_change();
