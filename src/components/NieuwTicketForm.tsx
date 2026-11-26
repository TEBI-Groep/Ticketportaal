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
import { searchSimilarTicketsAction } from "@/app/actions/search";
import { createTicketAction } from "@/app/actions/tickets";
import { SimilarTickets } from "@/components/SimilarTickets";
import {
  allowedTicketBedrijven,
  BEDRIJF_LABEL,
  forcesBedrijfsbreed,
  type TicketBedrijf,
  type UserBedrijf,
} from "@/lib/bedrijf";
import { SYSTEM_OPTIONS, TYPE_LABEL } from "@/lib/labels";
import { uploadTicketAttachment } from "@/lib/upload-attachment";
import type {
  Ticket,
  TicketPriority,
  TicketSystem,
  TicketType,
} from "@/lib/types";

interface NieuwTicketFormProps {
  departments: string[];
  /** Pre-check the creator's departments when present. */
  defaultAfdelingen?: string[];
  /** Default company from the creator's profile. */
  defaultBedrijf?: UserBedrijf;
  canCreate: boolean;
}

/**
 * Create-ticket form — persists via Supabase when the user may create.
 * Onderwerp triggers a similar-ticket search to reduce duplicates.
 */
export function NieuwTicketForm({
  departments,
  defaultAfdelingen = [],
  defaultBedrijf = "TEBI",
  canCreate,
}: NieuwTicketFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onderwerp, setOnderwerp] = useState("");
  const [systeem, setSysteem] = useState<TicketSystem>("Netsuite");
  // Controlled so we can warn when the user picks Spoed.
  const [prioriteit, setPrioriteit] = useState<TicketPriority>("laag");
  const [afdelingen, setAfdelingen] = useState<string[]>(() =>
    defaultAfdelingen.filter((a) => departments.includes(a)),
  );
  const [bedrijf, setBedrijf] = useState<TicketBedrijf>(defaultBedrijf);
  const [similar, setSimilar] = useState<Ticket[]>([]);
  const [searchPending, startSearch] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lockedBedrijfsbreed = forcesBedrijfsbreed(afdelingen);
  // Only own bedrijf or Bedrijfsbreed — never the other companies.
  const bedrijfOptions = allowedTicketBedrijven(defaultBedrijf);

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
    const prive = form.get("prive") === "on";
    const files = fileInputRef.current?.files
      ? Array.from(fileInputRef.current.files)
      : [];

    const result = await createTicketAction({
      type: String(form.get("type") ?? "wijziging") as TicketType,
      systeem: String(form.get("systeem") ?? "Netsuite") as TicketSystem,
      onderwerp: String(form.get("onderwerp") ?? ""),
      omschrijving: String(form.get("omschrijving") ?? ""),
      afdelingen,
      // User-selected Prioriteit (default Laag); Impact is no longer collected.
      prioriteit,
      prive,
      bedrijf: lockedBedrijfsbreed ? "bedrijfsbreed" : bedrijf,
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Optional bijlagen after the ticket exists (signed Storage upload).
    for (const file of files) {
      const uploaded = await uploadTicketAttachment(result.id, file);
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
        <Link href="/netsuite" className="btn btn-secondary">
          Terug naar Netsuite
        </Link>
      </div>
    );
  }

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
          {(Object.keys(TYPE_LABEL) as TicketType[]).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={value === "wijziging"}
                required
              />
              {TYPE_LABEL[value]}
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
          {SYSTEM_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
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

      <div className="form-field">
        <label htmlFor="bedrijf">Bedrijf</label>
        <select
          id="bedrijf"
          className="select-input"
          required
          value={lockedBedrijfsbreed ? "bedrijfsbreed" : bedrijf}
          disabled={lockedBedrijfsbreed}
          onChange={(e) => setBedrijf(e.target.value as TicketBedrijf)}
        >
          {bedrijfOptions.map((option) => (
            <option key={option} value={option}>
              {BEDRIJF_LABEL[option]}
            </option>
          ))}
        </select>
        {lockedBedrijfsbreed ? (
          <p className="form-hint">
            IT, Marketing, Administratie, Directie, HR en Infra zijn altijd
            Bedrijfsbreed.
          </p>
        ) : (
          <p className="form-hint">
            Alleen {defaultBedrijf} of Bedrijfsbreed (zichtbaar voor TEBI, VK en
            SPL).
          </p>
        )}
      </div>

      <fieldset className="form-field" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
          Afdelingen
        </legend>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Kies één of meer afdelingen die bij dit ticket horen.
          {afdelingen.length > 0
            ? ` Jouw afdeling(en) staan standaard aan.`
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
                checked={afdelingen.includes(afdeling)}
                onChange={() => {
                  setAfdelingen((prev) =>
                    prev.includes(afdeling)
                      ? prev.filter((a) => a !== afdeling)
                      : [...prev, afdeling],
                  );
                }}
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
          value={prioriteit}
          onChange={(e) => setPrioriteit(e.target.value as TicketPriority)}
        >
          <option value="laag">Laag</option>
          <option value="gemiddeld">Gemiddeld</option>
          <option value="hoog">Hoog</option>
          <option value="spoed">Spoed</option>
        </select>
        <p className="form-hint" style={{ marginBottom: 0 }}>
          Kies hoe dringend dit ticket is. Standaard staat Laag geselecteerd.
        </p>
        {/* Spoed is reserved for genuine urgent cases — make that unmistakable. */}
        {prioriteit === "spoed" ? (
          <p
            role="alert"
            style={{
              margin: "0.65rem 0 0",
              padding: "0.65rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--spoed-soft)",
              color: "var(--spoed)",
              fontSize: "0.875rem",
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Let op: Spoed is alleen voor échte spoedgevallen — werk ligt stil of
            er is acute bedrijfsschade. Kies anders Hoog of lager.
          </p>
        ) : null}
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
          accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,text/csv"
        />
        <p className="form-hint" style={{ marginBottom: 0 }}>
          Max. 10 MB per bestand — JPG, PNG, GIF, WebP, HEIC, PDF, Word, Excel
          (xls/xlsx/xlsm) of CSV.
        </p>
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--danger, #b42318)" }}>
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <Link href="/netsuite" className="btn btn-secondary">
          Annuleren
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Bezig…" : "Ticket indienen"}
        </button>
      </div>
    </form>
  );
}
