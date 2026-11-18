import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";
import { getAfgerondeTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Afgerond",
};

async function AfgerondContent() {
  const tickets = await getAfgerondeTickets();

  return (
    <>
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
    </>
  );
}

/** Closed / rejected tickets for lookup — foreshadows later knowledge base. */
export default function AfgerondPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Afgeronde tickets laden…</p>}>
        <AfgerondContent />
      </Suspense>
    </div>
  );
}
