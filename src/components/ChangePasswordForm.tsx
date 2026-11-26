"use client";

import { useState, useTransition } from "react";
import { changeOwnPasswordAction } from "@/app/actions/auth";
import styles from "./VoorkeurenForm.module.css";

/** Self-service password change on /voorkeuren. */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();

    // Client-side confirm check before hitting the server.
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError("Nieuwe wachtwoorden komen niet overeen.");
      return;
    }

    startTransition(async () => {
      const result = await changeOwnPasswordAction(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Wachtwoord gewijzigd. Gebruik het nieuwe wachtwoord bij de volgende login.");
    });
  }

  return (
    <section className={styles.section} aria-labelledby="password-heading">
      <h2 id="password-heading">Wachtwoord</h2>
      <p className={styles.intro}>
        Wijzig je inlogwachtwoord. Na opslaan blijf je ingelogd; gebruik het
        nieuwe wachtwoord de volgende keer dat je inlogt.
      </p>

      <form className={styles.passwordForm} onSubmit={submit}>
        <div className="form-field">
          <label htmlFor="current-password">Huidig wachtwoord</label>
          <input
            id="current-password"
            type="password"
            className="text-input"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              clearFeedback();
            }}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="new-password">Nieuw wachtwoord</label>
          <input
            id="new-password"
            type="password"
            className="text-input"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              clearFeedback();
            }}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="form-hint">Minimaal 8 tekens.</p>
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password">Bevestig nieuw wachtwoord</label>
          <input
            id="confirm-password"
            type="password"
            className="text-input"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearFeedback();
            }}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Opslaan…" : "Wachtwoord wijzigen"}
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
      </form>
    </section>
  );
}
