"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ATTACHMENTS_BUCKET } from "@/data/attachments";
import {
  notifyTicketUsers,
  resolveTicketNotifyRecipients,
} from "@/data/notifications";
import { getTicketById } from "@/data/tickets";
import { STATUS_LABEL } from "@/lib/labels";
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
  /** User-chosen priority on create (default laag in the form). */
  prioriteit: TicketPriority;
  /** Privé: hide from leidinggevenden (maps to vertrouwelijk). */
  prive?: boolean;
}

/** Allowed create-time prioriteit values (rejects forged form input). */
const CREATE_PRIORITIES: readonly TicketPriority[] = [
  "laag",
  "gemiddeld",
  "hoog",
  "spoed",
];

/** Legacy Impact placeholder — column stays NOT NULL; UI no longer collects it. */
const LEGACY_IMPACT_PLACEHOLDER: TicketImpact = "wens";

export interface UpdateTicketItInput {
  id: string;
  type: TicketType;
  systeem: TicketSystem;
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
  /** Privé: hide from leidinggevenden (maps to vertrouwelijk). */
  prive: boolean;
}

/** Partial IT patch for blur-to-save inline editors (merged with current row). */
export type PatchTicketItInput = {
  id: string;
} & Partial<Omit<UpdateTicketItInput, "id">>;

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
  revalidatePath("/overzicht");
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

    // Prefer user-selected prioriteit; fall back to Laag if the value is invalid.
    const prioriteit = CREATE_PRIORITIES.includes(input.prioriteit)
      ? input.prioriteit
      : "laag";

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        onderwerp,
        omschrijving,
        type: input.type,
        systeem: input.systeem,
        // Impact is retired in UX; write a neutral legacy value for NOT NULL.
        impact: LEGACY_IMPACT_PLACEHOLDER,
        prioriteit,
        melder_id: user.id,
        status: "nieuw",
        vertrouwelijk: Boolean(input.prive),
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

/**
 * Save one or more IT fields without resubmitting the whole form.
 * Loads the current ticket, merges the patch, then reuses updateTicketItAction.
 */
export async function patchTicketItAction(
  input: PatchTicketItInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getTicketById(input.id);
  if (!current) {
    return { ok: false, error: "Ticket niet gevonden." };
  }

  return updateTicketItAction({
    id: input.id,
    type: input.type ?? current.type,
    systeem: input.systeem ?? current.systeem,
    status: input.status ?? current.status,
    prioriteit: input.prioriteit ?? current.prioriteit,
    eigenaarId:
      input.eigenaarId !== undefined
        ? input.eigenaarId
        : (current.eigenaarId ?? null),
    melderId: input.melderId ?? current.melderId,
    afdelingen: input.afdelingen ?? current.afdelingen,
    streefdatum:
      input.streefdatum !== undefined
        ? input.streefdatum
        : (current.streefdatum ?? null),
    omvang:
      input.omvang !== undefined ? input.omvang : (current.omvang ?? null),
    oplossingSamenvatting:
      input.oplossingSamenvatting !== undefined
        ? input.oplossingSamenvatting
        : (current.oplossingSamenvatting ?? null),
    onderwerp: input.onderwerp ?? current.onderwerp,
    omschrijving: input.omschrijving ?? current.omschrijving,
    prive: input.prive ?? current.prive,
  });
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
      .select("rol, naam")
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

    // Snapshot before update so we can notify watchers on status change.
    const { data: before } = await supabase
      .from("tickets")
      .select("status, ticketnummer, onderwerp, melder_id, eigenaar_id")
      .eq("id", input.id)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      type: input.type,
      systeem: input.systeem,
      status: input.status,
      prioriteit: input.prioriteit,
      eigenaar_id: input.eigenaarId,
      melder_id: input.melderId,
      streefdatum: input.streefdatum || null,
      omvang: input.omvang,
      oplossing_samenvatting: input.oplossingSamenvatting?.trim() || null,
      vertrouwelijk: Boolean(input.prive),
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

    // Notify subscribers when status changes (in-app now; mail later).
    const previousStatus = before?.status as TicketStatus | undefined;
    if (before && previousStatus && previousStatus !== input.status) {
      const recipients = await resolveTicketNotifyRecipients(
        input.id,
        user.id,
        {
          melderId: input.melderId ?? before.melder_id,
          eigenaarId: input.eigenaarId ?? before.eigenaar_id,
        },
      );
      const actorNaam = profile?.naam ?? "IT";
      const ticketLabel =
        before.ticketnummer && before.onderwerp
          ? `${before.ticketnummer} · ${before.onderwerp}`
          : (before.ticketnummer ?? "Ticket");
      const inserted = await notifyTicketUsers({
        ticketId: input.id,
        recipientIds: recipients,
        kind: "ticket_status_changed",
        title: `${actorNaam} zette status op ${STATUS_LABEL[input.status]}`,
        body: `${ticketLabel} (${STATUS_LABEL[previousStatus]} → ${STATUS_LABEL[input.status]})`,
        payload: {
          actorId: user.id,
          actorNaam,
          fromStatus: previousStatus,
          toStatus: input.status,
        },
      });
      if (inserted > 0) {
        revalidatePath("/", "layout");
      }
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
    revalidatePath("/overzicht");
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
