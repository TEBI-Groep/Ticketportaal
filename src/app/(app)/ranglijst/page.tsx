import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketList } from "@/components/TicketList";
import { getCurrentUser } from "@/data/auth";
import { getRanglijstTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Ranglijst",
};

async function RanglijstContent() {
  const [tickets, user] = await Promise.all([
    getRanglijstTickets(),
    getCurrentUser(),
  ]);

  return (
    <>
      <header className="page-header">
        <h1>Ranglijst</h1>
        <p>
          NetSuite-wensen en -ideeën, gerangschikt op gemiddelde sterrenrating.
          Stemmen zijn advies aan IT — geen belofte.
        </p>
      </header>

      <TicketList
        tickets={tickets}
        showRank
        showVote
        currentUserId={user.id}
        emptyMessage="Nog geen NetSuite-wensen. Maak de eerste aan."
      />
    </>
  );
}

/** Post-login home: NetSuite wishes ranked by average star rating. */
export default function RanglijstPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Ranglijst laden…</p>}>
        <RanglijstContent />
      </Suspense>
    </div>
  );
}
