import "server-only";
import type { SyncTrigger, WarehouseRun, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import type { RequestContext } from "../context";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { getWarehouse, warehouseAvailability } from "./index";
import { unwrapSource } from "./source";
import { startSync } from "./sync";
export function startWarehouseSync(ctx: RequestContext, o: {
    trigger: SyncTrigger;
    scope: "account" | "all";
    backfillDays?: number;
}): {
    response: WarehouseSyncResponse;
    done: Promise<WarehouseRun> | null;
} {
    const mode = ctx.source.mode;
    const w = getWarehouse(mode);
    if (!w)
        return { response: { started: false, run: null, reason: warehouseAvailability(mode).reason ?? "The warehouse is turned off." }, done: null };
    const cfg = warehouseConfig();
    const accountIds = o.scope === "all" ? ctx.accounts.filter((a) => !a.isManager).map((a) => a.id) : [ctx.accountId];
    const res = startSync({
        source: unwrapSource(ctx.source),
        warehouse: w,
        accountIds,
        trigger: o.trigger,
        scope: o.scope,
        backfillDays: o.backfillDays ?? cfg.backfillDays,
        maxRequests: cfg.maxRequests,
        restatementDays: googleAdsConfig().restatementDays,
        retentionDays: cfg.retentionDays,
    });
    if (!res.started)
        return { response: { started: false, run: null, reason: res.reason }, done: null };
    return { response: { started: true, run: res.run }, done: res.done };
}
