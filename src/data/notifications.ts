import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppNotification, NotificationKind } from "@/lib/types";

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
      actorId: typeof payload.actorId === "string" ? payload.actorId : undefined,
      actorNaam:
        typeof payload.actorNaam === "string" ? payload.actorNaam : undefined,
      snippet: typeof payload.snippet === "string" ? payload.snippet : undefined,
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

/** Truncate note body for notification preview. */
export function notificationSnippet(tekst: string, max = 80): string {
  const trimmed = tekst.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
