"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUserAction } from "@/data/auth";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET } from "@/data/attachments";
import { flushPendingEmailDeliveries } from "@/data/mail";
import {
  notifyTicketUsers,
  resolveTicketNotifyRecipients,
} from "@/data/notifications";
import { getTicketById } from "@/data/tickets";
import {
  resolveTicketBedrijf,
  type TicketBedrijf,
  type UserBedrijf,
} from "@/lib/bedrijf";
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
  /** Company scope; forced to Bedrijfsbreed for certain afdelingen. */
  bedrijf?: TicketBedrijf;
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
  /** Company scope; forced to Bedrijfsbreed for certain afdelingen. */
  bedrijf: TicketBedrijf;
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
  revalidatePath("/netsuite");
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

  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  if (user.rol !== "manager" && user.rol !== "uitvoerder") {
    return {
      ok: false,
      error: "Alleen managers en uitvoerders mogen tickets aanmaken.",
    };
  }

  try {
    const supabase = await createClient();

    const depts = await resolveDepartmentIds(supabase, input.afdelingen);
    if (!depts.ok) return depts;

    // Prefer user-selected prioriteit; fall back to Laag if the value is invalid.
    const prioriteit = CREATE_PRIORITIES.includes(input.prioriteit)
      ? input.prioriteit
      : "laag";

    const bedrijf = resolveTicketBedrijf(
      input.bedrijf,
      input.afdelingen,
      (user.bedrijf as UserBedrijf) ?? "TEBI",
    );

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
        bedrijf,
      })
      .select("id, ticketnummer, onderwerp")
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

    // Melder starts watching their own ticket (for update e-mails).
    await supabase.from("ticket_watchers").insert({
      ticket_id: data.id,
      user_id: user.id,
      reason: "melder",
    });

    // Ontvangstbevestiging (in-app + Missive mail when configured).
    await notifyTicketUsers({
      ticketId: data.id,
      recipientIds: [user.id],
      kind: "ticket_created",
      title: "Je ticket is aangemaakt",
      // No body — mail already shows ticketnummer · onderwerp.
      body: null,
      includeActor: true,
      payload: { actorId: user.id },
    });
    await flushPendingEmailDeliveries({ ticketId: data.id });

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
    bedrijf: input.bedrijf ?? current.bedrijf,
  });
}

export async function updateTicketItAction(
  input: UpdateTicketItInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  if (user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen tickets bewerken." };
  }

  try {
    const supabase = await createClient();
    const profile = { rol: user.rol, naam: user.naam };

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

    const bedrijf = resolveTicketBedrijf(
      input.bedrijf,
      input.afdelingen,
      "TEBI",
    );

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
      bedrijf,
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

    let notified = false;
    const actorNaam = profile?.naam ?? "IT";
    const ticketLabel = before
      ? before.ticketnummer && before.onderwerp
        ? `${before.ticketnummer} · ${before.onderwerp}`
        : (before.ticketnummer ?? "Ticket")
      : "Ticket";

    // Notify subscribers when status changes (in-app + Missive mail).
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
      const inserted = await notifyTicketUsers({
        ticketId: input.id,
        recipientIds: recipients,
        kind: "ticket_status_changed",
        title: `${actorNaam} zette status op ${STATUS_LABEL[input.status]}`,
        // Status transition only — mail template already shows ticketnummer · onderwerp.
        body: `${STATUS_LABEL[previousStatus]} → ${STATUS_LABEL[input.status]}`,
        payload: {
          actorId: user.id,
          actorNaam,
          fromStatus: previousStatus,
          toStatus: input.status,
        },
      });
      if (inserted > 0) notified = true;
    }

    // Notify Beheerders when eigenaar is assigned or taken away.
    const previousEigenaarId = before?.eigenaar_id ?? null;
    const nextEigenaarId = input.eigenaarId ?? null;
    if (previousEigenaarId !== nextEigenaarId) {
      if (nextEigenaarId && nextEigenaarId !== user.id) {
        const inserted = await notifyTicketUsers({
          ticketId: input.id,
          recipientIds: [nextEigenaarId],
          kind: "ticket_eigenaar_assigned",
          title: `${actorNaam} maakte je eigenaar`,
          body: ticketLabel,
          payload: {
            actorId: user.id,
            actorNaam,
          },
        });
        if (inserted > 0) notified = true;
      }
      if (previousEigenaarId && previousEigenaarId !== user.id) {
        const inserted = await notifyTicketUsers({
          ticketId: input.id,
          recipientIds: [previousEigenaarId],
          kind: "ticket_eigenaar_removed",
          title: `${actorNaam} verwijderde je als eigenaar`,
          body: ticketLabel,
          payload: {
            actorId: user.id,
            actorNaam,
          },
        });
        if (inserted > 0) notified = true;
      }
    }

    if (notified) {
      revalidatePath("/", "layout");
      // Status-change deliveries (eigenaar kinds stay in-app only in Phase A).
      await flushPendingEmailDeliveries({ ticketId: input.id });
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
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;

  if (gate.user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen tickets verwijderen." };
  }

  try {
    const supabase = await createClient();

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
