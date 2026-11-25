-- Per-user e-mail notification preferences (Phase B).
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_ticket_created boolean not null default true,
  email_ticket_status_changed boolean not null default true,
  email_ticket_comment boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy notification_preferences_insert_own
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy notification_preferences_update_own
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;

-- Queue e-mail only when the recipient has that kind enabled (missing row = all on).
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
    returning id, user_id, kind
  ),
  queued as (
    insert into public.notification_deliveries (notification_id, channel, status)
    select
      ir.id,
      'email'::public.notification_channel,
      'pending'
    from inserted_rows ir
    left join public.notification_preferences pref on pref.user_id = ir.user_id
    where p_queue_email
      and ir.kind = any (email_kinds)
      and case ir.kind
        when 'ticket_created' then coalesce(pref.email_ticket_created, true)
        when 'ticket_status_changed' then coalesce(pref.email_ticket_status_changed, true)
        when 'ticket_comment' then coalesce(pref.email_ticket_comment, true)
        else false
      end
    returning id
  )
  select count(*)::integer into inserted from inserted_rows;

  return coalesce(inserted, 0);
end;
$$;

revoke all on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb, boolean, boolean)
  from public;
grant execute on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb, boolean, boolean)
  to authenticated;
