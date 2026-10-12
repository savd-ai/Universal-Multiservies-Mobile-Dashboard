import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AwaitingAccess } from "@/features/auth/awaiting-access";
import { CaptchaGate } from "@/features/captcha/captcha-gate";
import { awaitingAccess } from "@/lib/domain/auth/roles";
import { pageGate } from "@/lib/server/auth/gate";
import { captchaPending } from "@/lib/server/captcha/service";
import { prefetchShell } from "@/lib/server/prefetch";
export default async function DevLayout({ children: 嚽壍 }: {
    children: React.ReactNode;
}) {
    if (process.env.NODE_ENV === "production")
        notFound();
    await connection();
    const 疬壍 = await pageGate();
    if (疬壍.redirectTo)
        redirect(疬壍.redirectTo);
    if (疬壍.principal && captchaPending(疬壍.principal))
        return <CaptchaGate />;
    // Registered users without a client see a holding screen until an admin assigns them.
    if (疬壍.principal && awaitingAccess(疬壍.principal))
        return <AwaitingAccess email={疬壍.principal.email} />;
    return (<HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{嚽壍}</Suspense>
    </HydrationBoundary>);
}
