-- A ticket may have at most one parent (hoofdticket).
create unique index if not exists ticket_links_one_parent_per_child
  on public.ticket_links (to_ticket_id)
  where link_type = 'parent';
