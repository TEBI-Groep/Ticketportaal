"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { searchSimilarTicketsAction } from "@/app/actions/search";
import { createTicketAction } from "@/app/actions/tickets";
import { SimilarTickets } from "@/components/SimilarTickets";
import type { Ticket, TicketImpact, TicketSystem, TicketType } from "@/lib/types";

interface NieuwTicketFormProps {
  departments: string[];
  canCreate: boolean;
}

/**
 * Create-ticket form — persists via Supabase when the user may create.
 * Onderwerp triggers a similar-ticket search to reduce duplicates.
 */
export function NieuwTicketForm({ departments, canCreate }: NieuwTicketFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onderwerp, setOnderwerp] = useState("");
  const [systeem, setSysteem] = useState<TicketSystem>("NetSuite");
  const [similar, setSimilar] = useState<Ticket[]>([]);
  const [searchPending, startSearch] = useTransition();

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
    const result = await createTicketAction({
      type: String(form.get("type") ?? "wijziging") as TicketType,
      systeem: String(form.get("systeem") ?? "NetSuite") as TicketSystem,
      onderwerp: String(form.get("onderwerp") ?? ""),
      omschrijving: String(form.get("omschrijving") ?? ""),
      afdeling: String(form.get("afdeling") ?? ""),
      impact: String(form.get("impact") ?? "hinderlijk") as TicketImpact,
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
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

  const defaultAfdeling = departments[0] ?? "";

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
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
          <option>hardware</option>
          <option>Outlook</option>
          <option>overig</option>
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
        <label htmlFor="afdeling">Afdeling</label>
        <select
          id="afdeling"
          name="afdeling"
          className="select-input"
          required
          defaultValue={defaultAfdeling}
        >
          {departments.map((afdeling) => (
            <option key={afdeling} value={afdeling}>
              {afdeling}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="impact">Impact</label>
        <select
          id="impact"
          name="impact"
          className="select-input"
          required
          defaultValue="hinderlijk"
        >
          <option value="stil">Werk ligt stil</option>
          <option value="hinderlijk">Hinderlijk</option>
          <option value="wens">Wens</option>
        </select>
      </div>

      <p className="form-hint">
        Bijlagen volgen later. Bij een match kun je beter stemmen of het
        bestaande ticket openen.
      </p>

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
