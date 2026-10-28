import "server-only";
import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import { cookies } from "next/headers";
import { qk } from "@/lib/api/query-keys";
import { buildMe } from "./auth/me";
import { ACCOUNT_COOKIE, principalFromCookies, scopeFor } from "./auth/principal";
import { requestContext } from "./context";
import { listDashboards } from "./dashboards";
import { log } from "./log";
import { runWithScope } from "./scope";
import { buildStatus } from "./status";
export async function prefetchShell(): Promise<DehydratedState> {
    const qc = new QueryClient();
    try {
        const principal = await principalFromCookies();
        if (!principal)
            return dehydrate(qc);
        const cookie = (await cookies()).get(ACCOUNT_COOKIE)?.value?.replace(/\D/g, "") || undefined;
        await runWithScope(await scopeFor(principal, cookie ?? null), async () => {
            const ctx = await requestContext(undefined, undefined, { preferred: cookie });
            await Promise.all([
                qc.prefetchQuery({ queryKey: qk.status(), queryFn: () => buildStatus(ctx) }),
                qc.prefetchQuery({ queryKey: qk.dashboards(), queryFn: () => listDashboards() }),
                qc.prefetchQuery({ queryKey: qk.me(), queryFn: () => buildMe(principal) }),
            ]);
        });
    }
    catch (err) {
        log.warn("shell prefetch failed", { error: (err as Error).message });
    }
    return dehydrate(qc);
}
