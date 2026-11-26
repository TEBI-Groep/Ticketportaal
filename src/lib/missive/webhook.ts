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
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const received = signatureHeader.slice("sha256=".length).toLowerCase();
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
  conversation?: { id?: string; subject?: string | null };
  latest_message?: {
    id?: string;
    subject?: string | null;
    preview?: string | null;
    type?: string;
    email_message_id?: string | null;
    in_reply_to?: string[] | null;
    from_field?: { name?: string | null; address?: string | null } | null;
  };
};

export function parseMissiveWebhookPayload(
  value: unknown,
): MissiveWebhookPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as MissiveWebhookPayload;
}

/** True when the payload looks like a real conversation event (not rule validation). */
export function isMissiveConversationEvent(
  payload: MissiveWebhookPayload,
): boolean {
  return Boolean(payload.conversation?.id && payload.latest_message?.id);
}
