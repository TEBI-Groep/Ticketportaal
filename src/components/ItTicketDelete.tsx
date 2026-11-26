"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTicketItAction } from "@/app/actions/tickets";
import type { Ticket } from "@/lib/types";
import styles from "./ItTicketEditor.module.css";

/**
 * Compact IT-only delete control (replaces the old full IT form actions).
 */
export function ItTicketDelete({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    const result = await deleteTicketItAction(ticket.id);
    setDeleting(false);
    if (!result.ok) {
      setConfirmDelete(false);
      setError(result.error);
      return;
    }
    router.push("/netsuite");
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p role="alert" style={{ color: "var(--spoed, #b42318)", marginBottom: "0.5rem" }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={`btn btn-ghost ${styles.deleteBtn}`}
        onClick={() => {
          setError(null);
          setConfirmDelete(true);
        }}
        disabled={deleting}
      >
        Ticket verwijderen
      </button>

      {confirmDelete ? (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-ticket-title"
            aria-describedby="delete-ticket-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-ticket-title">Ticket verwijderen?</h2>
            <p id="delete-ticket-desc">
              Weet je zeker dat je <strong>{ticket.ticketnummer}</strong> (
              {ticket.onderwerp}) wilt verwijderen? Dit kan niet ongedaan worden
              gemaakt.
            </p>
            <p className={styles.warning}>
              Alleen gebruiken voor foutieve of testtickets.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Annuleren
              </button>
              <button
                type="button"
                className={`btn btn-primary ${styles.deleteConfirm}`}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Bezig…" : "Ja, verwijderen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
