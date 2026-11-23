"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Subscribe the signed-in user to ticket updates (mailing later). */
export async function subscribeToTicketAction(
  ticketId: string,
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

    const { data: existing } = await supabase
      .from("ticket_watchers")
      .select("ticket_id")
      .eq("ticket_id", ticketId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("ticket_watchers").insert({
        ticket_id: ticketId,
        user_id: user.id,
        reason: "manual",
      });
      if (error) {
        return { ok: false, error: error.message };
      }
    }

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Abonneren mislukt.",
    };
  }
}

/** Unsubscribe the signed-in user from ticket updates. */
export async function unsubscribeFromTicketAction(
  ticketId: string,
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

    const { error } = await supabase
      .from("ticket_watchers")
      .delete()
      .eq("ticket_id", ticketId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Afmelden mislukt.",
    };
  }
}
