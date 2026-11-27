"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUserAction } from "@/data/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { flushPendingEmailDeliveries } from "@/data/mail";
import {
  notificationSnippet,
  notifyTicketUsers,
  resolveTicketNotifyRecipients,
} from "@/data/notifications";
import type { TicketComment } from "@/lib/types";

export async function addCommentAction(
  ticketId: string,
  body: string,
  options: { hasAttachments?: boolean } = {},
): Promise<{ ok: true; comment: TicketComment } | { ok: false; error: string }> {
  const tekst = body.trim();
  // Text-only updates are allowed when the client will attach bijlagen next.
  if (!tekst && !options.hasAttachments) {
    return { ok: false, error: "Bericht mag niet leeg zijn." };
  }

  const gate = await requireActiveUserAction();
  if (!gate.ok) return gate;
  const user = gate.user;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("comments")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        // Empty string when the update is bijlagen-only.
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
      attachments: [],
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
    // Body is the update text only — mail template already shows ticketnummer · onderwerp.
    const snippet = notificationSnippet(
      tekst || (options.hasAttachments ? "Bijlage(n) toegevoegd" : ""),
    );
    const inserted = await notifyTicketUsers({
      ticketId,
      recipientIds: recipients,
      kind: "ticket_comment",
      title: `${comment.auteurNaam} plaatste een update`,
      body: snippet,
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
      await flushPendingEmailDeliveries({ ticketId });
    }
    return { ok: true, comment };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Plaatsen mislukt.",
    };
  }
}
