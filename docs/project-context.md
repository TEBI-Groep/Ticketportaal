# Ticketportaal Tebi — project context

## Goal
Internal web ticket portal so IT requests no longer live in inbox mail and Planner. After go-live, new requests go only through the portal.

## Problem
- Requests are split across IT inbox and Planner; registration is optional and inconsistent
- Managers lack visibility into what IT is working on and cannot influence priority
- Busy periods bury mail; converting mail to Planner tasks feels like overhead

## Success criteria (from opzet)
- All IT requests live in the portal
- Each ticket gets category + status within 2 working days
- Managers can always see a top 10 and current IT work
- NetSuite changes are traceable to a ticket
- After ~3 months, fewer status-chase questions to IT (baseline needed)

## Stack direction
- Next.js + TypeScript web app (PC + mobile)
- SQL database (hosting-dependent); Supabase mentioned as scale option
- Hosting interest: Cloud 86
- Role-based access; APIs authenticated

## Roles
- Gebruiker: view tickets
- Manager: create tickets (and related)
- Uitvoerder (IT): full access

## Core UX
- After login: ranking first; create/vote in ≤3 clicks
- Tebi brand, calm/business look
- Main pages: Ranglijst, Spoed, Mijn tickets, Afgerond

## Must-haves vs later
**Must:** create/edit tickets, status, priority, category  
**Nice:** attachments, week overview  
**Later:** self-submit with manager approval, knowledge base, mail/Teams intake, NetSuite deep links, recurring tasks

## Extra requirements (detail doc)
- Create form: subject, description, department, attachment; type (storing/wijziging/vraag/idee); system (NetSuite/WMS/hardware/Outlook/overig); impact
- Suggest similar tickets to vote instead of duplicates
- IT fields: owner, target date, size (S/M/L), statuses including wait states
- Internal vs requester comments; email/Teams on status change; solution field
- Department views + public planning; confidential tickets
- Voting only on NetSuite change requests/ideas (not outages); limited votes (proposal: 5); advisory only — IT sets final priority
- IT kanban + per-person lists; separate daily vs projects
- SLAs, stale signals, high-impact approval, requester confirm before close
- Reporting: volume, lead time, recurring issues, top-10 NetSuite wishes

## Source files (repo)
- `Opzet ticketportaal.docx`
- `Extra informatie.docx`
