import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { User, UserRole } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listUitvoerders(): Promise<User[]> {
  const users = await listUsers();
  return users.filter((u) => u.rol === "uitvoerder" && u.actief);
}

export async function listUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, naam, email, rol, actief, departments ( naam )")
      .order("naam");
    if (error || !data) return [];
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
      .order("sort_order");
    if (error || !data) return [];
    return data.map((d) => d.naam);
  } catch {
    return [];
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
