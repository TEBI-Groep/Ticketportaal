import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

type PrefRow = {
  email_ticket_created: boolean;
  email_ticket_status_changed: boolean;
  email_ticket_comment: boolean;
};

function mapPrefs(row: PrefRow | null): NotificationPreferences {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    emailTicketCreated: row.email_ticket_created,
    emailTicketStatusChanged: row.email_ticket_status_changed,
    emailTicketComment: row.email_ticket_comment,
  };
}

/** Load current user’s mail preferences (defaults if no row yet). */
export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  if (!isSupabaseConfigured()) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const { data, error } = await supabase
      .from("notification_preferences")
      .select(
        "email_ticket_created, email_ticket_status_changed, email_ticket_comment",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("getMyNotificationPreferences", error.message);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    return mapPrefs(data as PrefRow | null);
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/** Upsert mail preferences for the signed-in user. */
export async function saveMyNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        email_ticket_created: prefs.emailTicketCreated,
        email_ticket_status_changed: prefs.emailTicketStatusChanged,
        email_ticket_comment: prefs.emailTicketComment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}
