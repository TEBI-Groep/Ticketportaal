-- Privé (vertrouwelijk): leidinggevenden may not see private tickets,
-- even when the ticket shares their afdeling. Visibility is limited to
-- IT, melder, eigenaar, and explicit ACL entries.

create or replace function public.can_view_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        public.is_uitvoerder()
        or not t.vertrouwelijk
        or t.melder_id = auth.uid()
        or t.eigenaar_id = auth.uid()
        or exists (
          select 1 from public.ticket_acl a
          where a.ticket_id = t.id and a.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists tickets_select_visible on public.tickets;
create policy tickets_select_visible
  on public.tickets for select to authenticated
  using (
    public.is_uitvoerder()
    or not vertrouwelijk
    or melder_id = auth.uid()
    or eigenaar_id = auth.uid()
    or exists (
      select 1 from public.ticket_acl a
      where a.ticket_id = id and a.user_id = auth.uid()
    )
  );
