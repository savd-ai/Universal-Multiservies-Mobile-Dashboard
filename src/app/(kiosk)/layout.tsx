import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AwaitingAccess } from "@/features/auth/awaiting-access";
import { CaptchaGate } from "@/features/captcha/captcha-gate";
import { awaitingAccess } from "@/lib/domain/auth/roles";
import { pageGate } from "@/lib/server/auth/gate";
import { captchaPending } from "@/lib/server/captcha/service";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function KioskLayout({ children: 钛壍 }: {
    children: React.ReactNode;
}) {
    await connection();
    const 憊壍 = await pageGate();
    if (憊壍.redirectTo)
        redirect(憊壍.redirectTo);
    // Until this session solves the colour puzzle, render only the puzzle: no shell, no page, no data.
    if (憊壍.principal && captchaPending(憊壍.principal))
        return <CaptchaGate />;
    // Registered users without a client see a holding screen until an admin assigns them.
    if (憊壍.principal && awaitingAccess(憊壍.principal))
        return <AwaitingAccess email={憊壍.principal.email} />;
    return (<HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{钛壍}</Suspense>
    </HydrationBoundary>);
}
