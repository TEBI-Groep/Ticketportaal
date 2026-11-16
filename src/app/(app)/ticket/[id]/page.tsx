import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { getTicketById, MOCK_USER } from "@/data/mock";
import {
  IMPACT_LABEL,
  TYPE_LABEL,
  formatDate,
} from "@/lib/labels";
import {
  isStembaar,
  mijnRating,
  ratingAantal,
  ratingGemiddelde,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ticket = getTicketById(id);
  return {
    title: ticket ? `${ticket.ticketnummer}` : "Ticket",
  };
}

/** Basic ticket detail — requester fields + light IT panel (visual only). */
export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ticket = getTicketById(id);

  if (!ticket) {
    notFound();
  }

  const canVote = isStembaar(ticket);
  const avg = ratingGemiddelde(ticket);
  const count = ratingAantal(ticket);
  const mine = mijnRating(ticket, MOCK_USER.id);

  return (
    <div className="page">
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/ranglijst" className="btn btn-ghost">
          ← Terug
        </Link>
      </p>

      <div className="detail-grid split">
        <section className="detail-panel">
          <div className="detail-title-row">
            <h1>
              {ticket.ticketnummer} · {ticket.onderwerp}
            </h1>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.prioriteit} />
            </div>
          </div>

          <dl className="kv-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="kv">
              <dt>Type</dt>
              <dd>{TYPE_LABEL[ticket.type]}</dd>
            </div>
            <div className="kv">
              <dt>Systeem</dt>
              <dd>{ticket.systeem}</dd>
            </div>
            <div className="kv">
              <dt>Impact</dt>
              <dd>{IMPACT_LABEL[ticket.impact]}</dd>
            </div>
            <div className="kv">
              <dt>Afdeling</dt>
              <dd>{ticket.afdeling}</dd>
            </div>
            <div className="kv">
              <dt>Melder</dt>
              <dd>{ticket.melderNaam}</dd>
            </div>
            <div className="kv">
              <dt>Aangemaakt</dt>
              <dd>{formatDate(ticket.createdAt)}</dd>
            </div>
          </dl>

          <h2>Omschrijving</h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: "1.25rem" }}>
            {ticket.omschrijving}
          </p>

          {ticket.oplossingSamenvatting ? (
            <>
              <h2>Oplossing</h2>
              <p style={{ color: "var(--ink-soft)" }}>{ticket.oplossingSamenvatting}</p>
            </>
          ) : null}

          {canVote ? (
            <div style={{ marginTop: "1.5rem" }}>
              <h2>Beoordeling</h2>
              <p className="form-hint" style={{ marginBottom: "0.75rem" }}>
                Beoordeel dit verzoek met 1–5 sterren. Het gemiddelde bepaalt de
                plek op de ranglijst (advies aan IT).
              </p>
              <StarRating
                average={avg}
                count={count}
                myRating={mine}
                beoordelingen={ticket.beoordelingen}
                interactive
              />
            </div>
          ) : null}
        </section>

        <aside className="detail-panel" aria-label="IT-gegevens">
          <h2>IT-paneel</h2>
          <p className="form-hint" style={{ marginBottom: "1rem" }}>
            Alleen zichtbaar/bewerkbaar voor uitvoerders in de echte app. Nu
            read-only mock.
          </p>
          <dl className="kv-grid">
            <div className="kv">
              <dt>Eigenaar</dt>
              <dd>{ticket.eigenaarNaam ?? "Nog niet geclaimd"}</dd>
            </div>
            <div className="kv">
              <dt>Streefdatum</dt>
              <dd>{ticket.streefdatum ? formatDate(ticket.streefdatum) : "—"}</dd>
            </div>
            <div className="kv">
              <dt>Omvang</dt>
              <dd>{ticket.omvang ?? "—"}</dd>
            </div>
            <div className="kv">
              <dt>Laatst bijgewerkt</dt>
              <dd>{formatDate(ticket.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
