import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketTable } from "@/components/TicketTable";
import { requireUser } from "@/data/auth";
import { getNetsuiteTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Netsuite",
};

async function NetsuiteContent() {
  const [tickets, user] = await Promise.all([
    getNetsuiteTickets(),
    requireUser(),
  ]);

  return (
    <>
      <header className="page-header">
        <h1>Netsuite</h1>
        <p>
          NetSuite-wijzigingen, -ideeën en -procesverbeteringen, gerangschikt
          op gemiddelde sterrenrating.
        </p>
      </header>

      {/* Same table UX as Overzicht; frozen # + Stemmen for ranking/voting. */}
      <TicketTable
        tickets={tickets}
        showRank
        showVote
        currentUserId={user.id}
        // Slimmer Netsuite-lijst: drop people/activity columns for now.
        hiddenColumns={["melder", "eigenaar", "updatedAt"]}
        searchPlaceholder="Zoek in Netsuite…"
        searchLabel="Zoeken in Netsuite"
        emptyMessage="Nog geen NetSuite-wensen. Maak de eerste aan."
      />
    </>
  );
}

/** Post-login home: NetSuite wishes ranked by average star rating. */
export default function NetsuitePage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Netsuite laden…</p>}>
        <NetsuiteContent />
      </Suspense>
    </div>
  );
}
