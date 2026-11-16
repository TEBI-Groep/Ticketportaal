import type { Metadata } from "next";
import { TicketList } from "@/components/TicketList";
import { getSpoedTickets } from "@/data/mock";

export const metadata: Metadata = {
  title: "Spoed",
};

/** Urgent outages / high-impact tickets — kept separate from the wish ranking. */
export default function SpoedPage() {
  const tickets = getSpoedTickets();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Spoed</h1>
        <p>
          Storingen en urgente tickets waarbij werk stilligt of IT-prioriteit
          Spoed is. Geen stemmen hier.
        </p>
      </header>

      <p className="disclaimer">
        Stemmen gelden niet op spoedtickets — IT pakt deze op basis van impact.
      </p>

      <TicketList
        tickets={tickets}
        emptyMessage="Geen spoedtickets — mooi."
        emptyCta="Storing melden"
      />
    </div>
  );
}
