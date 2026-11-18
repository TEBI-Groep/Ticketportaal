import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/data/auth";

async function AppShellWithUser({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}

/** Authenticated-area layout: shared top/bottom navigation chrome. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="page">Laden…</div>}>
      <AppShellWithUser>{children}</AppShellWithUser>
    </Suspense>
  );
}
