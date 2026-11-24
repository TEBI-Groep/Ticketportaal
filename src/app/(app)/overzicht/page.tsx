import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUser } from "@/data/auth";
import { getOverzichtTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Overzicht",
};

async function OverzichtContent() {
  // Auth gate; ticket visibility still comes from Postgres RLS.
  await requireUser();
  const tickets = await getOverzichtTickets();

  // Spoed sits in its own table above the rest (same TicketTable UX).
  const spoedTickets = tickets.filter((t) => t.prioriteit === "spoed");
  const overigeTickets = tickets.filter((t) => t.prioriteit !== "spoed");

  return (
    <>
      {/* Intro copy omitted on Overzicht — tables + column filters speak for themselves. */}
      <header className="page-header">
        <h1>Overzicht</h1>
      </header>

      {/* Spoed section only when there is at least one urgent ticket. */}
      {spoedTickets.length > 0 ? (
        <section
          aria-labelledby="overzicht-spoed-heading"
          style={{ marginBottom: "2rem" }}
        >
          <h2
            id="overzicht-spoed-heading"
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              margin: "0 0 0.65rem",
              color: "var(--ink)",
            }}
          >
            Spoed
            <span
              className="form-hint"
              style={{ fontWeight: 500, marginLeft: "0.5rem" }}
            >
              ({spoedTickets.length})
            </span>
          </h2>
          <TicketTable
            tickets={spoedTickets}
            searchPlaceholder="Zoek in spoedtickets…"
            searchLabel="Zoeken in spoedtickets"
            emptyMessage="Geen spoedtickets — mooi."
            emptyCta=""
          />
        </section>
      ) : null}

      {/* Main open-ticket table — Spoed excluded. */}
      <section aria-labelledby="overzicht-overig-heading">
        <h2
          id="overzicht-overig-heading"
          style={{
            fontSize: "1.15rem",
            fontWeight: 700,
            margin: "0 0 0.65rem",
            color: "var(--ink)",
          }}
        >
          Overige tickets
        </h2>
        <TicketTable
          tickets={overigeTickets}
          searchPlaceholder="Zoek in het overzicht…"
          emptyMessage="Geen open tickets zichtbaar."
          emptyCta="Ticket aanmaken"
        />
      </section>
    </>
  );
}

/** Spreadsheet-style open-ticket overview for everyone (Spoed + rest). */
export default function OverzichtPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Overzicht laden…</p>}>
        <OverzichtContent />
      </Suspense>
    </div>
  );
}
