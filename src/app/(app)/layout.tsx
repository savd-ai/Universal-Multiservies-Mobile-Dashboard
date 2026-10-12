import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { AwaitingAccess } from "@/features/auth/awaiting-access";
import { CaptchaGate } from "@/features/captcha/captcha-gate";
import { awaitingAccess } from "@/lib/domain/auth/roles";
import { pageGate } from "@/lib/server/auth/gate";
import { captchaPending } from "@/lib/server/captcha/service";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function AppLayout({ children: 庚壍 }: {
    children: React.ReactNode;
}) {
    await connection();
    const 綉壍 = await pageGate();
    if (綉壍.redirectTo)
        redirect(綉壍.redirectTo);
    // Until this session solves the colour puzzle, render only the puzzle: no shell, no page, no data.
    if (綉壍.principal && captchaPending(綉壍.principal))
        return <CaptchaGate />;
    // Registered users without a client see a holding screen until an admin assigns them.
    if (綉壍.principal && awaitingAccess(綉壍.principal))
        return <AwaitingAccess email={綉壍.principal.email} />;
    return (<HydrationBoundary state={await prefetchShell()}>
      <AppShell>{庚壍}</AppShell>
    </HydrationBoundary>);
}
