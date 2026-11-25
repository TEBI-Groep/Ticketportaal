"use client";

import { useState } from "react";
import { TicketTable } from "@/components/TicketTable";
import type { Ticket } from "@/lib/types";
import styles from "./TicketTable.module.css";

interface OverzichtTablesProps {
  spoedTickets: Ticket[];
  overigeTickets: Ticket[];
}

/**
 * Overzicht body: one shared search above Spoed (when present) + Overige.
 * Search always stays visible even when there are no Spoed tickets.
 */
export function OverzichtTables({
  spoedTickets,
  overigeTickets,
}: OverzichtTablesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchActive = searchQuery.trim().length > 0;

  return (
    <>
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
        {searchActive ? (
          <div className={styles.filterBar}>
            <button
              type="button"
              className={styles.clearFilters}
              onClick={() => setSearchQuery("")}
            >
              Zoekopdracht wissen
            </button>
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
          emptyMessage="Geen open tickets zichtbaar."
          emptyCta="Ticket aanmaken"
        />
      </section>
    </>
  );
}
