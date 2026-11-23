"use client";

import { useMemo, useState } from "react";
import { TicketList } from "@/components/TicketList";
import { TicketTable } from "@/components/TicketTable";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from "@/lib/labels";
import {
  chipOptionsFromTickets,
  emptyChipFilters,
  filterTickets,
  hasActiveChipFilters,
  type TicketChipFilters,
} from "@/lib/ticket-search";
import type {
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketSystem,
  TicketType,
} from "@/lib/types";
import styles from "./FilteredTicketList.module.css";

export type TicketFilterDims =
  | "systeem"
  | "status"
  | "afdeling"
  | "type"
  | "prioriteit";

interface FilteredTicketListProps {
  tickets: Ticket[];
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Which chip groups to offer (only shown when the list has 2+ values). */
  filterDims?: TicketFilterDims[];
  showRank?: boolean;
  showVote?: boolean;
  currentUserId?: string;
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
  /** List rows (default) or sortable spreadsheet table (Overzicht). */
  variant?: "list" | "table";
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * Client search + filter chips over an already-loaded ticket list.
 */
export function FilteredTicketList({
  tickets,
  searchPlaceholder = "Zoek op nummer, onderwerp of trefwoord…",
  searchLabel = "Zoeken in tickets",
  filterDims = ["systeem", "status", "afdeling"],
  showRank = false,
  showVote = false,
  currentUserId = "",
  emptyMessage = "Geen tickets gevonden.",
  emptyHref,
  emptyCta,
  variant = "list",
}: FilteredTicketListProps) {
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState<TicketChipFilters>(() => emptyChipFilters());

  const options = useMemo(() => chipOptionsFromTickets(tickets), [tickets]);
  const filtered = useMemo(
    () => filterTickets(tickets, query, chips),
    [tickets, query, chips],
  );

  const hasQuery = query.trim().length > 0;
  const hasChips = hasActiveChipFilters(chips);
  const hasFilters = hasQuery || hasChips;

  const showSysteem =
    filterDims.includes("systeem") && options.systemen.length > 1;
  const showStatus =
    filterDims.includes("status") && options.statussen.length > 1;
  const showAfdeling =
    filterDims.includes("afdeling") && options.afdelingen.length > 1;
  const showType = filterDims.includes("type") && options.types.length > 1;
  const showPrioriteit =
    filterDims.includes("prioriteit") && options.prioriteiten.length > 1;
  const showAnyChips =
    showSysteem || showStatus || showAfdeling || showType || showPrioriteit;

  function clearFilters() {
    setQuery("");
    setChips(emptyChipFilters());
  }

  return (
    <>
      <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            autoComplete="off"
          />
          {hasFilters ? (
            <span className="form-hint" aria-live="polite">
              {filtered.length} van {tickets.length}
            </span>
          ) : null}
          {hasFilters ? (
            <button type="button" className={styles.clear} onClick={clearFilters}>
              Filters wissen
            </button>
          ) : null}
        </div>

        {showAnyChips ? (
          <div className={styles.filters}>
            {showSysteem ? (
              <div className={styles.group} role="group" aria-label="Filter op systeem">
                <span className={styles.label}>Systeem</span>
                {options.systemen.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${chips.systemen.has(value) ? styles.chipActive : ""}`}
                    aria-pressed={chips.systemen.has(value)}
                    onClick={() =>
                      setChips((c) => ({
                        ...c,
                        systemen: toggleInSet(c.systemen, value as TicketSystem),
                      }))
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}

            {showStatus ? (
              <div className={styles.group} role="group" aria-label="Filter op status">
                <span className={styles.label}>Status</span>
                {options.statussen.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${chips.statussen.has(value) ? styles.chipActive : ""}`}
                    aria-pressed={chips.statussen.has(value)}
                    onClick={() =>
                      setChips((c) => ({
                        ...c,
                        statussen: toggleInSet(c.statussen, value as TicketStatus),
                      }))
                    }
                  >
                    {STATUS_LABEL[value]}
                  </button>
                ))}
              </div>
            ) : null}

            {showType ? (
              <div className={styles.group} role="group" aria-label="Filter op type">
                <span className={styles.label}>Type</span>
                {options.types.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${chips.types.has(value) ? styles.chipActive : ""}`}
                    aria-pressed={chips.types.has(value)}
                    onClick={() =>
                      setChips((c) => ({
                        ...c,
                        types: toggleInSet(c.types, value as TicketType),
                      }))
                    }
                  >
                    {TYPE_LABEL[value]}
                  </button>
                ))}
              </div>
            ) : null}

            {showPrioriteit ? (
              <div
                className={styles.group}
                role="group"
                aria-label="Filter op prioriteit"
              >
                <span className={styles.label}>Prioriteit</span>
                {options.prioriteiten.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${chips.prioriteiten.has(value) ? styles.chipActive : ""}`}
                    aria-pressed={chips.prioriteiten.has(value)}
                    onClick={() =>
                      setChips((c) => ({
                        ...c,
                        prioriteiten: toggleInSet(
                          c.prioriteiten,
                          value as TicketPriority,
                        ),
                      }))
                    }
                  >
                    {PRIORITY_LABEL[value]}
                  </button>
                ))}
              </div>
            ) : null}

            {showAfdeling ? (
              <div className={styles.group} role="group" aria-label="Filter op afdeling">
                <span className={styles.label}>Afdeling</span>
                {options.afdelingen.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${chips.afdelingen.has(value) ? styles.chipActive : ""}`}
                    aria-pressed={chips.afdelingen.has(value)}
                    onClick={() =>
                      setChips((c) => ({
                        ...c,
                        afdelingen: toggleInSet(c.afdelingen, value),
                      }))
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {variant === "table" ? (
        <TicketTable
          tickets={filtered}
          emptyMessage={
            hasFilters ? "Geen tickets voor deze filters." : emptyMessage
          }
          emptyHref={emptyHref}
          emptyCta={hasFilters ? "" : emptyCta}
        />
      ) : (
        <TicketList
          tickets={filtered}
          showRank={showRank}
          showVote={showVote}
          currentUserId={currentUserId}
          emptyMessage={
            hasFilters ? "Geen tickets voor deze filters." : emptyMessage
          }
          emptyHref={emptyHref}
          emptyCta={hasFilters ? "" : emptyCta}
        />
      )}
    </>
  );
}
