/** Shared domain types for the Ticketportaal UI shell (mock-backed). */

export type TicketType = "storing" | "wijziging" | "vraag" | "idee";
export type TicketSystem = "NetSuite" | "WMS" | "hardware" | "Outlook" | "overig";
export type TicketImpact = "stil" | "hinderlijk" | "wens";
export type TicketStatus =
  | "nieuw"
  | "ingepland"
  | "in_behandeling"
  | "wacht_op_melder"
  | "afgerond"
  | "afgewezen";
export type TicketPriority = "spoed" | "voorrang" | "belangrijk" | "normaal";
export type TicketSize = "S" | "M" | "L";
export type UserRole = "gebruiker" | "manager" | "uitvoerder";

/** Star rating scale: 1 (laag) … 5 (hoog). */
export type StarScore = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  naam: string;
  email: string;
  rol: UserRole;
  afdeling: string;
}

export interface Ticket {
  id: string;
  ticketnummer: string;
  onderwerp: string;
  omschrijving: string;
  afdeling: string;
  type: TicketType;
  systeem: TicketSystem;
  impact: TicketImpact;
  status: TicketStatus;
  prioriteit: TicketPriority;
  melderId: string;
  melderNaam: string;
  eigenaarNaam?: string;
  streefdatum?: string;
  omvang?: TicketSize;
  /** Average of all 1–5 ratings (0 if nobody rated yet). */
  ratingGemiddelde: number;
  /** How many people rated this ticket. */
  ratingAantal: number;
  /** Current mock user’s rating, or null if not rated. */
  mijnRating: StarScore | null;
  createdAt: string;
  updatedAt: string;
  /** Short solution blurb for completed tickets (UI-only for now). */
  oplossingSamenvatting?: string;
}

/** True when rating is allowed: NetSuite + wijziging/idee + not closed. */
export function isStembaar(ticket: Ticket): boolean {
  const open =
    ticket.status !== "afgerond" && ticket.status !== "afgewezen";
  const typeOk = ticket.type === "wijziging" || ticket.type === "idee";
  return open && typeOk && ticket.systeem === "NetSuite";
}

/** Display helper: one decimal for averages, e.g. 4.3. */
export function formatRating(avg: number): string {
  if (avg <= 0) return "—";
  return avg.toFixed(1);
}
