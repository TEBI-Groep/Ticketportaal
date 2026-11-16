"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAX_STEMMEN, MOCK_USER } from "@/data/mock";
import styles from "./shell.module.css";

/** Primary destinations from the wireframe IA. */
const NAV_ITEMS = [
  { href: "/ranglijst", label: "Ranglijst", short: "Rang" },
  { href: "/spoed", label: "Spoed", short: "Spoed" },
  { href: "/mijn-tickets", label: "Mijn tickets", short: "Mijn" },
  { href: "/afgerond", label: "Afgerond", short: "Klaar" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared chrome: Tebi brand, four tabs, + Ticket CTA, subtle stemsaldo.
 * Desktop uses top nav; mobile adds a bottom bar for thumb reach.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/ranglijst" className={styles.brand} aria-label="Tebi Ticketportaal home">
          <span className={styles.brandName}>Tebi</span>
          <span className={styles.brandProduct}>Ticketportaal</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Hoofdnavigatie">
          {NAV_ITEMS.map((item) => (
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
          {/* Stemsaldo stays subtle — not a hero metric strip. */}
          <p className={styles.stemsaldo} title="Maximaal 5 actieve stemmen">
            Stemmen:{" "}
            <strong>
              {MOCK_USER.stemmenOver}/{MAX_STEMMEN}
            </strong>{" "}
            over
          </p>

          <Link href="/ticket/nieuw" className={styles.createBtn}>
            <span aria-hidden>+</span> Ticket
          </Link>

          <div className={styles.userChip} aria-label="Ingelogde gebruiker">
            <strong>{MOCK_USER.naam}</strong>
            <span>{MOCK_USER.rol}</span>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav className={styles.bottomNav} aria-label="Mobiele navigatie">
        {NAV_ITEMS.map((item) => (
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
