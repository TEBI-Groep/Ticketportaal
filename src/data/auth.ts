import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { User, UserRole } from "@/lib/types";
import { MOCK_USER } from "@/data/mock";

export type AppUser = User & { afdelingId?: string | null };

/**
 * Current signed-in profile, or mock user when Supabase/env/session is missing.
 */
export async function getCurrentUser(): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    return MOCK_USER;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return MOCK_USER;
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
    return MOCK_USER;
  }
}
