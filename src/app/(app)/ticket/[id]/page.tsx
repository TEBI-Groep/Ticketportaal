import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CommentThread } from "@/components/CommentThread";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TicketItDetail } from "@/components/TicketItDetail";
import { TicketWatchBell } from "@/components/TicketWatchBell";
import layoutStyles from "@/components/TicketInlineEdit.module.css";
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
  searchParams: Promise<{ note?: string; comment?: string }>;
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string; comment?: string }>;
}) {
  const { id } = await params;
  const { note: highlightNoteId, comment: highlightCommentId } =
    await searchParams;
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
    isIt ? getItNotesForTicket(ticket.id) : Promise.resolve([]),
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

      {isIt ? (
        <TicketItDetail
          ticket={ticket}
          comments={comments}
          itNotes={itNotes}
          attachments={attachments}
          uitvoerders={uitvoerders}
          melders={activeMelders}
          departments={departments}
          watching={watching}
          currentUserId={user.id}
          viewerRol={user.rol}
          highlightNoteId={highlightNoteId ?? null}
          highlightCommentId={highlightCommentId ?? null}
        />
      ) : (
        /* Same split as IT: main ticket body left, Updates & vragen on the right. */
        <div className={layoutStyles.detailSplit}>
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
                {ticket.prive ? (
                  <span className="badge" title="Alleen melder en IT">
                    Privé
                  </span>
                ) : null}
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
                <dt>Afdelingen</dt>
                <dd>{formatAfdelingen(ticket.afdelingen)}</dd>
              </div>
              <div className="kv">
                <dt>Omvang</dt>
                <dd>{ticket.omvang ?? "—"}</dd>
              </div>
              <div className="kv">
                <dt>Privé</dt>
                <dd>{ticket.prive ? "Ja" : "Nee"}</dd>
              </div>
              {/* People grouped together. */}
              <div className="kv">
                <dt>Melder</dt>
                <dd>{ticket.melderNaam}</dd>
              </div>
              <div className="kv">
                <dt>Eigenaar</dt>
                <dd>{ticket.eigenaarNaam ?? "Nog niet geclaimd"}</dd>
              </div>
              {/* Dates grouped together. */}
              <div className="kv">
                <dt>Aangemaakt</dt>
                <dd>{formatDate(ticket.createdAt)}</dd>
              </div>
              <div className="kv">
                <dt>Streefdatum</dt>
                <dd>
                  {ticket.streefdatum ? formatDate(ticket.streefdatum) : "—"}
                </dd>
              </div>
              <div className="kv">
                <dt>Laatst bijgewerkt</dt>
                <dd>{formatDate(ticket.updatedAt)}</dd>
              </div>
            </dl>

            <h2>Omschrijving</h2>
            <p style={{ color: "var(--ink-soft)", marginBottom: "1.25rem" }}>
              {ticket.omschrijving}
            </p>

            {ticket.oplossingSamenvatting ? (
              <>
                <h2>Oplossing</h2>
                <p style={{ color: "var(--ink-soft)" }}>
                  {ticket.oplossingSamenvatting}
                </p>
              </>
            ) : null}

            <TicketAttachments
              ticketId={ticket.id}
              initialAttachments={attachments}
              currentUserId={user.id}
              canDeleteAny={false}
            />

            {canVote ? (
              <div style={{ marginTop: "1.5rem" }}>
                <h2>Beoordeling</h2>
                <p className="form-hint" style={{ marginBottom: "0.75rem" }}>
                  Beoordeel dit verzoek met 1–5 sterren. Het gemiddelde bepaalt
                  de plek op de ranglijst.
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

          <aside
            className={layoutStyles.sideRail}
            aria-label="Updates en vragen"
          >
            <div className="detail-panel">
              <CommentThread
                ticketId={ticket.id}
                initialComments={comments}
                embedded
                highlightCommentId={highlightCommentId ?? null}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Ticket detail — inline IT editing for uitvoerders; read-only for others. */
export default function TicketDetailPage({ params, searchParams }: PageProps) {
  return (
    <div className="page">
      <Suspense fallback={<p className="form-hint">Ticket laden…</p>}>
        <TicketDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
