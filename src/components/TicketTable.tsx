"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  formatDate,
} from "@/lib/labels";
import { filterTicketsByQuery } from "@/lib/ticket-search";
import type {
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@/lib/types";
import styles from "./TicketTable.module.css";

/** Columns that support client-side sorting / filtering on Overzicht. */
export type TicketSortKey =
  | "ticketnummer"
  | "onderwerp"
  | "status"
  | "prioriteit"
  | "type"
  | "systeem"
  | "afdeling"
  | "melder"
  | "eigenaar"
  | "streefdatum"
  | "omvang"
  | "updatedAt";

type SortDir = "asc" | "desc";

/** Active column filters: empty/missing set = no filter on that column. */
type ColumnFilters = Partial<Record<TicketSortKey, Set<string>>>;

const COLUMNS: Array<{ key: TicketSortKey; label: string }> = [
  { key: "ticketnummer", label: "Nummer" },
  { key: "onderwerp", label: "Onderwerp" },
  { key: "status", label: "Status" },
  { key: "prioriteit", label: "Prioriteit" },
  { key: "type", label: "Type" },
  { key: "systeem", label: "Systeem" },
  { key: "afdeling", label: "Afdeling" },
  { key: "melder", label: "Melder" },
  { key: "eigenaar", label: "Eigenaar" },
  { key: "streefdatum", label: "Streefdatum" },
  { key: "omvang", label: "Omvang" },
  { key: "updatedAt", label: "Bijgewerkt" },
];

/** Fixed status order so “Nieuw” sorts before “Afgerond”, not alphabetically. */
const STATUS_RANK: Record<TicketStatus, number> = {
  nieuw: 0,
  ingepland: 1,
  in_behandeling: 2,
  wacht_op_melder: 3,
  wacht_op_publicatie: 4,
  afgerond: 5,
  afgewezen: 6,
};

/** Fixed priority order: Spoed first. */
const PRIORITY_RANK: Record<TicketPriority, number> = {
  spoed: 0,
  hoog: 1,
  gemiddeld: 2,
  laag: 3,
};

const SIZE_RANK: Record<string, number> = { S: 0, M: 1, L: 2 };

/** Default Overzicht order: soonest streefdatum, then Spoed-first prioriteit. */
const DEFAULT_SORT_KEY: TicketSortKey = "streefdatum";
const DEFAULT_SORT_DIR: SortDir = "asc";

/** Empty placeholder stored as a stable filter token. */
const EMPTY_TOKEN = "__empty__";

/** First click direction when activating a column as primary sort. */
function initialSortDir(key: TicketSortKey): SortDir {
  return key === "updatedAt" ? "desc" : "asc";
}

/**
 * Primary sort, then fixed tie-breakers Streefdatum → prioriteit
 * (skip whichever is already the primary), then ticketnummer.
 */
function compareWithTieBreakers(
  a: Ticket,
  b: Ticket,
  sortKey: TicketSortKey,
  sortDir: SortDir,
): number {
  const primary = compareTickets(a, b, sortKey, sortDir);
  if (primary !== 0) return primary;

  if (sortKey !== "streefdatum") {
    const byStreef = compareTickets(a, b, "streefdatum", "asc");
    if (byStreef !== 0) return byStreef;
  }
  if (sortKey !== "prioriteit") {
    const byPrio = compareTickets(a, b, "prioriteit", "asc");
    if (byPrio !== 0) return byPrio;
  }

  return a.ticketnummer.localeCompare(b.ticketnummer, "nl", {
    numeric: true,
  });
}

function compareNullableDate(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareTickets(
  a: Ticket,
  b: Ticket,
  key: TicketSortKey,
  dir: SortDir,
): number {
  let cmp = 0;
  switch (key) {
    case "ticketnummer":
      cmp = a.ticketnummer.localeCompare(b.ticketnummer, "nl", {
        numeric: true,
      });
      break;
    case "onderwerp":
      cmp = a.onderwerp.localeCompare(b.onderwerp, "nl", {
        sensitivity: "base",
      });
      break;
    case "status":
      cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      break;
    case "prioriteit":
      cmp = PRIORITY_RANK[a.prioriteit] - PRIORITY_RANK[b.prioriteit];
      break;
    case "type":
      cmp = TYPE_LABEL[a.type].localeCompare(TYPE_LABEL[b.type], "nl");
      break;
    case "systeem":
      cmp = a.systeem.localeCompare(b.systeem, "nl");
      break;
    case "afdeling":
      cmp = (a.afdelingen.join(", ") || "").localeCompare(
        b.afdelingen.join(", ") || "",
        "nl",
      );
      break;
    case "melder":
      cmp = (a.melderNaam || "").localeCompare(b.melderNaam || "", "nl", {
        sensitivity: "base",
      });
      break;
    case "eigenaar":
      cmp = (a.eigenaarNaam || "").localeCompare(b.eigenaarNaam || "", "nl", {
        sensitivity: "base",
      });
      break;
    case "streefdatum":
      cmp = compareNullableDate(a.streefdatum, b.streefdatum);
      break;
    case "omvang":
      cmp =
        (SIZE_RANK[a.omvang ?? ""] ?? 99) - (SIZE_RANK[b.omvang ?? ""] ?? 99);
      break;
    case "updatedAt":
      cmp = a.updatedAt.localeCompare(b.updatedAt);
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

/** Raw filter tokens for a ticket/column (afdeling can yield multiple). */
function filterTokens(ticket: Ticket, key: TicketSortKey): string[] {
  switch (key) {
    case "ticketnummer":
      return [ticket.ticketnummer];
    case "onderwerp":
      return [ticket.onderwerp];
    case "status":
      return [ticket.status];
    case "prioriteit":
      return [ticket.prioriteit];
    case "type":
      return [ticket.type];
    case "systeem":
      return [ticket.systeem];
    case "afdeling":
      return ticket.afdelingen.length > 0
        ? ticket.afdelingen
        : [EMPTY_TOKEN];
    case "melder":
      return [ticket.melderNaam || EMPTY_TOKEN];
    case "eigenaar":
      return [ticket.eigenaarNaam || EMPTY_TOKEN];
    case "streefdatum":
      return [ticket.streefdatum || EMPTY_TOKEN];
    case "omvang":
      return [ticket.omvang || EMPTY_TOKEN];
    case "updatedAt":
      return [ticket.updatedAt];
  }
}

/** Human label for a filter token in the dropdown. */
function filterLabel(key: TicketSortKey, token: string): string {
  if (token === EMPTY_TOKEN) {
    if (key === "eigenaar") return "Nog niet geclaimd";
    return "—";
  }
  switch (key) {
    case "status":
      return STATUS_LABEL[token as TicketStatus] ?? token;
    case "prioriteit":
      return PRIORITY_LABEL[token as TicketPriority] ?? token;
    case "type":
      return TYPE_LABEL[token as TicketType] ?? token;
    case "streefdatum":
    case "updatedAt":
      return formatDate(token);
    default:
      return token;
  }
}

function ticketMatchesColumn(
  ticket: Ticket,
  key: TicketSortKey,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true;
  return filterTokens(ticket, key).some((token) => selected.has(token));
}

function ticketMatchesFilters(
  ticket: Ticket,
  filters: ColumnFilters,
): boolean {
  for (const col of COLUMNS) {
    const selected = filters[col.key];
    if (selected && selected.size > 0) {
      if (!ticketMatchesColumn(ticket, col.key, selected)) return false;
    }
  }
  return true;
}

function hasAnyColumnFilter(filters: ColumnFilters): boolean {
  return COLUMNS.some((col) => (filters[col.key]?.size ?? 0) > 0);
}

/** Funnel icon — filled when the column filter is active (Excel cue). */
function FilterFunnelIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={styles.funnelIcon}
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
    >
      <path
        d="M2 2.5h12l-4.5 5.2v4.3L6.5 14V7.7L2 2.5z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TicketTableProps {
  tickets: Ticket[];
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
  /** Global free-text search above the table (combined with column filters). */
  searchPlaceholder?: string;
  searchLabel?: string;
}

type PanelCoords = {
  left: number;
  maxHeight: number;
  width: number;
  /** Prefer opening below the funnel; flip upward when space is tight. */
  openUp: boolean;
  top?: number;
  bottom?: number;
};

/**
 * Spreadsheet-style ticket overview with sortable + filterable headers.
 * Sort: title click cycles activate → flip → reset to default.
 * Filter: funnel button (Excel-like). Tie-breakers always Streefdatum → prioriteit.
 */
export function TicketTable({
  tickets,
  emptyMessage = "Geen tickets gevonden.",
  emptyHref = "/ticket/nieuw",
  emptyCta = "Ticket aanmaken",
  searchPlaceholder = "Zoek in het overzicht…",
  searchLabel = "Zoeken in tickets",
}: TicketTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  /* Default: soonest streefdatum first, then priority severity. */
  const [sortKey, setSortKey] = useState<TicketSortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [filters, setFilters] = useState<ColumnFilters>({});
  const [openFilter, setOpenFilter] = useState<TicketSortKey | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [panelCoords, setPanelCoords] = useState<PanelCoords | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const headerBarRef = useRef<HTMLTableSectionElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const filterBtnRefs = useRef<
    Partial<Record<TicketSortKey, HTMLButtonElement | null>>
  >({});

  const isDefaultSort =
    sortKey === DEFAULT_SORT_KEY && sortDir === DEFAULT_SORT_DIR;

  function resetSort() {
    setSortKey(DEFAULT_SORT_KEY);
    setSortDir(DEFAULT_SORT_DIR);
  }

  function closeFilterPanel() {
    setOpenFilter(null);
    setFilterQuery("");
    setPanelCoords(null);
  }

  /* Portals need document.body — only after mount. */
  useEffect(() => {
    setPortalReady(true);
  }, []);

  /* Position the filter panel in the viewport (avoids table overflow clipping). */
  useEffect(() => {
    if (!openFilter) {
      setPanelCoords(null);
      return;
    }

    function placePanel() {
      const btn = filterBtnRefs.current[openFilter!];
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = 210;
      const gap = 4;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(320, openUp ? spaceAbove : spaceBelow),
      );

      if (openUp) {
        setPanelCoords({
          openUp: true,
          left,
          width,
          maxHeight,
          bottom: window.innerHeight - rect.top + gap,
        });
      } else {
        setPanelCoords({
          openUp: false,
          left,
          width,
          maxHeight,
          top: rect.bottom + gap,
        });
      }
    }

    placePanel();
    window.addEventListener("scroll", placePanel, true);
    window.addEventListener("resize", placePanel);
    return () => {
      window.removeEventListener("scroll", placePanel, true);
      window.removeEventListener("resize", placePanel);
    };
  }, [openFilter]);

  /* Close the open filter popover on outside click / Escape. */
  useEffect(() => {
    if (!openFilter) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (headerBarRef.current?.contains(target)) return;
      if (filterPanelRef.current?.contains(target)) return;
      closeFilterPanel();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") closeFilterPanel();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openFilter]);

  /* Text first, then Excel column filters — both apply together. */
  const searched = useMemo(
    () => filterTicketsByQuery(tickets, searchQuery),
    [tickets, searchQuery],
  );

  const filtered = useMemo(
    () => searched.filter((t) => ticketMatchesFilters(t, filters)),
    [searched, filters],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        compareWithTieBreakers(a, b, sortKey, sortDir),
      ),
    [filtered, sortKey, sortDir],
  );

  /* Options for the open column: values still present after search + other filters. */
  const openFilterOptions = useMemo(() => {
    if (!openFilter) return [];
    const others: ColumnFilters = { ...filters };
    delete others[openFilter];
    const pool = searched.filter((t) => ticketMatchesFilters(t, others));
    const counts = new Map<string, number>();
    for (const ticket of pool) {
      for (const token of filterTokens(ticket, openFilter)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([token, count]) => ({
        token,
        count,
        label: filterLabel(openFilter, token),
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "nl", { sensitivity: "base" }),
      );
  }, [openFilter, filters, searched]);

  const visibleFilterOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return openFilterOptions;
    return openFilterOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [openFilterOptions, filterQuery]);

  /* Remember which list opened the ticket so detail “Terug” can return here. */
  const ticketHref = (id: string) =>
    `/ticket/${id}?van=${encodeURIComponent(pathname)}`;

  /**
   * Three-state column sort: activate → flip direction → reset to default
   * (Streefdatum ↑ then prioriteit). Makes “cycling off” land on default.
   */
  function onSort(key: TicketSortKey) {
    if (key === sortKey) {
      const first = initialSortDir(key);
      if (sortDir === first) {
        setSortDir(first === "asc" ? "desc" : "asc");
        return;
      }
      /* Second direction already active → clear back to default order. */
      resetSort();
      return;
    }
    setSortKey(key);
    setSortDir(initialSortDir(key));
  }

  function toggleFilterPanel(key: TicketSortKey) {
    setOpenFilter((cur) => {
      if (cur === key) {
        setFilterQuery("");
        setPanelCoords(null);
        return null;
      }
      setFilterQuery("");
      return key;
    });
  }

  function toggleFilterValue(key: TicketSortKey, token: string) {
    setFilters((prev) => {
      const current = new Set(prev[key] ?? []);
      if (current.has(token)) current.delete(token);
      else current.add(token);
      const next = { ...prev };
      if (current.size === 0) delete next[key];
      else next[key] = current;
      return next;
    });
  }

  function selectAllFilterValues(key: TicketSortKey) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
    closeFilterPanel();
  }

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

  const filtersActive = hasAnyColumnFilter(filters);
  const searchActive = searchQuery.trim().length > 0;
  const narrowed = filtersActive || searchActive;
  const openCol = openFilter
    ? COLUMNS.find((c) => c.key === openFilter)
    : null;
  const openSelected = openFilter
    ? (filters[openFilter] ?? new Set<string>())
    : new Set<string>();
  const openFilterActive = openSelected.size > 0;

  const panelStyle: CSSProperties | undefined = panelCoords
    ? {
        position: "fixed",
        left: panelCoords.left,
        width: panelCoords.width,
        /* Fixed height so the value list can scroll inside the portaled panel. */
        height: panelCoords.maxHeight,
        maxHeight: panelCoords.maxHeight,
        top: panelCoords.openUp ? undefined : panelCoords.top,
        bottom: panelCoords.openUp ? panelCoords.bottom : undefined,
        zIndex: 80,
      }
    : undefined;

  const filterPortal =
    portalReady && openFilter && openCol && panelCoords
      ? createPortal(
          <div
            ref={filterPanelRef}
            className={styles.filterPanel}
            style={panelStyle}
            role="dialog"
            aria-label={`Filter ${openCol.label}`}
          >
            <input
              className={styles.filterSearch}
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Zoek in waarden…"
              aria-label={`Zoek filterwaarden voor ${openCol.label}`}
              autoComplete="off"
            />
            <div className={styles.filterActions}>
              <button
                type="button"
                className={styles.filterAction}
                onClick={() => selectAllFilterValues(openFilter)}
              >
                Alles
              </button>
              <button
                type="button"
                className={styles.filterAction}
                onClick={() => selectAllFilterValues(openFilter)}
                disabled={!openFilterActive}
              >
                Wissen
              </button>
            </div>
            <ul className={styles.filterList}>
              {visibleFilterOptions.length === 0 ? (
                <li className={styles.filterEmpty}>Geen waarden</li>
              ) : (
                visibleFilterOptions.map((opt) => {
                  /* Empty selection means “all”; checkboxes show all on. */
                  const checked =
                    openSelected.size === 0 || openSelected.has(opt.token);
                  return (
                    <li key={opt.token}>
                      <label className={styles.filterOption}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            /* First uncheck from “all” → keep every other option. */
                            if (openSelected.size === 0) {
                              const all = new Set(
                                openFilterOptions.map((o) => o.token),
                              );
                              all.delete(opt.token);
                              setFilters((prev) => ({
                                ...prev,
                                [openFilter]: all,
                              }));
                              return;
                            }
                            toggleFilterValue(openFilter, opt.token);
                          }}
                        />
                        <span className={styles.filterOptionLabel}>
                          {opt.label}
                        </span>
                        <span className={styles.filterCount}>{opt.count}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div>
      {/* Global search restored; works together with column filters. */}
      <div className={styles.toolbar}>
        <input
          className={`search-input ${styles.searchInput}`}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          autoComplete="off"
        />
        {narrowed || !isDefaultSort ? (
          <div className={styles.filterBar}>
            {narrowed ? (
              <span className="form-hint" aria-live="polite">
                {sorted.length} van {tickets.length}
              </span>
            ) : null}
            {!isDefaultSort ? (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={resetSort}
                title="Terug naar Streefdatum, dan prioriteit"
              >
                Sortering resetten
              </button>
            ) : null}
            {filtersActive ? (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={clearAllFilters}
              >
                Filters wissen
              </button>
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

      <div className={styles.wrap}>
        <table className={styles.table}>
          {/* Funnel buttons stay in thead; the menu itself is portaled to body. */}
          <thead ref={headerBarRef}>
            <tr>
              {COLUMNS.map((col) => {
                const sortActive = sortKey === col.key;
                const colFilter = filters[col.key];
                const filterActive = (colFilter?.size ?? 0) > 0;
                const panelOpen = openFilter === col.key;

                return (
                  <th key={col.key} scope="col" className={styles.th}>
                    <div className={styles.thInner}>
                      {/* Title click = sort (Excel: primary header action). */}
                      <button
                        type="button"
                        className={`${styles.sortBtn} ${
                          sortActive ? styles.sortBtnActive : ""
                        }`}
                        onClick={() => onSort(col.key)}
                        aria-sort={
                          sortActive
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        title={
                          sortActive
                            ? sortDir === initialSortDir(col.key)
                              ? `Omkeren (${col.label})`
                              : "Sortering resetten (Streefdatum → prioriteit)"
                            : `Sorteren op ${col.label}`
                        }
                      >
                        <span className={styles.sortLabel}>{col.label}</span>
                        {sortActive ? (
                          <span className={styles.arrow} aria-hidden>
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </button>

                      {/* Funnel = open column filter; stays filled while active. */}
                      <button
                        type="button"
                        ref={(el) => {
                          filterBtnRefs.current[col.key] = el;
                        }}
                        className={`${styles.filterBtn} ${
                          filterActive ? styles.filterBtnActive : ""
                        } ${panelOpen ? styles.filterBtnOpen : ""}`}
                        aria-label={
                          filterActive
                            ? `Filter op ${col.label} (actief)`
                            : `Filter op ${col.label}`
                        }
                        aria-expanded={panelOpen}
                        aria-haspopup="dialog"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFilterPanel(col.key);
                        }}
                      >
                        <FilterFunnelIcon active={filterActive} />
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className={styles.emptyCell}>
                  Geen tickets voor deze filters.{" "}
                  <button
                    type="button"
                    className={styles.clearFilters}
                    onClick={clearAllFilters}
                  >
                    Filters wissen
                  </button>
                </td>
              </tr>
            ) : (
              sorted.map((ticket) => {
                const href = ticketHref(ticket.id);
                function openTicket() {
                  router.push(href);
                }
                function onRowKey(e: KeyboardEvent<HTMLTableRowElement>) {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openTicket();
                  }
                }

                // Soft blue row tint for Nieuw — Spoed and Overige share TicketTable.
                const rowClass =
                  ticket.status === "nieuw"
                    ? `${styles.dataRow} ${styles.dataRowNieuw}`
                    : styles.dataRow;

                return (
                  <tr
                    key={ticket.id}
                    className={rowClass}
                    onClick={openTicket}
                    onKeyDown={onRowKey}
                    tabIndex={0}
                  >
                    <td title={ticket.ticketnummer}>
                      <Link
                        href={href}
                        className={styles.rowLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={styles.nummer}>
                          {ticket.ticketnummer}
                        </span>
                        {ticket.prive ? (
                          <span className={styles.prive}>Privé</span>
                        ) : null}
                      </Link>
                    </td>
                    <td title={ticket.onderwerp}>
                      <span className={styles.onderwerp}>
                        {ticket.onderwerp}
                      </span>
                    </td>
                    <td title={STATUS_LABEL[ticket.status]}>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td title={PRIORITY_LABEL[ticket.prioriteit]}>
                      {ticket.prioriteit === "spoed" ? (
                        <PriorityBadge priority={ticket.prioriteit} />
                      ) : (
                        <span className={styles.cell}>
                          {PRIORITY_LABEL[ticket.prioriteit]}
                        </span>
                      )}
                    </td>
                    <td title={TYPE_LABEL[ticket.type]}>
                      <span className={styles.cell}>
                        {TYPE_LABEL[ticket.type]}
                      </span>
                    </td>
                    <td title={ticket.systeem}>
                      <span className={styles.cell}>{ticket.systeem}</span>
                    </td>
                    <td title={ticket.afdelingen.join(", ") || undefined}>
                      <span className={styles.cell}>
                        {ticket.afdelingen.join(", ") || "—"}
                      </span>
                    </td>
                    <td title={ticket.melderNaam || undefined}>
                      <span className={styles.cell}>
                        {ticket.melderNaam || "—"}
                      </span>
                    </td>
                    <td
                      className={
                        !ticket.eigenaarNaam ? styles.muted : undefined
                      }
                      title={ticket.eigenaarNaam ?? "Nog niet geclaimd"}
                    >
                      <span className={styles.cell}>
                        {ticket.eigenaarNaam ?? "Nog niet geclaimd"}
                      </span>
                    </td>
                    <td
                      title={
                        ticket.streefdatum
                          ? formatDate(ticket.streefdatum)
                          : undefined
                      }
                    >
                      <span className={styles.cell}>
                        {ticket.streefdatum
                          ? formatDate(ticket.streefdatum)
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.cell}>
                        {ticket.omvang ?? "—"}
                      </span>
                    </td>
                    <td title={formatDate(ticket.updatedAt)}>
                      <span className={styles.cell}>
                        {formatDate(ticket.updatedAt)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Fixed portal so the menu isn’t clipped by .wrap overflow-x. */}
      {filterPortal}
    </div>
  );
}
