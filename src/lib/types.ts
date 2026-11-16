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

/** One person’s rating on a ticket (shown in the beoordelingen breakdown). */
export interface TicketRating {
  userId: string;
  naam: string;
  afdeling: string;
  score: StarScore;
}

/** Public comment on a ticket (MVP: one shared thread, no internal split yet). */
export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  auteurNaam: string;
  auteurRol: UserRole;
  tekst: string;
  createdAt: string;
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
  /** Individual ratings; average/count are derived. */
  beoordelingen: TicketRating[];
  createdAt: string;
  updatedAt: string;
  /** Short solution blurb for completed tickets (UI-only for now). */
  oplossingSamenvatting?: string;
}

/** Average of all scores, or 0 when empty. */
export function ratingGemiddelde(ticket: Ticket): number {
  const list = ticket.beoordelingen;
  if (list.length === 0) return 0;
  const sum = list.reduce((acc, r) => acc + r.score, 0);
  return sum / list.length;
}

export function ratingAantal(ticket: Ticket): number {
  return ticket.beoordelingen.length;
}

/** Current user’s score on this ticket, if any. */
export function mijnRating(
  ticket: Ticket,
  userId: string,
): StarScore | null {
  return ticket.beoordelingen.find((r) => r.userId === userId)?.score ?? null;
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
