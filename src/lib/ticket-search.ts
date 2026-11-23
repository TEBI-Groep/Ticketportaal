import type {
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketSystem,
  TicketType,
} from "@/lib/types";

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
    ticket.afdelingen.join(" "),
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

/** Active chip filters — empty set means “all” for that dimension. */
export interface TicketChipFilters {
  systemen: Set<TicketSystem>;
  statussen: Set<TicketStatus>;
  afdelingen: Set<string>;
  types: Set<TicketType>;
  prioriteiten: Set<TicketPriority>;
}

export function emptyChipFilters(): TicketChipFilters {
  return {
    systemen: new Set(),
    statussen: new Set(),
    afdelingen: new Set(),
    types: new Set(),
    prioriteiten: new Set(),
  };
}

export function hasActiveChipFilters(filters: TicketChipFilters): boolean {
  return (
    filters.systemen.size > 0 ||
    filters.statussen.size > 0 ||
    filters.afdelingen.size > 0 ||
    filters.types.size > 0 ||
    filters.prioriteiten.size > 0
  );
}

/** Apply text query + chip filters (AND across dimensions, OR within). */
export function filterTickets(
  tickets: Ticket[],
  query: string,
  chips: TicketChipFilters,
): Ticket[] {
  return filterTicketsByQuery(tickets, query).filter((t) => {
    if (chips.systemen.size > 0 && !chips.systemen.has(t.systeem)) return false;
    if (chips.statussen.size > 0 && !chips.statussen.has(t.status)) return false;
    if (
      chips.afdelingen.size > 0 &&
      !t.afdelingen.some((a) => chips.afdelingen.has(a))
    ) {
      return false;
    }
    if (chips.types.size > 0 && !chips.types.has(t.type)) return false;
    if (chips.prioriteiten.size > 0 && !chips.prioriteiten.has(t.prioriteit)) {
      return false;
    }
    return true;
  });
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "nl"));
}

/** Chip options present in the current list (hide dims with &lt; 2 values). */
export function chipOptionsFromTickets(tickets: Ticket[]) {
  return {
    systemen: uniqueSorted(tickets.map((t) => t.systeem)),
    statussen: uniqueSorted(tickets.map((t) => t.status)),
    afdelingen: uniqueSorted(
      tickets.flatMap((t) => t.afdelingen).filter((a) => a.length > 0),
    ),
    types: uniqueSorted(tickets.map((t) => t.type)),
    prioriteiten: uniqueSorted(tickets.map((t) => t.prioriteit)),
  };
}

/** Escape `%` / `_` for Postgres ILIKE patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
