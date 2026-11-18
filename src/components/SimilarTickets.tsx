"use client";

import Link from "next/link";
import type { Ticket } from "@/lib/types";
import { isStembaar, ratingAantal, ratingGemiddelde } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/labels";
import styles from "./SimilarTickets.module.css";

interface SimilarTicketsProps {
  tickets: Ticket[];
  query: string;
  loading?: boolean;
}

/**
 * Create-form panel: possible duplicates / related tickets for the draft onderwerp.
 */
export function SimilarTickets({
  tickets,
  query,
  loading = false,
}: SimilarTicketsProps) {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  return (
    <div className={styles.panel} aria-live="polite">
      <div className={styles.header}>
        <strong>Vergelijkbare tickets</strong>
        <span className="form-hint">
          {loading
            ? "Zoeken…"
            : tickets.length === 0
              ? "Geen vergelijkbare tickets gevonden."
              : "Bestaat dit al? Open of stem i.p.v. een nieuw ticket."}
        </span>
      </div>

      {!loading && tickets.length > 0 ? (
        <ul className={styles.list}>
          {tickets.map((ticket) => {
            const canVote = isStembaar(ticket);
            const avg = ratingGemiddelde(ticket);
            const count = ratingAantal(ticket);
            return (
              <li key={ticket.id} className={styles.item}>
                <div className={styles.meta}>
                  <Link
                    href={`/ticket/${ticket.id}?van=${encodeURIComponent("/ticket/nieuw")}`}
                    className={styles.title}
                  >
                    {ticket.ticketnummer} · {ticket.onderwerp}
                  </Link>
                  <span className={styles.sub}>
                    {STATUS_LABEL[ticket.status]} · {ticket.systeem}
                    {count > 0 ? ` · gem. ${avg.toFixed(1)} (${count})` : ""}
                  </span>
                </div>
                <div className={styles.actions}>
                  <Link
                    href={`/ticket/${ticket.id}?van=${encodeURIComponent("/ticket/nieuw")}`}
                    className="btn btn-secondary"
                    style={{ minHeight: "2rem", padding: "0.35rem 0.75rem" }}
                  >
                    {canVote ? "Bekijk / stem" : "Bekijk"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
