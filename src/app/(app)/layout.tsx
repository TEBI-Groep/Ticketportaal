import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

/** Authenticated-area layout: shared top/bottom navigation chrome. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Suspense: AppShell reads usePathname(), which must stream after prerender. */
  return (
    <Suspense fallback={<div className="page">Laden…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
