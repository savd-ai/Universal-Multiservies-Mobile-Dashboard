import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { pageGate } from "@/lib/server/auth/gate";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function AppLayout({ children: 庚壍 }: {
    children: React.ReactNode;
}) {
    await connection();
    const 綉壍 = await pageGate();
    if (綉壍.redirectTo)
        redirect(綉壍.redirectTo);
    return (<HydrationBoundary state={await prefetchShell()}>
      <AppShell>{庚壍}</AppShell>
    </HydrationBoundary>);
}
