import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { User, UserRole } from "@/lib/types";
import type { UserBedrijf } from "@/lib/bedrijf";
import { USER_BEDRIJVEN } from "@/lib/bedrijf";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listUitvoerders(): Promise<User[]> {
  const users = await listUsers();
  return users.filter((u) => u.rol === "uitvoerder" && u.actief);
}

function mapUserRow(p: Record<string, unknown>): User {
  const links = (p.profile_departments ?? []) as Array<{
    department_id: string;
    departments: { naam: string } | Array<{ naam: string }> | null;
  }>;
  const afdelingen = [
    ...new Set(
      links
        .map((l) => one(l.departments)?.naam ?? "")
        .filter((n) => n.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  const legacyDept = one(
    p.departments as { naam: string } | Array<{ naam: string }> | null,
  );
  const list =
    afdelingen.length > 0
      ? afdelingen
      : legacyDept?.naam
        ? [legacyDept.naam]
        : [];
  return {
    id: p.id as string,
    naam: p.naam as string,
    email: p.email as string,
    rol: p.rol as UserRole,
    afdeling: list.join(", "),
    afdelingen: list,
    bedrijf: (p.bedrijf as UserBedrijf) ?? "TEBI",
    actief: Boolean(p.actief),
  };
}

export async function listUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    // Load profiles + junction separately (nested embed was ambiguous/failing).
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, naam, email, rol, actief, bedrijf, afdeling_id, departments!profiles_afdeling_id_fkey ( naam )",
      )
      .order("naam");
    if (error || !data) {
      if (error) console.error("listUsers", error.message);
      return [];
    }

    const { data: allLinks, error: linkError } = await supabase
      .from("profile_departments")
      .select("profile_id, department_id, departments ( naam )");
    if (linkError) {
      console.error("listUsers profile_departments", linkError.message);
    }

    const linksByProfile = new Map<
      string,
      Array<{
        department_id: string;
        departments: { naam: string } | Array<{ naam: string }> | null;
      }>
    >();
    for (const row of allLinks ?? []) {
      const pid = row.profile_id as string;
      const list = linksByProfile.get(pid) ?? [];
      list.push({
        department_id: row.department_id as string,
        departments: row.departments as
          | { naam: string }
          | Array<{ naam: string }>
          | null,
      });
      linksByProfile.set(pid, list);
    }

    return data.map((p) =>
      mapUserRow({
        ...(p as Record<string, unknown>),
        profile_departments: linksByProfile.get(p.id) ?? [],
      }),
    );
  } catch {
    return [];
  }
}

export async function listDepartments(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("naam")
      .eq("actief", true)
      .order("naam");
    if (error || !data) return [];
    // Alphabetical (nl) for create form, IT panel, and user admin.
    return data
      .map((d) => d.naam)
      .sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" }));
  } catch {
    return [];
  }
}

/** Resolve department names → ids; requires at least one. */
async function resolveDepartmentIdsByNames(
  names: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const unique = [
    ...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0)),
  ];
  if (unique.length === 0) {
    return { ok: false, error: "Kies minstens één afdeling." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, naam")
    .in("naam", unique)
    .eq("actief", true);
  if (error) return { ok: false, error: error.message };
  const found = data ?? [];
  if (found.length !== unique.length) {
    const known = new Set(found.map((d) => d.naam));
    const missing = unique.filter((n) => !known.has(n));
    return { ok: false, error: `Onbekende afdeling: ${missing.join(", ")}.` };
  }
  return { ok: true, ids: found.map((d) => d.id) };
}

function parseBedrijf(value: string): UserBedrijf | null {
  return (USER_BEDRIJVEN as readonly string[]).includes(value)
    ? (value as UserBedrijf)
    : null;
}

/** Replace profile_departments and sync profiles.afdeling_id (primary). */
async function syncProfileDepartments(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string,
  departmentIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: delError } = await admin
    .from("profile_departments")
    .delete()
    .eq("profile_id", profileId);
  if (delError) return { ok: false, error: delError.message };

  if (departmentIds.length > 0) {
    const { error: insError } = await admin.from("profile_departments").insert(
      departmentIds.map((department_id) => ({
        profile_id: profileId,
        department_id,
      })),
    );
    if (insError) return { ok: false, error: insError.message };
  }

  // Keep legacy FK as the first linked department for Missive / defaults.
  const { error: fkError } = await admin
    .from("profiles")
    .update({ afdeling_id: departmentIds[0] ?? null })
    .eq("id", profileId);
  if (fkError) return { ok: false, error: fkError.message };

  return { ok: true };
}

export interface CreateUserInput {
  naam: string;
  email: string;
  rol: UserRole;
  /** One or more afdelingen. */
  afdelingen: string[];
  bedrijf: UserBedrijf;
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

  const bedrijf = parseBedrijf(input.bedrijf);
  if (!bedrijf) {
    return { ok: false, error: "Kies een geldig bedrijf (TEBI, VK of SPL)." };
  }

  const depts = await resolveDepartmentIdsByNames(input.afdelingen);
  if (!depts.ok) return depts;

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
      bedrijf,
      afdeling_id: depts.ids[0] ?? null,
      actief: input.actief ?? true,
    })
    .eq("id", created.user.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const sync = await syncProfileDepartments(admin, created.user.id, depts.ids);
  if (!sync.ok) return sync;

  const afdelingen = [...input.afdelingen].sort((a, b) =>
    a.localeCompare(b, "nl"),
  );

  return {
    ok: true,
    user: {
      id: created.user.id,
      naam: input.naam,
      email: input.email,
      rol: input.rol,
      afdeling: afdelingen.join(", "),
      afdelingen,
      bedrijf,
      actief: input.actief ?? true,
    },
  };
}

export interface UpdateUserInput {
  id: string;
  naam: string;
  /** New login e-mail; synced to Auth + profiles. */
  email: string;
  rol: UserRole;
  afdelingen: string[];
  bedrijf: UserBedrijf;
  actief: boolean;
}

export async function updateUserAccount(
  input: UpdateUserInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Vul een geldig e-mailadres in." };
  }

  const bedrijf = parseBedrijf(input.bedrijf);
  if (!bedrijf) {
    return { ok: false, error: "Kies een geldig bedrijf (TEBI, VK of SPL)." };
  }

  const depts = await resolveDepartmentIdsByNames(input.afdelingen);
  if (!depts.ok) return depts;

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "supabase_service_role_key ontbreekt — voeg die toe om e-mailadressen te wijzigen.",
    };
  }

  // Current profile e-mail — skip Auth call when unchanged.
  const { data: current, error: currentError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", input.id)
    .maybeSingle();
  if (currentError) {
    return { ok: false, error: currentError.message };
  }
  if (!current) {
    return { ok: false, error: "Gebruiker niet gevonden." };
  }

  const previousEmail = (current.email as string).trim().toLowerCase();
  const emailChanged = previousEmail !== email;

  if (emailChanged) {
    // Block duplicates in profiles before touching Auth.
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", input.id)
      .maybeSingle();
    if (taken?.id) {
      return { ok: false, error: "Dit e-mailadres is al in gebruik." };
    }

    // Auth is source of truth for login; confirm immediately (IT admin change).
    const { error: authError } = await admin.auth.admin.updateUserById(
      input.id,
      {
        email,
        email_confirm: true,
      },
    );
    if (authError) {
      return { ok: false, error: authError.message };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      naam: input.naam,
      email,
      rol: input.rol,
      bedrijf,
      afdeling_id: depts.ids[0] ?? null,
      actief: input.actief,
    })
    .eq("id", input.id);

  if (error) {
    // Best-effort rollback Auth e-mail if profile write fails after Auth change.
    if (emailChanged) {
      await admin.auth.admin.updateUserById(input.id, {
        email: previousEmail,
        email_confirm: true,
      });
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncProfileDepartments(admin, input.id, depts.ids);
  if (!sync.ok) return sync;

  // Stop queued mail and sessions when IT deactivates an account.
  if (!input.actief) {
    const { data: notifIds } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", input.id);
    const ids = (notifIds ?? []).map((n) => n.id);
    if (ids.length > 0) {
      await admin
        .from("notification_deliveries")
        .update({
          status: "skipped",
          error: "Account is inactief.",
        })
        .eq("channel", "email")
        .eq("status", "pending")
        .in("notification_id", ids);
    }
    try {
      await admin.auth.admin.signOut(input.id, "global");
    } catch {
      // Best-effort — profile actief + action gates still block.
    }
  }

  return { ok: true };
}

/**
 * Set / reset an Auth password (no e-mail flow yet).
 * Requires service role — used by uitvoerders in Gebruikersbeheer.
 */
export async function setUserPassword(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { ok: false, error: "Wachtwoord moet minimaal 8 tekens zijn." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "supabase_service_role_key ontbreekt — voeg die toe om wachtwoorden te wijzigen.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Ticket still owned as melder — shown when delete is blocked. */
export type BlockingMelderTicket = {
  id: string;
  ticketnummer: string;
  onderwerp: string;
};

export type DeleteUserResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Present when the user is still melder on one or more tickets. */
      blockingTickets?: BlockingMelderTicket[];
    };

/**
 * Permanently delete an Auth user (+ profile cascade).
 * Blocks when the user is still melder on tickets; cleans other FKs first.
 */
export async function deleteUserAccount(
  userId: string,
  actorId: string,
): Promise<DeleteUserResult> {
  if (userId === actorId) {
    return { ok: false, error: "Je kunt je eigen account niet verwijderen." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "supabase_service_role_key ontbreekt — voeg die toe om accounts te verwijderen.",
    };
  }

  const { data: melderTickets, error: melderError } = await admin
    .from("tickets")
    .select("id, ticketnummer, onderwerp")
    .eq("melder_id", userId)
    .order("ticketnummer", { ascending: true });
  if (melderError) {
    return { ok: false, error: melderError.message };
  }
  if (melderTickets && melderTickets.length > 0) {
    return {
      ok: false,
      error: `Deze gebruiker is melder van ${melderTickets.length} ticket(s). Wijzig eerst de melder op die tickets.`,
      blockingTickets: melderTickets.map((t) => ({
        id: t.id,
        ticketnummer: t.ticketnummer,
        onderwerp: t.onderwerp,
      })),
    };
  }

  // Portal comments require user_id (comments_portal_needs_user). Anonymize
  // those as system comments before clearing the author FK.
  const portalComments = await admin
    .from("comments")
    .update({ user_id: null, source: "system" })
    .eq("user_id", userId)
    .eq("source", "portal");
  if (portalComments.error) {
    return { ok: false, error: portalComments.error.message };
  }

  const otherComments = await admin
    .from("comments")
    .update({ user_id: null })
    .eq("user_id", userId)
    .neq("source", "portal");
  if (otherComments.error) {
    return { ok: false, error: otherComments.error.message };
  }

  const steps: Array<{ error: { message: string } | null }> = [
    await admin
      .from("tickets")
      .update({ eigenaar_id: null })
      .eq("eigenaar_id", userId),
    await admin
      .from("ticket_status_events")
      .update({ changed_by: null })
      .eq("changed_by", userId),
    await admin
      .from("ticket_links")
      .update({ created_by: null })
      .eq("created_by", userId),
    await admin
      .from("knowledge_articles")
      .update({ created_by: null })
      .eq("created_by", userId),
    await admin
      .from("ticket_attachments")
      .update({ uploaded_by: actorId })
      .eq("uploaded_by", userId),
    await admin.from("it_notes").delete().eq("user_id", userId),
    await admin
      .from("approval_requests")
      .delete()
      .or(`requested_by.eq.${userId},approver_id.eq.${userId}`),
  ];

  for (const step of steps) {
    if (step.error) {
      return { ok: false, error: step.error.message };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
