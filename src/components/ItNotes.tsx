"use client";

import { FormEvent, useState } from "react";
import type { ItNote, UserRole } from "@/lib/types";
import { formatDate } from "@/lib/labels";
import { MOCK_USER } from "@/data/mock";
import styles from "./ItNotes.module.css";

interface ItNotesProps {
  ticketId: string;
  initialNotes: ItNote[];
  /** Current user’s role — only uitvoerder sees note bodies. */
  viewerRol: UserRole;
}

/**
 * IT-only internal notes in the detail side rail.
 * Managers/gebruikers see a locked hint; uitvoerders see the thread + compose.
 */
export function ItNotes({ ticketId, initialNotes, viewerRol }: ItNotesProps) {
  const isIt = viewerRol === "uitvoerder";
  const [notes, setNotes] = useState(initialNotes);
  const [tekst, setTekst] = useState("");
  const [sending, setSending] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = tekst.trim();
    if (!trimmed || sending || !isIt) return;

    setSending(true);
    const next: ItNote = {
      id: `n-local-${Date.now()}`,
      ticketId,
      userId: MOCK_USER.id,
      auteurNaam: MOCK_USER.naam,
      tekst: trimmed,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    window.setTimeout(() => {
      setNotes((prev) => [...prev, next]);
      setTekst("");
      setSending(false);
    }, 200);
  }

  return (
    <section className={styles.wrap} aria-labelledby="it-notes-heading">
      <header className={styles.header}>
        <h2 id="it-notes-heading">Interne notities</h2>
        <span className={styles.badge}>Alleen IT</span>
      </header>

      {!isIt ? (
        <p className={styles.locked}>
          Deze notities zijn alleen zichtbaar voor uitvoerders (IT).
        </p>
      ) : (
        <>
          <p className={styles.hint}>
            Niet zichtbaar voor melder of managers. Voor afstemming binnen IT.
          </p>

          {notes.length === 0 ? (
            <p className={styles.empty}>Nog geen interne notities.</p>
          ) : (
            <ul className={styles.list}>
              {notes.map((note) => (
                <li key={note.id} className={styles.item}>
                  <div className={styles.meta}>
                    <span className={styles.author}>{note.auteurNaam}</span>
                    <time dateTime={note.createdAt}>
                      {formatDate(note.createdAt)}
                    </time>
                  </div>
                  <p className={styles.body}>{note.tekst}</p>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.compose} onSubmit={handleSubmit}>
            <label htmlFor={`it-note-${ticketId}`} className={styles.label}>
              Nieuwe notitie
            </label>
            <textarea
              id={`it-note-${ticketId}`}
              className={`textarea-input ${styles.input}`}
              rows={3}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              placeholder="Interne aantekening…"
              maxLength={2000}
            />
            <div className={styles.actions}>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={sending || !tekst.trim()}
              >
                {sending ? "Bezig…" : "Opslaan"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
