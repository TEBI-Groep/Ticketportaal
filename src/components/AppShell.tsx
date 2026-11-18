"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/lib/types";
import styles from "./shell.module.css";

/** Primary destinations from the wireframe IA. */
const NAV_ITEMS = [
  { href: "/ranglijst", label: "Ranglijst", short: "Rang" },
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
}: {
  children: React.ReactNode;
  user: User;
}) {
  const pathname = usePathname();
  const isIt = user.rol === "uitvoerder";
  const desktopItems = isIt ? [...NAV_ITEMS, ...IT_NAV_ITEMS] : [...NAV_ITEMS];

  return (
    <div className={styles.shell}>
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

          <div className={styles.userChip} aria-label="Ingelogde gebruiker">
            <strong>{user.naam}</strong>
            <span>{user.rol}</span>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav
        className={styles.bottomNav}
        aria-label="Mobiele navigatie"
        style={isIt ? { gridTemplateColumns: "repeat(5, 1fr)" } : undefined}
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
