import type { Metadata } from "next";
import { Suspense } from "react";
import { FilteredTicketList } from "@/components/FilteredTicketList";
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
      <header className="page-header">
        <h1>Overzicht</h1>
        <p>
          Alle open tickets die jij mag zien, in een tabel met sorteerbare
          kolommen. Klik op een kop om te sorteren; klik op een rij om het
          ticket te openen.
        </p>
      </header>

      <FilteredTicketList
        tickets={tickets}
        variant="table"
        filterDims={["systeem", "status", "type", "prioriteit", "afdeling"]}
        searchPlaceholder="Zoek in het overzicht…"
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
