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

/** Deploy marker so we can confirm production has this build. */
const WEBHOOK_BUILD = "label-from-author-v1";

/**
 * Missive rule webhook:
 * - Phase C: incoming_email → comment on linked ticket
 * - Phase D: label_change (Ticketportaal label) → create ticket
 *
 * Every real-looking POST is audited to inbound_messages first, so Missive
 * “Rule triggered a webhook” can never look like a silent no-op again.
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
  const ruleType = (payload?.rule?.type ?? "").toLowerCase();
  const hasTicketLabel = payload
    ? conversationHasSharedLabel(payload, ticketLabel)
    : false;

  // Phase D if Missive says label_change, or any non-incoming rule that already
  // carries the Ticketportaal label (covers alternate type strings).
  const usePhaseD =
    ruleType === "label_change" ||
    ruleType.includes("label") ||
    (hasTicketLabel && ruleType !== "" && ruleType !== "incoming_email");

  const isLabelEvent = Boolean(payload?.conversation?.id && usePhaseD);
  const isEvent = payload
    ? isMissiveConversationEvent(payload) ||
      isLabelEvent ||
      // Any POST that names a rule + conversation is treated as real traffic.
      Boolean(payload.rule?.id && payload.conversation?.id)
    : false;
  const signature = request.headers.get("x-hook-signature");
  const secret = getMissiveWebhookSecret();

  console.info("missive webhook received", {
    build: WEBHOOK_BUILD,
    isEvent,
    usePhaseD,
    ruleType: payload?.rule?.type ?? null,
    ruleId: payload?.rule?.id ?? null,
    conversationId: payload?.conversation?.id ?? null,
    hasSignature: Boolean(signature),
    secretConfigured: Boolean(secret),
    labelNames: payload?.conversation?.shared_label_names ?? null,
    bodyBytes: rawBody.length,
    topKeys:
      json && typeof json === "object" ? Object.keys(json as object) : [],
  });

  // Audit before signature checks so rejects are still visible in the DB.
  if (payload && (isEvent || payload.rule?.id || payload.conversation?.id)) {
    await auditWebhookReceipt(payload, {
      status: "pending",
      error: null,
    });
  }

  // Validation POSTs when saving a rule may omit the signature; require it for real events.
  if (secret) {
    if (signature) {
      if (!verifyMissiveWebhookSignature(rawBody, signature)) {
        console.error("missive webhook invalid signature", {
          build: WEBHOOK_BUILD,
          signaturePrefix: signature.slice(0, 12),
          bodyBytes: rawBody.length,
          isEvent,
          ruleType: payload?.rule?.type ?? null,
        });
        if (payload) {
          await auditWebhookReceipt(payload, {
            status: "failed",
            error: "Invalid signature",
          });
        }
        return NextResponse.json(
          { ok: false, error: "Invalid signature", build: WEBHOOK_BUILD },
          { status: 401 },
        );
      }
    } else if (isEvent) {
      console.error("missive webhook missing signature on event", {
        build: WEBHOOK_BUILD,
        conversationId: payload?.conversation?.id ?? null,
        ruleType: payload?.rule?.type ?? null,
      });
      if (payload) {
        await auditWebhookReceipt(payload, {
          status: "failed",
          error:
            "Missing signature — set Signature secret on the Missive rule (same value as MISSIVE_WEBHOOK_SECRET)",
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing signature — set Signature secret on the Missive rule (same value as MISSIVE_WEBHOOK_SECRET)",
          build: WEBHOOK_BUILD,
        },
        { status: 401 },
      );
    }
  }

  // Rule-save validation (or empty ping): accept quickly.
  if (!payload || !isEvent) {
    return NextResponse.json({
      ok: true,
      status: "validated",
      build: WEBHOOK_BUILD,
    });
  }

  try {
    const result = usePhaseD
      ? await processMissiveLabelToTicket(payload)
      : await processMissiveIncomingEmail(payload);
    console.info("missive inbound result", {
      build: WEBHOOK_BUILD,
      status: result.ok ? result.status : "error",
      detail: result.ok ? result.detail : result.error,
      conversationId: payload.conversation?.id ?? null,
      ruleType: payload.rule?.type ?? null,
      usePhaseD,
    });
    // Finalize the pre-insert audit row when handlers return ignored/duplicate
    // without updating it (avoids stuck "pending").
    if (result.ok && (result.status === "ignored" || result.status === "duplicate")) {
      await auditWebhookReceipt(payload, {
        status: result.status,
        error: result.detail ?? null,
      });
    } else if (!result.ok) {
      await auditWebhookReceipt(payload, {
        status: "failed",
        error: result.error,
      });
    }
    if (!result.ok) {
      // Return 200 so Missive does not disable the rule on transient app errors;
      // failures are stored on inbound_messages when possible.
      return NextResponse.json({
        ok: false,
        error: result.error,
        build: WEBHOOK_BUILD,
      });
    }
    return NextResponse.json({ ...result, build: WEBHOOK_BUILD });
  } catch (err) {
    console.error("missive inbound threw", err);
    if (payload) {
      await auditWebhookReceipt(payload, {
        status: "failed",
        error: err instanceof Error ? err.message : "Webhook failed",
      });
    }
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Webhook failed",
      build: WEBHOOK_BUILD,
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
    build: WEBHOOK_BUILD,
  });
}

/** Stable external id for audit rows (message id preferred). */
function auditExternalId(payload: MissiveWebhookPayload): string {
  const latest = getWebhookMessage(payload);
  const conversationId = payload.conversation?.id?.trim() || "unknown";
  const messageId = latest?.id?.trim();
  const emailMessageId = latest?.email_message_id?.trim();
  if (messageId) return messageId;
  if (emailMessageId) return `email:${emailMessageId}`;
  // Label-change without a message id: one row per rule+conversation.
  return `rule:${payload.rule?.id ?? "unknown"}:conv:${conversationId}`;
}

/** Upsert a receipt row so every Missive POST is inspectable. */
async function auditWebhookReceipt(
  payload: MissiveWebhookPayload,
  input: { status: string; error: string | null },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const latest = getWebhookMessage(payload);
  await admin.from("inbound_messages").upsert(
    {
      channel: "missive",
      external_id: auditExternalId(payload),
      from_address: latest?.from_field?.address?.trim().toLowerCase() || null,
      subject:
        latest?.subject ??
        payload.conversation?.latest_message_subject ??
        payload.conversation?.subject ??
        null,
      body_text: latest?.preview ?? null,
      received_at: new Date().toISOString(),
      ticket_id: null,
      status: input.status,
      error: input.error ? input.error.slice(0, 500) : null,
      processed_at:
        input.status === "pending" ? null : new Date().toISOString(),
      raw: {
        ...(payload as unknown as Record<string, unknown>),
        _webhook_build: WEBHOOK_BUILD,
        _rule_type: payload.rule?.type ?? null,
        _shared_label_names: payload.conversation?.shared_label_names ?? null,
      },
    },
    { onConflict: "external_id" },
  );
}
