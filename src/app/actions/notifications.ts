"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUserAction } from "@/data/auth";
import { createClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  listMyNotifications,
} from "@/data/notifications";
import type { AppNotification } from "@/lib/types";

/** Load inbox items for the shell dropdown (client open). */
export async function listMyNotificationsAction(): Promise<AppNotification[]> {
  return listMyNotifications(25);
}

export async function countUnreadNotificationsAction(): Promise<number> {
  return countUnreadNotifications();
}

/** Mark one notification as read (own row via RLS). */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .is("read_at", null);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Markeren mislukt.",
    };
  }
}

/** Mark every unread notification for the current user as read. */
export async function markAllNotificationsReadAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Markeren mislukt.",
    };
  }
}

/** Permanently remove one of your own notifications. */
export async function deleteNotificationAction(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", user.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verwijderen mislukt.",
    };
  }
}

/** Clear the whole inbox for the current user. */
export async function deleteAllNotificationsAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verwijderen mislukt.",
    };
  }
}
