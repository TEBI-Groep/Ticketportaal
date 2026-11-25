import type { Metadata } from "next";
import { Suspense } from "react";
import { OverzichtTables } from "@/components/OverzichtTables";
import { requireUser } from "@/data/auth";
import { getOverzichtTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Overzicht",
};

async function OverzichtContent() {
  // Auth gate; ticket visibility still comes from Postgres RLS.
  const user = await requireUser();
  const isIt = user.rol === "uitvoerder";
  const tickets = await getOverzichtTickets();

  // Spoed sits in its own table above the rest (same TicketTable UX).
  const spoedTickets = tickets.filter((t) => t.prioriteit === "spoed");
  const overigeTickets = tickets.filter((t) => t.prioriteit !== "spoed");

  return (
    <OverzichtTables
      spoedTickets={spoedTickets}
      overigeTickets={overigeTickets}
      showMijnWerkToggle={isIt}
      currentUserId={user.id}
      currentUserNaam={user.naam}
    />
  );
}

/** Spreadsheet-style open-ticket overview for everyone (Spoed + rest). */
export default function OverzichtPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Overzicht laden…</p>}>
        <OverzichtContent />
      </Suspense>
    </div>
  );
}
