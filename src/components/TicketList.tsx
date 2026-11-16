"use client";

import Link from "next/link";
import type { Ticket } from "@/lib/types";
import {
  isStembaar,
  mijnRating,
  ratingAantal,
  ratingGemiddelde,
} from "@/lib/types";
import { IMPACT_LABEL, formatDate } from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { MOCK_USER } from "@/data/mock";

interface TicketListProps {
  tickets: Ticket[];
  /** Show leaderboard rank numbers (#1, #2, …). */
  showRank?: boolean;
  /** Show 1–5 star rating where voting is allowed. */
  showVote?: boolean;
  /** Extra empty-state copy. */
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
}

/**
 * List-first ticket presentation (wireframe direction A).
 * Rows navigate to detail; star rating stays outside the link hit-area.
 */
export function TicketList({
  tickets,
  showRank = false,
  showVote = false,
  emptyMessage = "Geen tickets gevonden.",
  emptyHref = "/ticket/nieuw",
  emptyCta = "Ticket aanmaken",
}: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
        {emptyCta ? (
          <Link href={emptyHref} className="btn btn-primary">
            {emptyCta}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <ul className={`ticket-list ${showRank ? "" : "list-compact"}`}>
      {tickets.map((ticket, index) => {
        const canRate = showVote && isStembaar(ticket);
        const avg = ratingGemiddelde(ticket);
        const count = ratingAantal(ticket);
        const mine = mijnRating(ticket, MOCK_USER.id);
        const showStars = showVote && (canRate || count > 0);

        return (
          <li
            key={ticket.id}
            className={`ticket-row ${showVote ? "with-vote" : ""}`}
          >
            <Link href={`/ticket/${ticket.id}`} className="ticket-row-link">
              {showRank ? (
                <span className="ticket-rank" aria-label={`Positie ${index + 1}`}>
                  {index + 1}
                </span>
              ) : null}

              <div className="ticket-main">
                <div className="ticket-title">
                  {ticket.ticketnummer} · {ticket.onderwerp}
                </div>
                <div className="ticket-meta">
                  <StatusBadge status={ticket.status} />
                  {ticket.prioriteit === "spoed" ? (
                    <PriorityBadge priority={ticket.prioriteit} />
                  ) : null}
                  <span>{ticket.systeem}</span>
                  <span>{IMPACT_LABEL[ticket.impact]}</span>
                  <span>{ticket.afdeling}</span>
                  <span>Bijgewerkt {formatDate(ticket.updatedAt)}</span>
                </div>
                {ticket.oplossingSamenvatting ? (
                  <p className="form-hint" style={{ marginTop: "0.35rem" }}>
                    {ticket.oplossingSamenvatting}
                  </p>
                ) : null}
              </div>
            </Link>

            {showStars ? (
              <div className="ticket-actions">
                <StarRating
                  average={avg}
                  count={count}
                  myRating={mine}
                  beoordelingen={ticket.beoordelingen}
                  interactive={canRate}
                  compact
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
