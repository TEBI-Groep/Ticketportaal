-- Phase A: queue email deliveries alongside in-app notifications (Missive sender).

-- Per-recipient Missive thread so updates reply into the same conversation.
create table if not exists public.ticket_email_threads (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  missive_conversation_id text,
  root_subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create index if not exists ticket_email_threads_conversation_idx
  on public.ticket_email_threads (missive_conversation_id)
  where missive_conversation_id is not null;

alter table public.ticket_email_threads enable row level security;

create policy ticket_email_threads_uitvoerder
  on public.ticket_email_threads for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

grant select, insert, update, delete on public.ticket_email_threads to authenticated;

-- Replace the previous 6-arg signature with the Phase A params.
drop function if exists public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb);

-- Fan-out in-app notifications + optional email delivery rows.
-- p_include_actor: used for ontvangstbevestiging (melder notifies themselves).
create or replace function public.notify_ticket_users(
  p_ticket_id uuid,
  p_recipient_ids uuid[],
  p_kind text,
  p_title text,
  p_body text default null,
  p_payload jsonb default '{}'::jsonb,
  p_include_actor boolean default false,
  p_queue_email boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  email_kinds text[] := array[
    'ticket_created',
    'ticket_status_changed',
    'ticket_comment'
  ];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_view_ticket(p_ticket_id) then
    raise exception 'cannot view ticket';
  end if;

  with recipients as (
    select distinct r as user_id
    from unnest(p_recipient_ids) as r
    where r is not null
      and (p_include_actor or r <> auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = r
          and p.actief
      )
  ),
  inserted_rows as (
    insert into public.notifications (user_id, ticket_id, kind, title, body, payload)
    select
      recipients.user_id,
      p_ticket_id,
      p_kind,
      p_title,
      p_body,
      coalesce(p_payload, '{}'::jsonb)
    from recipients
    returning id
  ),
  queued as (
    insert into public.notification_deliveries (notification_id, channel, status)
    select inserted_rows.id, 'email'::public.notification_channel, 'pending'
    from inserted_rows
    where p_queue_email
      and p_kind = any (email_kinds)
    returning id
  )
  select count(*)::integer into inserted from inserted_rows;

  return coalesce(inserted, 0);
end;
$$;

-- Recreate grants for the widened signature.
revoke all on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb)
  from public, authenticated;
revoke all on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb, boolean, boolean)
  from public;
grant execute on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb, boolean, boolean)
  to authenticated;
