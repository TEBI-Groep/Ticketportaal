/** Static mock users and tickets for the first UI shell — no backend yet. */

import type { ItNote, Ticket, TicketComment, TicketRating, User } from "@/lib/types";
import {
  isRanglijstKandidaat,
  ratingAantal,
  ratingGemiddelde,
} from "@/lib/types";

/**
 * Demo user after “login”.
 * Rol uitvoerder so the IT-only notes panel is visible in the UI shell;
 * switch to "manager" / "gebruiker" to verify those roles cannot see notes.
 */
export const MOCK_USER: User = {
  id: "u-1",
  naam: "Sara de Vries",
  email: "sara.devries@tebi.nl",
  rol: "uitvoerder",
  afdeling: "IT",
  actief: true,
};

/** Directory of accounts for IT user admin (UI shell — not Auth yet). */
export const MOCK_USERS: User[] = [
  MOCK_USER,
  {
    id: "u-2",
    naam: "Mark Jansen",
    email: "mark.jansen@tebi.nl",
    rol: "manager",
    afdeling: "Finance",
    actief: true,
  },
  {
    id: "u-3",
    naam: "Lisa Bakker",
    email: "lisa.bakker@tebi.nl",
    rol: "gebruiker",
    afdeling: "Magazijn",
    actief: true,
  },
  {
    id: "u-4",
    naam: "Tom de Wit",
    email: "tom.dewit@tebi.nl",
    rol: "manager",
    afdeling: "Sales",
    actief: true,
  },
  {
    id: "u-5",
    naam: "Noor Smits",
    email: "noor.smits@tebi.nl",
    rol: "uitvoerder",
    afdeling: "IT",
    actief: true,
  },
  {
    id: "u-6",
    naam: "Erik Vos",
    email: "erik.vos@tebi.nl",
    rol: "gebruiker",
    afdeling: "Inkoop",
    actief: false,
  },
];

export function getUsers(): User[] {
  return [...MOCK_USERS].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

function r(
  userId: string,
  naam: string,
  afdeling: string,
  score: TicketRating["score"],
): TicketRating {
  return { userId, naam, afdeling, score };
}

/** Seed tickets covering ranglijst, spoed, mijn tickets, and afgerond. */
export const MOCK_TICKETS: Ticket[] = [
  {
    id: "t-1",
    ticketnummer: "TP-104",
    onderwerp: "Factuurexport naar Exact verbeteren",
    omschrijving:
      "De huidige CSV-export mist BTW-regels en kost Finance elke maand handmatig werk. Graag een standaard NetSuite-saved search of Suitelet.",
    afdeling: "Finance",
    type: "wijziging",
    systeem: "NetSuite",
    impact: "hinderlijk",
    status: "ingepland",
    prioriteit: "belangrijk",
    melderId: "u-2",
    melderNaam: "Mark Jansen",
    eigenaarId: "u-5",
    eigenaarNaam: "Noor Smits",
    streefdatum: "2026-12-01",
    omvang: "M",
    beoordelingen: [
      r("u-1", "Sara de Vries", "Finance", 5),
      r("u-2", "Mark Jansen", "Finance", 5),
      r("u-3", "Lisa Bakker", "Magazijn", 4),
      r("u-4", "Tom Vermeer", "Sales", 5),
      r("u-5", "Noor Smits", "IT", 4),
      r("u-6", "Peter de Boer", "Inkoop", 5),
      r("u-7", "Anne Mulder", "Finance", 4),
      r("u-8", "Chris Veld", "Directie", 5),
    ],
    createdAt: "2026-10-02",
    updatedAt: "2026-11-10",
  },
  {
    id: "t-2",
    ticketnummer: "TP-112",
    onderwerp: "Picklijst WMS sorteren op locatie",
    omschrijving:
      "Pickers lopen onnodig heen en weer. Sorteer picklijsten standaard op magazijnlocatie.",
    afdeling: "Magazijn",
    type: "idee",
    systeem: "NetSuite",
    impact: "wens",
    status: "nieuw",
    prioriteit: "normaal",
    melderId: "u-3",
    melderNaam: "Lisa Bakker",
    beoordelingen: [
      r("u-3", "Lisa Bakker", "Magazijn", 5),
      r("u-6", "Peter de Boer", "Inkoop", 4),
      r("u-9", "Erik Vos", "Magazijn", 4),
      r("u-4", "Tom Vermeer", "Sales", 4),
      r("u-2", "Mark Jansen", "Finance", 3),
      r("u-10", "Inge Kuipers", "Magazijn", 5),
    ],
    createdAt: "2026-10-14",
    updatedAt: "2026-11-08",
  },
  {
    id: "t-3",
    ticketnummer: "TP-118",
    onderwerp: "Goedkeuringsflow inkooporders > €5.000",
    omschrijving:
      "Orders boven €5.000 moeten via de afdelingsmanager lopen voordat ze naar de leverancier gaan.",
    afdeling: "Inkoop",
    type: "wijziging",
    systeem: "NetSuite",
    impact: "hinderlijk",
    status: "in_behandeling",
    prioriteit: "voorrang",
    melderId: "u-1",
    melderNaam: "Sara de Vries",
    eigenaarId: "u-1",
    eigenaarNaam: "Sara de Vries",
    streefdatum: "2026-11-28",
    omvang: "L",
    beoordelingen: [
      r("u-6", "Peter de Boer", "Inkoop", 5),
      r("u-8", "Chris Veld", "Directie", 4),
      r("u-2", "Mark Jansen", "Finance", 4),
      r("u-11", "Marieke Bos", "Inkoop", 3),
      r("u-4", "Tom Vermeer", "Sales", 3),
    ],
    createdAt: "2026-10-20",
    updatedAt: "2026-11-12",
  },
  {
    id: "t-4",
    ticketnummer: "TP-121",
    onderwerp: "Klantkorting zichtbaar op verkooporder",
    omschrijving:
      "Sales wil de toegekende korting meteen zien op de orderregel, niet pas op de factuur.",
    afdeling: "Sales",
    type: "idee",
    systeem: "NetSuite",
    impact: "wens",
    status: "nieuw",
    prioriteit: "normaal",
    melderId: "u-4",
    melderNaam: "Tom Vermeer",
    beoordelingen: [
      r("u-1", "Sara de Vries", "Finance", 3),
      r("u-4", "Tom Vermeer", "Sales", 5),
      r("u-12", "Sanne Hof", "Sales", 4),
      r("u-2", "Mark Jansen", "Finance", 2),
    ],
    createdAt: "2026-10-28",
    updatedAt: "2026-11-05",
  },
  {
    id: "t-5",
    ticketnummer: "TP-125",
    onderwerp: "Dashboard openstaande debiteuren",
    omschrijving:
      "Eén overzicht van openstaande posten per klant met aging buckets, filterbaar op afdeling.",
    afdeling: "Finance",
    type: "wijziging",
    systeem: "NetSuite",
    impact: "hinderlijk",
    status: "nieuw",
    prioriteit: "normaal",
    melderId: "u-1",
    melderNaam: "Sara de Vries",
    beoordelingen: [
      r("u-2", "Mark Jansen", "Finance", 4),
      r("u-7", "Anne Mulder", "Finance", 3),
      r("u-8", "Chris Veld", "Directie", 2),
    ],
    createdAt: "2026-11-01",
    updatedAt: "2026-11-09",
  },
  {
    id: "t-6",
    ticketnummer: "TP-130",
    onderwerp: "Outlook gedeelde mailbox IT bereikbaar",
    omschrijving:
      "Meerdere collega’s krijgen geen toegang meer tot it@tebi.nl sinds de migratie van vanochtend.",
    afdeling: "IT",
    type: "storing",
    systeem: "Outlook",
    impact: "stil",
    status: "in_behandeling",
    prioriteit: "spoed",
    melderId: "u-5",
    melderNaam: "Noor Smits",
    eigenaarId: "u-1",
    eigenaarNaam: "Sara de Vries",
    omvang: "S",
    beoordelingen: [],
    createdAt: "2026-11-16",
    updatedAt: "2026-11-16",
  },
  {
    id: "t-7",
    ticketnummer: "TP-131",
    onderwerp: "Handheld scanners magazijn offline",
    omschrijving:
      "Drie Zebra-scanners verbinden niet meer met het WMS-wifi-SSID. Picken loopt vast op zone B.",
    afdeling: "Magazijn",
    type: "storing",
    systeem: "hardware",
    impact: "stil",
    status: "nieuw",
    prioriteit: "spoed",
    melderId: "u-3",
    melderNaam: "Lisa Bakker",
    beoordelingen: [],
    createdAt: "2026-11-16",
    updatedAt: "2026-11-16",
  },
  {
    id: "t-8",
    ticketnummer: "TP-098",
    onderwerp: "WMS pickfout bij split-orders",
    omschrijving:
      "Bij orders die over twee golven gaan, verdwijnt soms een regel uit de picklijst.",
    afdeling: "Magazijn",
    type: "storing",
    systeem: "WMS",
    impact: "hinderlijk",
    status: "wacht_op_melder",
    prioriteit: "voorrang",
    melderId: "u-1",
    melderNaam: "Sara de Vries",
    eigenaarId: "u-1",
    eigenaarNaam: "Sara de Vries",
    omvang: "M",
    beoordelingen: [],
    createdAt: "2026-09-18",
    updatedAt: "2026-11-14",
  },
  {
    id: "t-9",
    ticketnummer: "TP-077",
    onderwerp: "Printerqueue magazijn herstellen",
    omschrijving:
      "Labelprinters printten niet meer na Windows-update. IT heeft drivers opnieuw gezet.",
    afdeling: "Magazijn",
    type: "storing",
    systeem: "hardware",
    impact: "stil",
    status: "afgerond",
    prioriteit: "spoed",
    melderId: "u-3",
    melderNaam: "Lisa Bakker",
    eigenaarId: "u-5",
    eigenaarNaam: "Noor Smits",
    omvang: "S",
    beoordelingen: [],
    createdAt: "2026-08-12",
    updatedAt: "2026-08-13",
    oplossingSamenvatting: "Driver X herinstalleren en printspooler resetten op de terminal-pc’s.",
  },
  {
    id: "t-10",
    ticketnummer: "TP-085",
    onderwerp: "NetSuite rol ‘Sales Light’ aanpassen",
    omschrijving:
      "Sales Light had te veel rechten op klantprijzen. Rechten aangescherpt en getest.",
    afdeling: "Sales",
    type: "wijziging",
    systeem: "NetSuite",
    impact: "wens",
    status: "afgerond",
    prioriteit: "normaal",
    melderId: "u-4",
    melderNaam: "Tom Vermeer",
    eigenaarId: "u-1",
    eigenaarNaam: "Sara de Vries",
    omvang: "S",
    beoordelingen: [
      r("u-4", "Tom Vermeer", "Sales", 4),
      r("u-12", "Sanne Hof", "Sales", 5),
      r("u-8", "Chris Veld", "Directie", 3),
      r("u-2", "Mark Jansen", "Finance", 4),
    ],
    createdAt: "2026-09-01",
    updatedAt: "2026-09-20",
    oplossingSamenvatting: "Permissieset bijgewerkt; documentatie in Confluence gezet.",
  },
  {
    id: "t-11",
    ticketnummer: "TP-090",
    onderwerp: "Automatische herinnering open PO’s",
    omschrijving:
      "Wens voor wekelijkse mail bij openstaande inkooporders ouder dan 14 dagen.",
    afdeling: "Inkoop",
    type: "idee",
    systeem: "NetSuite",
    impact: "wens",
    status: "afgewezen",
    prioriteit: "normaal",
    melderId: "u-2",
    melderNaam: "Mark Jansen",
    beoordelingen: [
      r("u-6", "Peter de Boer", "Inkoop", 2),
      r("u-11", "Marieke Bos", "Inkoop", 3),
      r("u-2", "Mark Jansen", "Finance", 2),
    ],
    createdAt: "2026-09-05",
    updatedAt: "2026-10-01",
    oplossingSamenvatting: "Afgewezen: dekt bestaande saved-search + SuiteAnalytics al voldoende.",
  },
];

/** Departments available on the create form. */
export { FALLBACK_AFDELINGEN as AFDELINGEN } from "@/lib/departments";

export function getTicketById(id: string): Ticket | undefined {
  return MOCK_TICKETS.find((t) => t.id === id);
}

/**
 * NetSuite wishes/ideas sorted by average rating (desc),
 * then by number of ratings as a light tie-breaker.
 */
export function getRanglijstTickets(): Ticket[] {
  return MOCK_TICKETS.filter(
    (t) =>
      t.systeem === "NetSuite" &&
      (t.type === "wijziging" || t.type === "idee") &&
      t.prioriteit !== "spoed" &&
      t.status !== "afgerond" &&
      t.status !== "afgewezen",
  ).sort((a, b) => {
    const avgDiff = ratingGemiddelde(b) - ratingGemiddelde(a);
    if (avgDiff !== 0) return avgDiff;
    return ratingAantal(b) - ratingAantal(a);
  });
}

/** Open tickets with IT priority Spoed (the Spoed handle). */
export function getSpoedTickets(): Ticket[] {
  return MOCK_TICKETS.filter(
    (t) =>
      t.status !== "afgerond" &&
      t.status !== "afgewezen" &&
      t.prioriteit === "spoed",
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Open operational tickets outside Ranglijst and Spoed.
 * Non-uitvoerders only see tickets they created (`melderId`).
 */
export function getWerkvoorraadTickets(options?: {
  userId?: string;
  alleenEigen?: boolean;
}): Ticket[] {
  const alleenEigen = options?.alleenEigen ?? false;
  const userId = options?.userId;
  return MOCK_TICKETS.filter(
    (t) =>
      t.status !== "afgerond" &&
      t.status !== "afgewezen" &&
      t.prioriteit !== "spoed" &&
      !isRanglijstKandidaat(t) &&
      (!alleenEigen || (userId != null && t.melderId === userId)),
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Tickets created by the mock current user. */
export function getMijnTickets(userId: string = MOCK_USER.id): Ticket[] {
  return MOCK_TICKETS.filter(
    (t) =>
      t.melderId === userId &&
      t.status !== "afgerond" &&
      t.status !== "afgewezen",
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Open tickets where this user is Eigenaar (IT). */
export function getTicketsByEigenaar(userId: string = MOCK_USER.id): Ticket[] {
  return MOCK_TICKETS.filter(
    (t) =>
      t.eigenaarId === userId &&
      t.status !== "afgerond" &&
      t.status !== "afgewezen",
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAfgerondeTickets(): Ticket[] {
  return MOCK_TICKETS.filter(
    (t) => t.status === "afgerond" || t.status === "afgewezen",
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Seed public comments for a few tickets (MVP: one shared thread). */
export const MOCK_COMMENTS: TicketComment[] = [
  {
    id: "c-1",
    ticketId: "t-1",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    auteurRol: "uitvoerder",
    tekst:
      "We kijken naar een Suitelet-export. Kunnen jullie een voorbeeld-CSV meesturen van de gewenste kolommen?",
    createdAt: "2026-11-08",
  },
  {
    id: "c-2",
    ticketId: "t-1",
    userId: "u-2",
    auteurNaam: "Mark Jansen",
    auteurRol: "manager",
    tekst:
      "Voorbeeld staat in de gedeelde Finance-map (FactuurExport_gewenst.xlsx). BTW per regel is het belangrijkst.",
    createdAt: "2026-11-09",
  },
  {
    id: "c-3",
    ticketId: "t-1",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    auteurRol: "uitvoerder",
    tekst: "Top, dank. Concept staat gepland voor week 48.",
    createdAt: "2026-11-10",
  },
  {
    id: "c-4",
    ticketId: "t-6",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    auteurRol: "uitvoerder",
    tekst:
      "Permissions opnieuw gezet op it@tebi.nl. Kunnen Verkoop en Magazijn even testen of ze erbij kunnen?",
    createdAt: "2026-11-16",
  },
  {
    id: "c-5",
    ticketId: "t-6",
    userId: "u-4",
    auteurNaam: "Tom Vermeer",
    auteurRol: "manager",
    tekst: "Sales kan er weer bij — werkt hier.",
    createdAt: "2026-11-16",
  },
  {
    id: "c-6",
    ticketId: "t-8",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    auteurRol: "uitvoerder",
    tekst:
      "We hebben een screenshot nodig van de picklijst wanneer de regel ontbreekt. Kun je die plaatsen?",
    createdAt: "2026-11-14",
  },
  {
    id: "c-7",
    ticketId: "t-3",
    userId: "u-1",
    auteurNaam: "Sara de Vries",
    auteurRol: "manager",
    tekst:
      "Drempel mag later configureerbaar zijn, maar start met €5.000 zoals Directie vroeg.",
    createdAt: "2026-11-11",
  },
];

export function getCommentsForTicket(ticketId: string): TicketComment[] {
  return MOCK_COMMENTS.filter((c) => c.ticketId === ticketId).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/** Internal IT notes — only returned/rendered for uitvoerders. */
export const MOCK_IT_NOTES: ItNote[] = [
  {
    id: "n-1",
    ticketId: "t-1",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    tekst:
      "Saved search prototype in sandbox. Let op: BTW-groep mapping wijkt af van Exact — even met Mark checken vóór go-live.",
    createdAt: "2026-11-09",
  },
  {
    id: "n-2",
    ticketId: "t-1",
    userId: "u-1",
    auteurNaam: "Sara de Vries",
    tekst: "Omvang M bevestigd. Streefdatum blijft 1 dec tenzij regressie in WMS.",
    createdAt: "2026-11-10",
  },
  {
    id: "n-3",
    ticketId: "t-6",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    tekst:
      "Exchange shared mailbox ACL opnieuw gezet. Monitoring tot morgen 12:00; daarna ticket afronden als geen klachten.",
    createdAt: "2026-11-16",
  },
  {
    id: "n-4",
    ticketId: "t-8",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    tekst:
      "Wacht op screenshot van melder. Reproduceert niet in test-wave — mogelijk alleen split over DC2.",
    createdAt: "2026-11-14",
  },
  {
    id: "n-5",
    ticketId: "t-3",
    userId: "u-5",
    auteurNaam: "Noor Smits",
    tekst:
      "Workflow in draft. Goedkeurder = afdelingsmanager uit employee record; fallback Directie.",
    createdAt: "2026-11-12",
  },
];

export function getItNotesForTicket(ticketId: string): ItNote[] {
  return MOCK_IT_NOTES.filter((n) => n.ticketId === ticketId).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}
