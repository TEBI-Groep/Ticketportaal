"use client";

import { FormEvent, useState } from "react";
import type { TicketComment } from "@/lib/types";
import { formatDate } from "@/lib/labels";
import { MOCK_USER } from "@/data/mock";
import styles from "./CommentThread.module.css";

const ROL_LABEL: Record<TicketComment["auteurRol"], string> = {
  gebruiker: "Gebruiker",
  manager: "Manager",
  uitvoerder: "IT",
};

interface CommentThreadProps {
  ticketId: string;
  initialComments: TicketComment[];
}

/**
 * Public comment thread on ticket detail — questions and extra context.
 * MVP: one shared thread (no internal/IT-only split yet). Submit is local mock.
 */
export function CommentThread({
  ticketId,
  initialComments,
}: CommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [tekst, setTekst] = useState("");
  const [sending, setSending] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = tekst.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const next: TicketComment = {
      id: `c-local-${Date.now()}`,
      ticketId,
      userId: MOCK_USER.id,
      auteurNaam: MOCK_USER.naam,
      auteurRol: MOCK_USER.rol,
      tekst: trimmed,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    // Demo only — disappears on refresh until Supabase is wired.
    window.setTimeout(() => {
      setComments((prev) => [...prev, next]);
      setTekst("");
      setSending(false);
    }, 200);
  }

  return (
    <section className={styles.thread} aria-labelledby="comments-heading">
      <header className={styles.header}>
        <h2 id="comments-heading">Updates &amp; vragen</h2>
        <p className="form-hint">
          Deel extra info of stel een vraag. Iedereen op dit ticket ziet deze
          berichten.
        </p>
      </header>

      {comments.length === 0 ? (
        <p className={styles.empty}>Nog geen berichten. Stel de eerste vraag.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <div className={styles.meta}>
                <span className={styles.author}>{comment.auteurNaam}</span>
                <span className={styles.role}>{ROL_LABEL[comment.auteurRol]}</span>
                <time dateTime={comment.createdAt}>
                  {formatDate(comment.createdAt)}
                </time>
              </div>
              <p className={styles.body}>{comment.tekst}</p>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.compose} onSubmit={handleSubmit}>
        <label htmlFor={`comment-${ticketId}`} className="form-hint">
          Nieuw bericht
        </label>
        <textarea
          id={`comment-${ticketId}`}
          className={`textarea-input ${styles.input}`}
          rows={3}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          placeholder="Vraag of aanvulling…"
          maxLength={2000}
        />
        <div className={styles.actions}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !tekst.trim()}
          >
            {sending ? "Bezig…" : "Plaatsen"}
          </button>
        </div>
      </form>
    </section>
  );
}
