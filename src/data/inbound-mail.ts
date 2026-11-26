import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushPendingEmailDeliveries } from "@/data/mail";
import { notificationSnippet } from "@/data/notifications";
import { htmlEmailToCommentText } from "@/lib/missive/email-text";
import { getMissiveFromEmail } from "@/lib/missive/env";
import { fetchMissiveMessage } from "@/lib/missive/messages";
import type { MissiveWebhookPayload } from "@/lib/missive/webhook";

const MAX_COMMENT_CHARS = 2000;

export type InboundProcessResult =
  | { ok: true; status: "created" | "duplicate" | "ignored"; detail?: string }
  | { ok: false; error: string };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Phase C: map a Missive incoming_email webhook onto a ticket Update
 * when the conversation is one we opened via ticket_email_threads.
 */
export async function processMissiveIncomingEmail(
  payload: MissiveWebhookPayload,
): Promise<InboundProcessResult> {
  const ruleType = payload.rule?.type;
  if (ruleType && ruleType !== "incoming_email") {
    return { ok: true, status: "ignored", detail: `rule type ${ruleType}` };
  }

  const conversationId = payload.conversation?.id?.trim();
  const latest = payload.latest_message;
  const messageId = latest?.id?.trim();
  if (!conversationId || !latest || !messageId) {
    return {
      ok: true,
      status: "ignored",
      detail: "missing conversation/message",
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." };
  }

  const fromAddress = (latest.from_field?.address ?? "").trim().toLowerCase();
  const fromName = (latest.from_field?.name ?? "").trim();
  const ourFrom = (getMissiveFromEmail() ?? "").toLowerCase();
  if (fromAddress && ourFrom && fromAddress === ourFrom) {
    return { ok: true, status: "ignored", detail: "own outbound address" };
  }

  // Only conversations we already mailed into (Phase A threads).
  const { data: thread, error: threadError } = await admin
    .from("ticket_email_threads")
    .select("ticket_id, user_id")
    .eq("missive_conversation_id", conversationId)
    .limit(1)
    .maybeSingle();

  if (threadError) {
    return { ok: false, error: threadError.message };
  }
  if (!thread?.ticket_id) {
    // Unknown conversation → leave for Phase D (create ticket from inbox).
    return { ok: true, status: "ignored", detail: "no matching ticket thread" };
  }

  const ticketId = thread.ticket_id as string;
  const externalId = messageId;

  // Idempotent audit row.
  const receivedAt = new Date().toISOString();
  const { error: inboundInsertError } = await admin
    .from("inbound_messages")
    .insert({
      channel: "missive",
      external_id: externalId,
      from_address: fromAddress || null,
      subject: latest.subject ?? payload.conversation?.subject ?? null,
      body_text: latest.preview ?? null,
      received_at: receivedAt,
      ticket_id: ticketId,
      status: "pending",
      raw: payload as unknown as Record<string, unknown>,
    });

  if (inboundInsertError) {
    if (inboundInsertError.code === "23505") {
      return { ok: true, status: "duplicate" };
    }
    return { ok: false, error: inboundInsertError.message };
  }

  const full = await fetchMissiveMessage(messageId);
  const rawHtml = full?.body ?? null;
  const previewFallback = latest.preview ?? "";
  let bodyText = htmlEmailToCommentText(rawHtml);
  if (!bodyText) {
    bodyText = previewFallback.trim();
  }
  if (bodyText.length > MAX_COMMENT_CHARS) {
    bodyText = `${bodyText.slice(0, MAX_COMMENT_CHARS - 1)}…`;
  }

  if (!bodyText) {
    await admin
      .from("inbound_messages")
      .update({
        status: "ignored",
        error: "Lege e-mailbody.",
        processed_at: new Date().toISOString(),
        body_text: null,
      })
      .eq("external_id", externalId);
    return { ok: true, status: "ignored", detail: "empty body" };
  }

  // Match portal user by e-mail when possible (null user_id is allowed for email source).
  let userId: string | null = null;
  let auteurNaam = fromName || fromAddress || "E-mail";
  if (fromAddress) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, naam")
      .ilike("email", fromAddress)
      .maybeSingle();
    if (profile) {
      userId = profile.id;
      auteurNaam = profile.naam || auteurNaam;
    }
  }

  const inReplyTo =
    Array.isArray(latest.in_reply_to) && latest.in_reply_to[0]
      ? String(latest.in_reply_to[0])
      : Array.isArray(full?.in_reply_to) && full?.in_reply_to?.[0]
        ? String(full.in_reply_to[0])
        : null;

  const { data: comment, error: commentError } = await admin
    .from("comments")
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      body: bodyText,
      source: "email",
      external_message_id: externalId,
      in_reply_to: inReplyTo,
    })
    .select("id")
    .single();

  if (commentError) {
    if (commentError.code === "23505") {
      await admin
        .from("inbound_messages")
        .update({
          status: "duplicate",
          processed_at: new Date().toISOString(),
          body_text: bodyText,
        })
        .eq("external_id", externalId);
      return { ok: true, status: "duplicate" };
    }
    await admin
      .from("inbound_messages")
      .update({
        status: "failed",
        error: commentError.message.slice(0, 500),
        processed_at: new Date().toISOString(),
        body_text: bodyText,
      })
      .eq("external_id", externalId);
    return { ok: false, error: commentError.message };
  }

  await admin
    .from("inbound_messages")
    .update({
      status: "processed",
      comment_id: comment.id,
      processed_at: new Date().toISOString(),
      body_text: bodyText,
    })
    .eq("external_id", externalId);

  const recipients = await resolveInboundNotifyRecipients(admin, ticketId, userId);
  const snippet = notificationSnippet(bodyText);
  const { data: inserted, error: notifyError } = await admin.rpc(
    "notify_ticket_users_system",
    {
      p_ticket_id: ticketId,
      p_recipient_ids: recipients,
      p_kind: "ticket_comment",
      p_title: `${auteurNaam} plaatste een update`,
      p_body: snippet,
      p_payload: {
        commentId: comment.id,
        actorId: userId,
        actorNaam: auteurNaam,
        snippet,
        source: "email",
      },
      p_actor_id: userId,
      p_include_actor: false,
      p_queue_email: true,
    },
  );

  if (notifyError) {
    console.error("notify_ticket_users_system failed", notifyError.message);
  }

  revalidatePath(`/ticket/${ticketId}`);
  if (typeof inserted === "number" && inserted > 0) {
    revalidatePath("/", "layout");
    await flushPendingEmailDeliveries({ ticketId });
  }

  return { ok: true, status: "created" };
}

/** Watchers ∪ melder ∪ eigenaar − actor, with privé narrowing (admin path). */
async function resolveInboundNotifyRecipients(
  admin: AdminClient,
  ticketId: string,
  actorId: string | null,
): Promise<string[]> {
  const { data: ticket } = await admin
    .from("tickets")
    .select("melder_id, eigenaar_id, vertrouwelijk")
    .eq("id", ticketId)
    .maybeSingle();

  const { data: watchers } = await admin
    .from("ticket_watchers")
    .select("user_id")
    .eq("ticket_id", ticketId);

  const set = new Set<string>((watchers ?? []).map((w) => w.user_id as string));
  if (ticket?.melder_id) set.add(ticket.melder_id as string);
  if (ticket?.eigenaar_id) set.add(ticket.eigenaar_id as string);
  if (actorId) set.delete(actorId);

  if (!ticket?.vertrouwelijk) {
    return [...set];
  }

  // Privé: only Beheerder + melder.
  if (set.size === 0) return [];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, rol")
    .in("id", [...set])
    .eq("actief", true);

  const melderId = (ticket.melder_id as string | null) ?? null;
  return (profiles ?? [])
    .filter(
      (row) =>
        row.rol === "uitvoerder" ||
        (melderId !== null && row.id === melderId),
    )
    .map((row) => row.id as string);
}
