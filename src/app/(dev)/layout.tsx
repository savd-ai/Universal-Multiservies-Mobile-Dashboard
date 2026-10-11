import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { pageGate } from "@/lib/server/auth/gate";
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
    return (<HydrationBoundary state={await prefetchShell()}>
      <Suspense fallback={null}>{嚽壍}</Suspense>
    </HydrationBoundary>);
}
