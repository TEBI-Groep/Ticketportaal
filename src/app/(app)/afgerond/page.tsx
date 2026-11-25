import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUser } from "@/data/auth";
import { getAfgerondeTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Afgerond",
};

async function AfgerondContent() {
  const user = await requireUser();
  const tickets = await getAfgerondeTickets(user);
  const isIt = user.rol === "uitvoerder";
  const isManager = user.rol === "manager";

  return (
    <>
      <header className="page-header">
        <h1>Afgerond</h1>
        <p>
          {isIt
            ? "Alle afgeronde en afgewezen tickets ter naslag."
            : isManager
              ? "Afgeronde en afgewezen tickets van jouw afdeling (niet-privé), plus tickets die jij hebt aangemaakt."
              : "Afgeronde en afgewezen tickets die jij hebt aangemaakt (als melder)."}
        </p>
      </header>

      <TicketTable
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
