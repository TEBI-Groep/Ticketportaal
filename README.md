# Ticketportaal · Tebi

Intern IT-ticketportaal (UI-shell). Next.js App Router + TypeScript + CSS variables. Mockdata — nog geen auth/database/API.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Login accepteert elke niet-lege combinatie en landt op **Ranglijst**.

## Scripts

| Commando        | Doel              |
|-----------------|-------------------|
| `npm run dev`   | Development server |
| `npm run build` | Productiebuild     |
| `npm start`     | Start productie    |
| `npm run lint`  | ESLint             |

## Pagina’s (MVP-shell)

- `/login` — inloggen (mock)
- `/ranglijst` — NetSuite-wensen op stemmen (home)
- `/spoed` — urgente storingen
- `/mijn-tickets` — eigen open tickets
- `/afgerond` — gesloten tickets
- `/ticket/nieuw` — aanmaakformulier
- `/ticket/[id]` — detail
- `/gebruikers` — IT: accounts aanmaken/bewerken (alleen uitvoerder)

Planningdocs staan in `docs/`.
