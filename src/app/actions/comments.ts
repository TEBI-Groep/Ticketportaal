"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import {
  notificationSnippet,
  notifyTicketUsers,
  resolveTicketNotifyRecipients,
} from "@/data/notifications";
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
      .select(
        "id, ticket_id, user_id, body, created_at, profiles!comments_user_id_fkey ( naam, rol )",
      )
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
      createdAt: data.created_at,
    };

    // Notify watchers / melder / eigenaar (same set as status changes).
    const { data: ticket } = await supabase
      .from("tickets")
      .select("ticketnummer, onderwerp, melder_id, eigenaar_id")
      .eq("id", ticketId)
      .maybeSingle();

    const recipients = await resolveTicketNotifyRecipients(ticketId, user.id, {
      melderId: ticket?.melder_id,
      eigenaarId: ticket?.eigenaar_id,
    });
    const snippet = notificationSnippet(tekst);
    const ticketLabel = ticket?.ticketnummer
      ? `${ticket.ticketnummer}${ticket.onderwerp ? ` · ${ticket.onderwerp}` : ""}`
      : "Ticket";
    const inserted = await notifyTicketUsers({
      ticketId,
      recipientIds: recipients,
      kind: "ticket_comment",
      title: `${comment.auteurNaam} plaatste een update`,
      body: `${ticketLabel}: ${snippet}`,
      payload: {
        commentId: comment.id,
        actorId: user.id,
        actorNaam: comment.auteurNaam,
        snippet,
      },
    });

    revalidatePath(`/ticket/${ticketId}`);
    if (inserted > 0) {
      revalidatePath("/", "layout");
    }
    return { ok: true, comment };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Plaatsen mislukt.",
    };
  }
}
