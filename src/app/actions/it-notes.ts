"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { ItNote } from "@/lib/types";

export async function addItNoteAction(
  ticketId: string,
  body: string,
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
      .select("id, ticket_id, user_id, body, created_at, profiles ( naam )")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Opslaan mislukt." };
    }

    const author = one(data.profiles);
    const note: ItNote = {
      id: data.id,
      ticketId: data.ticket_id,
      userId: data.user_id,
      auteurNaam: author?.naam ?? profile.naam,
      tekst: data.body,
      createdAt: data.created_at.slice(0, 10),
    };

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true, note };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}
