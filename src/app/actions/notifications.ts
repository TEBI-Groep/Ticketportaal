"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is niet geconfigureerd." };
  }
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
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is niet geconfigureerd." };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }
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
