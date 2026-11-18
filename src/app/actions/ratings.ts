"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { StarScore } from "@/lib/types";

/**
 * Upsert the current user’s 1–5 rating, or remove it when score matches
 * the existing one (toggle off). Eligibility is enforced in the DB trigger.
 */
export async function rateTicketAction(
  ticketId: string,
  score: StarScore,
): Promise<
  | { ok: true; myRating: StarScore | null }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
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
      .from("ratings")
      .select("score")
      .eq("ticket_id", ticketId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.score === score) {
      const { error } = await supabase
        .from("ratings")
        .delete()
        .eq("ticket_id", ticketId)
        .eq("user_id", user.id);
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidateRatingPaths(ticketId);
      return { ok: true, myRating: null };
    }

    const { error } = await supabase.from("ratings").upsert(
      {
        ticket_id: ticketId,
        user_id: user.id,
        score,
      },
      { onConflict: "ticket_id,user_id" },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidateRatingPaths(ticketId);
    return { ok: true, myRating: score };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Beoordelen mislukt.",
    };
  }
}

function revalidateRatingPaths(ticketId: string) {
  revalidatePath(`/ticket/${ticketId}`);
  revalidatePath("/ranglijst");
  revalidatePath("/spoed");
  revalidatePath("/mijn-tickets");
  revalidatePath("/afgerond");
}
