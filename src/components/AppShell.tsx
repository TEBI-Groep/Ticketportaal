"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import type { User } from "@/lib/types";
import styles from "./shell.module.css";

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.logoutBtn} disabled={pending}>
      {pending ? "Bezig…" : "Uitloggen"}
    </button>
  );
}

/** Primary destinations from the wireframe IA. */
const NAV_ITEMS = [
  { href: "/ranglijst", label: "Ranglijst", short: "Rang" },
  { href: "/werkvoorraad", label: "Werkvoorraad", short: "Werk" },
  { href: "/spoed", label: "Spoed", short: "Spoed" },
  { href: "/mijn-tickets", label: "Mijn tickets", short: "Mijn" },
  { href: "/afgerond", label: "Afgerond", short: "Klaar" },
] as const;

/** IT-only destinations (shown when the signed-in user is uitvoerder). */
const IT_NAV_ITEMS = [
  { href: "/gebruikers", label: "Gebruikers", short: "Users" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared chrome: Tebi brand, four tabs, + Ticket CTA.
 * Stemsaldo removed — ratings are 1–5 stars without a limited pool.
 */
export function AppShell({
  children,
  user,
  supabaseConfigured = true,
}: {
  children: React.ReactNode;
  user: User;
  /** False when URL/anon env is missing — UI uses mock data; writes will fail. */
  supabaseConfigured?: boolean;
}) {
  const pathname = usePathname();
  const isIt = user.rol === "uitvoerder";
  const desktopItems = isIt ? [...NAV_ITEMS, ...IT_NAV_ITEMS] : [...NAV_ITEMS];

  return (
    <div className={styles.shell}>
      {!supabaseConfigured ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "0.5rem 1rem",
            background: "#fff4e5",
            color: "#8a5a00",
            fontSize: "0.875rem",
            borderBottom: "1px solid #f0d9a8",
          }}
        >
          Demo-modus: Supabase URL/anon key ontbreken op deze omgeving. Tickets
          komen uit mockdata; comments en notities kunnen niet worden opgeslagen.
        </p>
      ) : null}
      <header className={styles.topbar}>
        <Link href="/ranglijst" className={styles.brand} aria-label="Tebi Ticketportaal home">
          <span className={styles.brandName}>Tebi</span>
          <span className={styles.brandProduct}>Ticketportaal</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Hoofdnavigatie">
          {desktopItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${
                isActive(pathname, item.href) ? styles.navLinkActive : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/ticket/nieuw" className={styles.createBtn}>
            <span aria-hidden>+</span> Ticket
          </Link>

          <div className={styles.userMenu}>
            <div className={styles.userChip} aria-label="Ingelogde gebruiker">
              <strong>{user.naam}</strong>
              <span>{user.rol}</span>
            </div>
            <form action={logoutAction}>
              <LogoutButton />
            </form>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav
        className={styles.bottomNav}
        aria-label="Mobiele navigatie"
        style={{
          gridTemplateColumns: `repeat(${desktopItems.length}, 1fr)`,
        }}
      >
        {desktopItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.bottomLink} ${
              isActive(pathname, item.href) ? styles.bottomLinkActive : ""
            }`}
          >
            <span className={styles.bottomIcon} aria-hidden>
              {item.short.charAt(0)}
            </span>
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
