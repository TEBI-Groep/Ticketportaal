"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { rateTicketAction } from "@/app/actions/ratings";
import type { StarScore, TicketRating } from "@/lib/types";
import { formatRating } from "@/lib/types";
import styles from "./StarRating.module.css";

interface StarRatingProps {
  /** Ticket id — required when interactive. */
  ticketId?: string;
  /** Community average (0 = none yet). */
  average: number;
  /** Number of ratings behind the average. */
  count: number;
  /** Current user’s score, if any. */
  myRating: StarScore | null;
  /** Who rated what — opens when “beoordelingen” is clicked. */
  beoordelingen?: TicketRating[];
  /** When true, stars are clickable and persist to Supabase. */
  interactive?: boolean;
  /** Compact layout for list rows. */
  compact?: boolean;
}

const SCORES: StarScore[] = [1, 2, 3, 4, 5];

type RatingView = {
  mine: StarScore | null;
  average: number;
  count: number;
};

/**
 * 1–5 star rating: average + count; click count for who-voted panel.
 * Interactive mode upserts/deletes the signed-in user’s rating.
 */
export function StarRating({
  ticketId,
  average,
  count,
  myRating,
  beoordelingen = [],
  interactive = false,
  compact = false,
}: StarRatingProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hover, setHover] = useState<StarScore | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useOptimistic<RatingView>(
    { mine: myRating, average, count },
    (_current, next: RatingView) => next,
  );
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const displayScore = hover ?? view.mine;

  const sorted = [...beoordelingen].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.naam.localeCompare(b.naam, "nl");
  });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPanelPos(null);
      return;
    }

    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(288, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, rect.right - width),
        window.innerWidth - width - 8,
      );
      setPanelPos({ top: rect.bottom + 6, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        wrapRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleRate(score: StarScore) {
    if (!interactive || !ticketId || pending) return;
    setError(null);

    const removing = view.mine === score;
    let next: RatingView;
    if (removing && view.mine !== null) {
      const nextCount = Math.max(0, view.count - 1);
      const sum = view.average * view.count - view.mine;
      next = {
        mine: null,
        count: nextCount,
        average: nextCount > 0 ? sum / nextCount : 0,
      };
    } else if (view.mine !== null) {
      const sum = view.average * view.count - view.mine + score;
      next = {
        mine: score,
        count: view.count,
        average: view.count > 0 ? sum / view.count : score,
      };
    } else {
      const nextCount = view.count + 1;
      next = {
        mine: score,
        count: nextCount,
        average: (view.average * view.count + score) / nextCount,
      };
    }

    startTransition(async () => {
      setView(next);
      const result = await rateTicketAction(ticketId, score);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const panel =
    typeof document !== "undefined" && open && panelPos && sorted.length > 0
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={styles.panel}
            role="dialog"
            aria-label="Wie heeft beoordeeld"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            <header className={styles.panelHeader}>
              <strong>Beoordelingen</strong>
              <span>
                gem. {formatRating(view.average)} · {view.count}
              </span>
            </header>
            <ul className={styles.panelList}>
              {sorted.map((entry) => (
                <li key={`${entry.userId}-${entry.score}`}>
                  <div className={styles.person}>
                    <span className={styles.personName}>{entry.naam}</span>
                    <span className={styles.personDept}>{entry.afdeling}</span>
                  </div>
                  <span
                    className={styles.personScore}
                    aria-label={`${entry.score} sterren`}
                  >
                    {"★".repeat(entry.score)}
                    <span className={styles.personScoreEmpty}>
                      {"★".repeat(5 - entry.score)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${compact ? styles.compact : ""}`}
      onMouseLeave={() => setHover(null)}
    >
      <div
        className={styles.stars}
        role={interactive ? "radiogroup" : "img"}
        aria-label={
          interactive
            ? "Beoordeel met 1 tot 5 sterren"
            : `Gemiddelde ${formatRating(view.average)} van 5 (${view.count} beoordelingen)`
        }
      >
        {SCORES.map((score) => {
          const filled =
            displayScore !== null
              ? score <= displayScore
              : view.average > 0 && score <= Math.round(view.average);

          return (
            <button
              key={score}
              type="button"
              className={`${styles.star} ${filled ? styles.filled : ""}`}
              disabled={!interactive || pending}
              aria-label={`${score} ster${score === 1 ? "" : "ren"}`}
              aria-checked={interactive ? view.mine === score : undefined}
              role={interactive ? "radio" : undefined}
              onMouseEnter={() => interactive && setHover(score)}
              onFocus={() => interactive && setHover(score)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRate(score);
              }}
            >
              ★
            </button>
          );
        })}
      </div>

      <p className={styles.meta}>
        <span className={styles.avg}>{formatRating(view.average)}</span>
        {view.count === 0 ? (
          <span className={styles.count}>nog geen beoordelingen</span>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className={styles.countBtn}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {view.count} beoordeling{view.count === 1 ? "" : "en"}
          </button>
        )}
        {view.mine ? (
          <span className={styles.mine}>Jij: {view.mine}★</span>
        ) : null}
      </p>

      {error ? (
        <p
          role="alert"
          className={styles.count}
          style={{ color: "var(--danger, #b42318)" }}
        >
          {error}
        </p>
      ) : null}

      {panel}
    </div>
  );
}
