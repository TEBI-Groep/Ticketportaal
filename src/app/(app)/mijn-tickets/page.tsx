import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";
import { getCurrentUser } from "@/data/auth";
import { getMijnTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Mijn tickets",
};

async function MijnTicketsContent() {
  const user = await getCurrentUser();
  const tickets = await getMijnTickets(user.id);

  return (
    <>
      <header className="page-header">
        <h1>Mijn tickets</h1>
        <p>
          Openstaande tickets die jij hebt aangemaakt. Klik door voor status en
          details.
        </p>
      </header>

      <TicketList
        tickets={tickets}
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
