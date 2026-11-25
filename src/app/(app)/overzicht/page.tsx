import type { Metadata } from "next";
import { Suspense } from "react";
import { OverzichtTables } from "@/components/OverzichtTables";
import { requireUitvoerder } from "@/data/auth";
import { getOverzichtTickets } from "@/data/tickets";

export const metadata: Metadata = {
  title: "Overzicht",
};

async function OverzichtContent() {
  // IT-only spreadsheet overview; non-IT are redirected by requireUitvoerder.
  const user = await requireUitvoerder();
  const tickets = await getOverzichtTickets();

  // Spoed sits in its own table above the rest (same TicketTable UX).
  const spoedTickets = tickets.filter((t) => t.prioriteit === "spoed");
  const overigeTickets = tickets.filter((t) => t.prioriteit !== "spoed");

  return (
    <OverzichtTables
      spoedTickets={spoedTickets}
      overigeTickets={overigeTickets}
      showMijnWerkToggle
      currentUserId={user.id}
      currentUserNaam={user.naam}
    />
  );
}

/** Spreadsheet-style open-ticket overview for Beheerders (IT). */
export default function OverzichtPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Overzicht laden…</p>}>
        <OverzichtContent />
      </Suspense>
    </div>
  );
}
