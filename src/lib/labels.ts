/** Dutch display labels for enums used across list and detail views. */

import type {
  TicketImpact,
  TicketPriority,
  TicketStatus,
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
};

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
  uitvoerder: "Beheerder (IT)",
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
