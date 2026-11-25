import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OverzichtTables } from "@/components/OverzichtTables";
import { requireUser } from "@/data/auth";
import { getOverzichtTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Overzicht",
};

async function OverzichtContent() {
  // Auth gate; ticket visibility still comes from Postgres RLS.
  const user = await requireUser();
  const isIt = user.rol === "uitvoerder";
  const tickets = await getOverzichtTickets();

  // Spoed sits in its own table above the rest (same TicketTable UX).
  const spoedTickets = tickets.filter((t) => t.prioriteit === "spoed");
  const overigeTickets = tickets.filter((t) => t.prioriteit !== "spoed");

  return (
    <>
      {/* Intro copy omitted on Overzicht — tables + column filters speak for themselves. */}
      <header className="page-header page-headerWithAction">
        <h1>Overzicht</h1>
        {/* Mijn werk left the nav; IT reaches it from here for now. */}
        {isIt ? (
          <Link href="/mijn-werk" className="btn btn-secondary">
            Mijn werk
          </Link>
        ) : null}
      </header>

      {/* One search above both tables; always visible even without Spoed. */}
      <OverzichtTables
        spoedTickets={spoedTickets}
        overigeTickets={overigeTickets}
      />
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
