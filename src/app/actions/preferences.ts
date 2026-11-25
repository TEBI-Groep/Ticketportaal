"use server";

import { revalidatePath } from "next/cache";
import { saveMyNotificationPreferences } from "@/data/preferences";
import type { NotificationPreferences } from "@/lib/notification-preferences";

/** Save mail toggles from /voorkeuren. */
export async function saveNotificationPreferencesAction(
  prefs: NotificationPreferences,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await saveMyNotificationPreferences(prefs);
  if (result.ok) {
    revalidatePath("/voorkeuren");
  }
  return result;
}
