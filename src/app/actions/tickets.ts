"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ATTACHMENTS_BUCKET } from "@/data/attachments";
import type {
  TicketImpact,
  TicketPriority,
  TicketSize,
  TicketStatus,
  TicketSystem,
  TicketType,
} from "@/lib/types";

export interface CreateTicketInput {
  onderwerp: string;
  omschrijving: string;
  afdelingen: string[];
  type: TicketType;
  systeem: TicketSystem;
  impact: TicketImpact;
}

export interface UpdateTicketItInput {
  id: string;
  status: TicketStatus;
  prioriteit: TicketPriority;
  eigenaarId: string | null;
  melderId: string;
  afdelingen: string[];
  streefdatum: string | null;
  omvang: TicketSize | null;
  oplossingSamenvatting: string | null;
  onderwerp?: string;
  omschrijving?: string;
}

function defaultPrioriteit(impact: TicketImpact): TicketPriority {
  if (impact === "stil") return "spoed";
  if (impact === "hinderlijk") return "gemiddeld";
  return "laag";
}

function uniqueNames(names: string[]): string[] {
  return [
    ...new Set(
      names.map((n) => n.trim()).filter((n) => n.length > 0),
    ),
  ];
}

async function resolveDepartmentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  names: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const unique = uniqueNames(names);
  if (unique.length === 0) {
    return { ok: false, error: "Kies minstens één afdeling." };
  }

  const { data: depts, error } = await supabase
    .from("departments")
    .select("id, naam")
    .in("naam", unique);

  if (error) {
    return { ok: false, error: error.message };
  }

  const byName = new Map((depts ?? []).map((d) => [d.naam, d.id]));
  const missing = unique.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    return { ok: false, error: `Onbekende afdeling: ${missing.join(", ")}.` };
  }

  return { ok: true, ids: unique.map((n) => byName.get(n)!) };
}

function revalidateTicketPaths(id: string) {
  revalidatePath(`/ticket/${id}`);
  revalidatePath("/ranglijst");
  revalidatePath("/werkvoorraad");
  revalidatePath("/spoed");
  revalidatePath("/mijn-tickets");
  revalidatePath("/mijn-werk");
  revalidatePath("/afgerond");
}

export async function createTicketAction(
  input: CreateTicketInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const onderwerp = input.onderwerp.trim();
  const omschrijving = input.omschrijving.trim();
  if (!onderwerp || !omschrijving) {
    return { ok: false, error: "Onderwerp en omschrijving zijn verplicht." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "manager" && profile?.rol !== "uitvoerder") {
      return {
        ok: false,
        error: "Alleen managers en uitvoerders mogen tickets aanmaken.",
      };
    }

    const depts = await resolveDepartmentIds(supabase, input.afdelingen);
    if (!depts.ok) return depts;

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        onderwerp,
        omschrijving,
        type: input.type,
        systeem: input.systeem,
        impact: input.impact,
        prioriteit: defaultPrioriteit(input.impact),
        melder_id: user.id,
        status: "nieuw",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Aanmaken mislukt." };
    }

    const { error: linkError } = await supabase.from("ticket_departments").insert(
      depts.ids.map((department_id) => ({
        ticket_id: data.id,
        department_id,
      })),
    );

    if (linkError) {
      await supabase.from("tickets").delete().eq("id", data.id);
      return { ok: false, error: linkError.message };
    }

    // Melder starts watching their own ticket (for future update e-mails).
    await supabase.from("ticket_watchers").insert({
      ticket_id: data.id,
      user_id: user.id,
      reason: "melder",
    });

    revalidateTicketPaths(data.id);
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Aanmaken mislukt.",
    };
  }
}

export async function updateTicketItAction(
  input: UpdateTicketItInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "uitvoerder") {
      return { ok: false, error: "Alleen uitvoerders mogen tickets bewerken." };
    }

    if (!input.melderId) {
      return { ok: false, error: "Kies een melder." };
    }

    const depts = await resolveDepartmentIds(supabase, input.afdelingen);
    if (!depts.ok) return depts;

    const { data: melder } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.melderId)
      .maybeSingle();
    if (!melder?.id) {
      return { ok: false, error: "Onbekende melder." };
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      prioriteit: input.prioriteit,
      eigenaar_id: input.eigenaarId,
      melder_id: input.melderId,
      streefdatum: input.streefdatum || null,
      omvang: input.omvang,
      oplossing_samenvatting: input.oplossingSamenvatting?.trim() || null,
    };

    if (input.onderwerp !== undefined) {
      const onderwerp = input.onderwerp.trim();
      if (!onderwerp) {
        return { ok: false, error: "Onderwerp mag niet leeg zijn." };
      }
      patch.onderwerp = onderwerp;
    }
    if (input.omschrijving !== undefined) {
      const omschrijving = input.omschrijving.trim();
      if (!omschrijving) {
        return { ok: false, error: "Omschrijving mag niet leeg zijn." };
      }
      patch.omschrijving = omschrijving;
    }

    const { error } = await supabase
      .from("tickets")
      .update(patch)
      .eq("id", input.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { error: deleteError } = await supabase
      .from("ticket_departments")
      .delete()
      .eq("ticket_id", input.id);
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    const { error: insertError } = await supabase
      .from("ticket_departments")
      .insert(
        depts.ids.map((department_id) => ({
          ticket_id: input.id,
          department_id,
        })),
      );
    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    revalidateTicketPaths(input.id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}

/**
 * Permanently delete a ticket (IT only) — for false/test tickets.
 * Cascades child rows; clears nullable FKs and storage objects first.
 */
export async function deleteTicketItAction(
  ticketId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "uitvoerder") {
      return { ok: false, error: "Alleen uitvoerders mogen tickets verwijderen." };
    }

    const { data: attachments } = await supabase
      .from("ticket_attachments")
      .select("storage_path")
      .eq("ticket_id", ticketId);
    const paths = (attachments ?? [])
      .map((a) => a.storage_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
    }

    await supabase
      .from("inbound_messages")
      .update({ ticket_id: null })
      .eq("ticket_id", ticketId);
    await supabase
      .from("knowledge_articles")
      .update({ related_ticket_id: null })
      .eq("related_ticket_id", ticketId);

    const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/ranglijst");
    revalidatePath("/werkvoorraad");
    revalidatePath("/spoed");
    revalidatePath("/mijn-tickets");
    revalidatePath("/mijn-werk");
    revalidatePath("/afgerond");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verwijderen mislukt.",
    };
  }
}
