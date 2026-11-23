"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeToTicketAction,
  unsubscribeFromTicketAction,
} from "@/app/actions/watchers";
import styles from "./TicketWatchBell.module.css";

interface TicketWatchBellProps {
  ticketId: string;
  /** Display label for feedback, e.g. ticketnummer. */
  ticketLabel: string;
  initiallyWatching: boolean;
}

/** Outline bell icon (not subscribed). */
function BellOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18.5 15.5 6 3" />
      <path d="M13.4 5.1A5 5 0 0 1 18 10v1.5c0 .6.2 1.2.6 1.7L20 15H9.5" />
      <path d="M6.2 6.2A5 5 0 0 0 6 10v1.5c0 .6-.2 1.2-.6 1.7L4 15h12" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

/** Filled/active bell icon (subscribed). */
function BellOnIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2a6 6 0 0 0-6 6v2.2c0 .7-.2 1.4-.7 2L3.8 14.5c-.5.6-.1 1.5.7 1.5h15c.8 0 1.2-.9.7-1.5L18.7 12.2c-.5-.6-.7-1.3-.7-2V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2H9.2A3 3 0 0 0 12 22Z" />
    </svg>
  );
}

/**
 * Bell toggle to follow a ticket for future e-mail updates.
 * Shows a short confirmation popup after subscribe / unsubscribe.
 */
export function TicketWatchBell({
  ticketId,
  ticketLabel,
  initiallyWatching,
}: TicketWatchBellProps) {
  const router = useRouter();
  const [watching, setWatching] = useState(initiallyWatching);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the feedback popup after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(handle);
  }, [toast]);

  async function toggle() {
    if (pending) return;
    setPending(true);
    setError(null);

    const nextWatching = !watching;
    const result = watching
      ? await unsubscribeFromTicketAction(ticketId)
      : await subscribeToTicketAction(ticketId);

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setWatching(nextWatching);
    setToast(
      nextWatching
        ? `Je volgt nu ${ticketLabel} en krijgt hiervoor updates.`
        : `Je volgt ${ticketLabel} niet meer en krijgt hiervoor geen updates meer.`,
    );
    router.refresh();
  }

  const label = watching
    ? "Afmelden voor updates"
    : "Volgen voor updates";

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.bell} ${watching ? styles.bellOn : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={watching}
        aria-label={label}
        title={label}
      >
        {watching ? <BellOnIcon /> : <BellOffIcon />}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <p>{toast}</p>
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setToast(null)}
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
