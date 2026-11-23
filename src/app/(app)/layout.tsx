import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/data/auth";
import {
  countNieuwRanglijstTickets,
  countNieuwWerkvoorraadTickets,
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
  const isIt = user.rol === "uitvoerder";

  // Badge counts: spoed for everyone; nieuw badges for IT; wacht-op-melder for all.
  const [
    spoedCount,
    nieuwRanglijstCount,
    nieuwWerkvoorraadCount,
    wachtOpMelderCount,
  ] = await Promise.all([
    countOpenSpoedTickets(),
    isIt ? countNieuwRanglijstTickets() : Promise.resolve(0),
    isIt ? countNieuwWerkvoorraadTickets() : Promise.resolve(0),
    countWachtOpMelderTickets({
      id: user.id,
      rol: user.rol,
      afdelingId: user.afdelingId,
    }),
  ]);

  return (
    <AppShell
      user={user}
      spoedCount={spoedCount}
      nieuwRanglijstCount={nieuwRanglijstCount}
      nieuwWerkvoorraadCount={nieuwWerkvoorraadCount}
      wachtOpMelderCount={wachtOpMelderCount}
      supabaseConfigured={isSupabaseConfigured()}
    >
      {children}
    </AppShell>
  );
}
