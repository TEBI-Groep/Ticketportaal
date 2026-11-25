"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
import type { User } from "@/lib/types";
import styles from "./shell.module.css";

function LogoutMenuItem() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.userMenuItem} disabled={pending}>
      {pending ? "Bezig…" : "Uitloggen"}
    </button>
  );
}

/**
 * Desktop-only account menu on the name chip: Voorkeuren + Uitloggen.
 * Hidden on small screens (same as the previous userChip).
 */
export function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={styles.userMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.userChipButton}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <strong>{user.naam}</strong>
        <span>{ROLE_LABEL[user.rol]}</span>
      </button>

      {open ? (
        <div className={styles.userDropdown} role="menu" aria-label="Account">
          <Link
            href="/voorkeuren"
            className={styles.userMenuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Voorkeuren
          </Link>
          <form action={logoutAction}>
            <LogoutMenuItem />
          </form>
        </div>
      ) : null}
    </div>
  );
}
