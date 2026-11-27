"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  addTicketLinkAction,
  removeTicketLinkAction,
  searchTicketsForLinkAction,
  type TicketLinkComposeType,
} from "@/app/actions/ticket-links";
import { LINK_TYPE_LABEL } from "@/lib/labels";
import type { Ticket, TicketLink } from "@/lib/types";
import styles from "./TicketLinks.module.css";

interface TicketLinksProps {
  ticketId: string;
  initialLinks: TicketLink[];
}

function linkRelationLabel(link: TicketLink): string {
  if (link.linkType === "duplicate") {
    return link.otherIsCanonical ? "Duplicaat van" : "Heeft duplicaat";
  }
  if (link.linkType === "parent") {
    return link.otherIsParent ? "Hoofdticket" : "Onderliggend";
  }
  return LINK_TYPE_LABEL[link.linkType];
}

/**
 * Compact gekoppelde tickets for the IT rail (under Interne notities).
 * Beheerder-only — related, duplicate, parent/child.
 */
export function TicketLinks({ ticketId, initialLinks }: TicketLinksProps) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [composeType, setComposeType] =
    useState<TicketLinkComposeType>("related");
  const [hits, setHits] = useState<Ticket[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  // Debounced search for link candidates.
  useEffect(() => {
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
  }, [query, ticketId]);

  function addLink(otherId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addTicketLinkAction({
        viewerTicketId: ticketId,
        otherTicketId: otherId,
        composeType,
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
      <h3 id="ticket-links-heading" className={styles.heading}>
        Gekoppelde tickets
      </h3>

      {links.length > 0 ? (
        <ul className={styles.list}>
          {links.map((link) => (
            <li key={link.id} className={styles.item}>
              <span className={styles.kind}>{linkRelationLabel(link)}</span>
              <Link
                href={`/ticket/${link.otherTicketId}`}
                className={styles.ticketLink}
                title={link.otherOnderwerp}
              >
                {link.otherTicketnummer}
                <span className={styles.onderwerp}> · {link.otherOnderwerp}</span>
              </Link>
              <button
                type="button"
                className={styles.removeBtn}
                disabled={pending}
                onClick={() => removeLink(link.id)}
                aria-label={`Ontkoppel ${link.otherTicketnummer}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nog geen koppelingen.</p>
      )}

      <form className={styles.compose} onSubmit={onComposeSubmit}>
        <div className={styles.composeRow}>
          <select
            id={`link-type-${ticketId}`}
            className={`select-input ${styles.select}`}
            value={composeType}
            disabled={pending}
            aria-label="Koppeltype"
            onChange={(e) =>
              setComposeType(e.target.value as TicketLinkComposeType)
            }
          >
            <option value="related">Gerelateerd</option>
            <option value="duplicate">Duplicaat van</option>
            <option value="child">Onderliggend</option>
            <option value="parent">Hoofdticket</option>
          </select>
          <input
            id={`link-search-${ticketId}`}
            className={`text-input ${styles.search}`}
            type="search"
            value={query}
            disabled={pending}
            placeholder="TP-… of onderwerp"
            aria-label="Zoek ticket om te koppelen"
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {searching ? (
          <p className={styles.hint}>Zoeken…</p>
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
                  {hit.ticketnummer} · {hit.onderwerp}
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim().length >= 2 ? (
          <p className={styles.hint}>Geen tickets gevonden.</p>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}