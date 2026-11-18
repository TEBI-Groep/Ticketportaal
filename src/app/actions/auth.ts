"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function loginAction(
  email: string,
  password: string,
): Promise<{ ok: false; error: string } | { ok: true }> {
  const trimmed = email.trim();
  if (!trimmed || !password) {
    return { ok: false, error: "Vul e-mail en wachtwoord in." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase is niet geconfigureerd (URL / anon key ontbreken op deze omgeving).",
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Inloggen mislukt.",
    };
  }

  redirect("/ranglijst");
}

/** Clear the Auth session and return to login. */
export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Still send the user to login even if sign-out fails.
    }
  }
  redirect("/login");
}
