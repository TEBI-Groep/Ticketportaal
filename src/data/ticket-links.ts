import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Ticket, TicketLink, TicketLinkType, TicketStatus } from "@/lib/types";
import { searchSimilarTickets } from "@/data/tickets";

type LinkRow = {
  id: string;
  from_ticket_id: string;
  to_ticket_id: string;
  link_type: TicketLinkType;
  created_at: string;
};

type TicketLite = {
  id: string;
  ticketnummer: string;
  onderwerp: string;
  status: TicketStatus;
};

/** Link kinds exposed in the IT UI. */
export const EDITABLE_LINK_TYPES: TicketLinkType[] = [
  "related",
  "duplicate",
  "parent",
];

/**
 * Links involving this ticket, oriented for display on the open detail.
 */
export async function getLinksForTicket(ticketId: string): Promise<TicketLink[]> {
  if (!isSupabaseConfigured() || !ticketId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_links")
      .select("id, from_ticket_id, to_ticket_id, link_type, created_at")
      .or(`from_ticket_id.eq.${ticketId},to_ticket_id.eq.${ticketId}`)
      .in("link_type", EDITABLE_LINK_TYPES)
      .order("created_at", { ascending: true });
    if (error || !data?.length) return [];

    const rows = data as LinkRow[];
    const otherIds = [
      ...new Set(
        rows.map((row) =>
          row.from_ticket_id === ticketId ? row.to_ticket_id : row.from_ticket_id,
        ),
      ),
    ];
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, ticketnummer, onderwerp, status")
      .in("id", otherIds);
    const byId = new Map(
      ((tickets ?? []) as TicketLite[]).map((t) => [t.id, t]),
    );

    const links: TicketLink[] = [];
    for (const row of rows) {
      const otherId =
        row.from_ticket_id === ticketId ? row.to_ticket_id : row.from_ticket_id;
      const other = byId.get(otherId);
      if (!other) continue;

      // Duplicate: from = duplicate, to = canonical original.
      const otherIsCanonical =
        row.link_type === "duplicate"
          ? row.from_ticket_id === ticketId
          : undefined;
      // Parent: from = hoofdticket, to = onderliggend.
      const otherIsParent =
        row.link_type === "parent"
          ? row.to_ticket_id === ticketId
          : undefined;

      links.push({
        id: row.id,
        linkType: row.link_type,
        otherTicketId: other.id,
        otherTicketnummer: other.ticketnummer,
        otherOnderwerp: other.onderwerp,
        otherStatus: other.status,
        otherIsCanonical,
        otherIsParent,
        createdAt: row.created_at,
      });
    }
    return links;
  } catch {
    return [];
  }
}

/** Search candidates to link (excludes the current ticket). */
export async function searchTicketsForLink(
  query: string,
  currentTicketId: string,
  limit = 8,
): Promise<Ticket[]> {
  const results = await searchSimilarTickets(query, { limit: limit + 3 });
  return results.filter((t) => t.id !== currentTicketId).slice(0, limit);
}
