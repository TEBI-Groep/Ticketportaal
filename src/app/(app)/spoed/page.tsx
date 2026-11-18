import type { Metadata } from "next";
import { Suspense } from "react";
import { FilteredTicketList } from "@/components/FilteredTicketList";
import { getSpoedTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Spoed",
};

async function SpoedContent() {
  const tickets = await getSpoedTickets();

  return (
    <>
      <header className="page-header">
        <h1>Spoed</h1>
        <p>
          Open tickets met IT-prioriteit Spoed. Geen stemmen hier.
        </p>
      </header>

      <p className="disclaimer">
        Stemmen gelden niet op spoedtickets — IT pakt deze op via prioriteit.
      </p>

      <FilteredTicketList
        tickets={tickets}
        searchPlaceholder="Zoek in spoedtickets…"
        emptyMessage="Geen spoedtickets — mooi."
        emptyCta="Storing melden"
      />
    </>
  );
}

/** Urgent outages / high-impact tickets — kept separate from the wish ranking. */
export default function SpoedPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Spoedtickets laden…</p>}>
        <SpoedContent />
      </Suspense>
    </div>
  );
}
