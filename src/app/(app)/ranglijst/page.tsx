import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUser } from "@/data/auth";
import { getRanglijstTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Ranglijst",
};

async function RanglijstContent() {
  const [tickets, user] = await Promise.all([
    getRanglijstTickets(),
    requireUser(),
  ]);

  return (
    <>
      <header className="page-header">
        <h1>Ranglijst</h1>
        <p>
          NetSuite-wensen en -ideeën, gerangschikt op gemiddelde sterrenrating.
        </p>
      </header>

      {/* Same table UX as Overzicht; frozen # + Stemmen for ranking/voting. */}
      <TicketTable
        tickets={tickets}
        showRank
        showVote
        currentUserId={user.id}
        // Slimmer Ranglijst: drop people/activity columns for now.
        hiddenColumns={["melder", "eigenaar", "updatedAt"]}
        searchPlaceholder="Zoek in de ranglijst…"
        searchLabel="Zoeken in de ranglijst"
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
