import type { Metadata } from "next";
import { Suspense } from "react";
import { VoorkeurenForm } from "@/components/VoorkeurenForm";
import { requireUser } from "@/data/auth";
import { getMyNotificationPreferences } from "@/data/preferences";

export const metadata: Metadata = {
  title: "Voorkeuren",
};

async function VoorkeurenContent() {
  await requireUser();
  const prefs = await getMyNotificationPreferences();

  return (
    <>
      <header className="page-header">
        <h1>Voorkeuren</h1>
        <p>Beheer hoe je updates uit het Ticketportaal ontvangt.</p>
      </header>
      <VoorkeurenForm initial={prefs} />
    </>
  );
}

/** Account preferences — mail toggles first (Phase B). */
export default function VoorkeurenPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Voorkeuren laden…</p>}>
        <VoorkeurenContent />
      </Suspense>
    </div>
  );
}
