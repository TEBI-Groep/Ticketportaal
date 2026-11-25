"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ItNote, User, UserRole } from "@/lib/types";
import { formatDateTime } from "@/lib/labels";
import {
  addItNoteAction,
  toggleItNoteReactionAction,
} from "@/app/actions/it-notes";
import styles from "./ItNotes.module.css";

interface ItNotesProps {
  ticketId: string;
  initialNotes: ItNote[];
  /** Current user’s role — only uitvoerder sees note bodies. */
  viewerRol: UserRole;
  currentUserId: string;
  /** Active Beheerders available for @-style mentions. */
  uitvoerders: User[];
  /** From `?note=` deep-link (notification bell). */
  highlightNoteId?: string | null;
}

/**
 * IT-only internal notes: compose with mention chips + thumbs-up reactions.
 */
export function ItNotes({
  ticketId,
  initialNotes,
  viewerRol,
  currentUserId,
  uitvoerders,
  highlightNoteId = null,
}: ItNotesProps) {
  const isIt = viewerRol === "uitvoerder";
  const [notes, setNotes] = useState(initialNotes);

  // Keep local list in sync after layout/ticket revalidation.
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);
  const [tekst, setTekst] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Deep-link from the notification bell: scroll + brief highlight.
  useEffect(() => {
    if (!highlightNoteId) return;
    const el = itemRefs.current.get(highlightNoteId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightNoteId, notes]);

  const mentionCandidates = uitvoerders.filter(
    (u) => u.id !== currentUserId && !mentionIds.includes(u.id),
  );
  const selectedMentions = uitvoerders.filter((u) =>
    mentionIds.includes(u.id),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = tekst.trim();
    if (!trimmed || sending || !isIt) return;

    setSending(true);
    setError(null);
    const result = await addItNoteAction(ticketId, trimmed, mentionIds);
    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotes((prev) => [...prev, result.note]);
    setTekst("");
    setMentionIds([]);
    setMentionOpen(false);
  }

  async function handleReaction(note: ItNote) {
    if (reactingId || !isIt) return;
    setReactingId(note.id);
    const prevReacted = note.reactedByMe;
    // Optimistic UI.
    setNotes((list) =>
      list.map((n) => {
        if (n.id !== note.id) return n;
        if (prevReacted) {
          return {
            ...n,
            reactedByMe: false,
            reactions: n.reactions.filter((r) => r.userId !== currentUserId),
          };
        }
        return {
          ...n,
          reactedByMe: true,
          reactions: [
            ...n.reactions,
            {
              userId: currentUserId,
              naam: "Jij",
              kind: "thumbs_up" as const,
            },
          ],
        };
      }),
    );

    const result = await toggleItNoteReactionAction(note.id, ticketId);
    setReactingId(null);
    if (!result.ok) {
      // Roll back on failure.
      setNotes((list) =>
        list.map((n) => (n.id === note.id ? note : n)),
      );
      setError(result.error);
    }
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
            Niet zichtbaar voor melder of managers. Vermeld een Beheerder of
            geef een 👍 — zij krijgen een melding.
          </p>

          {notes.length === 0 ? (
            <p className={styles.empty}>Nog geen interne notities.</p>
          ) : (
            <ul className={styles.list}>
              {notes.map((note) => {
                const highlighted = highlightNoteId === note.id;
                return (
                  <li
                    key={note.id}
                    id={`it-note-${note.id}`}
                    className={`${styles.item} ${
                      highlighted ? styles.itemHighlight : ""
                    }`}
                    ref={(el) => {
                      if (el) itemRefs.current.set(note.id, el);
                      else itemRefs.current.delete(note.id);
                    }}
                  >
                    <div className={styles.meta}>
                      <span className={styles.author}>{note.auteurNaam}</span>
                      <time dateTime={note.createdAt}>
                        {formatDateTime(note.createdAt)}
                      </time>
                    </div>
                    <p className={styles.body}>{note.tekst}</p>
                    {note.mentions.length > 0 ? (
                      <div className={styles.mentionRow} aria-label="Vermeldingen">
                        {note.mentions.map((m) => (
                          <span key={m.userId} className={styles.mentionChip}>
                            @{m.naam}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.reactionRow}>
                      <button
                        type="button"
                        className={`${styles.reactBtn} ${
                          note.reactedByMe ? styles.reactBtnActive : ""
                        }`}
                        aria-pressed={note.reactedByMe}
                        aria-label={
                          note.reactedByMe
                            ? "👍 verwijderen"
                            : "👍 geven"
                        }
                        disabled={reactingId === note.id}
                        title={
                          note.reactions.length
                            ? note.reactions.map((r) => r.naam).join(", ")
                            : "Duim omhoog"
                        }
                        onClick={() => handleReaction(note)}
                      >
                        <span aria-hidden>👍</span>
                        {note.reactions.length > 0 ? (
                          <span className={styles.reactCount}>
                            {note.reactions.length}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </li>
                );
              })}
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

            {selectedMentions.length > 0 ? (
              <div className={styles.mentionRow}>
                {selectedMentions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={styles.mentionChipRemovable}
                    onClick={() =>
                      setMentionIds((ids) => ids.filter((id) => id !== u.id))
                    }
                    title="Verwijder vermelding"
                  >
                    @{u.naam} ×
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.composeTools}>
              <div className={styles.mentionPicker}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-expanded={mentionOpen}
                  onClick={() => setMentionOpen((open) => !open)}
                  disabled={mentionCandidates.length === 0}
                >
                  Vermeld Beheerder
                </button>
                {mentionOpen ? (
                  <ul className={styles.mentionMenu} role="listbox">
                    {mentionCandidates.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={styles.mentionOption}
                          onClick={() => {
                            setMentionIds((ids) => [...ids, u.id]);
                            setMentionOpen(false);
                          }}
                        >
                          {u.naam}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={sending || !tekst.trim()}
              >
                {sending ? "Bezig…" : "Opslaan"}
              </button>
            </div>

            {error ? (
              <p
                className={styles.hint}
                role="alert"
                style={{ color: "var(--danger, #b42318)" }}
              >
                {error}
              </p>
            ) : null}
          </form>
        </>
      )}
    </section>
  );
}
