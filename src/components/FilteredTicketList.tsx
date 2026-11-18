"use client";

import { useMemo, useState } from "react";
import { TicketList } from "@/components/TicketList";
import { filterTicketsByQuery } from "@/lib/ticket-search";
import type { Ticket } from "@/lib/types";

interface FilteredTicketListProps {
  tickets: Ticket[];
  searchPlaceholder?: string;
  searchLabel?: string;
  showRank?: boolean;
  showVote?: boolean;
  currentUserId?: string;
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
}

/**
 * Client search bar over an already-loaded ticket list (nummer, titel, body, meta).
 */
export function FilteredTicketList({
  tickets,
  searchPlaceholder = "Zoek op nummer, onderwerp of trefwoord…",
  searchLabel = "Zoeken in tickets",
  showRank = false,
  showVote = false,
  currentUserId = "",
  emptyMessage = "Geen tickets gevonden.",
  emptyHref,
  emptyCta,
}: FilteredTicketListProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterTicketsByQuery(tickets, query),
    [tickets, query],
  );
  const hasQuery = query.trim().length > 0;

  return (
    <>
      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          autoComplete="off"
        />
        {hasQuery ? (
          <span className="form-hint" aria-live="polite">
            {filtered.length} van {tickets.length}
          </span>
        ) : null}
      </div>

      <TicketList
        tickets={filtered}
        showRank={showRank}
        showVote={showVote}
        currentUserId={currentUserId}
        emptyMessage={
          hasQuery
            ? "Geen tickets voor deze zoekopdracht."
            : emptyMessage
        }
        emptyHref={emptyHref}
        emptyCta={hasQuery ? "" : emptyCta}
      />
    </>
  );
}
