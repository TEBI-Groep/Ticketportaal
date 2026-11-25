import { createAdminClient } from "@/lib/supabase/admin";
import { isMissiveConfigured } from "@/lib/missive/env";
import { sendMissiveEmail } from "@/lib/missive/client";
import { buildNotificationEmail } from "@/lib/mail/templates";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  prefersEmailForKind,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

type PendingDeliveryRow = {
  id: string;
  notification_id: string;
  notifications: {
    id: string;
    user_id: string;
    ticket_id: string | null;
    kind: string;
    title: string;
    body: string | null;
    profiles: { naam: string; email: string } | null;
    tickets: {
      id: string;
      ticketnummer: string;
      onderwerp: string;
    } | null;
  } | null;
};

/**
 * Send pending email deliveries (Missive). Safe no-op when Missive/env missing.
 * Prefer calling after notifyTicketUsers / ticket create.
 */
export async function flushPendingEmailDeliveries(options?: {
  ticketId?: string;
  limit?: number;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  const admin = createAdminClient();
  if (!admin) {
    return result;
  }

  if (!isMissiveConfigured()) {
    // Mark current pending rows skipped so they don’t clog the queue offline.
    let skipQuery = admin
      .from("notification_deliveries")
      .update({
        status: "skipped",
        error: "Missive is niet geconfigureerd (MISSIVE_API_TOKEN / FROM).",
      })
      .eq("channel", "email")
      .eq("status", "pending");

    if (options?.ticketId) {
      const { data: notifIds } = await admin
        .from("notifications")
        .select("id")
        .eq("ticket_id", options.ticketId);
      const ids = (notifIds ?? []).map((n) => n.id);
      if (ids.length === 0) return result;
      skipQuery = skipQuery.in("notification_id", ids);
    }

    const { data: skippedRows } = await skipQuery.select("id");
    result.skipped = skippedRows?.length ?? 0;
    return result;
  }

  let query = admin
    .from("notification_deliveries")
    .select(
      `
      id,
      notification_id,
      notifications!inner (
        id,
        user_id,
        ticket_id,
        kind,
        title,
        body,
        profiles!notifications_user_id_fkey ( naam, email ),
        tickets!notifications_ticket_id_fkey ( id, ticketnummer, onderwerp )
      )
    `,
    )
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 40);

  if (options?.ticketId) {
    query = query.eq("notifications.ticket_id", options.ticketId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("flushPendingEmailDeliveries load failed", error?.message);
    return result;
  }

  for (const row of data as unknown as PendingDeliveryRow[]) {
    const notification = row.notifications;
    const profile = notification?.profiles;
    const ticket = notification?.tickets;

    if (!notification || !profile?.email) {
      await admin
        .from("notification_deliveries")
        .update({
          status: "failed",
          error: "Geen e-mailadres voor ontvanger.",
        })
        .eq("id", row.id);
      result.failed += 1;
      continue;
    }

    // Safety net: skip if the user turned this kind off after queueing.
    const prefs = await loadPreferences(admin, notification.user_id);
    if (!prefersEmailForKind(prefs, notification.kind)) {
      await admin
        .from("notification_deliveries")
        .update({
          status: "skipped",
          error: "Uitgeschakeld in voorkeuren.",
        })
        .eq("id", row.id);
      result.skipped += 1;
      continue;
    }

    let rootSubject: string | null = null;
    let conversationId: string | null = null;

    if (notification.ticket_id) {
      const { data: thread } = await admin
        .from("ticket_email_threads")
        .select("missive_conversation_id, root_subject")
        .eq("ticket_id", notification.ticket_id)
        .eq("user_id", notification.user_id)
        .maybeSingle();
      rootSubject = thread?.root_subject ?? null;
      conversationId = thread?.missive_conversation_id ?? null;
    }

    const content = buildNotificationEmail({
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      ticketId: notification.ticket_id,
      ticketnummer: ticket?.ticketnummer,
      onderwerp: ticket?.onderwerp,
      rootSubject,
    });

    const send = await sendMissiveEmail({
      toEmail: profile.email,
      toName: profile.naam,
      subject: content.subject,
      html: content.html,
      conversationId,
    });

    if (!send.ok) {
      await admin
        .from("notification_deliveries")
        .update({
          status: "failed",
          error: send.error.slice(0, 500),
        })
        .eq("id", row.id);
      result.failed += 1;
      continue;
    }

    await admin
      .from("notification_deliveries")
      .update({
        status: "sent",
        provider_ref: send.conversationId ?? send.draftId,
        sent_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", row.id);

    if (notification.ticket_id) {
      const nextRoot = rootSubject ?? content.subject.replace(/^Re:\s*/i, "");
      await admin.from("ticket_email_threads").upsert(
        {
          ticket_id: notification.ticket_id,
          user_id: notification.user_id,
          missive_conversation_id:
            send.conversationId ?? conversationId ?? null,
          root_subject: nextRoot,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ticket_id,user_id" },
      );
    }

    result.sent += 1;
  }

  return result;
}

/** Load prefs for one user; missing row means all mail kinds on. */
async function loadPreferences(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await admin
    .from("notification_preferences")
    .select(
      "email_ticket_created, email_ticket_status_changed, email_ticket_comment",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    emailTicketCreated: data.email_ticket_created,
    emailTicketStatusChanged: data.email_ticket_status_changed,
    emailTicketComment: data.email_ticket_comment,
  };
}
