import type { Metadata } from "next";
import { TicketList } from "@/components/TicketList";
import { getRanglijstTickets } from "@/data/mock";

export const metadata: Metadata = {
  title: "Ranglijst",
};

/** Post-login home: NetSuite wishes ranked by votes (leaderboard-first). */
export default function RanglijstPage() {
  const tickets = getRanglijstTickets();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Ranglijst</h1>
        <p>
          NetSuite-wijzigingen en ideeën, gesorteerd op stemmen. Managers zien
          hier meteen de topwensen.
        </p>
      </header>

      <p className="disclaimer">
        Stemmen zijn advies — IT bepaalt de definitieve prioriteit.
      </p>

      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Zoek op onderwerp…"
          aria-label="Zoeken in ranglijst"
          disabled
          title="Zoeken komt in een latere iteratie"
        />
        <select className="select-input" aria-label="Filter afdeling" disabled>
          <option>Alle afdelingen</option>
        </select>
      </div>

      <TicketList
        tickets={tickets}
        showRank
        showVote
        emptyMessage="Nog geen NetSuite-wensen. Maak de eerste aan."
      />
    </div>
  );
}
