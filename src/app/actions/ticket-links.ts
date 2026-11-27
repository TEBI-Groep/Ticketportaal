"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUserAction } from "@/data/auth";
import {
  EDITABLE_LINK_TYPES,
  getLinksForTicket,
  searchTicketsForLink,
} from "@/data/ticket-links";
import { createClient } from "@/lib/supabase/server";
import type { Ticket, TicketLink, TicketLinkType } from "@/lib/types";

function isEditableLinkType(value: string): value is TicketLinkType {
  return (EDITABLE_LINK_TYPES as string[]).includes(value);
}

/** Search tickets to link from the detail UI (IT). */
export async function searchTicketsForLinkAction(
  query: string,
  currentTicketId: string,
): Promise<Ticket[]> {
  const gate = await requireActiveUserAction();
  if (!gate.ok || gate.user.rol !== "uitvoerder") return [];
  return searchTicketsForLink(query, currentTicketId);
}

/**
 * Create a related or duplicate link.
 * Duplicate: fromTicketId is the duplicate, toTicketId is the canonical original.
 * Related: stored as from=current → to=other (either direction counts as related).
 */
export async function addTicketLinkAction(input: {
  fromTicketId: string;
  toTicketId: string;
  linkType: TicketLinkType;
}): Promise<{ ok: true; links: TicketLink[] } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  if (gate.user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen tickets koppelen." };
  }

  const { fromTicketId, toTicketId, linkType } = input;
  if (!fromTicketId || !toTicketId) {
    return { ok: false, error: "Kies een ticket om te koppelen." };
  }
  if (fromTicketId === toTicketId) {
    return { ok: false, error: "Een ticket kan niet aan zichzelf gekoppeld worden." };
  }
  if (!isEditableLinkType(linkType)) {
    return { ok: false, error: "Onbekend koppeltype." };
  }

  try {
    const supabase = await createClient();

    // Related is symmetric — block if either direction already exists.
    if (linkType === "related") {
      const { data: existingForward } = await supabase
        .from("ticket_links")
        .select("id")
        .eq("link_type", "related")
        .eq("from_ticket_id", fromTicketId)
        .eq("to_ticket_id", toTicketId)
        .maybeSingle();
      const { data: existingReverse } = await supabase
        .from("ticket_links")
        .select("id")
        .eq("link_type", "related")
        .eq("from_ticket_id", toTicketId)
        .eq("to_ticket_id", fromTicketId)
        .maybeSingle();
      if (existingForward || existingReverse) {
        return { ok: false, error: "Deze tickets zijn al gerelateerd." };
      }
    }

    const { error } = await supabase.from("ticket_links").insert({
      from_ticket_id: fromTicketId,
      to_ticket_id: toTicketId,
      link_type: linkType,
      created_by: gate.user.id,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Deze koppeling bestaat al." };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath(`/ticket/${fromTicketId}`);
    revalidatePath(`/ticket/${toTicketId}`);
    const links = await getLinksForTicket(fromTicketId);
    return { ok: true, links };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Koppelen mislukt.",
    };
  }
}

/** Remove a link; viewerTicketId is used to refresh the list for the open detail. */
export async function removeTicketLinkAction(
  linkId: string,
  viewerTicketId: string,
): Promise<{ ok: true; links: TicketLink[] } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  if (gate.user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen koppelingen verwijderen." };
  }
  if (!linkId) {
    return { ok: false, error: "Koppeling ontbreekt." };
  }

  try {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("ticket_links")
      .select("from_ticket_id, to_ticket_id")
      .eq("id", linkId)
      .maybeSingle();

    const { error } = await supabase
      .from("ticket_links")
      .delete()
      .eq("id", linkId);
    if (error) {
      return { ok: false, error: error.message };
    }

    if (row) {
      revalidatePath(`/ticket/${row.from_ticket_id}`);
      revalidatePath(`/ticket/${row.to_ticket_id}`);
    } else {
      revalidatePath(`/ticket/${viewerTicketId}`);
    }

    const links = await getLinksForTicket(viewerTicketId);
    return { ok: true, links };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verwijderen mislukt.",
    };
  }
}
