# Ticketportaal · Tebi

Intern IT-ticketportaal. Next.js App Router + TypeScript + Supabase (Auth + Postgres).

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul keys uit Supabase-dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo-login:** `sara.devries@tebi.nl` / `TebiDemo2026!`

App routes require a Supabase Auth session. Without URL/anon keys, login is the only reachable page.

## Env

| Variabele | Waarvoor |
|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Project-URL (server reads both; browser needs `NEXT_PUBLIC_*` on Vercel) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` | Anon/publishable key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: Auth admin + Missive mail flush (bypasses RLS) |
| `MISSIVE_API_TOKEN` | Missive REST API bearer token (Productive plan) |
| `MISSIVE_FROM_EMAIL` | From-address; must be a Missive alias on that account |
| `MISSIVE_FROM_NAME` | Optional display name (default `Tebi Ticketportaal`) |
| `MISSIVE_WEBHOOK_SECRET` | Optional HMAC secret for inbound Missive webhooks (`X-Hook-Signature`) |
| `MISSIVE_TICKET_LABEL` | Shared Missive label that creates a ticket (default `Ticketportaal`) |
| `MISSIVE_FALLBACK_MELDER_EMAIL` | Optional profile email used as melder when the sender is unknown |
| `APP_BASE_URL` | Public site origin for ticket links in e-mails (e.g. `https://ticketportaal.vercel.app`) |

All ticket and user data comes from Supabase. On **Vercel**, set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project → Settings → Environment Variables), then redeploy.

**Missive Phase A:** ticket create (ontvangstbevestiging), status changes, and Updates & vragen comments queue `notification_deliveries` and send via Missive when the token/from address are set. Without Missive env, deliveries are marked `skipped` and the app keeps working.

**Missive Phase C (reply-by-mail):** replies in an existing ticket conversation create an Updates & vragen comment. Webhook URL: `POST /api/webhooks/missive`. In Missive: Settings → Rules → trigger **Incoming email** → action **Webhook** → that URL (+ optional signature secret = `MISSIVE_WEBHOOK_SECRET`). Only conversations stored in `ticket_email_threads` are imported.

**Missive Phase D (label → ticket):** apply the shared label `Ticketportaal` (or `MISSIVE_TICKET_LABEL`) in Missive. Rule: **User action / label change** (not Incoming email) → condition **Added label name** = that label → **Webhook** → same URL. Use the **same Signature secret** as Phase C (`MISSIVE_WEBHOOK_SECRET`); without it Missive shows “triggered” but the app returns 401. Creates a ticket (defaults: type `vraag`, systeem `Overig`, prioriteit `laag`), links the conversation for Phase C replies, and sends an in-thread ontvangstbevestiging with `TP-…` + Open ticket.

## Scripts

| Commando        | Doel              |
|-----------------|-------------------|
| `npm run dev`   | Development server |
| `npm run build` | Productiebuild     |
| `npm start`     | Start productie    |
| `npm run lint`  | ESLint             |

## Pagina’s

- `/login` — Supabase Auth
- `/ranglijst` — NetSuite-wensen op sterrenrating
- `/werkvoorraad` — open storingen/vragen/overig (IT: alle; overig: eigen)
- `/spoed` — tickets met IT-prioriteit Spoed
- `/mijn-tickets` — tickets die jij hebt aangemaakt
- `/mijn-werk` — IT: tickets waar jij Eigenaar van bent
- `/afgerond` — gesloten tickets
- `/ticket/nieuw` — aanmaakformulier + vergelijkbare-ticket suggesties
- `/ticket/[id]` — detail + bijlagen + comments + IT-notities
- `/gebruikers` — IT: accounts aanmaken/bewerken (uitvoerder)

## Database

Schema + RLS + seed in `supabase/migrations/` (project `rlnzhgkdaoewqiilnaaa`, eu-west-1).
