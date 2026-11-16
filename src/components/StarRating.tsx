"use client";

import { useState } from "react";
import type { StarScore } from "@/lib/types";
import { formatRating } from "@/lib/types";
import styles from "./StarRating.module.css";

interface StarRatingProps {
  /** Community average (0 = none yet). */
  average: number;
  /** Number of ratings behind the average. */
  count: number;
  /** Current user’s score, if any. */
  myRating: StarScore | null;
  /** When true, stars are clickable (mock alert for now). */
  interactive?: boolean;
  /** Compact layout for list rows. */
  compact?: boolean;
}

const SCORES: StarScore[] = [1, 2, 3, 4, 5];

/**
 * 1–5 star rating: shows average + count; optional interactive set for “mijn rating”.
 * Persistence comes later with Supabase — mock only alerts on click.
 */
export function StarRating({
  average,
  count,
  myRating,
  interactive = false,
  compact = false,
}: StarRatingProps) {
  const [hover, setHover] = useState<StarScore | null>(null);
  const displayScore = hover ?? myRating;

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
        <span className={styles.count}>
          {count === 0
            ? "nog geen beoordelingen"
            : `${count} beoordeling${count === 1 ? "" : "en"}`}
        </span>
        {myRating ? (
          <span className={styles.mine}>Jij: {myRating}★</span>
        ) : null}
      </p>
    </div>
  );
}
