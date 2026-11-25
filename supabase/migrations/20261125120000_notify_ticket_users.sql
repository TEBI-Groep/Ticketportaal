-- Allow any ticket viewer to fan-out in-app notifications to recipients.
-- Used for status changes + Updates & vragen (and later email via notification_deliveries).

create or replace function public.notify_ticket_users(
  p_ticket_id uuid,
  p_recipient_ids uuid[],
  p_kind text,
  p_title text,
  p_body text default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Actor must be allowed to see the ticket before notifying others.
  if not public.can_view_ticket(p_ticket_id) then
    raise exception 'cannot view ticket';
  end if;

  insert into public.notifications (user_id, ticket_id, kind, title, body, payload)
  select distinct r, p_ticket_id, p_kind, p_title, p_body, coalesce(p_payload, '{}'::jsonb)
  from unnest(p_recipient_ids) as r
  where r is not null
    and r <> auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = r
        and p.actief
    );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb)
  from public;
grant execute on function public.notify_ticket_users(uuid, uuid[], text, text, text, jsonb)
  to authenticated;
