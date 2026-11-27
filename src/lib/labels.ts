/** Dutch display labels for enums used across list and detail views. */

import type {
  TicketImpact,
  TicketLinkType,
  TicketPriority,
  TicketSize,
  TicketStatus,
  TicketSystem,
  TicketType,
  UserRole,
} from "@/lib/types";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  nieuw: "Nieuw",
  ingepland: "Ingepland",
  in_behandeling: "In behandeling",
  wacht_op_melder: "Wacht op melder",
  wacht_op_publicatie: "Wacht op publicatie",
  afgerond: "Afgerond",
  afgewezen: "Afgewezen",
};

export const TYPE_LABEL: Record<TicketType, string> = {
  storing: "Storing",
  wijziging: "Wijziging",
  vraag: "Vraag",
  idee: "Idee",
  procesverbetering: "Procesverbetering",
};

/** Labels for ticket_links (viewer-oriented for related/duplicate). */
export const LINK_TYPE_LABEL: Record<TicketLinkType, string> = {
  related: "Gerelateerd",
  duplicate: "Duplicaat",
  blocks: "Blokkeert",
  blocked_by: "Geblokkeerd door",
};

/** Ordered systeem choices for create + IT inline edit. */
export const SYSTEM_OPTIONS: readonly TicketSystem[] = [
  "Artikelen",
  "Hardware",
  "Netsuite",
  "Netsuite transportplanning",
  "Netsuite WMS",
  "Outlook",
  "Overig",
  "Software",
  "Telefonie",
  "Ticketportaal",
  "Werkplek",
] as const;

/** Systeem values that count as Netsuite for Ranglijst queries. */
export const NETSUITE_SYSTEM_OPTIONS: readonly TicketSystem[] =
  SYSTEM_OPTIONS.filter((s) => s.toLowerCase().includes("netsuite"));

/** Ordered omvang choices for IT sizing. */
export const SIZE_OPTIONS: readonly TicketSize[] = [
  "S",
  "M",
  "L",
  "XL",
  "XXL",
] as const;

export const IMPACT_LABEL: Record<TicketImpact, string> = {
  stil: "Werk ligt stil",
  hinderlijk: "Hinderlijk",
  wens: "Wens",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  spoed: "Spoed",
  hoog: "Hoog",
  gemiddeld: "Gemiddeld",
  laag: "Laag",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  gebruiker: "Medewerker",
  manager: "Leidinggevende",
  uitvoerder: "Beheerder",
};

/** Format ISO date strings for Dutch UI (day month year). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format ISO datetime for comments / interne notities (date + time). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Join department names for compact list/detail display. */
export function formatAfdelingen(afdelingen: string[]): string {
  if (afdelingen.length === 0) return "—";
  return afdelingen.join(", ");
}
