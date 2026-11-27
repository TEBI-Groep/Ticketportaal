-- Link bijlagen to an Updates & vragen comment (nullable = ticket-level only).
alter table public.ticket_attachments
  add column if not exists comment_id uuid
    references public.comments (id) on delete set null;

create index if not exists ticket_attachments_comment_idx
  on public.ticket_attachments (comment_id);
