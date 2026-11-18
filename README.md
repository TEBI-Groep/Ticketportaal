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
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Project-URL (server reads both; browser needs `NEXT_PUBLIC_*` on Vercel) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` | Anon/publishable key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: Auth admin (gebruikers aanmaken) |

Comments, IT-notes and login need URL + anon key. The service-role key is only for creating users. Without URL/anon the UI falls back to mock data and writes show “Supabase is niet geconfigureerd.”

On **Vercel**, set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project → Settings → Environment Variables), then redeploy.

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
- `/ticket/[id]` — detail + comments + IT-notities
- `/gebruikers` — IT: accounts aanmaken/bewerken (uitvoerder)

## Database

Schema + RLS + seed in `supabase/migrations/` (project `rlnzhgkdaoewqiilnaaa`, eu-west-1).
