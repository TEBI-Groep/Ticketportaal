import type { Metadata } from "next";
import { getUsers, MOCK_USER } from "@/data/mock";
import { UserAdmin } from "@/components/UserAdmin";

export const metadata: Metadata = {
  title: "Gebruikers",
};

/**
 * IT user admin — create and edit accounts (rollen / afdeling / actief).
 * Only uitvoerders may open this page in the shell.
 */
export default function GebruikersPage() {
  if (MOCK_USER.rol !== "uitvoerder") {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Gebruikers</h1>
          <p>Alleen uitvoerders (IT) mogen accounts beheren.</p>
        </header>
        <div className="empty-state">
          <p>Geen toegang tot gebruikersbeheer.</p>
        </div>
      </div>
    );
  }

  const users = getUsers();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Gebruikers</h1>
        <p>
          Accounts aanmaken en bewerken: rol, afdeling en actief-status. In de
          UI-shell blijft dit mockdata; later Supabase Auth +{" "}
          <code>profiles</code>.
        </p>
      </header>

      <UserAdmin initialUsers={users} currentUserId={MOCK_USER.id} />
    </div>
  );
}
