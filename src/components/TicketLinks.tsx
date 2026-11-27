"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  addTicketLinkAction,
  removeTicketLinkAction,
  searchTicketsForLinkAction,
} from "@/app/actions/ticket-links";
import { LINK_TYPE_LABEL } from "@/lib/labels";
import type { Ticket, TicketLink, TicketLinkType } from "@/lib/types";
import styles from "./TicketLinks.module.css";

interface TicketLinksProps {
  ticketId: string;
  initialLinks: TicketLink[];
  /** IT can add/remove; others see the list only. */
  canEdit: boolean;
}

type ComposeType = "related" | "duplicate";

function linkRelationLabel(link: TicketLink): string {
  if (link.linkType === "duplicate") {
    return link.otherIsCanonical ? "Duplicaat van" : "Heeft duplicaat";
  }
  return LINK_TYPE_LABEL[link.linkType];
}

/**
 * Gekoppelde tickets (related / duplicate) on ticket detail.
 */
export function TicketLinks({
  ticketId,
  initialLinks,
  canEdit,
}: TicketLinksProps) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [linkType, setLinkType] = useState<ComposeType>("related");
  const [hits, setHits] = useState<Ticket[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  // Debounced search for link candidates (IT only).
  useEffect(() => {
    if (!canEdit) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const results = await searchTicketsForLinkAction(q, ticketId);
      if (!cancelled) {
        setHits(results);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [canEdit, query, ticketId]);

  function addLink(otherId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addTicketLinkAction({
        fromTicketId: ticketId,
        toTicketId: otherId,
        linkType: linkType as TicketLinkType,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLinks(result.links);
      setQuery("");
      setHits([]);
    });
  }

  function removeLink(linkId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await removeTicketLinkAction(linkId, ticketId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLinks(result.links);
    });
  }

  function onComposeSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <section className={styles.wrap} aria-labelledby="ticket-links-heading">
      <header className={styles.header}>
        <h2 id="ticket-links-heading">Gekoppelde tickets</h2>
        <p className="form-hint">
          Gerelateerde tickets of duplicaten.{" "}
          {canEdit
            ? "Zoek op ticketnummer of onderwerp om te koppelen."
            : "Alleen IT kan koppelingen wijzigen."}
        </p>
      </header>

      {links.length === 0 ? (
        <p className={styles.empty}>Nog geen koppelingen.</p>
      ) : (
        <ul className={styles.list}>
          {links.map((link) => (
            <li key={link.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.kind}>{linkRelationLabel(link)}</span>
                <Link
                  href={`/ticket/${link.otherTicketId}`}
                  className={styles.ticketLink}
                >
                  {link.otherTicketnummer} · {link.otherOnderwerp}
                </Link>
                <StatusBadge status={link.otherStatus} />
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={pending}
                  onClick={() => removeLink(link.id)}
                >
                  Ontkoppel
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form className={styles.compose} onSubmit={onComposeSubmit}>
          <label htmlFor={`link-type-${ticketId}`} className="form-hint">
            Type
          </label>
          <select
            id={`link-type-${ticketId}`}
            className={`select-input ${styles.select}`}
            value={linkType}
            disabled={pending}
            onChange={(e) => setLinkType(e.target.value as ComposeType)}
          >
            <option value="related">Gerelateerd</option>
            <option value="duplicate">Duplicaat van (ander is origineel)</option>
          </select>

          <label htmlFor={`link-search-${ticketId}`} className="form-hint">
            Zoek ticket
          </label>
          <input
            id={`link-search-${ticketId}`}
            className={`text-input ${styles.search}`}
            type="search"
            value={query}
            disabled={pending}
            placeholder="TP-123 of onderwerp…"
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />

          {searching ? (
            <p className="form-hint">Zoeken…</p>
          ) : hits.length > 0 ? (
            <ul className={styles.hits}>
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className={styles.hitBtn}
                    disabled={pending}
                    onClick={() => addLink(hit.id)}
                  >
                    <span className={styles.hitLabel}>
                      {hit.ticketnummer} · {hit.onderwerp}
                    </span>
                    <StatusBadge status={hit.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="form-hint">Geen tickets gevonden.</p>
          ) : null}

          {error ? (
            <p
              className="form-hint"
              role="alert"
              style={{ color: "var(--danger, #b42318)" }}
            >
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
