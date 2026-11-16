"use client";

import Link from "next/link";
import type { Ticket } from "@/lib/types";
import { isStembaar } from "@/lib/types";
import { IMPACT_LABEL, STATUS_LABEL, formatDate } from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";

interface TicketListProps {
  tickets: Ticket[];
  /** Show leaderboard rank numbers (#1, #2, …). */
  showRank?: boolean;
  /** Show inline stem actie where voting is allowed. */
  showVote?: boolean;
  /** Extra empty-state copy. */
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
}

/**
 * List-first ticket presentation (wireframe direction A).
 * Rows navigate to detail; vote buttons stop propagation via nested control.
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
        const canVote = showVote && isStembaar(ticket);

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

            {showVote ? (
              <div className="ticket-actions">
                <span className="vote-count" title="Aantal stemmen">
                  ▲ {ticket.stemmen}
                </span>
                {canVote ? (
                  <button
                    type="button"
                    className={`btn btn-vote ${ticket.gestemdDoorMij ? "is-active" : ""}`}
                    /* Mock-only: visual toggle hint; no persistence yet. */
                    onClick={(e) => {
                      e.preventDefault();
                      window.alert(
                        ticket.gestemdDoorMij
                          ? "In de echte app zou je stem hier worden ingetrokken."
                          : "In de echte app zou je hier 1 stem plaatsen (max 5).",
                      );
                    }}
                  >
                    {ticket.gestemdDoorMij ? "Intrekken" : "Stem"}
                  </button>
                ) : (
                  <span className="form-hint">{STATUS_LABEL[ticket.status]}</span>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
