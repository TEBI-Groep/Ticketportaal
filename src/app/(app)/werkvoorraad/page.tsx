import type { Metadata } from "next";
import { Suspense } from "react";
import { FilteredTicketList } from "@/components/FilteredTicketList";
import { getCurrentUser } from "@/data/auth";
import { getWerkvoorraadTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Werkvoorraad",
};

async function WerkvoorraadContent() {
  const user = await getCurrentUser();
  const isIt = user.rol === "uitvoerder";
  const tickets = await getWerkvoorraadTickets({
    userId: user.id,
    rol: user.rol,
  });

  return (
    <>
      <header className="page-header">
        <h1>Werkvoorraad</h1>
        <p>
          {isIt
            ? "Open storingen, vragen en overige verzoeken — alles wat niet op de openbare NetSuite-ranglijst hoort. Spoed blijft een aparte lijst."
            : "Jouw open storingen, vragen en overige verzoeken (niet op de ranglijst). Spoed blijft een aparte lijst."}
        </p>
      </header>

      <FilteredTicketList
        tickets={tickets}
        filterDims={["systeem", "status", "type", "prioriteit", "afdeling"]}
        searchPlaceholder="Zoek in de werkvoorraad…"
        emptyMessage={
          isIt
            ? "Geen open tickets in de werkvoorraad."
            : "Je hebt geen open tickets in de werkvoorraad."
        }
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
