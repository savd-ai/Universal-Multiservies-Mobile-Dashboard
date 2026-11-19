import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";

// Every app page renders at request time (demo/live status must never be baked in at build time). Status and the
// dashboard list are prefetched so the first paint already shows the data mode, account and dashboards.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const gate = await pageGate();
  if (gate.redirectTo) redirect(gate.redirectTo);
  return (
    <HydrationBoundary state={await prefetchShell()}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  );
}
