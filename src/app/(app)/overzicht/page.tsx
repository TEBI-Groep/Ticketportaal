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

  return (
    <>
      {/* Intro copy omitted on Overzicht — table + column filters speak for themselves. */}
      <header className="page-header">
        <h1>Overzicht</h1>
      </header>

      {/* No chip filter bar: filtering lives in Excel-like column headers. */}
      <TicketTable
        tickets={tickets}
        emptyMessage="Geen open tickets zichtbaar."
        emptyCta="Ticket aanmaken"
      />
    </>
  );
}

/** Spreadsheet-style open-ticket overview for everyone. */
export default function OverzichtPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Overzicht laden…</p>}>
        <OverzichtContent />
      </Suspense>
    </div>
  );
}
