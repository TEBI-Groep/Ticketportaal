import type { Metadata } from "next";
import { Suspense } from "react";
import { UserAdmin } from "@/components/UserAdmin";
import { requireUitvoerder } from "@/data/auth";
import { listDepartments, listUsers } from "@/data/users";

export const metadata: Metadata = {
  title: "Gebruikers",
};

async function GebruikersContent() {
  const me = await requireUitvoerder();

  const [users, departments] = await Promise.all([
    listUsers(),
    listDepartments(),
  ]);

  return (
    <>
      <header className="page-header">
        <h1>Gebruikers</h1>
        <p>
          Accounts aanmaken en bewerken: rol, afdeling(en), bedrijf en
          actief-status.
        </p>
      </header>

      <UserAdmin
        initialUsers={users}
        departments={departments}
        currentUserId={me.id}
      />
    </>
  );
}

/**
 * IT user admin — create and edit accounts (rollen / afdeling / actief).
 * Only uitvoerders may open this page.
 */
export default function GebruikersPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Gebruikers laden…</p>}>
        <GebruikersContent />
      </Suspense>
    </div>
  );
}
