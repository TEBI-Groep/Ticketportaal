import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUser } from "@/data/auth";
import { getMijnTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Mijn tickets",
};

async function MijnTicketsContent() {
  const user = await requireUser();
  const tickets = await getMijnTickets(user);
  const isManager = user.rol === "manager";

  return (
    <>
      <header className="page-header">
        <h1>Mijn tickets</h1>
        <p>
          {isManager
            ? "Openstaande tickets van jouw afdeling, plus tickets die jij hebt aangemaakt."
            : "Openstaande tickets die jij hebt aangemaakt (als melder)."}
        </p>
      </header>

      <TicketTable
        tickets={tickets}
        searchPlaceholder="Zoek in jouw tickets…"
        searchLabel="Zoeken in jouw tickets"
        emptyMessage="Je hebt geen openstaande tickets."
      />
    </>
  );
}

/** Tickets created by the current user — open items only. */
export default function MijnTicketsPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Je tickets laden…</p>}>
        <MijnTicketsContent />
      </Suspense>
    </div>
  );
}
