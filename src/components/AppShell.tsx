"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
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

type BadgeKey = "spoed" | "nieuw" | "wachtOpMelder";

type NavItem = {
  href: string;
  label: string;
  short: string;
  /** Optional count badge (e.g. open spoed tickets). */
  badge?: number;
};

/** Same order as before; Werkvoorraad only for uitvoerders. */
const NAV_ITEMS: Array<
  Omit<NavItem, "badge"> & { itOnly?: boolean; badgeKey?: BadgeKey }
> = [
  { href: "/ranglijst", label: "Ranglijst", short: "Rang" },
  {
    href: "/werkvoorraad",
    label: "Werkvoorraad",
    short: "Werk",
    itOnly: true,
    badgeKey: "nieuw",
  },
  { href: "/spoed", label: "Spoed", short: "Spoed", badgeKey: "spoed" },
  {
    href: "/mijn-tickets",
    label: "Mijn tickets",
    short: "Mijn",
    badgeKey: "wachtOpMelder",
  },
  { href: "/afgerond", label: "Afgerond", short: "Klaar" },
  { href: "/mijn-werk", label: "Mijn werk", short: "Eigen", itOnly: true },
  { href: "/gebruikers", label: "Gebruikers", short: "Users", itOnly: true },
];

function badgeForKey(
  key: BadgeKey | undefined,
  counts: { spoed: number; nieuw: number; wachtOpMelder: number },
): number | undefined {
  if (!key) return undefined;
  const value = counts[key];
  return value > 0 ? value : undefined;
}

function navForRole(
  isIt: boolean,
  counts: { spoed: number; nieuw: number; wachtOpMelder: number },
): NavItem[] {
  return NAV_ITEMS.filter((item) => isIt || !item.itOnly).map(
    ({ href, label, short, badgeKey }) => ({
      href,
      label,
      short,
      badge: badgeForKey(badgeKey, counts),
    }),
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared chrome: Tebi brand, role-aware tabs, + Ticket CTA.
 * Stemsaldo removed — ratings are 1–5 stars without a limited pool.
 */
export function AppShell({
  children,
  user,
  spoedCount = 0,
  nieuwCount = 0,
  wachtOpMelderCount = 0,
  supabaseConfigured = true,
}: {
  children: React.ReactNode;
  user: User;
  /** Open tickets with prioriteit spoed (nav badge). */
  spoedCount?: number;
  /** Tickets with status nieuw — IT Werkvoorraad badge. */
  nieuwCount?: number;
  /** Tickets waiting on this user as melder — Mijn tickets badge. */
  wachtOpMelderCount?: number;
  /** False when Supabase URL/anon key are missing on this environment. */
  supabaseConfigured?: boolean;
}) {
  const pathname = usePathname();
  const isIt = user.rol === "uitvoerder";
  const desktopItems = navForRole(isIt, {
    spoed: spoedCount,
    nieuw: isIt ? nieuwCount : 0,
    wachtOpMelder: wachtOpMelderCount,
  });

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
          Supabase URL/anon key ontbreken op deze omgeving — data en auth werken
          niet tot die zijn geconfigureerd.
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
              <span>{item.label}</span>
              {item.badge != null ? (
                <span className={styles.navBadge} aria-label={`${item.badge} open`}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
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
              <span>{ROLE_LABEL[user.rol]}</span>
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
            <span className={styles.bottomIconWrap}>
              <span className={styles.bottomIcon} aria-hidden>
                {item.short.charAt(0)}
              </span>
              {item.badge != null ? (
                <span
                  className={styles.navBadge}
                  aria-label={`${item.badge} open`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </span>
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
