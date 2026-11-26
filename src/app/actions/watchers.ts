"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUserAction } from "@/data/auth";
import { createClient } from "@/lib/supabase/server";

/** Subscribe the signed-in user to ticket updates (mailing later). */
export async function subscribeToTicketAction(
  ticketId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();

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
  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();

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
