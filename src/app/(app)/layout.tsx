import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/data/auth";
import { countUnreadNotifications } from "@/data/notifications";
import {
  countOpenNieuwTickets,
  countOpenSpoedTickets,
  countWachtOpMelderTickets,
} from "@/data/tickets";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Auth gates the whole shell via cookies(), so this segment is allowed to
 * block (Cache Components). Keep requireUser outside Suspense — redirect()
 * inside a Suspense boundary can leave "Laden…" on screen forever after login.
 *
 * @see https://nextjs.org/docs/app/guides/authentication-with-cache-components
 */
export const instant = false;

/** Authenticated-area layout: shared top/bottom navigation chrome. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Spoed + nieuw on Overzicht; wacht-op-melder for Mijn tickets; inbox for everyone.
  const [spoedCount, nieuwCount, wachtOpMelderCount, unreadNotificationCount] =
    await Promise.all([
      countOpenSpoedTickets(),
      countOpenNieuwTickets(),
      countWachtOpMelderTickets({
        id: user.id,
        rol: user.rol,
        afdelingId: user.afdelingId,
      }),
      countUnreadNotifications(),
    ]);

  return (
    <AppShell
      user={user}
      spoedCount={spoedCount}
      nieuwCount={nieuwCount}
      wachtOpMelderCount={wachtOpMelderCount}
      unreadNotificationCount={unreadNotificationCount}
      supabaseConfigured={isSupabaseConfigured()}
    >
      {children}
    </AppShell>
  );
}
