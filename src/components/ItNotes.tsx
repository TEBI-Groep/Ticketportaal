"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** Active `@query` at the caret, if any. */
function activeAtMention(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|[\s\n])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const start = before.length - query.length - 1;
  return { start, query };
}

/**
 * IT-only internal notes: @-mention while typing + thumbs-up reactions.
 * Enter saves; Shift+Enter inserts a newline.
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
  const [tekst, setTekst] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep local list in sync after layout/ticket revalidation.
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  // Deep-link from the notification bell: scroll + brief highlight.
  useEffect(() => {
    if (!highlightNoteId) return;
    const el = itemRefs.current.get(highlightNoteId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightNoteId, notes]);

  const taggable = useMemo(
    () => uitvoerders.filter((u) => u.id !== currentUserId),
    [uitvoerders, currentUserId],
  );

  const atMention = activeAtMention(tekst, caret);
  const mentionSuggestions = useMemo(() => {
    if (!atMention) return [];
    const q = atMention.query.toLowerCase();
    return taggable
      .filter((u) => !mentionIds.includes(u.id))
      .filter((u) => !q || u.naam.toLowerCase().includes(q))
      .slice(0, 8);
  }, [atMention, taggable, mentionIds]);

  useEffect(() => {
    setMentionIndex(0);
  }, [atMention?.query, atMention?.start]);

  const selectedMentions = uitvoerders.filter((u) =>
    mentionIds.includes(u.id),
  );

  function syncCaretFromTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    setCaret(el.selectionStart ?? el.value.length);
  }

  function insertMention(user: User) {
    if (!atMention) return;
    const before = tekst.slice(0, atMention.start);
    const after = tekst.slice(caret);
    const insertion = `@${user.naam} `;
    const next = `${before}${insertion}${after}`;
    const nextCaret = before.length + insertion.length;
    setTekst(next);
    setMentionIds((ids) =>
      ids.includes(user.id) ? ids : [...ids, user.id],
    );
    setCaret(nextCaret);
    // Restore focus + caret after React applies the value.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

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
    setCaret(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const menuOpen = mentionSuggestions.length > 0;

    if (menuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (i) =>
            (i - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const pick = mentionSuggestions[mentionIndex];
        if (pick) insertMention(pick);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Move caret past `@` so the menu closes without deleting text.
        const el = textareaRef.current;
        if (el && atMention) {
          const nextCaret = atMention.start;
          el.setSelectionRange(nextCaret, nextCaret);
          setCaret(nextCaret);
        }
        return;
      }
    }

    // Enter saves; Shift+Enter keeps a normal newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
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
      setNotes((list) => list.map((n) => (n.id === note.id ? note : n)));
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
                      <div
                        className={styles.mentionRow}
                        aria-label="Vermeldingen"
                      >
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
                          note.reactedByMe ? "Duim omhoog verwijderen" : "Duim omhoog geven"
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

          <form
            ref={formRef}
            className={styles.compose}
            onSubmit={handleSubmit}
          >
            <label htmlFor={`it-note-${ticketId}`} className={styles.label}>
              Nieuwe notitie
            </label>
            <div className={styles.composeField}>
              <textarea
                ref={textareaRef}
                id={`it-note-${ticketId}`}
                className={`textarea-input ${styles.input}`}
                rows={3}
                value={tekst}
                onChange={(e) => {
                  setTekst(e.target.value);
                  setCaret(e.target.selectionStart ?? e.target.value.length);
                }}
                onClick={syncCaretFromTextarea}
                onKeyUp={syncCaretFromTextarea}
                onSelect={syncCaretFromTextarea}
                onKeyDown={handleKeyDown}
                placeholder="Interne aantekening… (@naam, Enter = opslaan)"
                maxLength={2000}
                aria-autocomplete="list"
                aria-expanded={mentionSuggestions.length > 0}
              />
              {mentionSuggestions.length > 0 ? (
                <ul
                  className={styles.atMenu}
                  role="listbox"
                  aria-label="Beheerders vermelden"
                >
                  {mentionSuggestions.map((u, index) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === mentionIndex}
                        className={`${styles.mentionOption} ${
                          index === mentionIndex
                            ? styles.mentionOptionActive
                            : ""
                        }`}
                        onMouseDown={(e) => {
                          // Keep textarea focus; click would blur first.
                          e.preventDefault();
                          insertMention(u);
                        }}
                      >
                        @{u.naam}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

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
              <span className={styles.composeHint}>
                Shift+Enter voor nieuwe regel
              </span>
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
