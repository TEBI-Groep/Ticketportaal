import { createHmac, timingSafeEqual } from "crypto";
import { getMissiveWebhookSecret } from "@/lib/missive/env";

/** Verify Missive X-Hook-Signature (sha256= + HMAC hex of raw body). */
export function verifyMissiveWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getMissiveWebhookSecret();
  if (!secret) {
    // No secret configured — accept (dev / first setup).
    return true;
  }
  if (!signatureHeader) return false;

  // Missive docs: "sha256=" + HMAC hexdigest. Accept any casing on the prefix.
  const normalized = signatureHeader.trim();
  const prefix = "sha256=";
  if (!normalized.toLowerCase().startsWith(prefix)) return false;
  const received = normalized.slice(prefix.length).toLowerCase();
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(received, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type MissiveWebhookPayload = {
  rule?: { id?: string; type?: string; description?: string };
  conversation?: {
    id?: string;
    subject?: string | null;
    latest_message_subject?: string | null;
  };
  latest_message?: {
    id?: string;
    subject?: string | null;
    preview?: string | null;
    type?: string;
    email_message_id?: string | null;
    in_reply_to?: string[] | null;
    from_field?: { name?: string | null; address?: string | null } | null;
  };
  /** Some Missive payloads nest the message under `message`. */
  message?: MissiveWebhookPayload["latest_message"];
};

export function parseMissiveWebhookPayload(
  value: unknown,
): MissiveWebhookPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as MissiveWebhookPayload;
}

/** Prefer latest_message; fall back to message. */
export function getWebhookMessage(
  payload: MissiveWebhookPayload,
): NonNullable<MissiveWebhookPayload["latest_message"]> | null {
  return payload.latest_message ?? payload.message ?? null;
}

/**
 * True when the payload looks like a real conversation event (not rule validation).
 * Message id OR email Message-ID is enough together with a conversation id.
 */
export function isMissiveConversationEvent(
  payload: MissiveWebhookPayload,
): boolean {
  const message = getWebhookMessage(payload);
  return Boolean(
    payload.conversation?.id &&
      (message?.id || message?.email_message_id),
  );
}
