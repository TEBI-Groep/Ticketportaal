-- Add Ticketportaal to the systeem option list (between Telefonie and Werkplek in UI).
alter type public.ticket_systeem add value if not exists 'Ticketportaal';
