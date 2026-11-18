/** Shared env helpers — never throw at import time so builds without secrets still work. */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined
  );
}

/**
 * Server-only privileged key for Auth admin (create users).
 * Canonical name: `supabase_service_role_key`.
 * Cursor’s secrets UI only accepts UPPERCASE names, so published apps may
 * inject `SUPABASE_SERVICE_ROLE_KEY` — we accept both.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.supabase_service_role_key?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

/** True when a service-role key is present (never logs the value). */
export function hasSupabaseServiceRoleKey(): boolean {
  return Boolean(getSupabaseServiceRoleKey());
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
