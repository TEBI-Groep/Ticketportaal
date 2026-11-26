import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { VoorkeurenForm } from "@/components/VoorkeurenForm";
import styles from "@/components/VoorkeurenForm.module.css";
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
        <p>Beheer meldingen en je inlogwachtwoord.</p>
      </header>
      <div className={styles.wrap}>
        <VoorkeurenForm initial={prefs} />
        <ChangePasswordForm />
      </div>
    </>
  );
}

/** Account preferences — mail toggles + self-service password. */
export default function VoorkeurenPage() {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Voorkeuren laden…</p>}>
        <VoorkeurenContent />
      </Suspense>
    </div>
  );
}
