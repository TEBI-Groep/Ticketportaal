-- Private Storage bucket for ticket screenshots / files.
-- Object path: {ticket_id}/{uuid}-{safe_file_name}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read when the ticket is visible to the user.
create policy ticket_attachments_storage_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and public.can_view_ticket(((storage.foldername(name))[1])::uuid)
  );

-- Upload into a folder named after a ticket the user can view.
create policy ticket_attachments_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and public.can_view_ticket(((storage.foldername(name))[1])::uuid)
  );

-- Uploader or IT may delete the object.
create policy ticket_attachments_storage_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and (
      owner = auth.uid()
      or public.is_uitvoerder()
    )
  );
