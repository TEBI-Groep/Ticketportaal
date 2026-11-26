/** Bedrijf / company scope for users and tickets. */

/** User-assigned bedrijven (no Bedrijfsbreed). */
export type UserBedrijf = "TEBI" | "VK" | "SPL";

/** Ticket scope: one company or all three. */
export type TicketBedrijf = UserBedrijf | "bedrijfsbreed";

export const USER_BEDRIJVEN: readonly UserBedrijf[] = [
  "TEBI",
  "VK",
  "SPL",
] as const;

export const TICKET_BEDRIJVEN: readonly TicketBedrijf[] = [
  "TEBI",
  "VK",
  "SPL",
  "bedrijfsbreed",
] as const;

/** Dutch labels for selects and tables. */
export const BEDRIJF_LABEL: Record<TicketBedrijf, string> = {
  TEBI: "TEBI",
  VK: "VK",
  SPL: "SPL",
  bedrijfsbreed: "Bedrijfsbreed",
};

/**
 * Afdelingen that always make a ticket Bedrijfsbreed
 * (IT, Marketing, Administratie, Directie, HR, Infra).
 */
export const BEDRIJFSBREED_AFDELINGEN: readonly string[] = [
  "Administratie",
  "Directie",
  "HR",
  "Infra",
  "IT",
  "Marketing",
] as const;

/** True when any selected afdeling forces Bedrijfsbreed. */
export function forcesBedrijfsbreed(afdelingen: string[]): boolean {
  return afdelingen.some((naam) =>
    (BEDRIJFSBREED_AFDELINGEN as readonly string[]).includes(naam),
  );
}

/** Resolve ticket bedrijf from selection + afdelingen rule. */
export function resolveTicketBedrijf(
  selected: TicketBedrijf | string | null | undefined,
  afdelingen: string[],
  fallback: UserBedrijf = "TEBI",
): TicketBedrijf {
  if (forcesBedrijfsbreed(afdelingen)) return "bedrijfsbreed";
  if (
    selected === "TEBI" ||
    selected === "VK" ||
    selected === "SPL" ||
    selected === "bedrijfsbreed"
  ) {
    return selected;
  }
  return fallback;
}
