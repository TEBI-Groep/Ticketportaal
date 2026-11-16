import type { Metadata } from "next";
import { TicketList } from "@/components/TicketList";
import { getAfgerondeTickets } from "@/data/mock";

export const metadata: Metadata = {
  title: "Afgerond",
};

/** Closed / rejected tickets for lookup — foreshadows later knowledge base. */
export default function AfgerondPage() {
  const tickets = getAfgerondeTickets();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Afgerond</h1>
        <p>
          Afgeronde en afgewezen tickets ter naslag. Zoek later of iets al eens
          is opgelost.
        </p>
      </header>

      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Zoek in opgeloste tickets…"
          aria-label="Zoeken in afgeronde tickets"
          disabled
          title="Zoeken komt in een latere iteratie"
        />
      </div>

      <TicketList
        tickets={tickets}
        emptyMessage="Nog geen afgeronde tickets."
        emptyCta=""
      />
    </div>
  );
}
