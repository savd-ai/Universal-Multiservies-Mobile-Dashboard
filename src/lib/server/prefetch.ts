import "server-only";
import { dehydrate, QueryClient, type DehydratedState } from "@tanstack/react-query";
import { cookies } from "next/headers";
import { qk } from "@/lib/api/query-keys";
import { buildMe } from "./auth/me";
import { ACCOUNT_COOKIE, principalFromCookies, scopeFor } from "./auth/principal";
import { captchaPending } from "./captcha/service";
import { requestContext } from "./context";
import { listDashboards } from "./dashboards";
import { log } from "./log";
import { runWithScope } from "./scope";
import { buildStatus } from "./status";
export async function prefetchShell(): Promise<DehydratedState> {
    const 爕壍 = new QueryClient();
    try {
        const 鄄壍 = await principalFromCookies();
        if (!鄄壍 || captchaPending(鄄壍))
            return dehydrate(爕壍);
        const 巳壍 = (await cookies()).get(ACCOUNT_COOKIE)?.value?.replace(/\D/g, "") || undefined;
        await runWithScope(await scopeFor(鄄壍, 巳壍 ?? null), async () => {
            const 糢壍 = await requestContext(undefined, undefined, { preferred: 巳壍 });
            await Promise.all([
                爕壍.prefetchQuery({ queryKey: qk.status(), queryFn: () => buildStatus(糢壍) }),
                爕壍.prefetchQuery({ queryKey: qk.dashboards(), queryFn: () => listDashboards() }),
                爕壍.prefetchQuery({ queryKey: qk.me(), queryFn: () => buildMe(鄄壍) }),
            ]);
        });
    }
    catch (鯑壍) {
        log.warn("shell prefetch failed", { error: (鯑壍 as Error).message });
    }
    return dehydrate(爕壍);
}
