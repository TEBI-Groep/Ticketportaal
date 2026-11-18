# Supabase schema — Ticketportaal

Project: `rlnzhgkdaoewqiilnaaa` (eu-west-1).  
Design: see agent store `docs/database-concept.md`.

## Migrations

Applied in order under `migrations/`:

| File | Contents |
|------|----------|
| `…80000_enums_helpers` | Enums, `set_updated_at`, ticketnummer sequence |
| `…80100_departments_profiles` | Departments, profiles, auth trigger, role helpers |
| `…80200_tickets` | Tickets + eigenaar guard |
| `…80300_ratings_comments_it_notes` | Ratings, stats view, comments, IT notes |
| `…80400_future_tables` | Fase 2–4 tables + status event log |
| `…80500_rls_policies` | RLS + grants (applied remotely as core + future) |
| `…80600_security_guards` | Column guards for profiles/tickets |
| `…80700_harden_functions` | search_path + revoke PUBLIC execute |

## Local / CI

```bash
npx supabase link --project-ref rlnzhgkdaoewqiilnaaa
npx supabase db push
```

Do not commit secrets. App env (see dashboard → Project Settings → API):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://rlnzhgkdaoewqiilnaaa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # publishable / anon key
SUPABASE_SERVICE_ROLE_KEY=      # server-only
```
