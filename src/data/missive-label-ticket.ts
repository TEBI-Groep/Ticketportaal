import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  htmlEmailToCommentText,
  stripQuotedReply,
} from "@/lib/missive/email-text";
import { sendMissiveEmail } from "@/lib/missive/client";
import {
  getAppBaseUrl,
  getMissiveFallbackMelderEmail,
  getMissiveFromEmail,
  getMissiveTicketLabel,
} from "@/lib/missive/env";
import { fetchMissiveMessage } from "@/lib/missive/messages";
import { buildNotificationEmail } from "@/lib/mail/templates";
import {
  conversationHasSharedLabel,
  getWebhookMessage,
  type MissiveWebhookPayload,
} from "@/lib/missive/webhook";
import type { InboundProcessResult } from "@/data/inbound-mail";

/** Phase D defaults until IT edits the ticket in the portal. */
const DEFAULT_TYPE = "vraag" as const;
const DEFAULT_SYSTEEM = "Overig" as const;
const DEFAULT_PRIORITEIT = "laag" as const;
const LEGACY_IMPACT = "wens" as const;
const MAX_OMSCHRIJVING = 8000;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Phase D: when the Ticketportaal label is added in Missive, create a ticket
 * from the conversation and reply in-thread with TP-… + open link.
 */
export async function processMissiveLabelToTicket(
  payload: MissiveWebhookPayload,
): Promise<InboundProcessResult> {
  const ruleType = (payload.rule?.type ?? "").toLowerCase();
  const labelName = getMissiveTicketLabel();
  const hasLabel = conversationHasSharedLabel(payload, labelName);
  // Accept label_change and any rule.type containing "label"; otherwise require
  // the Ticketportaal label to already be present on the conversation.
  const looksLikeLabelRule =
    ruleType === "label_change" || ruleType.includes("label");
  if (!looksLikeLabelRule && !hasLabel) {
    return {
      ok: true,
      status: "ignored",
      detail: `not a label create event (rule type ${ruleType || "unknown"})`,
    };
  }
  if (!hasLabel) {
    return {
      ok: true,
      status: "ignored",
      detail: `label ${labelName} not present (likely removed)`,
    };
  }

  const conversationId = payload.conversation?.id?.trim() ?? null;
  const latest = getWebhookMessage(payload);
  const messageId = latest?.id?.trim() || null;
  const emailMessageId = latest?.email_message_id?.trim() || null;
  if (!conversationId) {
    return { ok: true, status: "ignored", detail: "missing conversation" };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." };
  }

  // Already linked → do not create a second ticket for the same thread.
  const existingTicketId = await findTicketIdByConversation(
    admin,
    conversationId,
  );
  if (existingTicketId) {
    return {
      ok: true,
      status: "duplicate",
      detail: `conversation already linked to ${existingTicketId}`,
    };
  }

  // Latest message may be from it@tebi.nl (team inbox reply). Prefer an
  // external conversation author so label→ticket still creates a melder.
  const ourFrom = (getMissiveFromEmail() ?? "").toLowerCase();
  const sender = resolveExternalSender(payload, latest, ourFrom);
  const fromAddress = sender.address;
  const fromName = sender.name;
  if (!fromAddress && ourFrom && (latest?.from_field?.address ?? "").toLowerCase() === ourFrom) {
    return {
      ok: true,
      status: "ignored",
      detail: "own outbound address (no external author)",
    };
  }

  // Inactive portal senders must not create tickets or get confirmation mail.
  if (fromAddress) {
    const { data: senderProfile } = await admin
      .from("profiles")
      .select("id, actief")
      .ilike("email", fromAddress)
      .maybeSingle();
    if (senderProfile && senderProfile.actief === false) {
      return {
        ok: true,
        status: "ignored",
        detail: "inactive sender",
      };
    }
  }

  const subjectRaw =
    latest?.subject ??
    payload.conversation?.latest_message_subject ??
    payload.conversation?.subject ??
    null;
  const onderwerp = cleanSubject(subjectRaw) || "Mail naar ticket";

  const full = messageId ? await fetchMissiveMessage(messageId) : null;
  let bodyText = htmlEmailToCommentText(full?.body ?? null);
  if (!bodyText) {
    bodyText = stripQuotedReply(latest?.preview ?? "");
  }
  if (!bodyText) {
    bodyText = "(Geen berichttekst in de e-mail.)";
  }
  if (bodyText.length > MAX_OMSCHRIJVING) {
    bodyText = `${bodyText.slice(0, MAX_OMSCHRIJVING - 1)}…`;
  }

  const melder = await resolveMelder(admin, fromAddress);
  if (!melder) {
    return {
      ok: false,
      error:
        "Geen melder gevonden (onbekende afzender en geen fallback uitvoerder).",
    };
  }

  // Prefixed when we map an unknown sender onto a fallback melder.
  const omschrijving =
    melder.matchedByEmail || !fromAddress
      ? bodyText
      : `Van: ${fromName || fromAddress} <${fromAddress}>\n\n${bodyText}`;

  const departmentId =
    melder.afdelingId ?? (await firstDepartmentId(admin));
  if (!departmentId) {
    return { ok: false, error: "Geen afdeling beschikbaar voor nieuw ticket." };
  }

  const externalId =
    messageId ??
    (emailMessageId
      ? `email:${emailMessageId}`
      : `label:${conversationId}:${labelName}`);
  const receivedAt = new Date().toISOString();

  // Upsert: the route may already have written a pending audit row for this
  // external_id. Treat only fully processed rows (with ticket_id) as duplicates.
  const { data: existingInbound } = await admin
    .from("inbound_messages")
    .select("status, ticket_id")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingInbound?.ticket_id) {
    return { ok: true, status: "duplicate" };
  }
  if (
    existingInbound?.status === "processed" ||
    existingInbound?.status === "duplicate"
  ) {
    return { ok: true, status: "duplicate" };
  }

  const { error: inboundUpsertError } = await admin
    .from("inbound_messages")
    .upsert(
      {
        channel: "missive",
        external_id: externalId,
        from_address: fromAddress || null,
        subject: subjectRaw,
        body_text: bodyText,
        received_at: receivedAt,
        ticket_id: null,
        status: "pending",
        error: null,
        processed_at: null,
        raw: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "external_id" },
    );

  if (inboundUpsertError) {
    return { ok: false, error: inboundUpsertError.message };
  }

  // Default to melder’s bedrijf; force_bedrijfsbreed afdelingen sync via trigger.
  const { data: ticket, error: ticketError } = await admin
    .from("tickets")
    .insert({
      onderwerp,
      omschrijving,
      type: DEFAULT_TYPE,
      systeem: DEFAULT_SYSTEEM,
      impact: LEGACY_IMPACT,
      prioriteit: DEFAULT_PRIORITEIT,
      melder_id: melder.id,
      status: "nieuw",
      vertrouwelijk: false,
      bedrijf: melder.bedrijf,
    })
    .select("id, ticketnummer, onderwerp")
    .single();

  if (ticketError || !ticket) {
    await markInbound(admin, externalId, {
      status: "failed",
      error: (ticketError?.message ?? "Ticket insert failed").slice(0, 500),
      bodyText,
    });
    return {
      ok: false,
      error: ticketError?.message ?? "Ticket aanmaken mislukt.",
    };
  }

  const { error: deptError } = await admin.from("ticket_departments").insert({
    ticket_id: ticket.id,
    department_id: departmentId,
  });
  if (deptError) {
    await admin.from("tickets").delete().eq("id", ticket.id);
    await markInbound(admin, externalId, {
      status: "failed",
      error: deptError.message.slice(0, 500),
      bodyText,
    });
    return { ok: false, error: deptError.message };
  }

  // Melder watches their ticket so later Updates keep mailing them.
  await admin.from("ticket_watchers").upsert(
    {
      ticket_id: ticket.id,
      user_id: melder.id,
      reason: "melder",
    },
    { onConflict: "ticket_id,user_id" },
  );

  const rootSubject = `[${ticket.ticketnummer}] Ontvangstbevestiging: ${ticket.onderwerp}`;
  await admin.from("ticket_email_threads").upsert(
    {
      ticket_id: ticket.id,
      user_id: melder.id,
      missive_conversation_id: conversationId,
      root_subject: rootSubject,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ticket_id,user_id" },
  );

  // In-app notify only — mail goes via the in-thread Missive reply below.
  await admin.rpc("notify_ticket_users_system", {
    p_ticket_id: ticket.id,
    p_recipient_ids: [melder.id],
    p_kind: "ticket_created",
    p_title: "Je ticket is aangemaakt",
    p_body: null,
    p_payload: {
      actorId: melder.id,
      source: "email_label",
      conversationId,
    },
    p_actor_id: melder.id,
    p_include_actor: true,
    p_queue_email: false,
  });

  const replyTo =
    fromAddress ||
    melder.email ||
    latest?.to_fields?.[0]?.address ||
    "";
  let replyError: string | null = null;
  if (replyTo) {
    const content = buildNotificationEmail({
      kind: "ticket_created",
      title: "Je ticket is aangemaakt",
      body: null,
      ticketId: ticket.id,
      ticketnummer: ticket.ticketnummer,
      onderwerp: ticket.onderwerp,
      rootSubject,
    });
    const send = await sendMissiveEmail({
      toEmail: replyTo,
      toName: fromName || melder.naam,
      subject: content.subject,
      html: content.html,
      conversationId,
    });
    if (!send.ok) {
      replyError = send.error;
      console.error("missive label ticket reply failed", send.error);
    }
  } else {
    replyError = "Geen reply-adres voor ontvangstbevestiging.";
  }

  await markInbound(admin, externalId, {
    status: "processed",
    ticketId: ticket.id,
    bodyText,
    error: replyError,
  });

  revalidatePath(`/ticket/${ticket.id}`);
  revalidatePath("/overzicht");
  revalidatePath("/werkvoorraad");
  revalidatePath("/mijn-tickets");
  revalidatePath("/", "layout");

  return {
    ok: true,
    status: "created",
    detail: `${ticket.ticketnummer} (${getAppBaseUrl()}/ticket/${ticket.id})`,
  };
}

/**
 * Prefer a non-Missive author for melder. Team-inbox threads often have
 * latest_message.from_field = it@tebi.nl even when the request came from a colleague.
 */
function resolveExternalSender(
  payload: MissiveWebhookPayload,
  latest: ReturnType<typeof getWebhookMessage>,
  ourFrom: string,
): { address: string; name: string } {
  const candidates: Array<{ address: string; name: string }> = [];

  for (const author of payload.conversation?.authors ?? []) {
    const address = (author.address ?? "").trim().toLowerCase();
    if (!address) continue;
    candidates.push({
      address,
      name: (author.name ?? "").trim(),
    });
  }

  const latestAddress = (latest?.from_field?.address ?? "").trim().toLowerCase();
  if (latestAddress) {
    candidates.unshift({
      address: latestAddress,
      name: (latest?.from_field?.name ?? "").trim(),
    });
  }

  const external = candidates.find((c) => !ourFrom || c.address !== ourFrom);
  if (external) return external;
  return { address: latestAddress, name: (latest?.from_field?.name ?? "").trim() };
}

async function findTicketIdByConversation(
  admin: AdminClient,
  conversationId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("ticket_email_threads")
    .select("ticket_id")
    .eq("missive_conversation_id", conversationId)
    .limit(1)
    .maybeSingle();
  return (data?.ticket_id as string | undefined) ?? null;
}

/** Match sender to a profile; otherwise fallback uitvoerder / configured email. */
async function resolveMelder(
  admin: AdminClient,
  fromAddress: string,
): Promise<{
  id: string;
  email: string;
  naam: string;
  afdelingId: string | null;
  bedrijf: "TEBI" | "VK" | "SPL";
  matchedByEmail: boolean;
} | null> {
  if (fromAddress) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, naam, afdeling_id, actief, bedrijf")
      .ilike("email", fromAddress)
      .maybeSingle();
    if (profile?.id && profile.actief !== false) {
      return {
        id: profile.id as string,
        email: (profile.email as string) ?? fromAddress,
        naam: (profile.naam as string) ?? fromAddress,
        afdelingId: (profile.afdeling_id as string | null) ?? null,
        bedrijf: (profile.bedrijf as "TEBI" | "VK" | "SPL") ?? "TEBI",
        matchedByEmail: true,
      };
    }
  }

  const fallbackEmail = getMissiveFallbackMelderEmail();
  if (fallbackEmail) {
    const { data: fallback } = await admin
      .from("profiles")
      .select("id, email, naam, afdeling_id, actief, bedrijf")
      .ilike("email", fallbackEmail)
      .eq("actief", true)
      .maybeSingle();
    if (fallback?.id) {
      return {
        id: fallback.id as string,
        email: (fallback.email as string) ?? fallbackEmail,
        naam: (fallback.naam as string) ?? fallbackEmail,
        afdelingId: (fallback.afdeling_id as string | null) ?? null,
        bedrijf: (fallback.bedrijf as "TEBI" | "VK" | "SPL") ?? "TEBI",
        matchedByEmail: false,
      };
    }
  }

  const { data: uitvoerder } = await admin
    .from("profiles")
    .select("id, email, naam, afdeling_id, bedrijf")
    .eq("rol", "uitvoerder")
    .eq("actief", true)
    .order("email", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!uitvoerder?.id) return null;
  return {
    id: uitvoerder.id as string,
    email: (uitvoerder.email as string) ?? "",
    naam: (uitvoerder.naam as string) ?? "IT",
    afdelingId: (uitvoerder.afdeling_id as string | null) ?? null,
    bedrijf: (uitvoerder.bedrijf as "TEBI" | "VK" | "SPL") ?? "TEBI",
    matchedByEmail: false,
  };
}

async function firstDepartmentId(admin: AdminClient): Promise<string | null> {
  const { data } = await admin
    .from("departments")
    .select("id")
    .eq("actief", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Strip Re:/Fwd: noise so onderwerp stays readable. */
function cleanSubject(subject: string | null): string {
  if (!subject) return "";
  return subject
    .replace(/^(?:(?:re|fw|fwd|aw|sv)\s*:\s*)+/i, "")
    .trim();
}

async function markInbound(
  admin: AdminClient,
  externalId: string,
  input: {
    status: string;
    ticketId?: string;
    bodyText?: string;
    error?: string | null;
  },
): Promise<void> {
  await admin
    .from("inbound_messages")
    .update({
      status: input.status,
      ticket_id: input.ticketId ?? null,
      body_text: input.bodyText ?? undefined,
      error: input.error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("external_id", externalId);
}
