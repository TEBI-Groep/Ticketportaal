"use client";

import { FormEvent, useRef, useState } from "react";
import type { TicketAttachment } from "@/lib/types";
import { formatDate } from "@/lib/labels";
import {
  deleteAttachmentAction,
  uploadAttachmentAction,
} from "@/app/actions/attachments";
import styles from "./TicketAttachments.module.css";

interface TicketAttachmentsProps {
  ticketId: string;
  initialAttachments: TicketAttachment[];
  currentUserId: string;
  canDeleteAny: boolean;
}

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Screenshots and files on a ticket — visible to anyone who can open the ticket.
 */
export function TicketAttachments({
  ticketId,
  initialAttachments,
  currentUserId,
  canDeleteAny,
}: TicketAttachmentsProps) {
  const [items, setItems] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadAttachmentAction(ticketId, formData);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setItems((prev) => [...prev, result.attachment]);
    if (input) input.value = "";
  }

  async function handleDelete(attachment: TicketAttachment) {
    if (deletingId) return;
    setDeletingId(attachment.id);
    setError(null);
    const result = await deleteAttachmentAction(attachment.id, ticketId);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((prev) => prev.filter((a) => a.id !== attachment.id));
  }

  return (
    <section className={styles.wrap} aria-labelledby="attachments-heading">
      <header className={styles.header}>
        <h2 id="attachments-heading">Bijlagen</h2>
        <p className="form-hint">
          Screenshots of bestanden bij dit ticket. Max. 5 MB — JPG, PNG, GIF,
          WebP, HEIC, PDF of Word.
        </p>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>Nog geen bijlagen.</p>
      ) : (
        <ul className={styles.grid}>
          {items.map((item) => {
            const canDelete =
              canDeleteAny || item.uploadedBy === currentUserId;
            return (
              <li key={item.id} className={styles.card}>
                {item.kind === "image" && item.url ? (
                  <a
                    className={styles.thumbLink}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title={item.fileName}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.thumb}
                      src={item.url}
                      alt={item.fileName}
                    />
                  </a>
                ) : (
                  <a
                    className={styles.fileLink}
                    href={item.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.fileName}
                  </a>
                )}
                <span className={styles.fileName} title={item.fileName}>
                  {item.fileName}
                </span>
                <div className={styles.meta}>
                  <span>{item.uploaderNaam}</span>
                  <time dateTime={item.createdAt}>
                    {formatDate(item.createdAt)}
                  </time>
                  {item.byteSize ? (
                    <span>{formatBytes(item.byteSize)}</span>
                  ) : null}
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deletingId === item.id ? "Bezig…" : "Verwijderen"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form className={styles.compose} onSubmit={handleUpload}>
        <label htmlFor={`attachment-${ticketId}`} className="form-hint">
          Bestand toevoegen
        </label>
        <input
          ref={inputRef}
          id={`attachment-${ticketId}`}
          className={styles.fileInput}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx,.heic,.heif"
          disabled={uploading}
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
            className="btn btn-secondary"
            disabled={uploading}
          >
            {uploading ? "Uploaden…" : "Uploaden"}
          </button>
        </div>
      </form>
    </section>
  );
}
