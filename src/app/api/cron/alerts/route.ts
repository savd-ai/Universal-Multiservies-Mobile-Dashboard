import { runAlerts } from "@/lib/server/alerts/runner";
import { authorizeCron, withRunLock } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { env } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { log } from "@/lib/server/log";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const maxDuration = 120;
const handler = route({ allowCrossSite: true }, async ({ req }) => {
    const via = authorizeCron(req);
    const startedAt = new Date().toISOString();
    const res = await withRunLock(async () => {
        const base = await requestContext();
        const all = env.bool("ALERTS_ALL_ACCOUNTS");
        const accounts = all ? base.accounts.filter((a) => !a.isManager).map((a) => a.id) : [base.accountId];
        const runs = [];
        for (const accountId of accounts) {
            try {
                const ctx = accountId === base.accountId ? base : await requestContext(undefined, accountId);
                const { deliveries, ...summary } = await runAlerts(ctx, { actor: "scheduler", digests: true, perAccountDigests: all });
                runs.push({ ...summary, deliveryIds: deliveries.map((d) => d.id) });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                log.error("Scheduled alert run failed", { accountId, error: message });
                runs.push({ accountId, error: message });
            }
        }
        await getStore().scheduler.set((prev) => ({ ...prev, lastRunAt: startedAt }));
        return runs;
    });
    if (!res.ran)
        return { ok: true, skipped: true, reason: `An alert run is already in progress (started ${res.startedAt}).`, via };
    return { ok: true, ranAt: startedAt, via, runs: res.value };
});
export const GET = handler;
export const POST = handler;
