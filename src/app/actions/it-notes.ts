"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import { notificationSnippet } from "@/data/notifications";
import type { ItNote } from "@/lib/types";

/**
 * Create an IT note, optionally tagging Beheerders (creates mention + inbox rows).
 */
export async function addItNoteAction(
  ticketId: string,
  body: string,
  mentionUserIds: string[] = [],
): Promise<{ ok: true; note: ItNote } | { ok: false; error: string }> {
  const tekst = body.trim();
  if (!tekst) {
    return { ok: false, error: "Notitie mag niet leeg zijn." };
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("naam, rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "uitvoerder") {
      return { ok: false, error: "Alleen uitvoerders mogen IT-notities plaatsen." };
    }

    const { data, error } = await supabase
      .from("it_notes")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        body: tekst,
      })
      // Hint the author FK — mentions/reactions also link notes↔profiles.
      .select(
        "id, ticket_id, user_id, body, created_at, profiles!it_notes_user_id_fkey ( naam )",
      )
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Opslaan mislukt." };
    }

    const author = one(data.profiles);
    const actorNaam = author?.naam ?? profile.naam ?? "IT";

    // Unique, active Beheerders only — never notify yourself.
    const uniqueMentionIds = [
      ...new Set(mentionUserIds.filter((id) => id && id !== user.id)),
    ];

    let mentions: ItNote["mentions"] = [];
    if (uniqueMentionIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, naam, rol, actief")
        .in("id", uniqueMentionIds)
        .eq("rol", "uitvoerder")
        .eq("actief", true);

      const valid = (profiles ?? []).map((p) => ({
        userId: p.id,
        naam: p.naam,
      }));

      if (valid.length > 0) {
        const { error: mentionError } = await supabase
          .from("it_note_mentions")
          .insert(
            valid.map((m) => ({
              note_id: data.id,
              user_id: m.userId,
            })),
          );
        if (mentionError) {
          return {
            ok: false,
            error: mentionError.message ?? "Vermeldingen opslaan mislukt.",
          };
        }

        mentions = valid;
        const snippet = notificationSnippet(tekst);
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(
            valid.map((m) => ({
              user_id: m.userId,
              ticket_id: ticketId,
              kind: "it_note_mention",
              title: `${actorNaam} heeft je vermeld`,
              body: snippet,
              payload: {
                noteId: data.id,
                actorId: user.id,
                actorNaam,
                snippet,
              },
            })),
          );
        if (notifyError) {
          return {
            ok: false,
            error: notifyError.message ?? "Melding aanmaken mislukt.",
          };
        }
      }
    }

    const note: ItNote = {
      id: data.id,
      ticketId: data.ticket_id,
      userId: data.user_id,
      auteurNaam: actorNaam,
      tekst: data.body,
      createdAt: data.created_at,
      mentions,
      reactions: [],
      reactedByMe: false,
    };

    revalidatePath(`/ticket/${ticketId}`);
    // Bell badge lives in the app layout.
    revalidatePath("/", "layout");
    return { ok: true, note };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}

/**
 * Toggle thumbs-up on an IT note. Notifies the note author when adding.
 */
export async function toggleItNoteReactionAction(
  noteId: string,
  ticketId: string,
): Promise<
  | { ok: true; reacted: boolean }
  | { ok: false; error: string }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("naam, rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "uitvoerder") {
      return { ok: false, error: "Alleen uitvoerders mogen reageren." };
    }

    const { data: existing } = await supabase
      .from("it_note_reactions")
      .select("note_id")
      .eq("note_id", noteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("it_note_reactions")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", user.id);
      if (error) {
        return { ok: false, error: error.message };
      }
      revalidatePath(`/ticket/${ticketId}`);
      return { ok: true, reacted: false };
    }

    const { data: note, error: noteError } = await supabase
      .from("it_notes")
      .select("id, ticket_id, user_id, body")
      .eq("id", noteId)
      .maybeSingle();

    if (noteError || !note) {
      return { ok: false, error: noteError?.message ?? "Notitie niet gevonden." };
    }

    const { error: insertError } = await supabase
      .from("it_note_reactions")
      .insert({
        note_id: noteId,
        user_id: user.id,
        kind: "thumbs_up",
      });
    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    // Notify the author (skip self-react).
    if (note.user_id !== user.id) {
      const actorNaam = profile.naam ?? "IT";
      const snippet = notificationSnippet(note.body);
      await supabase.from("notifications").insert({
        user_id: note.user_id,
        ticket_id: note.ticket_id,
        kind: "it_note_reaction",
        title: `${actorNaam} gaf een duim omhoog`,
        body: snippet,
        payload: {
          noteId,
          actorId: user.id,
          actorNaam,
          snippet,
        },
      });
    }

    revalidatePath(`/ticket/${ticketId}`);
    revalidatePath("/", "layout");
    return { ok: true, reacted: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Reageren mislukt.",
    };
  }
}
