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

export function getSupabaseServiceRoleKey(): string | undefined {
  // Cursor app secrets require lowercase names; keep uppercase for local/Vercel.
  return (
    process.env.supabase_service_role_key?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
