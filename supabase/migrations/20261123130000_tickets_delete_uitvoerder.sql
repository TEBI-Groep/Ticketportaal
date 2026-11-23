-- Allow IT (uitvoerder) to permanently delete tickets (false / test tickets).

create policy tickets_delete_uitvoerder
  on public.tickets for delete to authenticated
  using (public.is_uitvoerder());
