import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type {
  ItNote,
  Ticket,
  TicketComment,
  TicketRating,
  UserRole,
} from "@/lib/types";
import {
  escapeIlikePattern,
  filterTicketsByQuery,
  normalizeTicketQuery,
} from "@/lib/ticket-search";
import {
  isRanglijstKandidaat,
  ratingAantal,
  ratingGemiddelde,
  type TicketSystem,
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
  ticket_departments:
    | Array<{ departments: { naam: string } | null }>
    | null;
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

  const afdelingen = [
    ...new Set(
      (row.ticket_departments ?? [])
        .map((td) => td.departments?.naam ?? "")
        .filter((naam) => naam.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl"));

  return {
    id: row.id,
    ticketnummer: row.ticketnummer,
    onderwerp: row.onderwerp,
    omschrijving: row.omschrijving,
    afdelingen,
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
  ticket_departments ( departments ( naam ) ),
  melder:profiles!tickets_melder_id_fkey ( id, naam ),
  eigenaar:profiles!tickets_eigenaar_id_fkey ( id, naam ),
  ratings ( user_id, score, profiles ( naam, departments ( naam ) ) )
`;

function sortOpenTickets(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mergeTicketsById(lists: Ticket[][]): Ticket[] {
  const byId = new Map<string, Ticket>();
  for (const list of lists) {
    for (const ticket of list) {
      byId.set(ticket.id, ticket);
    }
  }
  return sortOpenTickets([...byId.values()]);
}

export async function getTicketById(id: string): Promise<Ticket | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    return mapTicket(data as unknown as TicketRow);
  } catch {
    return undefined;
  }
}

/**
 * Find tickets that look similar to a draft onderwerp (create-form helper).
 * Prefers same systeem and open tickets.
 */
export async function searchSimilarTickets(
  query: string,
  options?: { systeem?: TicketSystem; limit?: number },
): Promise<Ticket[]> {
  const limit = options?.limit ?? 5;
  const q = normalizeTicketQuery(query);
  if (q.length < 3 || !isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const pattern = `%${escapeIlikePattern(q.replace(/,/g, " "))}%`;
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .or(
        [
          `ticketnummer.ilike."${pattern}"`,
          `onderwerp.ilike."${pattern}"`,
          `omschrijving.ilike."${pattern}"`,
        ].join(","),
      )
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error || !data) return [];

    let list = (data as unknown as TicketRow[]).map(mapTicket);
    list = filterTicketsByQuery(list, query);

    if (options?.systeem) {
      const same = list.filter((t) => t.systeem === options.systeem);
      const other = list.filter((t) => t.systeem !== options.systeem);
      list = [...same, ...other];
    }

    return list
      .sort((a, b) => {
        const aOpen =
          a.status !== "afgerond" && a.status !== "afgewezen" ? 0 : 1;
        const bOpen =
          b.status !== "afgerond" && b.status !== "afgewezen" ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getRanglijstTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("systeem", "NetSuite")
      .in("type", ["wijziging", "idee"])
      .neq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return [];
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => {
        const avgDiff = ratingGemiddelde(b) - ratingGemiddelde(a);
        if (avgDiff !== 0) return avgDiff;
        return ratingAantal(b) - ratingAantal(a);
      });
  } catch {
    return [];
  }
}

export async function getSpoedTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return [];
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/**
 * Open operational tickets for IT: not Spoed, not on the public NetSuite
 * Ranglijst (storingen, vragen, Outlook/WMS/hardware, etc.).
 * Page is uitvoerder-only; non-IT users use Mijn tickets instead.
 */
export async function getWerkvoorraadTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .neq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return [];
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .filter((t) => !isRanglijstKandidaat(t))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export type MijnTicketsUser = {
  id: string;
  rol: UserRole;
  afdelingId?: string | null;
};

/**
 * Open tickets for the current user:
 * - iedereen: tickets where they are melder
 * - leidinggevende: also all tickets that include their afdeling
 */
export async function getMijnTickets(user: MijnTicketsUser): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();

    const { data: ownData, error: ownError } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("melder_id", user.id)
      .not("status", "in", '("afgerond","afgewezen")');
    if (ownError) return [];
    const own = (ownData as unknown as TicketRow[] | null)?.map(mapTicket) ?? [];

    if (user.rol !== "manager" || !user.afdelingId) {
      return sortOpenTickets(own);
    }

    const { data: links, error: linkError } = await supabase
      .from("ticket_departments")
      .select("ticket_id")
      .eq("department_id", user.afdelingId);
    if (linkError || !links || links.length === 0) {
      return sortOpenTickets(own);
    }

    const { data: deptData, error: deptError } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .in(
        "id",
        links.map((l) => l.ticket_id),
      )
      .not("status", "in", '("afgerond","afgewezen")');
    if (deptError || !deptData) {
      return sortOpenTickets(own);
    }

    return mergeTicketsById([
      own,
      (deptData as unknown as TicketRow[]).map(mapTicket),
    ]);
  } catch {
    return [];
  }
}

/** Open tickets where this user is Eigenaar (IT assignee). */
export async function getTicketsByEigenaar(userId: string): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("eigenaar_id", userId)
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return [];
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getAfgerondeTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .in("status", ["afgerond", "afgewezen"]);
    if (error || !data) return [];
    return (data as unknown as TicketRow[])
      .map(mapTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getCommentsForTicket(
  ticketId: string,
): Promise<TicketComment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, ticket_id, user_id, body, created_at, profiles ( naam, rol )",
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
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
    return [];
  }
}

export async function getItNotesForTicket(ticketId: string): Promise<ItNote[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("it_notes")
      .select("id, ticket_id, user_id, body, created_at, profiles ( naam )")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
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
    return [];
  }
}
