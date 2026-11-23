import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CommentThread } from "@/components/CommentThread";
import { ItNotes } from "@/components/ItNotes";
import { ItTicketEditor } from "@/components/ItTicketEditor";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TicketWatchBell } from "@/components/TicketWatchBell";
import { requireUser } from "@/data/auth";
import { getAttachmentsForTicket } from "@/data/attachments";
import {
  getCommentsForTicket,
  getItNotesForTicket,
  getTicketById,
} from "@/data/tickets";
import { listDepartments, listUsers, listUitvoerders } from "@/data/users";
import { isWatchingTicket } from "@/data/watchers";
import {
  IMPACT_LABEL,
  TYPE_LABEL,
  formatAfdelingen,
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
  const ticket = await getTicketById(id);
  return {
    title: ticket ? `${ticket.ticketnummer}` : "Ticket",
  };
}

async function TicketDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ticket, user] = await Promise.all([
    getTicketById(id),
    requireUser(),
  ]);

  if (!ticket) {
    notFound();
  }

  const canVote = isStembaar(ticket);
  const avg = ratingGemiddelde(ticket);
  const count = ratingAantal(ticket);
  const mine = mijnRating(ticket, user.id);
  const isIt = user.rol === "uitvoerder";
  const [
    comments,
    itNotes,
    attachments,
    uitvoerders,
    melders,
    departments,
    watching,
  ] = await Promise.all([
    getCommentsForTicket(ticket.id),
    getItNotesForTicket(ticket.id),
    getAttachmentsForTicket(ticket.id),
    isIt ? listUitvoerders() : Promise.resolve([]),
    isIt ? listUsers() : Promise.resolve([]),
    isIt ? listDepartments() : Promise.resolve([]),
    isWatchingTicket(ticket.id, user.id),
  ]);
  const activeMelders = melders.filter(
    (u) => u.actief || u.id === ticket.melderId,
  );

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Suspense
          fallback={
            <span className="btn btn-ghost" aria-hidden>
              ← Terug
            </span>
          }
        >
          <BackLink />
        </Suspense>
      </p>

      <div className="detail-grid split">
        <section className="detail-panel">
          <div className="detail-title-row">
            <h1>
              {ticket.ticketnummer} · {ticket.onderwerp}
            </h1>
            <div
              style={{
                display: "flex",
                gap: "0.35rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.prioriteit} />
              <TicketWatchBell
                ticketId={ticket.id}
                ticketLabel={ticket.ticketnummer}
                initiallyWatching={watching}
              />
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
              <dt>Afdelingen</dt>
              <dd>{formatAfdelingen(ticket.afdelingen)}</dd>
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

          <TicketAttachments
            ticketId={ticket.id}
            initialAttachments={attachments}
            currentUserId={user.id}
            canDeleteAny={isIt}
          />

          <CommentThread ticketId={ticket.id} initialComments={comments} />

          {canVote ? (
            <div style={{ marginTop: "1.5rem" }}>
              <h2>Beoordeling</h2>
              <p className="form-hint" style={{ marginBottom: "0.75rem" }}>
                Beoordeel dit verzoek met 1–5 sterren. Het gemiddelde bepaalt de
                plek op de ranglijst (advies aan IT).
              </p>
              <StarRating
                key={`${ticket.id}-${mine ?? 0}-${count}`}
                ticketId={ticket.id}
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
          {isIt ? (
            <>
              <p className="form-hint" style={{ marginBottom: "1rem" }}>
                Status, prioriteit, eigenaar en overige IT-velden bewerken.
              </p>
              <ItTicketEditor
                ticket={ticket}
                uitvoerders={uitvoerders}
                melders={activeMelders}
                departments={departments}
              />
              <div style={{ marginTop: "1.5rem" }}>
                <ItNotes
                  ticketId={ticket.id}
                  initialNotes={itNotes}
                  viewerRol={user.rol}
                />
              </div>
            </>
          ) : (
            <>
              <p className="form-hint" style={{ marginBottom: "1rem" }}>
                IT-velden en interne notities zijn voor uitvoerders.
              </p>
              <dl className="kv-grid">
                <div className="kv">
                  <dt>Eigenaar</dt>
                  <dd>{ticket.eigenaarNaam ?? "Nog niet geclaimd"}</dd>
                </div>
                <div className="kv">
                  <dt>Streefdatum</dt>
                  <dd>
                    {ticket.streefdatum ? formatDate(ticket.streefdatum) : "—"}
                  </dd>
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
              <ItNotes
                ticketId={ticket.id}
                initialNotes={itNotes}
                viewerRol={user.rol}
              />
            </>
          )}
        </aside>
      </div>
    </>
  );
}

/** Ticket detail — requester fields + IT panel + comments / notes. */
export default function TicketDetailPage({ params }: PageProps) {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Ticket laden…</p>}>
        <TicketDetailContent params={params} />
      </Suspense>
    </div>
  );
}
