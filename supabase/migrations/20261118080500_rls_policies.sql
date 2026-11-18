-- RLS for all public tables (MVP rules + safe defaults for future tables)

-- Helper: can current user see a ticket (MVP + vertrouwelijk hook)
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

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.it_notes enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_status_events enable row level security;
alter table public.ticket_links enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.ticket_watchers enable row level security;
alter table public.ticket_acl enable row level security;
alter table public.sla_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.recurring_ticket_templates enable row level security;

-- departments
create policy departments_select_authenticated
  on public.departments for select to authenticated
  using (actief or public.is_uitvoerder());

create policy departments_write_uitvoerder
  on public.departments for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (actief or id = auth.uid() or public.is_uitvoerder());

create policy profiles_update_own_naam
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_uitvoerder
  on public.profiles for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- tickets
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

create policy tickets_insert_manager_uitvoerder
  on public.tickets for insert to authenticated
  with check (
    public.is_manager_or_uitvoerder()
    and melder_id = auth.uid()
  );

create policy tickets_update_melder_when_nieuw
  on public.tickets for update to authenticated
  using (melder_id = auth.uid() and status = 'nieuw')
  with check (melder_id = auth.uid());

create policy tickets_update_uitvoerder
  on public.tickets for update to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- ratings
create policy ratings_select_if_ticket_visible
  on public.ratings for select to authenticated
  using (public.can_view_ticket(ticket_id));

create policy ratings_insert_own
  on public.ratings for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_ticket(ticket_id));

create policy ratings_update_own
  on public.ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy ratings_delete_own
  on public.ratings for delete to authenticated
  using (user_id = auth.uid());

-- comments (public thread)
create policy comments_select_if_ticket_visible
  on public.comments for select to authenticated
  using (public.can_view_ticket(ticket_id));

create policy comments_insert_own_portal
  on public.comments for insert to authenticated
  with check (
    public.can_view_ticket(ticket_id)
    and source = 'portal'
    and user_id = auth.uid()
  );

create policy comments_update_own_portal
  on public.comments for update to authenticated
  using (user_id = auth.uid() and source = 'portal')
  with check (user_id = auth.uid() and source = 'portal');

-- it_notes: uitvoerder only
create policy it_notes_all_uitvoerder
  on public.it_notes for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder() and user_id = auth.uid());

-- ticket_attachments
create policy ticket_attachments_select
  on public.ticket_attachments for select to authenticated
  using (public.can_view_ticket(ticket_id));

create policy ticket_attachments_insert
  on public.ticket_attachments for insert to authenticated
  with check (
    public.can_view_ticket(ticket_id)
    and uploaded_by = auth.uid()
  );

create policy ticket_attachments_delete
  on public.ticket_attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_uitvoerder());

-- ticket_status_events
create policy ticket_status_events_select
  on public.ticket_status_events for select to authenticated
  using (public.can_view_ticket(ticket_id));

create policy ticket_status_events_insert_uitvoerder
  on public.ticket_status_events for insert to authenticated
  with check (public.is_uitvoerder());

-- ticket_links
create policy ticket_links_select
  on public.ticket_links for select to authenticated
  using (
    public.can_view_ticket(from_ticket_id)
    or public.can_view_ticket(to_ticket_id)
  );

create policy ticket_links_write_uitvoerder
  on public.ticket_links for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- notifications
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_insert_uitvoerder
  on public.notifications for insert to authenticated
  with check (public.is_uitvoerder() or user_id = auth.uid());

-- notification_deliveries: uitvoerder / service
create policy notification_deliveries_uitvoerder
  on public.notification_deliveries for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- ticket_watchers
create policy ticket_watchers_select
  on public.ticket_watchers for select to authenticated
  using (public.can_view_ticket(ticket_id) or user_id = auth.uid());

create policy ticket_watchers_insert_own
  on public.ticket_watchers for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_ticket(ticket_id));

create policy ticket_watchers_delete_own
  on public.ticket_watchers for delete to authenticated
  using (user_id = auth.uid() or public.is_uitvoerder());

-- ticket_acl
create policy ticket_acl_select
  on public.ticket_acl for select to authenticated
  using (public.is_uitvoerder() or user_id = auth.uid());

create policy ticket_acl_write_uitvoerder
  on public.ticket_acl for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- sla_policies
create policy sla_policies_select_authenticated
  on public.sla_policies for select to authenticated
  using (true);

create policy sla_policies_write_uitvoerder
  on public.sla_policies for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- approval_requests
create policy approval_requests_select
  on public.approval_requests for select to authenticated
  using (
    public.is_uitvoerder()
    or requested_by = auth.uid()
    or approver_id = auth.uid()
  );

create policy approval_requests_insert
  on public.approval_requests for insert to authenticated
  with check (requested_by = auth.uid());

create policy approval_requests_update_approver
  on public.approval_requests for update to authenticated
  using (approver_id = auth.uid() or public.is_uitvoerder())
  with check (approver_id = auth.uid() or public.is_uitvoerder());

-- knowledge_articles
create policy knowledge_articles_select
  on public.knowledge_articles for select to authenticated
  using (published or public.is_uitvoerder());

create policy knowledge_articles_write_uitvoerder
  on public.knowledge_articles for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- inbound_messages / recurring: uitvoerder only (service role for workers)
create policy inbound_messages_uitvoerder
  on public.inbound_messages for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

create policy recurring_templates_uitvoerder
  on public.recurring_ticket_templates for all to authenticated
  using (public.is_uitvoerder())
  with check (public.is_uitvoerder());

-- Grants for authenticated role (RLS still applies; policies gate writes)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert, update, delete on public.ratings to authenticated;
grant select, insert, update on public.comments to authenticated;
grant select, insert, update, delete on public.it_notes to authenticated;
grant select, insert, delete on public.ticket_attachments to authenticated;
grant select, insert on public.ticket_status_events to authenticated;
grant select, insert, update, delete on public.ticket_links to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_deliveries to authenticated;
grant select, insert, delete on public.ticket_watchers to authenticated;
grant select, insert, update, delete on public.ticket_acl to authenticated;
grant select, insert, update, delete on public.sla_policies to authenticated;
grant select, insert, update on public.approval_requests to authenticated;
grant select, insert, update, delete on public.knowledge_articles to authenticated;
grant select, insert, update, delete on public.inbound_messages to authenticated;
grant select, insert, update, delete on public.recurring_ticket_templates to authenticated;
grant select on public.ticket_rating_stats to authenticated;
grant usage, select on sequence public.ticket_nummer_seq to authenticated;
