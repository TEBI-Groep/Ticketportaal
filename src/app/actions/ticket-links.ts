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

/** UI intents — parent/child both store DB link_type = parent. */
export type TicketLinkComposeType =
  | "related"
  | "duplicate"
  | "child"
  | "parent";

function isComposeType(value: string): value is TicketLinkComposeType {
  return (
    value === "related" ||
    value === "duplicate" ||
    value === "child" ||
    value === "parent"
  );
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
 * Create a related, duplicate, or parent/child link.
 * - related: viewer ↔ other
 * - duplicate: viewer is duplicate of other
 * - child: other becomes onderliggend of viewer
 * - parent: other becomes hoofdticket of viewer
 */
export async function addTicketLinkAction(input: {
  viewerTicketId: string;
  otherTicketId: string;
  composeType: TicketLinkComposeType;
}): Promise<{ ok: true; links: TicketLink[] } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  if (gate.user.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen tickets koppelen." };
  }

  const { viewerTicketId, otherTicketId, composeType } = input;
  if (!viewerTicketId || !otherTicketId) {
    return { ok: false, error: "Kies een ticket om te koppelen." };
  }
  if (viewerTicketId === otherTicketId) {
    return { ok: false, error: "Een ticket kan niet aan zichzelf gekoppeld worden." };
  }
  if (!isComposeType(composeType)) {
    return { ok: false, error: "Onbekend koppeltype." };
  }

  let fromTicketId = viewerTicketId;
  let toTicketId = otherTicketId;
  let linkType: TicketLinkType = composeType === "child" || composeType === "parent"
    ? "parent"
    : composeType;

  // Parent DB edge: from = hoofdticket, to = onderliggend.
  if (composeType === "child") {
    fromTicketId = viewerTicketId;
    toTicketId = otherTicketId;
  } else if (composeType === "parent") {
    fromTicketId = otherTicketId;
    toTicketId = viewerTicketId;
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

    if (linkType === "parent") {
      // Child may only have one parent.
      const { data: existingParent } = await supabase
        .from("ticket_links")
        .select("id")
        .eq("link_type", "parent")
        .eq("to_ticket_id", toTicketId)
        .maybeSingle();
      if (existingParent) {
        return {
          ok: false,
          error: "Dit ticket heeft al een hoofdticket.",
        };
      }
      // Avoid obvious one-level cycles (other is already a child of viewer, etc.).
      const { data: reverseParent } = await supabase
        .from("ticket_links")
        .select("id")
        .eq("link_type", "parent")
        .eq("from_ticket_id", toTicketId)
        .eq("to_ticket_id", fromTicketId)
        .maybeSingle();
      if (reverseParent) {
        return {
          ok: false,
          error: "Die koppeling zou een lus maken.",
        };
      }
    }

    if (!(EDITABLE_LINK_TYPES as string[]).includes(linkType)) {
      return { ok: false, error: "Onbekend koppeltype." };
    }

    const { error } = await supabase.from("ticket_links").insert({
      from_ticket_id: fromTicketId,
      to_ticket_id: toTicketId,
      link_type: linkType,
      created_by: gate.user.id,
    });
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error:
            linkType === "parent"
              ? "Dit ticket heeft al een hoofdticket."
              : "Deze koppeling bestaat al.",
        };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath(`/ticket/${fromTicketId}`);
    revalidatePath(`/ticket/${toTicketId}`);
    const links = await getLinksForTicket(viewerTicketId);
    return { ok: true, links };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Koppelen mislukt.",
    };
  }
}

/** Remove a link; viewerTicketId refreshes the open detail list. */
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
