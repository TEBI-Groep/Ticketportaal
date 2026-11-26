-- Phase C: system fan-out for inbound Missive replies (service_role only).
-- Portal callers keep using notify_ticket_users (authenticated + auth.uid()).

create or replace function public.notify_ticket_users_system(
  p_ticket_id uuid,
  p_recipient_ids uuid[],
  p_kind text,
  p_title text,
  p_body text default null,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null,
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
  -- Only the service-role key may call this (inbound webhook worker).
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required';
  end if;

  if not exists (select 1 from public.tickets t where t.id = p_ticket_id) then
    raise exception 'ticket not found';
  end if;

  with recipients as (
    select distinct r as user_id
    from unnest(p_recipient_ids) as r
    where r is not null
      and (p_include_actor or p_actor_id is null or r <> p_actor_id)
      and exists (
        select 1
        from public.profiles p
        where p.id = r
          and p.actief
      )
      and exists (
        select 1
        from public.tickets t
        where t.id = p_ticket_id
          and (
            not t.vertrouwelijk
            or t.melder_id = r
            or exists (
              select 1
              from public.profiles p2
              where p2.id = r
                and p2.rol = 'uitvoerder'
            )
          )
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

revoke all on function public.notify_ticket_users_system(
  uuid, uuid[], text, text, text, jsonb, uuid, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.notify_ticket_users_system(
  uuid, uuid[], text, text, text, jsonb, uuid, boolean, boolean
) to service_role;
