"use client";

import { FormEvent, useState } from "react";
import type { TicketComment } from "@/lib/types";
import { formatDate } from "@/lib/labels";
import { addCommentAction } from "@/app/actions/comments";
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
 */
export function CommentThread({
  ticketId,
  initialComments,
}: CommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [tekst, setTekst] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = tekst.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    const result = await addCommentAction(ticketId, trimmed);
    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setComments((prev) => [...prev, result.comment]);
    setTekst("");
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
        {error ? (
          <p className="form-hint" role="alert" style={{ color: "var(--danger, #b42318)" }}>
            {error}
          </p>
        ) : null}
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
