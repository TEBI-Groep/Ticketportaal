-- M0a: enums + shared helpers for Ticketportaal

create type public.user_role as enum ('gebruiker', 'manager', 'uitvoerder');

create type public.ticket_type as enum ('storing', 'wijziging', 'vraag', 'idee');
create type public.ticket_systeem as enum ('NetSuite', 'WMS', 'hardware', 'Outlook', 'overig');
create type public.ticket_impact as enum ('stil', 'hinderlijk', 'wens');
create type public.ticket_priority as enum ('spoed', 'voorrang', 'belangrijk', 'normaal');
create type public.ticket_size as enum ('S', 'M', 'L');
create type public.ticket_status as enum (
  'nieuw',
  'ingepland',
  'in_behandeling',
  'wacht_op_melder',
  'afgerond',
  'afgewezen'
);

create type public.comment_source as enum ('portal', 'email', 'system');
create type public.comment_visibility as enum ('public', 'internal');

create type public.attachment_kind as enum ('image', 'document', 'other');
create type public.ticket_link_type as enum ('duplicate', 'related', 'blocks', 'blocked_by');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.notification_channel as enum ('in_app', 'email', 'teams');

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

create sequence public.ticket_nummer_seq start with 100 increment by 1;

create or replace function public.next_ticketnummer()
returns text
language sql
set search_path = public
as $$
  select 'TP-' || nextval('public.ticket_nummer_seq')::text;
$$;
