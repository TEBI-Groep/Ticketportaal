-- Keep inbound audit rows when tickets/comments are deleted.
-- Without SET NULL, deleting a ticket cascades comments and fails on
-- inbound_messages_comment_id_fkey.

alter table public.inbound_messages
  drop constraint if exists inbound_messages_ticket_id_fkey;

alter table public.inbound_messages
  add constraint inbound_messages_ticket_id_fkey
  foreign key (ticket_id) references public.tickets (id) on delete set null;

alter table public.inbound_messages
  drop constraint if exists inbound_messages_comment_id_fkey;

alter table public.inbound_messages
  add constraint inbound_messages_comment_id_fkey
  foreign key (comment_id) references public.comments (id) on delete set null;
