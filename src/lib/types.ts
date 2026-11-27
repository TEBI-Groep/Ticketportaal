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

export type { TicketBedrijf, UserBedrijf } from "@/lib/bedrijf";

/** Star rating scale: 1 (laag) … 5 (hoog). */
export type StarScore = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  naam: string;
  email: string;
  rol: UserRole;
  /** Display join of afdelingen (comma-separated). */
  afdeling: string;
  /** One or more departments linked to this user. */
  afdelingen: string[];
  /** Company scope for ticket visibility (TEBI / VK / SPL). */
  bedrijf: import("@/lib/bedrijf").UserBedrijf;
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
  /** portal = UI; email = Missive reply-by-mail (Phase C). */
  source?: "portal" | "email" | "system";
  /** Bijlagen uploaded with this update (empty when none). */
  attachments?: TicketAttachment[];
}

/** Beheerder tagged on an IT note. */
export interface ItNoteMention {
  userId: string;
  naam: string;
}

/** One person’s emoji reaction on an IT note (`kind` is the emoji glyph). */
export interface ItNoteReaction {
  userId: string;
  naam: string;
  kind: string;
}

/** Internal IT-only note — never shown to melder/manager in the real app. */
export interface ItNote {
  id: string;
  ticketId: string;
  userId: string;
  auteurNaam: string;
  tekst: string;
  createdAt: string;
  mentions: ItNoteMention[];
  reactions: ItNoteReaction[];
  /** True when the current viewer has reacted. */
  reactedByMe: boolean;
  /** Emoji the current viewer used, if any. */
  myReaction: string | null;
}

/** In-app notification kinds (email reuses create/status/comment in Phase A). */
export type NotificationKind =
  | "it_note_mention"
  | "it_note_reaction"
  | "ticket_created"
  | "ticket_status_changed"
  | "ticket_comment"
  | "ticket_eigenaar_assigned"
  | "ticket_eigenaar_removed";

export interface AppNotification {
  id: string;
  ticketId: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** Extra context for deep-links (noteId, commentId, status, …). */
  payload: {
    noteId?: string;
    commentId?: string;
    actorId?: string;
    actorNaam?: string;
    snippet?: string;
    fromStatus?: TicketStatus;
    toStatus?: TicketStatus;
  };
  readAt: string | null;
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
  /** When set, this file belongs to an Updates & vragen comment. */
  commentId?: string | null;
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
  /** Company scope; Bedrijfsbreed = visible to TEBI, VK and SPL. */
  bedrijf: import("@/lib/bedrijf").TicketBedrijf;
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

/** Types that belong on the public Netsuite list (when other rules match). */
export const RANGLIJST_TYPES: readonly TicketType[] = [
  "wijziging",
  "idee",
  "procesverbetering",
] as const;

/** Alias — preferred name after Ranglijst → Netsuite rename. */
export const NETSUITE_TYPES = RANGLIJST_TYPES;

/** True when the systeem name is a Netsuite variant (contains “Netsuite”). */
export function isNetsuiteSysteem(systeem: string): boolean {
  return systeem.toLowerCase().includes("netsuite");
}

/**
 * Netsuite* wijziging/idee/procesverbetering — belongs on the public Netsuite
 * page when open, not Spoed, and not Privé. Privé tickets stay melder+IT only.
 */
export function isRanglijstKandidaat(ticket: Ticket): boolean {
  const typeOk = (RANGLIJST_TYPES as readonly string[]).includes(ticket.type);
  return (
    typeOk &&
    isNetsuiteSysteem(ticket.systeem) &&
    !ticket.prive &&
    ticket.prioriteit !== "spoed"
  );
}

/** Alias for isRanglijstKandidaat. */
export const isNetsuiteKandidaat = isRanglijstKandidaat;

/** True when rating is allowed: public Netsuite-eligible + open. */
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
