import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";

// Kiosk pages (TV mode): no sidebar or header, same data prefetch as the app shell.
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const gate = await pageGate();
  if (gate.redirectTo) redirect(gate.redirectTo);
  return (
    <HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{children}</Suspense>
    </HydrationBoundary>
  );
}
