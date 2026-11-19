import type { Metadata } from "next";
import { Suspense } from "react";
import { FilteredTicketList } from "@/components/FilteredTicketList";
import { requireUitvoerder } from "@/data/auth";
import { getWerkvoorraadTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Werkvoorraad",
};

async function WerkvoorraadContent() {
  await requireUitvoerder();
  const tickets = await getWerkvoorraadTickets();

  return (
    <>
      <header className="page-header">
        <h1>Werkvoorraad</h1>
        <p>
          Open storingen, vragen en overige verzoeken — alles wat niet op de
          openbare NetSuite-ranglijst hoort. Spoed blijft een aparte lijst.
        </p>
      </header>

      <FilteredTicketList
        tickets={tickets}
        filterDims={["systeem", "status", "type", "prioriteit", "afdeling"]}
        searchPlaceholder="Zoek in de werkvoorraad…"
        emptyMessage="Geen open tickets in de werkvoorraad."
        emptyCta="Ticket aanmaken"
      />
    </>
  );
}

/** IT-only: operational open tickets outside Ranglijst and Spoed. */
export default function WerkvoorraadPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Werkvoorraad laden…</p>}>
        <WerkvoorraadContent />
      </Suspense>
    </div>
  );
}
