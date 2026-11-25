-- Allow users to permanently remove their own inbox notifications.
create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

grant delete on public.notifications to authenticated;
