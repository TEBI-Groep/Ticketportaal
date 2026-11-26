/** Missive + public app URL helpers (server-only secrets). */

export function getMissiveApiToken(): string | undefined {
  return process.env.MISSIVE_API_TOKEN?.trim() || undefined;
}

/** Must match a Missive email alias on the connected account. */
export function getMissiveFromEmail(): string | undefined {
  return process.env.MISSIVE_FROM_EMAIL?.trim() || undefined;
}

export function getMissiveFromName(): string {
  return process.env.MISSIVE_FROM_NAME?.trim() || "Tebi Ticketportaal";
}

/** Public site origin for ticket deep-links in mail bodies. */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}

/** True when outbound Missive mail can be attempted. */
export function isMissiveConfigured(): boolean {
  return Boolean(getMissiveApiToken() && getMissiveFromEmail());
}

/**
 * Optional HMAC secret for Missive rule webhooks (X-Hook-Signature).
 * When set, real inbound events must present a valid signature.
 */
export function getMissiveWebhookSecret(): string | undefined {
  return process.env.MISSIVE_WEBHOOK_SECRET?.trim() || undefined;
}
