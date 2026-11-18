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

Zonder env-keys valt de app terug op lokale mockdata (shell-demo).

## Env

| Variabele | Waarvoor |
|-----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (RLS) |
| `supabase_service_role_key` | Server-only: Auth admin (gebruikers aanmaken). Uppercase `SUPABASE_SERVICE_ROLE_KEY` also works locally/Vercel. |

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
- `/spoed` — urgente storingen
- `/mijn-tickets` — eigen open tickets
- `/afgerond` — gesloten tickets
- `/ticket/nieuw` — aanmaakformulier (UI; opslag volgt)
- `/ticket/[id]` — detail + comments + IT-notities
- `/gebruikers` — IT: accounts aanmaken/bewerken (uitvoerder)

## Database

Schema + RLS + seed in `supabase/migrations/` (project `rlnzhgkdaoewqiilnaaa`, eu-west-1).
