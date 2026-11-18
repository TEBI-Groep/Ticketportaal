/** Shared env helpers — never throw at import time so builds without secrets still work. */

/**
 * Project URL. Prefers NEXT_PUBLIC_* (browser + server); falls back to server-only
 * `SUPABASE_URL` (Cursor secrets / Vercel server env).
 */
export function getSupabaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    undefined
  );
}

/**
 * Anon / publishable key. Prefers NEXT_PUBLIC_*; falls back to server-only
 * `SUPABASE_ANON_KEY` for server actions and SSR.
 */
export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/**
 * Server-only privileged key for Auth admin (create users).
 * Cursor secrets require UPPERCASE names.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.supabase_service_role_key?.trim() ||
    undefined
  );
}

/** True when a service-role key is present (never logs the value). */
export function hasSupabaseServiceRoleKey(): boolean {
  return Boolean(getSupabaseServiceRoleKey());
}

/** URL + anon key available for server-side Supabase clients. */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
