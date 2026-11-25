"use client";

import { useMemo, useState } from "react";
import { TicketTable } from "@/components/TicketTable";
import type { Ticket } from "@/lib/types";
import styles from "./TicketTable.module.css";

interface OverzichtTablesProps {
  spoedTickets: Ticket[];
  overigeTickets: Ticket[];
  /** When set, show the Mijn werk toggle (IT only). */
  currentUserId?: string;
  currentUserNaam?: string;
  showMijnWerkToggle?: boolean;
}

/**
 * Overzicht body: shared search + optional Mijn werk Eigenaar filter toggle.
 * Search always stays visible even when there are no Spoed tickets.
 */
export function OverzichtTables({
  spoedTickets,
  overigeTickets,
  currentUserId,
  currentUserNaam,
  showMijnWerkToggle = false,
}: OverzichtTablesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  // Toggle filters both tables to tickets owned by the signed-in Beheerder.
  const [mijnWerk, setMijnWerk] = useState(false);
  const searchActive = searchQuery.trim().length > 0;

  const forcedFilters = useMemo(() => {
    if (!mijnWerk || !currentUserNaam) return undefined;
    return { eigenaar: new Set([currentUserNaam]) };
  }, [mijnWerk, currentUserNaam]);

  return (
    <>
      <header className="page-header page-headerWithAction">
        <h1>Overzicht</h1>
        {showMijnWerkToggle && currentUserId && currentUserNaam ? (
          <button
            type="button"
            className={mijnWerk ? "btn btn-primary" : "btn btn-secondary"}
            aria-pressed={mijnWerk}
            title={
              mijnWerk
                ? "Toon weer alle tickets"
                : "Toon alleen tickets waar jij Eigenaar van bent"
            }
            onClick={() => setMijnWerk((on) => !on)}
          >
            Mijn werk
          </button>
        ) : null}
      </header>

      {/* Shared search — filters both Spoed and Overige tables. */}
      <div className={styles.toolbar}>
        <input
          className={`search-input ${styles.searchInput}`}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek in het overzicht…"
          aria-label="Zoeken in het overzicht"
          autoComplete="off"
        />
        {searchActive || mijnWerk ? (
          <div className={styles.filterBar}>
            {mijnWerk ? (
              <span className="form-hint" aria-live="polite">
                Filter: Eigenaar = {currentUserNaam}
              </span>
            ) : null}
            {searchActive ? (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={() => setSearchQuery("")}
              >
                Zoekopdracht wissen
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Spoed section only when there is at least one urgent ticket. */}
      {spoedTickets.length > 0 ? (
        <section
          aria-labelledby="overzicht-spoed-heading"
          style={{ marginBottom: "2rem" }}
        >
          <h2
            id="overzicht-spoed-heading"
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              margin: "0 0 0.65rem",
              color: "var(--ink)",
            }}
          >
            Spoed
            <span
              className="form-hint"
              style={{ fontWeight: 500, marginLeft: "0.5rem" }}
            >
              ({spoedTickets.length})
            </span>
          </h2>
          <TicketTable
            tickets={spoedTickets}
            hideSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            forcedFilters={forcedFilters}
            emptyMessage="Geen spoedtickets — mooi."
            emptyCta=""
          />
        </section>
      ) : null}

      {/* Main open-ticket table — Spoed excluded. */}
      <section aria-labelledby="overzicht-overig-heading">
        <h2
          id="overzicht-overig-heading"
          style={{
            fontSize: "1.15rem",
            fontWeight: 700,
            margin: "0 0 0.65rem",
            color: "var(--ink)",
          }}
        >
          Overige tickets
        </h2>
        <TicketTable
          tickets={overigeTickets}
          hideSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          forcedFilters={forcedFilters}
          emptyMessage="Geen open tickets zichtbaar."
          emptyCta="Ticket aanmaken"
        />
      </section>
    </>
  );
}
