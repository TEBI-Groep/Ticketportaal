"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAllNotificationsAction,
  deleteNotificationAction,
  listMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { formatDateTime } from "@/lib/labels";
import type { AppNotification } from "@/lib/types";
import styles from "./NotificationBell.module.css";

interface NotificationBellProps {
  /** Unread count from the app layout (SSR). */
  initialUnreadCount: number;
}

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * Shell bell: inbox for ticket + IT note notifications, with dismiss.
 */
export function NotificationBell({
  initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function ensureLoaded() {
    if (items !== null || loading) return;
    setLoading(true);
    const list = await listMyNotificationsAction();
    setItems(list);
    setLoading(false);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await ensureLoaded();
  }

  function hrefFor(n: AppNotification): string {
    // Fall back to home — Overzicht is IT-only.
    if (!n.ticketId) return "/netsuite";
    if (n.payload.noteId) {
      return `/ticket/${n.ticketId}?note=${n.payload.noteId}`;
    }
    if (n.payload.commentId) {
      return `/ticket/${n.ticketId}?comment=${n.payload.commentId}`;
    }
    return `/ticket/${n.ticketId}`;
  }

  async function openNotification(n: AppNotification) {
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
        setItems((list) =>
          list
            ? list.map((item) =>
                item.id === n.id
                  ? { ...item, readAt: new Date().toISOString() }
                  : item,
              )
            : list,
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    setOpen(false);
    router.push(hrefFor(n));
    router.refresh();
  }

  async function markAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) return;
      setItems((list) =>
        list
          ? list.map((item) => ({
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
            }))
          : list,
      );
      setUnreadCount(0);
      router.refresh();
    });
  }

  /** Remove one row from the inbox (optimistic). */
  function dismissNotification(n: AppNotification) {
    startTransition(async () => {
      const result = await deleteNotificationAction(n.id);
      if (!result.ok) return;
      setItems((list) => (list ? list.filter((item) => item.id !== n.id) : list));
      if (!n.readAt) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      router.refresh();
    });
  }

  /** Empty the whole inbox. */
  function clearAll() {
    startTransition(async () => {
      const result = await deleteAllNotificationsAction();
      if (!result.ok) return;
      setItems([]);
      setUnreadCount(0);
      router.refresh();
    });
  }

  const badge =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;
  const hasItems = (items?.length ?? 0) > 0;

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.bellBtn}
        aria-label={
          unreadCount > 0
            ? `Meldingen, ${unreadCount} ongelezen`
            : "Meldingen"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          void toggleOpen();
        }}
      >
        <BellIcon />
        {badge ? (
          <span className={styles.badge} aria-hidden>
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Meldingen">
          <header className={styles.panelHeader}>
            <strong>Meldingen</strong>
            <div className={styles.headerActions}>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className={styles.markAll}
                  disabled={pending}
                  onClick={() => {
                    void markAllRead();
                  }}
                >
                  Alles gelezen
                </button>
              ) : null}
              {hasItems ? (
                <button
                  type="button"
                  className={styles.clearAll}
                  disabled={pending}
                  onClick={() => {
                    void clearAll();
                  }}
                >
                  Wis alles
                </button>
              ) : null}
            </div>
          </header>

          {loading || items === null ? (
            <p className={styles.empty}>Laden…</p>
          ) : items.length === 0 ? (
            <p className={styles.empty}>Nog geen meldingen.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li key={n.id} className={styles.row}>
                  <button
                    type="button"
                    className={`${styles.item} ${
                      !n.readAt ? styles.itemUnread : ""
                    }`}
                    onClick={() => {
                      void openNotification(n);
                    }}
                  >
                    <span className={styles.itemTitle}>{n.title}</span>
                    {n.body ? (
                      <span className={styles.itemBody}>{n.body}</span>
                    ) : null}
                    <time
                      className={styles.itemTime}
                      dateTime={n.createdAt}
                    >
                      {formatDateTime(n.createdAt)}
                    </time>
                  </button>
                  <button
                    type="button"
                    className={styles.dismissBtn}
                    aria-label="Melding verwijderen"
                    title="Verwijderen"
                    disabled={pending}
                    onClick={(event) => {
                      // Keep the panel open; don’t open the ticket.
                      event.stopPropagation();
                      dismissNotification(n);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
