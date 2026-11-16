import type { Metadata } from "next";
import { TicketList } from "@/components/TicketList";
import { getMijnTickets, MOCK_USER } from "@/data/mock";

export const metadata: Metadata = {
  title: "Mijn tickets",
};

/** Tickets created by the current (mock) user — open items only. */
export default function MijnTicketsPage() {
  const tickets = getMijnTickets(MOCK_USER.id);

  return (
    <div className="page">
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
    </div>
  );
}
