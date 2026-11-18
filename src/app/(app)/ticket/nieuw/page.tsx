"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FALLBACK_AFDELINGEN as AFDELINGEN } from "@/lib/departments";

/**
 * Simple create form (MVP fields). No similar-ticket panel yet — that is fase 2.
 * Submit routes to a mock detail id for the demo shell.
 */
export default function NieuwTicketPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    // Demo: land on an existing detail page so the flow feels complete.
    window.setTimeout(() => {
      // Demo: land on a seeded detail until create-ticket is wired to Supabase.
      router.push("/ticket/b0000000-0000-4000-8000-000000000005");
    }, 400);
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Ticket aanmaken</h1>
        <p>
          Beschrijf kort wat er speelt. Verplichte velden: onderwerp,
          omschrijving, afdeling, type, systeem en impact.
        </p>
      </header>

      <form className="form-stack" onSubmit={handleSubmit}>
        <fieldset className="form-field" style={{ border: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--ink-soft)" }}>
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
          <select id="systeem" name="systeem" className="select-input" required defaultValue="NetSuite">
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
          <select id="afdeling" name="afdeling" className="select-input" required defaultValue="Finance">
            {AFDELINGEN.map((afdeling) => (
              <option key={afdeling} value={afdeling}>
                {afdeling}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="impact">Impact</label>
          <select id="impact" name="impact" className="select-input" required defaultValue="hinderlijk">
            <option value="stil">Werk ligt stil</option>
            <option value="hinderlijk">Hinderlijk</option>
            <option value="wens">Wens</option>
          </select>
        </div>

        <p className="form-hint">
          Bijlagen en suggesties voor vergelijkbare tickets volgen later. Dit is
          een UI-demo zonder opslag.
        </p>

        <div className="form-actions">
          <Link href="/ranglijst" className="btn btn-secondary">
            Annuleren
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Bezig…" : "Ticket indienen"}
          </button>
        </div>
      </form>
    </div>
  );
}
