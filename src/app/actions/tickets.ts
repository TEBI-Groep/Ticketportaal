"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  TicketImpact,
  TicketPriority,
  TicketSize,
  TicketStatus,
  TicketSystem,
  TicketType,
} from "@/lib/types";

export interface CreateTicketInput {
  onderwerp: string;
  omschrijving: string;
  afdeling: string;
  type: TicketType;
  systeem: TicketSystem;
  impact: TicketImpact;
}

export interface UpdateTicketItInput {
  id: string;
  status: TicketStatus;
  prioriteit: TicketPriority;
  eigenaarId: string | null;
  streefdatum: string | null;
  omvang: TicketSize | null;
  oplossingSamenvatting: string | null;
  onderwerp?: string;
  omschrijving?: string;
}

function defaultPrioriteit(impact: TicketImpact): TicketPriority {
  if (impact === "stil") return "spoed";
  if (impact === "hinderlijk") return "gemiddeld";
  return "laag";
}

export async function createTicketAction(
  input: CreateTicketInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const onderwerp = input.onderwerp.trim();
  const omschrijving = input.omschrijving.trim();
  if (!onderwerp || !omschrijving) {
    return { ok: false, error: "Onderwerp en omschrijving zijn verplicht." };
  }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "manager" && profile?.rol !== "uitvoerder") {
      return {
        ok: false,
        error: "Alleen managers en uitvoerders mogen tickets aanmaken.",
      };
    }

    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("naam", input.afdeling)
      .maybeSingle();

    if (!dept?.id) {
      return { ok: false, error: "Onbekende afdeling." };
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        onderwerp,
        omschrijving,
        afdeling_id: dept.id,
        type: input.type,
        systeem: input.systeem,
        impact: input.impact,
        prioriteit: defaultPrioriteit(input.impact),
        melder_id: user.id,
        status: "nieuw",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Aanmaken mislukt." };
    }

    revalidatePath("/ranglijst");
    revalidatePath("/werkvoorraad");
    revalidatePath("/spoed");
    revalidatePath("/mijn-tickets");
    revalidatePath("/mijn-werk");
    revalidatePath(`/ticket/${data.id}`);
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Aanmaken mislukt.",
    };
  }
}

export async function updateTicketItAction(
  input: UpdateTicketItInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.rol !== "uitvoerder") {
      return { ok: false, error: "Alleen uitvoerders mogen tickets bewerken." };
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      prioriteit: input.prioriteit,
      eigenaar_id: input.eigenaarId,
      streefdatum: input.streefdatum || null,
      omvang: input.omvang,
      oplossing_samenvatting: input.oplossingSamenvatting?.trim() || null,
    };

    if (input.onderwerp !== undefined) {
      const onderwerp = input.onderwerp.trim();
      if (!onderwerp) {
        return { ok: false, error: "Onderwerp mag niet leeg zijn." };
      }
      patch.onderwerp = onderwerp;
    }
    if (input.omschrijving !== undefined) {
      const omschrijving = input.omschrijving.trim();
      if (!omschrijving) {
        return { ok: false, error: "Omschrijving mag niet leeg zijn." };
      }
      patch.omschrijving = omschrijving;
    }

    const { error } = await supabase
      .from("tickets")
      .update(patch)
      .eq("id", input.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath(`/ticket/${input.id}`);
    revalidatePath("/ranglijst");
    revalidatePath("/werkvoorraad");
    revalidatePath("/spoed");
    revalidatePath("/mijn-tickets");
    revalidatePath("/mijn-werk");
    revalidatePath("/afgerond");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}
