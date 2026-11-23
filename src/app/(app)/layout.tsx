import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/data/auth";
import { countOpenSpoedTickets } from "@/data/tickets";
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
  const [user, spoedCount] = await Promise.all([
    requireUser(),
    countOpenSpoedTickets(),
  ]);
  return (
    <AppShell
      user={user}
      spoedCount={spoedCount}
      supabaseConfigured={isSupabaseConfigured()}
    >
      {children}
    </AppShell>
  );
}
