"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { TicketComment } from "@/lib/types";

export async function addCommentAction(
  ticketId: string,
  body: string,
): Promise<{ ok: true; comment: TicketComment } | { ok: false; error: string }> {
  const tekst = body.trim();
  if (!tekst) {
    return { ok: false, error: "Bericht mag niet leeg zijn." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error:
        "Supabase is niet geconfigureerd (NEXT_PUBLIC_SUPABASE_URL / anon key of SUPABASE_URL / SUPABASE_ANON_KEY ontbreken).",
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

    const { data, error } = await supabase
      .from("comments")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        body: tekst,
        source: "portal",
      })
      .select("id, ticket_id, user_id, body, created_at, profiles ( naam, rol )")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Plaatsen mislukt." };
    }

    const profile = one(data.profiles) as {
      naam: string;
      rol: TicketComment["auteurRol"];
    } | null;

    const comment: TicketComment = {
      id: data.id,
      ticketId: data.ticket_id,
      userId: data.user_id ?? user.id,
      auteurNaam: profile?.naam ?? "Gebruiker",
      auteurRol: profile?.rol ?? "gebruiker",
      tekst: data.body,
      createdAt: data.created_at.slice(0, 10),
    };

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true, comment };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Plaatsen mislukt.",
    };
  }
}
