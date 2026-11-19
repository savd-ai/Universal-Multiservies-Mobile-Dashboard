import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";

// Developer pages (/dev/kit, /dev/charts) for visual QA of the UI kit and every chart type. Not available in
// production builds.
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const gate = await pageGate();
  if (gate.redirectTo) redirect(gate.redirectTo);
  return (
    <HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{children}</Suspense>
    </HydrationBoundary>
  );
}
