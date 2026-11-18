import type { Ticket } from "@/lib/types";

/** Normalize user search text for case-insensitive matching. */
export function normalizeTicketQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the ticket matches a free-text query (nummer, titel, body, meta). */
export function matchesTicketQuery(ticket: Ticket, query: string): boolean {
  const q = normalizeTicketQuery(query);
  if (!q) return true;

  const haystack = [
    ticket.ticketnummer,
    ticket.onderwerp,
    ticket.omschrijving,
    ticket.systeem,
    ticket.afdeling,
    ticket.melderNaam,
    ticket.eigenaarNaam ?? "",
    ticket.oplossingSamenvatting ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return q.split(" ").every((token) => haystack.includes(token));
}

export function filterTicketsByQuery(
  tickets: Ticket[],
  query: string,
): Ticket[] {
  const q = normalizeTicketQuery(query);
  if (!q) return tickets;
  return tickets.filter((t) => matchesTicketQuery(t, q));
}

/** Escape `%` / `_` for Postgres ILIKE patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
