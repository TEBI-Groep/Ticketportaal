import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listWatcherUserIds } from "@/data/watchers";
import type {
  AppNotification,
  NotificationKind,
  TicketStatus,
} from "@/lib/types";

type NotificationRow = {
  id: string;
  ticket_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function mapNotification(row: NotificationRow): AppNotification {
  const payload = (row.payload ?? {}) as AppNotification["payload"];
  return {
    id: row.id,
    ticketId: row.ticket_id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    payload: {
      noteId: typeof payload.noteId === "string" ? payload.noteId : undefined,
      commentId:
        typeof payload.commentId === "string" ? payload.commentId : undefined,
      actorId: typeof payload.actorId === "string" ? payload.actorId : undefined,
      actorNaam:
        typeof payload.actorNaam === "string" ? payload.actorNaam : undefined,
      snippet: typeof payload.snippet === "string" ? payload.snippet : undefined,
      fromStatus:
        typeof payload.fromStatus === "string"
          ? (payload.fromStatus as TicketStatus)
          : undefined,
      toStatus:
        typeof payload.toStatus === "string"
          ? (payload.toStatus as TicketStatus)
          : undefined,
    },
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Unread count for the shell bell badge (own rows only via RLS). */
export async function countUnreadNotifications(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Recent inbox items for the notification dropdown. */
export async function listMyNotifications(
  limit = 20,
): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, ticket_id, kind, title, body, payload, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => mapNotification(row as NotificationRow));
  } catch {
    return [];
  }
}

/** Truncate note/comment body for notification preview. */
export function notificationSnippet(tekst: string, max = 80): string {
  const trimmed = tekst.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export type NotifyPayload = AppNotification["payload"];

/**
 * Recipients for ticket events: watchers ∪ melder ∪ eigenaar − actor.
 * Melder is usually already a watcher; eigenaar often is not.
 */
export async function resolveTicketNotifyRecipients(
  ticketId: string,
  actorId: string,
  extras?: { melderId?: string | null; eigenaarId?: string | null },
): Promise<string[]> {
  const watchers = await listWatcherUserIds(ticketId);
  const set = new Set(watchers);
  if (extras?.melderId) set.add(extras.melderId);
  if (extras?.eigenaarId) set.add(extras.eigenaarId);
  set.delete(actorId);
  return [...set];
}

/**
 * Fan-out via security-definer RPC (works for non-IT commenters too).
 * Also queues email deliveries for Phase A kinds (create / status / comment).
 * Returns how many notification rows were inserted (0 on empty/error).
 */
export async function notifyTicketUsers(input: {
  ticketId: string;
  recipientIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string | null;
  payload?: NotifyPayload;
  /** Include the acting user (ontvangstbevestiging to melder). */
  includeActor?: boolean;
  /** Queue Missive email deliveries (default true for mail-worthy kinds). */
  queueEmail?: boolean;
}): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  if (input.recipientIds.length === 0) return 0;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("notify_ticket_users", {
      p_ticket_id: input.ticketId,
      p_recipient_ids: input.recipientIds,
      p_kind: input.kind,
      p_title: input.title,
      p_body: input.body ?? null,
      p_payload: input.payload ?? {},
      p_include_actor: Boolean(input.includeActor),
      p_queue_email: input.queueEmail !== false,
    });
    if (error) {
      console.error("notify_ticket_users failed", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("notify_ticket_users threw", err);
    return 0;
  }
}
