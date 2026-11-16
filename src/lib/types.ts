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

export interface User {
  id: string;
  naam: string;
  email: string;
  rol: UserRole;
  afdeling: string;
  /** How many of the max 5 votes this user still has available. */
  stemmenOver: number;
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
  stemmen: number;
  /** Whether the current mock user has voted on this ticket. */
  gestemdDoorMij: boolean;
  createdAt: string;
  updatedAt: string;
  /** Short solution blurb for completed tickets (UI-only for now). */
  oplossingSamenvatting?: string;
}

/** True when voting is allowed: NetSuite + wijziging/idee + not closed. */
export function isStembaar(ticket: Ticket): boolean {
  const open =
    ticket.status !== "afgerond" && ticket.status !== "afgewezen";
  const typeOk = ticket.type === "wijziging" || ticket.type === "idee";
  return open && typeOk && ticket.systeem === "NetSuite";
}
