import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { AwaitingAccess } from "@/features/auth/awaiting-access";
import { awaitingAccess } from "@/lib/domain/auth/roles";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function AppLayout({ children: 庚壍 }: {
    children: React.ReactNode;
}) {
    await connection();
    const 綉壍 = await pageGate();
    if (綉壍.redirectTo)
        redirect(綉壍.redirectTo);
    // Registered users without a client see a holding screen until an admin assigns them.
    if (綉壍.principal && awaitingAccess(綉壍.principal))
        return <AwaitingAccess email={綉壍.principal.email} />;
    return (<HydrationBoundary state={await prefetchShell()}>
      <AppShell>{庚壍}</AppShell>
    </HydrationBoundary>);
}
