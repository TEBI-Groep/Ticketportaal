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
  RANGLIJST_TYPES,
  ratingAantal,
  ratingGemiddelde,
  type TicketSystem,
} from "@/lib/types";
import { NETSUITE_SYSTEM_OPTIONS } from "@/lib/labels";

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
  vertrouwelijk: boolean;
  bedrijf: Ticket["bedrijf"];
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
    bedrijf: row.bedrijf ?? "TEBI",
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
    prive: row.vertrouwelijk,
  };
}

const TICKET_SELECT = `
  id, ticketnummer, onderwerp, omschrijving, type, systeem, impact, status, prioriteit,
  melder_id, eigenaar_id, streefdatum, omvang, oplossing_samenvatting, vertrouwelijk, bedrijf,
  created_at, updated_at,
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

/** Public Netsuite wishlist (formerly Ranglijst). RLS scopes by bedrijf. */
export async function getRanglijstTickets(): Promise<Ticket[]> {
  return getNetsuiteTickets();
}

export async function getNetsuiteTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      // All Netsuite* systemen + wijziging / idee / procesverbetering.
      .in("systeem", [...NETSUITE_SYSTEM_OPTIONS])
      .in("type", [...RANGLIJST_TYPES])
      .neq("prioriteit", "spoed")
      .eq("vertrouwelijk", false)
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

export type MijnTicketsUser = {
  id: string;
  rol: UserRole;
  /** @deprecated Prefer afdelingIds for multi-afdeling managers. */
  afdelingId?: string | null;
  afdelingIds?: string[];
};

function managerDepartmentIds(user: MijnTicketsUser): string[] {
  if (user.afdelingIds && user.afdelingIds.length > 0) return user.afdelingIds;
  return user.afdelingId ? [user.afdelingId] : [];
}

/** Open spoed count for the nav badge (afgerond/afgewezen excluded). */
export async function countOpenSpoedTickets(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("prioriteit", "spoed")
      .not("status", "in", '("afgerond","afgewezen")');
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Count tickets with status nieuw (Overzicht blue nav badge).
 * Same open/nieuw set RLS exposes on Overzicht — includes Spoed.
 */
export async function countOpenNieuwTickets(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "nieuw");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Count Werkvoorraad tickets with status nieuw (IT nav badge).
 * Same scope as getWerkvoorraadTickets: open and not spoed (incl. Ranglijst).
 */
export async function countNieuwWerkvoorraadTickets(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "nieuw")
      .neq("prioriteit", "spoed");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Count tickets with status wacht_op_melder in the same scope as Mijn tickets:
 * - iedereen: tickets where they are melder
 * - leidinggevende: also non-privé tickets that include their afdeling
 */
export async function countWachtOpMelderTickets(
  user: MijnTicketsUser,
): Promise<number> {
  if (!isSupabaseConfigured() || !user.id) return 0;
  try {
    const supabase = await createClient();

    const { data: ownData, error: ownError } = await supabase
      .from("tickets")
      .select("id")
      .eq("status", "wacht_op_melder")
      .eq("melder_id", user.id);
    if (ownError) return 0;
    const ids = new Set((ownData ?? []).map((row) => row.id));

    const deptIds = managerDepartmentIds(user);
    if (user.rol === "manager" && deptIds.length > 0) {
      const { data: links, error: linkError } = await supabase
        .from("ticket_departments")
        .select("ticket_id")
        .in("department_id", deptIds);
      if (!linkError && links && links.length > 0) {
        const { data: deptData, error: deptError } = await supabase
          .from("tickets")
          .select("id")
          .eq("status", "wacht_op_melder")
          .eq("vertrouwelijk", false)
          .in(
            "id",
            links.map((l) => l.ticket_id),
          );
        if (!deptError) {
          for (const row of deptData ?? []) ids.add(row.id);
        }
      }
    }

    return ids.size;
  } catch {
    return 0;
  }
}

/**
 * All open tickets visible to the current user (RLS filters the rest).
 * Used by the spreadsheet-style /overzicht page.
 */
export async function getOverzichtTickets(): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .not("status", "in", '("afgerond","afgewezen")');
    if (error || !data) return [];
    return sortOpenTickets(
      (data as unknown as TicketRow[]).map(mapTicket),
    );
  } catch {
    return [];
  }
}

/**
 * Open operational tickets for IT: everything open that is not Spoed,
 * including NetSuite Ranglijst-kandidaten so IT has one combined overview.
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
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

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

    const deptIds = managerDepartmentIds(user);
    if (user.rol !== "manager" || deptIds.length === 0) {
      return sortOpenTickets(own);
    }

    const { data: links, error: linkError } = await supabase
      .from("ticket_departments")
      .select("ticket_id")
      .in("department_id", deptIds);
    if (linkError || !links || links.length === 0) {
      return sortOpenTickets(own);
    }

    // Privé tickets stay out of the afdeling-overzicht for leidinggevenden.
    const { data: deptData, error: deptError } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .in(
        "id",
        links.map((l) => l.ticket_id),
      )
      .eq("vertrouwelijk", false)
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

/**
 * Closed tickets (afgerond / afgewezen) with the same visibility as Mijn tickets:
 * - Beheerder (IT): everything
 * - Medewerker: only tickets where they are melder
 * - Leidinggevende: own melder tickets + non-privé tickets of their afdeling
 */
export async function getAfgerondeTickets(
  user: MijnTicketsUser,
): Promise<Ticket[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();

    // IT sees the full closed archive.
    if (user.rol === "uitvoerder") {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .in("status", ["afgerond", "afgewezen"]);
      if (error || !data) return [];
      return (data as unknown as TicketRow[])
        .map(mapTicket)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    // Own closed tickets as melder (medewerker + leidinggevende).
    const { data: ownData, error: ownError } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("melder_id", user.id)
      .in("status", ["afgerond", "afgewezen"]);
    if (ownError) return [];
    const own = (ownData as unknown as TicketRow[] | null)?.map(mapTicket) ?? [];

    const deptIds = managerDepartmentIds(user);
    if (user.rol !== "manager" || deptIds.length === 0) {
      return sortOpenTickets(own);
    }

    const { data: links, error: linkError } = await supabase
      .from("ticket_departments")
      .select("ticket_id")
      .in("department_id", deptIds);
    if (linkError || !links || links.length === 0) {
      return sortOpenTickets(own);
    }

    // Privé tickets of other melders stay hidden from leidinggevenden.
    const { data: deptData, error: deptError } = await supabase
      .from("tickets")
      .select(TICKET_SELECT)
      .in(
        "id",
        links.map((l) => l.ticket_id),
      )
      .eq("vertrouwelijk", false)
      .in("status", ["afgerond", "afgewezen"]);
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

export async function getCommentsForTicket(
  ticketId: string,
): Promise<TicketComment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, ticket_id, user_id, body, source, created_at, profiles ( naam, rol )",
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((c) => {
      const profile = one(c.profiles) as {
        naam: string;
        rol: TicketComment["auteurRol"];
      } | null;
      const source =
        c.source === "email" || c.source === "system" || c.source === "portal"
          ? c.source
          : "portal";
      return {
        id: c.id,
        ticketId: c.ticket_id,
        userId: c.user_id ?? "",
        auteurNaam:
          profile?.naam ??
          (source === "email" ? "E-mail" : "Systeem"),
        auteurRol: profile?.rol ?? "gebruiker",
        tekst: c.body,
        // Keep full ISO timestamp so the UI can show date + time.
        createdAt: c.created_at,
        source,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = user?.id ?? "";

    const { data, error } = await supabase
      .from("it_notes")
      // Hint the author FK — mentions/reactions also link notes↔profiles.
      .select(
        "id, ticket_id, user_id, body, created_at, profiles!it_notes_user_id_fkey ( naam )",
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    const noteIds = data.map((n) => n.id);
    if (noteIds.length === 0) {
      return data.map((n) => {
        const profile = one(n.profiles);
        return {
          id: n.id,
          ticketId: n.ticket_id,
          userId: n.user_id,
          auteurNaam: profile?.naam ?? "IT",
          tekst: n.body,
          createdAt: n.created_at,
          mentions: [],
          reactions: [],
          reactedByMe: false,
          myReaction: null,
        };
      });
    }

    // Load reactions + mentions in parallel; join profiles for display names.
    const [reactionsRes, mentionsRes] = await Promise.all([
      supabase
        .from("it_note_reactions")
        .select(
          "note_id, user_id, kind, profiles!it_note_reactions_user_id_fkey ( naam )",
        )
        .in("note_id", noteIds),
      supabase
        .from("it_note_mentions")
        .select(
          "note_id, user_id, profiles!it_note_mentions_user_id_fkey ( naam )",
        )
        .in("note_id", noteIds),
    ]);

    const reactionsByNote = new Map<
      string,
      Array<{ userId: string; naam: string; kind: string }>
    >();
    for (const row of reactionsRes.data ?? []) {
      const list = reactionsByNote.get(row.note_id) ?? [];
      const profile = one(row.profiles);
      list.push({
        userId: row.user_id,
        naam: profile?.naam ?? "IT",
        // `kind` stores the emoji glyph (legacy thumbs_up mapped in migration).
        kind: row.kind === "thumbs_up" ? "👍" : row.kind,
      });
      reactionsByNote.set(row.note_id, list);
    }

    const mentionsByNote = new Map<
      string,
      Array<{ userId: string; naam: string }>
    >();
    for (const row of mentionsRes.data ?? []) {
      const list = mentionsByNote.get(row.note_id) ?? [];
      const profile = one(row.profiles);
      list.push({
        userId: row.user_id,
        naam: profile?.naam ?? "IT",
      });
      mentionsByNote.set(row.note_id, list);
    }

    return data.map((n) => {
      const profile = one(n.profiles);
      const reactions = reactionsByNote.get(n.id) ?? [];
      const mine = reactions.find((r) => r.userId === viewerId);
      return {
        id: n.id,
        ticketId: n.ticket_id,
        userId: n.user_id,
        auteurNaam: profile?.naam ?? "IT",
        tekst: n.body,
        // Keep full ISO timestamp so the UI can show date + time.
        createdAt: n.created_at,
        mentions: mentionsByNote.get(n.id) ?? [],
        reactions,
        reactedByMe: Boolean(mine),
        myReaction: mine?.kind ?? null,
      };
    });
  } catch {
    return [];
  }
}
