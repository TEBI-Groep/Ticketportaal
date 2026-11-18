import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/data/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Authenticated-area layout: shared top/bottom navigation chrome.
 * Auth runs outside Suspense — redirect() inside a Suspense boundary can
 * leave the fallback ("Laden…") on screen forever after login.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell user={user} supabaseConfigured={isSupabaseConfigured()}>
      {children}
    </AppShell>
  );
}
