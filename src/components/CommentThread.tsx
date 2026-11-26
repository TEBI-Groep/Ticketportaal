"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { TicketComment } from "@/lib/types";
import { formatDateTime, ROLE_LABEL } from "@/lib/labels";
import { addCommentAction } from "@/app/actions/comments";
import styles from "./CommentThread.module.css";

interface CommentThreadProps {
  ticketId: string;
  initialComments: TicketComment[];
  /** Drop top border/margin when the thread sits in a side panel. */
  embedded?: boolean;
  /** From `?comment=` deep-link (notification bell). */
  highlightCommentId?: string | null;
}

/**
 * Public comment thread on ticket detail — questions and extra context.
 */
export function CommentThread({
  ticketId,
  initialComments,
  embedded = false,
  highlightCommentId = null,
}: CommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [tekst, setTekst] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // Deep-link from the notification bell: scroll + brief highlight.
  useEffect(() => {
    if (!highlightCommentId) return;
    const el = itemRefs.current.get(highlightCommentId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightCommentId, comments]);

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
    <section
      className={`${styles.thread} ${embedded ? styles.embedded : ""}`}
      aria-labelledby="comments-heading"
    >
      <header className={styles.header}>
        <h2 id="comments-heading">Updates &amp; vragen</h2>
        <p className="form-hint">
          Deel extra info of stel een vraag. Abonnees van dit ticket krijgen een
          melding.
        </p>
      </header>

      {comments.length === 0 ? (
        <p className={styles.empty}>Nog geen berichten. Stel de eerste vraag.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => {
            const highlighted = highlightCommentId === comment.id;
            return (
              <li
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`${styles.item} ${
                  highlighted ? styles.itemHighlight : ""
                }`}
                ref={(el) => {
                  if (el) itemRefs.current.set(comment.id, el);
                  else itemRefs.current.delete(comment.id);
                }}
              >
                <div className={styles.meta}>
                  <span className={styles.author}>{comment.auteurNaam}</span>
                  <span className={styles.role}>
                    {comment.source === "email"
                      ? "via e-mail"
                      : ROLE_LABEL[comment.auteurRol]}
                  </span>
                  <time dateTime={comment.createdAt}>
                    {formatDateTime(comment.createdAt)}
                  </time>
                </div>
                <p className={styles.body}>{comment.tekst}</p>
              </li>
            );
          })}
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
          <p
            className="form-hint"
            role="alert"
            style={{ color: "var(--danger, #b42318)" }}
          >
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
