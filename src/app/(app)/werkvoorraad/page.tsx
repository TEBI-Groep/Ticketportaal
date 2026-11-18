import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";
import { getWerkvoorraadTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Werkvoorraad",
};

async function WerkvoorraadContent() {
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

      <TicketList
        tickets={tickets}
        emptyMessage="Geen open tickets in de werkvoorraad."
        emptyCta="Ticket aanmaken"
      />
    </>
  );
}

/** Operational open tickets outside Ranglijst and Spoed. */
export default function WerkvoorraadPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Werkvoorraad laden…</p>}>
        <WerkvoorraadContent />
      </Suspense>
    </div>
  );
}
