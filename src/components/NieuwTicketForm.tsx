"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { uploadAttachmentAction } from "@/app/actions/attachments";
import { searchSimilarTicketsAction } from "@/app/actions/search";
import { createTicketAction } from "@/app/actions/tickets";
import { SimilarTickets } from "@/components/SimilarTickets";
import type {
  Ticket,
  TicketPriority,
  TicketSystem,
  TicketType,
} from "@/lib/types";

interface NieuwTicketFormProps {
  departments: string[];
  /** Pre-check the creator's own department when present. */
  defaultAfdeling?: string | null;
  canCreate: boolean;
}

/**
 * Create-ticket form — persists via Supabase when the user may create.
 * Onderwerp triggers a similar-ticket search to reduce duplicates.
 */
export function NieuwTicketForm({
  departments,
  defaultAfdeling,
  canCreate,
}: NieuwTicketFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onderwerp, setOnderwerp] = useState("");
  const [systeem, setSysteem] = useState<TicketSystem>("NetSuite");
  const [similar, setSimilar] = useState<Ticket[]>([]);
  const [searchPending, startSearch] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runSimilarSearch = useEffectEvent(
    (query: string, system: TicketSystem) => {
      if (query.trim().length < 3) {
        setSimilar([]);
        return;
      }
      startSearch(async () => {
        const results = await searchSimilarTicketsAction(query, system);
        setSimilar(results);
      });
    },
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      runSimilarSearch(onderwerp, systeem);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [onderwerp, systeem]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || submitting) return;

    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const afdelingen = form
      .getAll("afdelingen")
      .map((v) => String(v))
      .filter((v) => v.length > 0);
    const prive = form.get("prive") === "on";
    const files = fileInputRef.current?.files
      ? Array.from(fileInputRef.current.files)
      : [];

    const result = await createTicketAction({
      type: String(form.get("type") ?? "wijziging") as TicketType,
      systeem: String(form.get("systeem") ?? "NetSuite") as TicketSystem,
      onderwerp: String(form.get("onderwerp") ?? ""),
      omschrijving: String(form.get("omschrijving") ?? ""),
      afdelingen,
      // User-selected Prioriteit (default Laag); Impact is no longer collected.
      prioriteit: String(form.get("prioriteit") ?? "laag") as TicketPriority,
      prive,
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Optional bijlagen after the ticket exists (reuse detail upload path).
    for (const file of files) {
      const uploadData = new FormData();
      uploadData.set("file", file);
      const uploaded = await uploadAttachmentAction(result.id, uploadData);
      if (!uploaded.ok) {
        setError(
          `Ticket is aangemaakt, maar bijlage "${file.name}" mislukte: ${uploaded.error}`,
        );
        setSubmitting(false);
        router.push(`/ticket/${result.id}`);
        router.refresh();
        return;
      }
    }

    router.push(`/ticket/${result.id}`);
    router.refresh();
  }

  if (!canCreate) {
    return (
      <div className="empty-state">
        <p>
          Alleen managers en uitvoerders (IT) mogen tickets aanmaken. Vraag je
          manager of IT om een ticket in te dienen.
        </p>
        <Link href="/ranglijst" className="btn btn-secondary">
          Terug naar ranglijst
        </Link>
      </div>
    );
  }

  const prechecked =
    defaultAfdeling && departments.includes(defaultAfdeling)
      ? defaultAfdeling
      : null;

  return (
    <form className="form-stack form-stack-wide" onSubmit={handleSubmit}>
      <fieldset className="form-field" style={{ border: 0 }}>
        <legend
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "var(--ink-soft)",
          }}
        >
          Type
        </legend>
        <div className="segmented">
          {(
            [
              ["storing", "Storing"],
              ["wijziging", "Wijziging"],
              ["vraag", "Vraag"],
              ["idee", "Idee"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={value === "wijziging"}
                required
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="systeem">Systeem</label>
        <select
          id="systeem"
          name="systeem"
          className="select-input"
          required
          value={systeem}
          onChange={(e) => setSysteem(e.target.value as TicketSystem)}
        >
          <option>NetSuite</option>
          <option>WMS</option>
          <option>Hardware</option>
          <option>Outlook</option>
          <option>Overig</option>
          <option>Artikelen</option>
          <option>Transportplanning</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="onderwerp">Onderwerp</label>
        <input
          id="onderwerp"
          name="onderwerp"
          className="text-input"
          required
          maxLength={120}
          placeholder="Korte, duidelijke titel"
          value={onderwerp}
          onChange={(e) => setOnderwerp(e.target.value)}
        />
        <SimilarTickets
          tickets={similar}
          query={onderwerp}
          loading={searchPending}
        />
      </div>

      <div className="form-field">
        <label htmlFor="omschrijving">Omschrijving</label>
        <textarea
          id="omschrijving"
          name="omschrijving"
          className="textarea-input"
          required
          placeholder="Wat gebeurt er, wat verwacht je, wie heeft er last van?"
        />
      </div>

      <fieldset className="form-field" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
          Afdelingen
        </legend>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Kies één of meer afdelingen die bij dit ticket horen.
          {prechecked
            ? ` Jouw afdeling (${prechecked}) staat standaard aan.`
            : null}
        </p>
        <div
          style={{
            display: "grid",
            gap: "0.35rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
          }}
        >
          {departments.map((afdeling) => (
            <label
              key={afdeling}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.95rem",
              }}
            >
              <input
                type="checkbox"
                name="afdelingen"
                value={afdeling}
                defaultChecked={afdeling === prechecked}
              />
              {afdeling}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="prioriteit">Prioriteit</label>
        <select
          id="prioriteit"
          name="prioriteit"
          className="select-input"
          required
          defaultValue="laag"
        >
          <option value="laag">Laag</option>
          <option value="gemiddeld">Gemiddeld</option>
          <option value="hoog">Hoog</option>
          <option value="spoed">Spoed</option>
        </select>
        <p className="form-hint" style={{ marginBottom: 0 }}>
          Kies hoe dringend dit ticket is. Standaard staat Laag geselecteerd.
        </p>
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
          name="prive"
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          <strong>Privé</strong>
          <span className="form-hint" style={{ display: "block", margin: 0 }}>
            Alleen jij (als melder) en IT zien dit ticket — niet op de
            ranglijst, niet voor leidinggevenden.
          </span>
        </span>
      </label>

      <div className="form-field">
        <label htmlFor="bijlagen">Bijlagen (optioneel)</label>
        <input
          id="bijlagen"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
        <p className="form-hint" style={{ marginBottom: 0 }}>
          Max. 5 MB per bestand — JPG, PNG, GIF, WebP, HEIC, PDF of Word.
        </p>
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--danger, #b42318)" }}>
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <Link href="/ranglijst" className="btn btn-secondary">
          Annuleren
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Bezig…" : "Ticket indienen"}
        </button>
      </div>
    </form>
  );
}
