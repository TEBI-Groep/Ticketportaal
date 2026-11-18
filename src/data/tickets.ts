import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { ItNote, Ticket, TicketComment, TicketRating } from "@/lib/types";
import {
  getAfgerondeTickets as mockAfgerond,
  getCommentsForTicket as mockComments,
  getItNotesForTicket as mockItNotes,
  getMijnTickets as mockMijn,
  getRanglijstTickets as mockRanglijst,
  getSpoedTickets as mockSpoed,
  getTicketById as mockTicketById,
  getTicketsByEigenaar as mockEigenaar,
  getWerkvoorraadTickets as mockWerkvoorraad,
} from "@/data/mock";
import {
  isRanglijstKandidaat,
  ratingAantal,
  ratingGemiddelde,
  type UserRole,
} from "@/lib/types";

type TicketRow = {
  id: string;
  ticketnummer: string;
  onderwerp: string;
  omschrijving: string;
  type: Ticket["type"];
  systeem: Ticket["systeem"];
  impact: Ticket["impact"];
  status: Ticket["status"];
  prioriteit: Ticket["prioriteit"];
  melder_id: string;
  eigenaar_id: string | null;
  streefdatum: string | null;
  omvang: Ticket["omvang"] | null;
  oplossing_samenvatting: string | null;
  created_at: string;
  updated_at: string;
  departments: { naam: string } | null;
  melder: { id: string; naam: string } | null;
  eigenaar: { id: string; naam: string } | null;
  ratings: Array<{
    user_id: string;
    score: number;
    profiles: { naam: string; departments: { naam: string } | null } | null;
  }> | null;
};

function mapTicket(row: TicketRow): Ticket {
  const beoordelingen: TicketRating[] = (row.ratings ?? []).map((r) => ({
    userId: r.user_id,
    naam: r.profiles?.naam ?? "Onbekend",
    afdeling: r.profiles?.departments?.naam ?? "",
    score: r.score as TicketRating["score"],
  }));

  return {
    id: row.id,
    ticketnummer: row.ticketnummer,
    onderwerp: row.onderwerp,
    omschrijving: row.omschrijving,
    afdeling: row.departments?.naam ?? "",
    type: row.type,
    systeem: row.systeem,
    impact: row.impact,
    status: row.status,
    prioriteit: row.prioriteit,
    melderId: row.melder_id,
    melderNaam: row.melder?.naam ?? "",
    eigenaarId: row.eigenaar_id ?? undefined,
    eigenaarNaam: row.eigenaar?.naam ?? undefined,
    streefdatum: row.streefdatum ?? undefined,
    omvang: row.omvang ?? undefined,
    beoordelingen,
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at.slice(0, 10),
    oplossingSamenvatting: row.oplossing_samenvatting ?? undefined,
  };
}

const TICKET_SELECT = `
  id, ticketnummer, onderwerp, omschrijving, type, systeem, impact, status, prioriteit,
  melder_id, eigenaar_id, streefdatum, omvang, oplossing_samenvatting, created_at, updated_at,
  departments ( naam ),
  melder:profiles!tickets_melder_id_fkey ( id, naam ),
  eigenaar:profiles!tickets_eigenaar_id_fkey ( id, naam ),
  ratings ( user_id, score, profiles ( naam, departments ( naam ) ) )
`;

export async function getTicketById(id: string): Promise<Ticket | undefined> {
  if (!isSupabaseConfigured()) return mockTicketById(id);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return mockTicketById(id);
    return mapTicket(data as unknown as TicketRow);
  } catch {
    return mockTicketById(id);
  }
}

export async function getRanglijstTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return mockRanglijst();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("systeem", "NetSuite")
      .in("type", ["wijziging", "idee"])
      .neq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return mockRanglijst();
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => {
        const avgDiff = ratingGemiddelde(b) - ratingGemiddelde(a);
        if (avgDiff !== 0) return avgDiff;
        return ratingAantal(b) - ratingAantal(a);
      });
  } catch {
    return mockRanglijst();
  }
}

export async function getSpoedTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return mockSpoed();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return mockSpoed();
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .filter((t) => t.prioriteit === "spoed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return mockSpoed();
  }
}

/**
 * Open operational tickets: not Spoed, not on the public NetSuite Ranglijst
 * (storingen, vragen, Outlook/WMS/hardware, etc.).
 * Non-uitvoerders only see tickets they created.
 */
export async function getWerkvoorraadTickets(options: {
  userId: string;
  rol: UserRole;
}): Promise<Ticket[]> {
  const alleenEigen = options.rol !== "uitvoerder";
  if (!isSupabaseConfigured()) {
    return mockWerkvoorraad({
      userId: options.userId,
      alleenEigen,
    });
  }
  try {
    const supabase = await createClient();
    let query = supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .neq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (alleenEigen) {
      query = query.eq("melder_id", options.userId);
    }
    const { data, error } = await query;
    if (error || !data) {
      return mockWerkvoorraad({
        userId: options.userId,
        alleenEigen,
      });
    }
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .filter((t) => !isRanglijstKandidaat(t))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return mockWerkvoorraad({
      userId: options.userId,
      alleenEigen,
    });
  }
}

export async function getMijnTickets(userId: string): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return mockMijn(userId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("melder_id", userId)
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return mockMijn(userId);
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return mockMijn(userId);
  }
}

/** Open tickets where this user is Eigenaar (IT assignee). */
export async function getTicketsByEigenaar(userId: string): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return mockEigenaar(userId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("eigenaar_id", userId)
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return mockEigenaar(userId);
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return mockEigenaar(userId);
  }
}

export async function getAfgerondeTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return mockAfgerond();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .in("status", ["afgerond", "afgewezen"]);
    if (error || !data) return mockAfgerond();
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return mockAfgerond();
  }
}

export async function getCommentsForTicket(
  ticketId: string,
): Promise<TicketComment[]> {
  if (!isSupabaseConfigured()) return mockComments(ticketId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .select("id, ticket_id, user_id, body, created_at, profiles ( naam, rol )")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return mockComments(ticketId);
    return data.map((c) => {
      const profile = one(c.profiles) as {
        naam: string;
        rol: TicketComment["auteurRol"];
      } | null;
      return {
        id: c.id,
        ticketId: c.ticket_id,
        userId: c.user_id ?? "",
        auteurNaam: profile?.naam ?? "Systeem",
        auteurRol: profile?.rol ?? "gebruiker",
        tekst: c.body,
        createdAt: c.created_at.slice(0, 10),
      };
    });
  } catch {
    return mockComments(ticketId);
  }
}

export async function getItNotesForTicket(ticketId: string): Promise<ItNote[]> {
  if (!isSupabaseConfigured()) return mockItNotes(ticketId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("it_notes")
      .select("id, ticket_id, user_id, body, created_at, profiles ( naam )")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return mockItNotes(ticketId);
    return data.map((n) => {
      const profile = one(n.profiles);
      return {
        id: n.id,
        ticketId: n.ticket_id,
        userId: n.user_id,
        auteurNaam: profile?.naam ?? "IT",
        tekst: n.body,
        createdAt: n.created_at.slice(0, 10),
      };
    });
  } catch {
    return mockItNotes(ticketId);
  }
}
