import { NextResponse } from "next/server";
import { processMissiveIncomingEmail } from "@/data/inbound-mail";
import { processMissiveLabelToTicket } from "@/data/missive-label-ticket";
import {
  getMissiveTicketLabel,
  getMissiveWebhookSecret,
} from "@/lib/missive/env";
import {
  isMissiveConversationEvent,
  parseMissiveWebhookPayload,
  verifyMissiveWebhookSignature,
} from "@/lib/missive/webhook";

/**
 * Missive rule webhook:
 * - Phase C: incoming_email → comment on linked ticket
 * - Phase D: label_change (Ticketportaal label) → create ticket
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let json: unknown = null;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseMissiveWebhookPayload(json);
  // Label-change may omit a full message payload; conversation id is enough for Phase D.
  const isLabelEvent = Boolean(
    payload?.rule?.type === "label_change" && payload.conversation?.id,
  );
  const isEvent = payload
    ? isMissiveConversationEvent(payload) || isLabelEvent
    : false;
  const signature = request.headers.get("x-hook-signature");
  const secret = getMissiveWebhookSecret();

  // Validation POSTs when saving a rule may omit the signature; require it for real events.
  if (secret) {
    if (signature) {
      if (!verifyMissiveWebhookSignature(rawBody, signature)) {
        console.error("missive webhook invalid signature", {
          hasSecret: true,
          signaturePrefix: signature.slice(0, 12),
          bodyBytes: rawBody.length,
          isEvent,
        });
        return NextResponse.json(
          { ok: false, error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else if (isEvent) {
      console.error("missive webhook missing signature on event", {
        conversationId: payload?.conversation?.id ?? null,
        ruleType: payload?.rule?.type ?? null,
      });
      return NextResponse.json(
        { ok: false, error: "Missing signature" },
        { status: 401 },
      );
    }
  }

  // Rule-save validation (or empty ping): accept quickly.
  if (!payload || !isEvent) {
    return NextResponse.json({ ok: true, status: "validated" });
  }

  try {
    const ruleType = payload.rule?.type ?? null;
    const result =
      ruleType === "label_change"
        ? await processMissiveLabelToTicket(payload)
        : await processMissiveIncomingEmail(payload);
    console.info("missive inbound result", {
      status: result.ok ? result.status : "error",
      detail: result.ok ? result.detail : result.error,
      conversationId: payload.conversation?.id ?? null,
      ruleType,
    });
    if (!result.ok) {
      // Return 200 so Missive does not disable the rule on transient app errors;
      // failures are stored on inbound_messages when possible.
      return NextResponse.json({ ok: false, error: result.error });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("missive inbound threw", err);
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Webhook failed",
    });
  }
}

/** Health check for ops / Missive rule save probes that use GET. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "missive-webhook",
    secretConfigured: Boolean(getMissiveWebhookSecret()),
    ticketLabel: getMissiveTicketLabel(),
  });
}
