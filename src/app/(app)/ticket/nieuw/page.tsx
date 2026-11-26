import type { Metadata } from "next";
import { Suspense } from "react";
import { NieuwTicketForm } from "@/components/NieuwTicketForm";
import { requireUser } from "@/data/auth";
import { listDepartments } from "@/data/users";

export const metadata: Metadata = {
  title: "Ticket aanmaken",
};

async function NieuwTicketContent() {
  const [departments, user] = await Promise.all([
    listDepartments(),
    requireUser(),
  ]);
  const canCreate = user.rol === "manager" || user.rol === "uitvoerder";

  return (
    <>
      <header className="page-header">
        <h1>Ticket aanmaken</h1>
        <p>
          Beschrijf kort wat er speelt. Verplichte velden: onderwerp,
          omschrijving, afdeling(en), type, systeem en prioriteit.
        </p>
      </header>

      <NieuwTicketForm
        departments={departments}
        defaultAfdelingen={user.afdelingen}
        defaultBedrijf={user.bedrijf}
        canCreate={canCreate}
      />
    </>
  );
}

/** Create form — managers and uitvoerders insert into Supabase. */
export default function NieuwTicketPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Formulier laden…</p>}>
        <NieuwTicketContent />
      </Suspense>
    </div>
  );
}
