-- Fix search_path + revoke public EXECUTE on SECURITY DEFINER helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.next_ticketnummer()
returns text
language sql
set search_path = public
as $$
  select 'TP-' || nextval('public.ticket_nummer_seq')::text;
$$;

-- Revoke default PUBLIC execute; grant only what clients need
revoke all on function public.set_updated_at() from public;
revoke all on function public.next_ticketnummer() from public;
revoke all on function public.current_rol() from public;
revoke all on function public.is_uitvoerder() from public;
revoke all on function public.is_manager_or_uitvoerder() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.enforce_ticket_eigenaar() from public;
revoke all on function public.enforce_rating_eligibility() from public;
revoke all on function public.can_view_ticket(uuid) from public;
revoke all on function public.log_ticket_status_change() from public;
revoke all on function public.protect_profile_fields() from public;
revoke all on function public.protect_ticket_melder_update() from public;

-- RLS policies / defaults need these as authenticated
grant execute on function public.current_rol() to authenticated;
grant execute on function public.is_uitvoerder() to authenticated;
grant execute on function public.is_manager_or_uitvoerder() to authenticated;
grant execute on function public.can_view_ticket(uuid) to authenticated;
grant execute on function public.next_ticketnummer() to authenticated;

-- Trigger-only functions: no direct RPC
revoke all on function public.set_updated_at() from anon, authenticated;
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.enforce_ticket_eigenaar() from anon, authenticated;
revoke all on function public.enforce_rating_eligibility() from anon, authenticated;
revoke all on function public.log_ticket_status_change() from anon, authenticated;
revoke all on function public.protect_profile_fields() from anon, authenticated;
revoke all on function public.protect_ticket_melder_update() from anon, authenticated;

revoke all on function public.current_rol() from anon;
revoke all on function public.is_uitvoerder() from anon;
revoke all on function public.is_manager_or_uitvoerder() from anon;
revoke all on function public.can_view_ticket(uuid) from anon;
revoke all on function public.next_ticketnummer() from anon;
