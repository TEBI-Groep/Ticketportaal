/** Shared domain types for the Ticketportaal app. */

export type TicketType =
  | "storing"
  | "wijziging"
  | "vraag"
  | "idee"
  | "procesverbetering";
/** Canonical systeem options shown in create + IT edit. */
export type TicketSystem =
  | "Artikelen"
  | "Hardware"
  | "Netsuite"
  | "Netsuite transportplanning"
  | "Netsuite WMS"
  | "Outlook"
  | "Overig"
  | "Software"
  | "Telefonie"
  | "Ticketportaal"
  | "Werkplek";
export type TicketImpact = "stil" | "hinderlijk" | "wens";
export type TicketStatus =
  | "nieuw"
  | "ingepland"
  | "in_behandeling"
  | "wacht_op_melder"
  | "wacht_op_publicatie"
  | "afgerond"
  | "afgewezen";
export type TicketPriority = "spoed" | "hoog" | "gemiddeld" | "laag";
export type TicketSize = "S" | "M" | "L" | "XL" | "XXL";
export type UserRole = "gebruiker" | "manager" | "uitvoerder";

/** Star rating scale: 1 (laag) … 5 (hoog). */
export type StarScore = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  naam: string;
  email: string;
  rol: UserRole;
  afdeling: string;
  /** Soft-disable; inactive users cannot sign in (when auth is wired). */
  actief: boolean;
}

/** One person’s rating on a ticket (shown in the beoordelingen breakdown). */
export interface TicketRating {
  userId: string;
  naam: string;
  afdeling: string;
  score: StarScore;
}

/** Public comment on a ticket (MVP: one shared thread for melder ↔ IT). */
export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  auteurNaam: string;
  auteurRol: UserRole;
  tekst: string;
  createdAt: string;
}

/** Internal IT-only note — never shown to melder/manager in the real app. */
export interface ItNote {
  id: string;
  ticketId: string;
  userId: string;
  auteurNaam: string;
  tekst: string;
  createdAt: string;
}

export type AttachmentKind = "image" | "document" | "other";

/** File attached to a ticket (screenshot, PDF, …). */
export interface TicketAttachment {
  id: string;
  ticketId: string;
  uploadedBy: string;
  uploaderNaam: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  kind: AttachmentKind;
  createdAt: string;
  /** Short-lived signed URL for preview/download (set when listing). */
  url?: string;
}

export interface Ticket {
  id: string;
  ticketnummer: string;
  onderwerp: string;
  omschrijving: string;
  /** One or more departments linked to this ticket. */
  afdelingen: string[];
  type: TicketType;
  systeem: TicketSystem;
  impact: TicketImpact;
  status: TicketStatus;
  prioriteit: TicketPriority;
  melderId: string;
  melderNaam: string;
  eigenaarId?: string;
  eigenaarNaam?: string;
  streefdatum?: string;
  omvang?: TicketSize;
  /** Individual ratings; average/count are derived. */
  beoordelingen: TicketRating[];
  createdAt: string;
  updatedAt: string;
  /** Short solution blurb for completed tickets (UI-only for now). */
  oplossingSamenvatting?: string;
  /** Privé: hidden from leidinggevenden; only melder, IT, eigenaar, ACL. */
  prive: boolean;
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

/**
 * Netsuite wijziging/idee — belongs on the public Ranglijst when open,
 * not Spoed, and not Privé. Privé tickets stay melder+IT only.
 */
export function isRanglijstKandidaat(ticket: Ticket): boolean {
  const typeOk = ticket.type === "wijziging" || ticket.type === "idee";
  return (
    typeOk &&
    ticket.systeem === "Netsuite" &&
    !ticket.prive &&
    ticket.prioriteit !== "spoed"
  );
}

/** True when rating is allowed: public ranglijst-eligible + open. */
export function isStembaar(ticket: Ticket): boolean {
  const open =
    ticket.status !== "afgerond" && ticket.status !== "afgewezen";
  return open && isRanglijstKandidaat(ticket);
}

/** Display helper: one decimal for averages, e.g. 4.3. */
export function formatRating(avg: number): string {
  if (avg <= 0) return "—";
  return avg.toFixed(1);
}
