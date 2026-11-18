import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { User, UserRole } from "@/lib/types";
import { getUsers as mockGetUsers } from "@/data/mock";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listUitvoerders(): Promise<User[]> {
  const users = await listUsers();
  return users.filter((u) => u.rol === "uitvoerder" && u.actief);
}

export async function listUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) return mockGetUsers();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, naam, email, rol, actief, departments ( naam )")
      .order("naam");
    if (error || !data) return mockGetUsers();
    return data.map((p) => {
      const dept = one(p.departments);
      return {
        id: p.id,
        naam: p.naam,
        email: p.email,
        rol: p.rol as UserRole,
        afdeling: dept?.naam ?? "",
        actief: p.actief,
      };
    });
  } catch {
    return mockGetUsers();
  }
}

export async function listDepartments(): Promise<string[]> {
  const { FALLBACK_AFDELINGEN } = await import("@/lib/departments");
  if (!isSupabaseConfigured()) {
    return [...FALLBACK_AFDELINGEN];
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("naam")
      .eq("actief", true)
      .order("sort_order");
    if (error || !data) {
      return [...FALLBACK_AFDELINGEN];
    }
    return data.map((d) => d.naam);
  } catch {
    return [...FALLBACK_AFDELINGEN];
  }
}

export interface CreateUserInput {
  naam: string;
  email: string;
  rol: UserRole;
  afdeling: string;
  wachtwoord: string;
  actief?: boolean;
}

/** Create Auth user + set profile fields. Requires service role. */
export async function createUserAccount(
  input: CreateUserInput,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "supabase_service_role_key ontbreekt — voeg die toe om accounts aan te maken.",
    };
  }

  const supabase = await createClient();
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("naam", input.afdeling)
    .maybeSingle();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.wachtwoord,
    email_confirm: true,
    user_metadata: { naam: input.naam },
  });

  if (createError || !created.user) {
    return { ok: false, error: createError?.message ?? "Aanmaken mislukt" };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      naam: input.naam,
      rol: input.rol,
      afdeling_id: dept?.id ?? null,
      actief: input.actief ?? true,
    })
    .eq("id", created.user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return {
    ok: true,
    user: {
      id: created.user.id,
      naam: input.naam,
      email: input.email,
      rol: input.rol,
      afdeling: input.afdeling,
      actief: input.actief ?? true,
    },
  };
}

export interface UpdateUserInput {
  id: string;
  naam: string;
  rol: UserRole;
  afdeling: string;
  actief: boolean;
}

export async function updateUserAccount(
  input: UpdateUserInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("naam", input.afdeling)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({
      naam: input.naam,
      rol: input.rol,
      afdeling_id: dept?.id ?? null,
      actief: input.actief,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
