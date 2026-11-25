import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** True when the user has a manual (or any) watcher row for this ticket. */
export async function isWatchingTicket(
  ticketId: string,
  userId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_watchers")
      .select("ticket_id")
      .eq("ticket_id", ticketId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/** All user ids watching a ticket (any reason: melder, manual, …). */
export async function listWatcherUserIds(ticketId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_watchers")
      .select("user_id")
      .eq("ticket_id", ticketId);
    if (error || !data) return [];
    return data.map((row) => row.user_id);
  } catch {
    return [];
  }
}
