"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
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
type BadgeTone = "danger" | "info";

type NavBadge = {
  count: number;
  tone: BadgeTone;
  /** Short aria description (e.g. “spoed”, “nieuw”). */
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  short: string;
  /** Zero or more count badges (Overzicht can show Spoed + Nieuw). */
  badges: NavBadge[];
};

type BadgeCounts = {
  spoed: number;
  nieuw: number;
  wachtOpMelder: number;
};

/** Werkvoorraad + Spoed pages hidden — open tickets live on Overzicht. */
const NAV_ITEMS: Array<{
  href: string;
  label: string;
  short: string;
  itOnly?: boolean;
  /** One or more badge keys; rendered left-to-right when count > 0. */
  badgeKeys?: BadgeKey[];
}> = [
  { href: "/ranglijst", label: "Ranglijst", short: "Rang" },
  {
    href: "/mijn-tickets",
    label: "Mijn tickets",
    short: "Mijn",
    badgeKeys: ["wachtOpMelder"],
  },
  {
    href: "/overzicht",
    label: "Overzicht",
    short: "Tabel",
    itOnly: true,
    badgeKeys: ["spoed", "nieuw"],
  },
  { href: "/afgerond", label: "Afgerond", short: "Klaar" },
  // Mijn werk lives on Overzicht (top-right) for now — not in the nav bar.
  { href: "/gebruikers", label: "Gebruikers", short: "Users", itOnly: true },
];

function badgeToneForKey(key: BadgeKey): BadgeTone {
  return key === "spoed" ? "danger" : "info";
}

function badgeLabelForKey(key: BadgeKey): string {
  switch (key) {
    case "spoed":
      return "spoed";
    case "nieuw":
      return "nieuw";
    case "wachtOpMelder":
      return "wacht op melder";
  }
}

function badgesForKeys(
  keys: BadgeKey[] | undefined,
  counts: BadgeCounts,
): NavBadge[] {
  if (!keys?.length) return [];
  const out: NavBadge[] = [];
  for (const key of keys) {
    const count = counts[key];
    if (count > 0) {
      out.push({
        count,
        tone: badgeToneForKey(key),
        label: badgeLabelForKey(key),
      });
    }
  }
  return out;
}

function navForRole(isIt: boolean, counts: BadgeCounts): NavItem[] {
  return NAV_ITEMS.filter((item) => isIt || !item.itOnly).map(
    ({ href, label, short, badgeKeys }) => ({
      href,
      label,
      short,
      badges: badgesForKeys(badgeKeys, counts),
    }),
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function badgeClass(tone: BadgeTone): string {
  return tone === "info"
    ? `${styles.navBadge} ${styles.navBadgeInfo}`
    : styles.navBadge;
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
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
  unreadNotificationCount = 0,
  supabaseConfigured = true,
}: {
  children: React.ReactNode;
  user: User;
  /** Open tickets with prioriteit spoed (red badge on Overzicht). */
  spoedCount?: number;
  /** Open tickets with status nieuw (blue badge on Overzicht). */
  nieuwCount?: number;
  /** Wacht-op-melder count in Mijn tickets scope (own + afdeling for managers). */
  wachtOpMelderCount?: number;
  /** Unread in-app notifications (IT bell). */
  unreadNotificationCount?: number;
  /** False when Supabase URL/anon key are missing on this environment. */
  supabaseConfigured?: boolean;
}) {
  const pathname = usePathname();
  const isIt = user.rol === "uitvoerder";
  const desktopItems = navForRole(isIt, {
    spoed: spoedCount,
    nieuw: nieuwCount,
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
              {item.badges.map((badge) => (
                <span
                  key={badge.label}
                  className={badgeClass(badge.tone)}
                  aria-label={`${badge.count} ${badge.label}`}
                >
                  {formatBadgeCount(badge.count)}
                </span>
              ))}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/ticket/nieuw" className={styles.createBtn}>
            <span aria-hidden>+</span> Ticket
          </Link>

          {/* Inbox for watchers (status/comments) and IT note mentions/reactions. */}
          <NotificationBell initialUnreadCount={unreadNotificationCount} />

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
              {/* Cluster so Spoed + Nieuw don’t stack on the same corner. */}
              {item.badges.length > 0 ? (
                <span className={styles.bottomBadges}>
                  {item.badges.map((badge) => (
                    <span
                      key={badge.label}
                      className={badgeClass(badge.tone)}
                      aria-label={`${badge.count} ${badge.label}`}
                    >
                      {formatBadgeCount(badge.count)}
                    </span>
                  ))}
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
