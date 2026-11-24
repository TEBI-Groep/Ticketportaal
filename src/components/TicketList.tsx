"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Ticket } from "@/lib/types";
import {
  isStembaar,
  mijnRating,
  ratingAantal,
  ratingGemiddelde,
} from "@/lib/types";
import {
  PRIORITY_LABEL,
  TYPE_LABEL,
  formatDate,
} from "@/lib/labels";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";

interface TicketListProps {
  tickets: Ticket[];
  /** Show leaderboard rank numbers (#1, #2, …). */
  showRank?: boolean;
  /** Show 1–5 star rating where voting is allowed. */
  showVote?: boolean;
  /** Current user id for “Jij: n★”. */
  currentUserId?: string;
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
  currentUserId = "",
  emptyMessage = "Geen tickets gevonden.",
  emptyHref = "/ticket/nieuw",
  emptyCta = "Ticket aanmaken",
}: TicketListProps) {
  const pathname = usePathname();
  /* Remember which list opened the ticket so detail “Terug” can return here. */
  const ticketHref = (id: string) =>
    `/ticket/${id}?van=${encodeURIComponent(pathname)}`;

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
        const mine = mijnRating(ticket, currentUserId);
        // Keep a ratings column whenever voting UI is enabled so rows align
        // (Werkvoorraad mixes stembare and non-stembare tickets).
        const showStars = showVote && (canRate || count > 0);

        return (
          <li
            key={ticket.id}
            className={`ticket-row ${showVote ? "with-vote" : ""}`}
          >
            <Link href={ticketHref(ticket.id)} className="ticket-row-link">
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
                  ) : (
                    <span>{PRIORITY_LABEL[ticket.prioriteit]}</span>
                  )}
                  <span>{TYPE_LABEL[ticket.type]}</span>
                  <span>{ticket.systeem}</span>
                  <span>{ticket.afdelingen.join(", ") || "—"}</span>
                  <span>Melder: {ticket.melderNaam || "—"}</span>
                  <span>
                    Eigenaar: {ticket.eigenaarNaam ?? "Nog niet geclaimd"}
                  </span>
                  <span>
                    Streefdatum{" "}
                    {ticket.streefdatum ? formatDate(ticket.streefdatum) : "—"}
                  </span>
                  <span>Omvang {ticket.omvang ?? "—"}</span>
                  {ticket.prive ? <span>Privé</span> : null}
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
                {showStars ? (
                  <StarRating
                    key={`${ticket.id}-${mine ?? 0}-${count}`}
                    ticketId={ticket.id}
                    average={avg}
                    count={count}
                    myRating={mine}
                    beoordelingen={ticket.beoordelingen}
                    interactive={canRate}
                    compact
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
