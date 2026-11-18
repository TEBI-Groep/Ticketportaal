"use server";

import { searchSimilarTickets } from "@/data/tickets";
import type { Ticket, TicketSystem } from "@/lib/types";

/** Debounced create-form lookup for possible duplicates. */
export async function searchSimilarTicketsAction(
  query: string,
  systeem?: TicketSystem,
): Promise<Ticket[]> {
  return searchSimilarTickets(query, { systeem, limit: 5 });
}
