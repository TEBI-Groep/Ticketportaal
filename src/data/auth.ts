import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { User, UserRole } from "@/lib/types";

export type AppUser = User & { afdelingId?: string | null };

/**
 * Current signed-in profile from Supabase Auth + profiles.
 * Returns null when env is missing, there is no session, or the profile is inactive.
 * Cached per request so layout + pages share one lookup.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, naam, email, rol, actief, afdeling_id, departments(naam)")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return {
        id: user.id,
        naam: user.email?.split("@")[0] ?? "Gebruiker",
        email: user.email ?? "",
        rol: "gebruiker",
        afdeling: "",
        actief: true,
      };
    }

    if (!profile.actief) {
      return null;
    }

    const dept = one(profile.departments);

    return {
      id: profile.id,
      naam: profile.naam,
      email: profile.email,
      rol: profile.rol as UserRole,
      afdeling: dept?.naam ?? "",
      afdelingId: profile.afdeling_id,
      actief: profile.actief,
    };
  } catch {
    return null;
  }
});

/** Drop a stale Auth session so middleware does not bounce /login → /ranglijst. */
async function clearSessionQuietly(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore — redirect to login anyway.
  }
}

/** True when Auth has a session but the profile is marked inactive. */
async function hasInactiveSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from("profiles")
      .select("actief")
      .eq("id", user.id)
      .maybeSingle();

    return Boolean(profile && !profile.actief);
  } catch {
    return false;
  }
}

/** Redirect to login when there is no signed-in user. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    // Auth cookie without a usable profile (e.g. inactive) would otherwise
    // loop: requireUser → /login ← middleware (session present) → /ranglijst.
    const inactive = await hasInactiveSession();
    await clearSessionQuietly();
    redirect(inactive ? "/login?reason=inactive" : "/login");
  }
  return user;
}

/** Redirect non-uitvoerders away from IT-only pages. */
export async function requireUitvoerder(): Promise<AppUser> {
  const user = await requireUser();
  if (user.rol !== "uitvoerder") {
    redirect("/ranglijst");
  }
  return user;
}

/**
 * Server-action gate: must be a real Supabase session with uitvoerder rol.
 */
export async function requireUitvoerderAction(): Promise<
  { ok: true; user: AppUser } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Je bent niet ingelogd." };
  }
  if (user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen dit doen." };
  }
  return { ok: true, user };
}
