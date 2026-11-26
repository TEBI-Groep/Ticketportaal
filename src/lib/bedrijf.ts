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

/**
 * Ticket bedrijf choices for a user: own company + Bedrijfsbreed only
 * (never the other two companies).
 */
export function allowedTicketBedrijven(
  userBedrijf: UserBedrijf,
): TicketBedrijf[] {
  return [userBedrijf, "bedrijfsbreed"];
}

/** True when value is a known ticket bedrijf. */
export function isTicketBedrijf(
  value: string | null | undefined,
): value is TicketBedrijf {
  return (TICKET_BEDRIJVEN as readonly string[]).includes(value ?? "");
}

/**
 * Create-form rule: only own bedrijf or Bedrijfsbreed
 * (forced afdelingen → Bedrijfsbreed).
 */
export function isAllowedCreateTicketBedrijf(
  selected: TicketBedrijf | string | null | undefined,
  userBedrijf: UserBedrijf,
  afdelingen: string[],
): boolean {
  if (forcesBedrijfsbreed(afdelingen)) {
    return selected === "bedrijfsbreed" || selected == null;
  }
  return selected === "bedrijfsbreed" || selected === userBedrijf;
}

/**
 * Resolve ticket bedrijf from selection + afdelingen rule.
 * Create path: only own + Bedrijfsbreed. Beheer may set any company later.
 */
export function resolveTicketBedrijf(
  selected: TicketBedrijf | string | null | undefined,
  afdelingen: string[],
  userBedrijf: UserBedrijf = "TEBI",
  options?: { allowAnyBedrijf?: boolean },
): TicketBedrijf {
  if (forcesBedrijfsbreed(afdelingen)) return "bedrijfsbreed";
  if (selected === "bedrijfsbreed" || selected === userBedrijf) {
    return selected;
  }
  // Beheer editing a ticket may choose TEBI / VK / SPL / Bedrijfsbreed.
  if (options?.allowAnyBedrijf && isTicketBedrijf(selected)) {
    return selected;
  }
  return userBedrijf;
}
