"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  formatDate,
} from "@/lib/labels";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";
import styles from "./TicketTable.module.css";

/** Columns that support client-side sorting on the Overzicht table. */
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

interface TicketTableProps {
  tickets: Ticket[];
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
}

/**
 * Spreadsheet-style ticket overview with sortable column headers.
 * Used on /overzicht; existing list pages keep TicketList.
 */
export function TicketTable({
  tickets,
  emptyMessage = "Geen tickets gevonden.",
  emptyHref = "/ticket/nieuw",
  emptyCta = "Ticket aanmaken",
}: TicketTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sortKey, setSortKey] = useState<TicketSortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        const primary = compareTickets(a, b, sortKey, sortDir);
        if (primary !== 0) return primary;
        // Stable secondary: ticket number so ties stay predictable.
        return a.ticketnummer.localeCompare(b.ticketnummer, "nl", {
          numeric: true,
        });
      }),
    [tickets, sortKey, sortDir],
  );

  /* Remember which list opened the ticket so detail “Terug” can return here. */
  const ticketHref = (id: string) =>
    `/ticket/${id}?van=${encodeURIComponent(pathname)}`;

  function onSort(key: TicketSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Dates / updated default to newest first; text columns start A→Z.
    setSortDir(key === "updatedAt" || key === "streefdatum" ? "desc" : "asc");
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

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sortKey === col.key;
              return (
                <th key={col.key} scope="col">
                  <button
                    type="button"
                    className={`${styles.sortBtn} ${
                      active ? styles.sortBtnActive : ""
                    }`}
                    onClick={() => onSort(col.key)}
                    aria-sort={
                      active
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {col.label}
                    {active ? (
                      <span className={styles.arrow} aria-hidden>
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((ticket) => {
            const href = ticketHref(ticket.id);
            /* Whole row navigates; nummer stays the semantic link for a11y. */
            function openTicket() {
              router.push(href);
            }
            function onRowKey(e: KeyboardEvent<HTMLTableRowElement>) {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openTicket();
              }
            }

            return (
              <tr
                key={ticket.id}
                className={styles.dataRow}
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
                    <span className={styles.nummer}>{ticket.ticketnummer}</span>
                    {ticket.prive ? (
                      <span className={styles.prive}>Privé</span>
                    ) : null}
                  </Link>
                </td>
                <td title={ticket.onderwerp}>
                  <span className={styles.onderwerp}>{ticket.onderwerp}</span>
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
                  <span className={styles.cell}>{TYPE_LABEL[ticket.type]}</span>
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
                  className={!ticket.eigenaarNaam ? styles.muted : undefined}
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
                    {ticket.streefdatum ? formatDate(ticket.streefdatum) : "—"}
                  </span>
                </td>
                <td>
                  <span className={styles.cell}>{ticket.omvang ?? "—"}</span>
                </td>
                <td title={formatDate(ticket.updatedAt)}>
                  <span className={styles.cell}>
                    {formatDate(ticket.updatedAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
