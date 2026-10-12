import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CaptchaGate } from "@/features/captcha/captcha-gate";
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
    return (<HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{嚽壍}</Suspense>
    </HydrationBoundary>);
}
