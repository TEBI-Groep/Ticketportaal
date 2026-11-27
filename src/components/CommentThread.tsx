"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { TicketAttachment, TicketComment } from "@/lib/types";
import { formatDateTime, ROLE_LABEL } from "@/lib/labels";
import { MAX_ATTACHMENT_LABEL } from "@/lib/attachment-rules";
import { addCommentAction } from "@/app/actions/comments";
import { uploadTicketAttachment } from "@/lib/upload-attachment";
import styles from "./CommentThread.module.css";

interface CommentThreadProps {
  ticketId: string;
  initialComments: TicketComment[];
  /** Drop top border/margin when the thread sits in a side panel. */
  embedded?: boolean;
  /** From `?comment=` deep-link (notification bell). */
  highlightCommentId?: string | null;
}

const FILE_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.heic,.heif";

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
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const pendingFiles = files;
    if ((!trimmed && pendingFiles.length === 0) || sending) return;

    setSending(true);
    setError(null);

    // Create the update first, then reuse signed Bijlagen upload per file.
    const result = await addCommentAction(ticketId, trimmed, {
      hasAttachments: pendingFiles.length > 0,
    });
    if (!result.ok) {
      setSending(false);
      setError(result.error);
      return;
    }

    const uploaded: TicketAttachment[] = [];
    const uploadErrors: string[] = [];
    for (const file of pendingFiles) {
      const uploadedFile = await uploadTicketAttachment(ticketId, file, {
        commentId: result.comment.id,
      });
      if (uploadedFile.ok) {
        uploaded.push(uploadedFile.attachment);
      } else {
        uploadErrors.push(`${file.name}: ${uploadedFile.error}`);
      }
    }

    setComments((prev) => [
      ...prev,
      { ...result.comment, attachments: uploaded },
    ]);
    setTekst("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(false);

    if (uploadErrors.length > 0) {
      setError(
        `Update geplaatst, maar niet alle bijlagen lukten: ${uploadErrors.join(" · ")}`,
      );
    }
  }

  const canSubmit = (tekst.trim().length > 0 || files.length > 0) && !sending;

  return (
    <section
      className={`${styles.thread} ${embedded ? styles.embedded : ""}`}
      aria-labelledby="comments-heading"
    >
      <header className={styles.header}>
        <h2 id="comments-heading">Updates &amp; vragen</h2>
        <p className="form-hint">
          Deel extra info of stel een vraag. Je kunt ook bijlagen toevoegen
          (max. {MAX_ATTACHMENT_LABEL}). Abonnees van dit ticket krijgen een
          melding.
        </p>
      </header>

      {comments.length === 0 ? (
        <p className={styles.empty}>Nog geen berichten. Stel de eerste vraag.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => {
            const highlighted = highlightCommentId === comment.id;
            const attachments = comment.attachments ?? [];
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
                {comment.tekst.trim() ? (
                  <p className={styles.body}>{comment.tekst}</p>
                ) : null}
                {attachments.length > 0 ? (
                  <ul className={styles.attachments}>
                    {attachments.map((file) => (
                      <li key={file.id}>
                        {file.kind === "image" && file.url ? (
                          <a
                            className={styles.thumbLink}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            title={file.fileName}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              className={styles.thumb}
                              src={file.url}
                              alt={file.fileName}
                            />
                          </a>
                        ) : (
                          <a
                            className={styles.fileLink}
                            href={file.url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {file.fileName}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
        <label htmlFor={`comment-files-${ticketId}`} className="form-hint">
          Bijlagen (optioneel)
        </label>
        <input
          ref={fileInputRef}
          id={`comment-files-${ticketId}`}
          className={styles.fileInput}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          disabled={sending}
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            setFiles(list);
          }}
        />
        {files.length > 0 ? (
          <p className="form-hint">
            {files.length === 1
              ? `1 bestand geselecteerd: ${files[0].name}`
              : `${files.length} bestanden geselecteerd`}
          </p>
        ) : null}
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
            disabled={!canSubmit}
          >
            {sending ? "Bezig…" : "Plaatsen"}
          </button>
        </div>
      </form>
    </section>
  );
}
