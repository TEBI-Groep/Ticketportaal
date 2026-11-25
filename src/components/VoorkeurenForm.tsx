"use client";

import { useState, useTransition } from "react";
import { saveNotificationPreferencesAction } from "@/app/actions/preferences";
import {
  MAIL_PREFERENCE_FIELDS,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import styles from "./VoorkeurenForm.module.css";

interface VoorkeurenFormProps {
  initial: NotificationPreferences;
}

/** Mail notification toggles for /voorkeuren. */
export function VoorkeurenForm({ initial }: VoorkeurenFormProps) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof NotificationPreferences) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setMessage(null);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveNotificationPreferencesAction(prefs);
      if (!result.ok) {
        setError(result.error);
        setMessage(null);
        return;
      }
      setError(null);
      setMessage("Voorkeuren opgeslagen.");
    });
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.section} aria-labelledby="mail-prefs-heading">
        <h2 id="mail-prefs-heading">E-mailmeldingen</h2>
        <p className={styles.intro}>
          Kies welke Ticketportaal-gebeurtenissen je per e-mail wilt ontvangen.
          In-app meldingen (bel) blijven altijd aan.
        </p>

        <ul className={styles.list}>
          {MAIL_PREFERENCE_FIELDS.map((field) => (
            <li key={field.key} className={styles.row}>
              <div className={styles.copy}>
                <span className={styles.label}>{field.label}</span>
                <span className={styles.hint}>{field.hint}</span>
              </div>
              <label className={styles.switch}>
                <span className="visually-hidden">{field.label}</span>
                <input
                  type="checkbox"
                  checked={prefs[field.key]}
                  onChange={() => toggle(field.key)}
                />
              </label>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={save}
          >
            {pending ? "Opslaan…" : "Opslaan"}
          </button>
          {message ? (
            <p className={styles.ok} role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className={styles.err} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
