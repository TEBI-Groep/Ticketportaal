import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUitvoerder } from "@/data/auth";
import { getTicketsByEigenaar } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Mijn werk",
};

async function MijnWerkContent() {
  const user = await requireUitvoerder();
  const tickets = await getTicketsByEigenaar(user.id);

  return (
    <>
      <header className="page-header">
        <h1>Mijn werk</h1>
        <p>
          Open tickets waar jij Eigenaar (IT) van bent. Tickets die jij zelf
          hebt aangemaakt staan onder Mijn tickets.
        </p>
      </header>

      <TicketTable
        tickets={tickets}
        searchPlaceholder="Zoek in jouw werk…"
        searchLabel="Zoeken in jouw werk"
        emptyMessage="Je bent nog nergens Eigenaar van."
        emptyCta=""
      />
    </>
  );
}

/** IT-only: open tickets assigned as Eigenaar. */
export default function MijnWerkPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Je werk laden…</p>}>
        <MijnWerkContent />
      </Suspense>
    </div>
  );
}
