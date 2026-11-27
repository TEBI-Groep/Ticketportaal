-- Parent/child ticket links: from = parent (hoofdticket), to = child.
-- Enum value must be committed before the index can reference it.
alter type public.ticket_link_type add value if not exists 'parent';
