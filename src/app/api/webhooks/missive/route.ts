import { NextResponse } from "next/server";
import { processMissiveIncomingEmail } from "@/data/inbound-mail";
import { processMissiveLabelToTicket } from "@/data/missive-label-ticket";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMissiveTicketLabel,
  getMissiveWebhookSecret,
} from "@/lib/missive/env";
import {
  conversationHasSharedLabel,
  getWebhookMessage,
  isMissiveConversationEvent,
  parseMissiveWebhookPayload,
  verifyMissiveWebhookSignature,
  type MissiveWebhookPayload,
} from "@/lib/missive/webhook";

/**
 * Missive rule webhook:
 * - Phase C: incoming_email → comment on linked ticket
 * - Phase D: label_change (Ticketportaal label) → create ticket
 *
 * Both Missive rules must use the same Signature secret as MISSIVE_WEBHOOK_SECRET.
 * Without it, Missive still shows “Rule triggered a webhook” while we return 401.
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
  const ticketLabel = getMissiveTicketLabel();
  // Label-change may omit a full message payload; conversation id is enough for Phase D.
  // Also treat “conversation already has Ticketportaal label” as a label event so a
  // mis-typed rule.type still reaches Phase D instead of silent validation.
  const isLabelEvent = Boolean(
    payload?.conversation?.id &&
      (payload.rule?.type === "label_change" ||
        conversationHasSharedLabel(payload, ticketLabel)),
  );
  const isEvent = payload
    ? isMissiveConversationEvent(payload) || isLabelEvent
    : false;
  const signature = request.headers.get("x-hook-signature");
  const secret = getMissiveWebhookSecret();

  console.info("missive webhook received", {
    isEvent,
    isLabelEvent,
    ruleType: payload?.rule?.type ?? null,
    ruleId: payload?.rule?.id ?? null,
    conversationId: payload?.conversation?.id ?? null,
    hasSignature: Boolean(signature),
    secretConfigured: Boolean(secret),
    labelNames: payload?.conversation?.shared_label_names ?? null,
  });

  // Validation POSTs when saving a rule may omit the signature; require it for real events.
  if (secret) {
    if (signature) {
      if (!verifyMissiveWebhookSignature(rawBody, signature)) {
        console.error("missive webhook invalid signature", {
          hasSecret: true,
          signaturePrefix: signature.slice(0, 12),
          bodyBytes: rawBody.length,
          isEvent,
          ruleType: payload?.rule?.type ?? null,
        });
        if (payload && isEvent) {
          await auditRejectedWebhook(payload, "Invalid signature");
        }
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
      if (payload) {
        await auditRejectedWebhook(
          payload,
          "Missing signature — set the same Signature secret as MISSIVE_WEBHOOK_SECRET on this Missive rule",
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing signature — set Signature secret on the Missive rule (same value as MISSIVE_WEBHOOK_SECRET)",
        },
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
    // Only label_change creates tickets. Incoming mail on a labeled thread must
    // still go through Phase C (reply → comment), even if Ticketportaal stays on.
    const usePhaseD = ruleType === "label_change";
    const result = usePhaseD
      ? await processMissiveLabelToTicket(payload)
      : await processMissiveIncomingEmail(payload);
    console.info("missive inbound result", {
      status: result.ok ? result.status : "error",
      detail: result.ok ? result.detail : result.error,
      conversationId: payload.conversation?.id ?? null,
      ruleType,
      usePhaseD,
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

/**
 * Persist rejected events (e.g. missing signature) so “Rule triggered a webhook”
 * in Missive is visible in inbound_messages instead of looking like a no-op.
 */
async function auditRejectedWebhook(
  payload: MissiveWebhookPayload,
  error: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const latest = getWebhookMessage(payload);
  const conversationId = payload.conversation?.id?.trim() || "unknown";
  const messageId = latest?.id?.trim();
  const emailMessageId = latest?.email_message_id?.trim();
  const externalId =
    messageId ??
    (emailMessageId
      ? `email:${emailMessageId}`
      : `reject:${conversationId}:${payload.rule?.id ?? "rule"}:${Date.now()}`);

  await admin.from("inbound_messages").upsert(
    {
      channel: "missive",
      external_id: externalId,
      from_address: latest?.from_field?.address?.trim().toLowerCase() || null,
      subject:
        latest?.subject ??
        payload.conversation?.latest_message_subject ??
        payload.conversation?.subject ??
        null,
      body_text: latest?.preview ?? null,
      received_at: new Date().toISOString(),
      ticket_id: null,
      status: "failed",
      error: error.slice(0, 500),
      processed_at: new Date().toISOString(),
      raw: payload as unknown as Record<string, unknown>,
    },
    { onConflict: "external_id" },
  );
}
