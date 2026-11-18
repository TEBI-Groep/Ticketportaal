"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** Browser Supabase client (anon key + cookies via @supabase/ssr). */
export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured (URL / anon key missing).");
  }
  return createBrowserClient(url, key);
}
