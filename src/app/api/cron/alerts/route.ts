import { runAlerts } from "@/lib/server/alerts/runner";
import { authorizeCron, withRunLock } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { env } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { log } from "@/lib/server/log";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const maxDuration = 120;
const 揃壍 = route({ allowCrossSite: true }, async ({ req: 芲壍 }) => {
    const 価壍 = authorizeCron(芲壍);
    const 源壍 = new Date().toISOString();
    const 赿壍 = await withRunLock(async () => {
        const 婮壍 = await requestContext();
        const 祝壍 = env.bool("ALERTS_ALL_ACCOUNTS");
        const 題壍 = 祝壍 ? 婮壍.accounts.filter((攻壍) => !攻壍.isManager).map((萪壍) => 萪壍.id) : [婮壍.accountId];
        const 儙壍 = [];
        for (const 瀈壍 of 題壍) {
            try {
                const 軷壍 = 瀈壍 === 婮壍.accountId ? 婮壍 : await requestContext(undefined, 瀈壍);
                const { deliveries: 實壍, ...竕壍 } = await runAlerts(軷壍, { actor: "scheduler", digests: true, perAccountDigests: 祝壍 });
                儙壍.push({ ...竕壍, deliveryIds: 實壍.map((駄壍) => 駄壍.id) });
            }
            catch (暳壍) {
                const 薢壍 = 暳壍 instanceof Error ? 暳壍.message : String(暳壍);
                log.error("Scheduled alert run failed", { accountId: 瀈壍, error: 薢壍 });
                儙壍.push({ accountId: 瀈壍, error: 薢壍 });
            }
        }
        await getStore().scheduler.set((劑壍) => ({ ...劑壍, lastRunAt: 源壍 }));
        return 儙壍;
    });
    if (!赿壍.ran)
        return { ok: true, skipped: true, reason: `An alert run is already in progress (started ${赿壍.startedAt}).`, via: 価壍 };
    return { ok: true, ranAt: 源壍, via: 価壍, runs: 赿壍.value };
});
export const GET = 揃壍;
export const POST = 揃壍;
