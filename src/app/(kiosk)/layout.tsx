import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AwaitingAccess } from "@/features/auth/awaiting-access";
import { awaitingAccess } from "@/lib/domain/auth/roles";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function KioskLayout({ children }: {
    children: React.ReactNode;
}) {
    await connection();
    const gate = await pageGate();
    if (gate.redirectTo)
        redirect(gate.redirectTo);
    // Registered users without a client see a holding screen until an admin assigns them.
    if (gate.principal && awaitingAccess(gate.principal))
        return <AwaitingAccess email={gate.principal.email} />;
    return (<HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{children}</Suspense>
    </HydrationBoundary>);
}
