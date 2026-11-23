"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTicketItAction,
  updateTicketItAction,
} from "@/app/actions/tickets";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import type {
  Ticket,
  TicketPriority,
  TicketSize,
  TicketStatus,
  User,
} from "@/lib/types";
import styles from "./ItTicketEditor.module.css";

interface ItTicketEditorProps {
  ticket: Ticket;
  uitvoerders: User[];
  melders: User[];
  departments: string[];
}

/**
 * IT-only editable fields on ticket detail (status, priority, owner, etc.).
 */
export function ItTicketEditor({
  ticket,
  uitvoerders,
  melders,
  departments,
}: ItTicketEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [prioriteit, setPrioriteit] = useState<TicketPriority>(ticket.prioriteit);
  const [eigenaarId, setEigenaarId] = useState(ticket.eigenaarId ?? "");
  const [melderId, setMelderId] = useState(ticket.melderId);
  const [afdelingen, setAfdelingen] = useState<string[]>(ticket.afdelingen);
  const [streefdatum, setStreefdatum] = useState(ticket.streefdatum ?? "");
  const [omvang, setOmvang] = useState<TicketSize | "">(ticket.omvang ?? "");
  const [oplossing, setOplossing] = useState(ticket.oplossingSamenvatting ?? "");
  const [onderwerp, setOnderwerp] = useState(ticket.onderwerp);
  const [omschrijving, setOmschrijving] = useState(ticket.omschrijving);
  const [prive, setPrive] = useState(ticket.prive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleAfdeling(naam: string) {
    setAfdelingen((prev) =>
      prev.includes(naam) ? prev.filter((a) => a !== naam) : [...prev, naam],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const result = await updateTicketItAction({
      id: ticket.id,
      status,
      prioriteit,
      eigenaarId: eigenaarId || null,
      melderId,
      afdelingen,
      streefdatum: streefdatum || null,
      omvang: omvang || null,
      oplossingSamenvatting: oplossing,
      onderwerp,
      omschrijving,
      prive,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("Ticket opgeslagen.");
    router.refresh();
  }

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
    router.push("/ranglijst");
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit} style={{ gap: "0.75rem" }}>
      <div className="form-field">
        <label htmlFor="it-onderwerp">Onderwerp</label>
        <input
          id="it-onderwerp"
          className="text-input"
          value={onderwerp}
          onChange={(e) => setOnderwerp(e.target.value)}
          required
          maxLength={120}
        />
      </div>

      <div className="form-field">
        <label htmlFor="it-omschrijving">Omschrijving</label>
        <textarea
          id="it-omschrijving"
          className="textarea-input"
          rows={4}
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="it-melder">Melder</label>
        <select
          id="it-melder"
          className="select-input"
          value={melderId}
          onChange={(e) => setMelderId(e.target.value)}
          required
        >
          {melders.map((u) => (
            <option key={u.id} value={u.id}>
              {u.naam}
              {u.afdeling ? ` · ${u.afdeling}` : ""}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="form-field" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
          Afdelingen
        </legend>
        <div
          style={{
            display: "grid",
            gap: "0.35rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
          }}
        >
          {departments.map((naam) => (
            <label
              key={naam}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.95rem",
              }}
            >
              <input
                type="checkbox"
                checked={afdelingen.includes(naam)}
                onChange={() => toggleAfdeling(naam)}
              />
              {naam}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="it-status">Status</label>
        <select
          id="it-status"
          className="select-input"
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
        >
          {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="it-prioriteit">Prioriteit</label>
        <select
          id="it-prioriteit"
          className="select-input"
          value={prioriteit}
          onChange={(e) => setPrioriteit(e.target.value as TicketPriority)}
        >
          {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="it-eigenaar">Eigenaar (IT)</label>
        <select
          id="it-eigenaar"
          className="select-input"
          value={eigenaarId}
          onChange={(e) => setEigenaarId(e.target.value)}
        >
          <option value="">Nog niet geclaimd</option>
          {uitvoerders.map((u) => (
            <option key={u.id} value={u.id}>
              {u.naam}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="it-streefdatum">Streefdatum</label>
        <input
          id="it-streefdatum"
          type="date"
          className="text-input"
          value={streefdatum}
          onChange={(e) => setStreefdatum(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="it-omvang">Omvang</label>
        <select
          id="it-omvang"
          className="select-input"
          value={omvang}
          onChange={(e) => setOmvang(e.target.value as TicketSize | "")}
        >
          <option value="">—</option>
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="it-oplossing">Oplossing (samenvatting)</label>
        <textarea
          id="it-oplossing"
          className="textarea-input"
          rows={3}
          value={oplossing}
          onChange={(e) => setOplossing(e.target.value)}
          placeholder="Korte samenvatting bij afronden…"
        />
      </div>

      <label
        className="form-field"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={prive}
          onChange={(e) => setPrive(e.target.checked)}
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          <strong>Privé</strong>
          <span className="form-hint" style={{ display: "block", margin: 0 }}>
            Leidinggevenden zien dit ticket niet. Alleen melder, IT en
            eventuele eigenaar.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" style={{ color: "var(--danger, #b42318)", margin: 0 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="form-hint" style={{ margin: 0 }}>
          {notice}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={`btn btn-ghost ${styles.deleteBtn}`}
          onClick={() => {
            setError(null);
            setConfirmDelete(true);
          }}
          disabled={saving || deleting}
        >
          Ticket verwijderen
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
          {saving ? "Bezig…" : "Opslaan"}
        </button>
      </div>

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
    </form>
  );
}
