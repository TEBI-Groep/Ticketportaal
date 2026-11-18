import type { Metadata } from "next";
import { Suspense } from "react";
import { FilteredTicketList } from "@/components/FilteredTicketList";
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
          Afgeronde en afgewezen tickets ter naslag. Zoek of iets al eens is
          opgelost.
        </p>
      </header>

      <FilteredTicketList
        tickets={tickets}
        searchPlaceholder="Zoek in opgeloste tickets…"
        searchLabel="Zoeken in afgeronde tickets"
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
