"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StarScore, TicketRating } from "@/lib/types";
import { formatRating } from "@/lib/types";
import styles from "./StarRating.module.css";

interface StarRatingProps {
  /** Community average (0 = none yet). */
  average: number;
  /** Number of ratings behind the average. */
  count: number;
  /** Current user’s score, if any. */
  myRating: StarScore | null;
  /** Who rated what — opens when “beoordelingen” is clicked. */
  beoordelingen?: TicketRating[];
  /** When true, stars are clickable (mock alert for now). */
  interactive?: boolean;
  /** Compact layout for list rows. */
  compact?: boolean;
}

const SCORES: StarScore[] = [1, 2, 3, 4, 5];

/**
 * 1–5 star rating: average + count; click count for who-voted panel.
 * Persistence comes later with Supabase — mock only alerts on star click.
 */
export function StarRating({
  average,
  count,
  myRating,
  beoordelingen = [],
  interactive = false,
  compact = false,
}: StarRatingProps) {
  const [hover, setHover] = useState<StarScore | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const displayScore = hover ?? myRating;

  const sorted = [...beoordelingen].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.naam.localeCompare(b.naam, "nl");
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
    if (!interactive) return;
    window.alert(
      myRating === score
        ? `Demo: je beoordeling blijft ${score}★. Later kun je dit wijzigen of wissen in de database.`
        : `Demo: je zou dit ticket ${score}★ geven. Het gemiddelde wordt dan herberekend over alle beoordelingen.`,
    );
  }

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
            : `Gemiddelde ${formatRating(average)} van 5 (${count} beoordelingen)`
        }
      >
        {SCORES.map((score) => {
          const filled =
            displayScore !== null
              ? score <= displayScore
              : average > 0 && score <= Math.round(average);

          return (
            <button
              key={score}
              type="button"
              className={`${styles.star} ${filled ? styles.filled : ""}`}
              disabled={!interactive}
              aria-label={`${score} ster${score === 1 ? "" : "ren"}`}
              aria-checked={interactive ? myRating === score : undefined}
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
        <span className={styles.avg}>{formatRating(average)}</span>
        {count === 0 ? (
          <span className={styles.count}>nog geen beoordelingen</span>
        ) : (
          <button
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
            {count} beoordeling{count === 1 ? "" : "en"}
          </button>
        )}
        {myRating ? (
          <span className={styles.mine}>Jij: {myRating}★</span>
        ) : null}
      </p>

      {open && sorted.length > 0 ? (
        <div
          id={panelId}
          className={styles.panel}
          role="dialog"
          aria-label="Wie heeft beoordeeld"
        >
          <header className={styles.panelHeader}>
            <strong>Beoordelingen</strong>
            <span>
              gem. {formatRating(average)} · {count}
            </span>
          </header>
          <ul className={styles.panelList}>
            {sorted.map((entry) => (
              <li key={`${entry.userId}-${entry.score}`}>
                <div className={styles.person}>
                  <span className={styles.personName}>{entry.naam}</span>
                  <span className={styles.personDept}>{entry.afdeling}</span>
                </div>
                <span className={styles.personScore} aria-label={`${entry.score} sterren`}>
                  {"★".repeat(entry.score)}
                  <span className={styles.personScoreEmpty}>
                    {"★".repeat(5 - entry.score)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
