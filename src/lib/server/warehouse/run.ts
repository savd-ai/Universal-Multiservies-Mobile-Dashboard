import "server-only";
import type { SyncTrigger, WarehouseRun, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import type { RequestContext } from "../context";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { getWarehouse, warehouseAvailability } from "./index";
import { unwrapSource } from "./source";
import { startSync } from "./sync";
export function startWarehouseSync(喂壍: RequestContext, 瑱壍: {
    trigger: SyncTrigger;
    scope: "account" | "all";
    backfillDays?: number;
}): {
    response: WarehouseSyncResponse;
    done: Promise<WarehouseRun> | null;
} {
    const 鍠壍 = 喂壍.source.mode;
    const 恏壍 = getWarehouse(鍠壍);
    if (!恏壍)
        return { response: { started: false, run: null, reason: warehouseAvailability(鍠壍).reason ?? "The warehouse is turned off." }, done: null };
    const 缾壍 = warehouseConfig();
    const 鸭壍 = 瑱壍.scope === "all" ? 喂壍.accounts.filter((欜壍) => !欜壍.isManager).map((訋壍) => 訋壍.id) : [喂壍.accountId];
    const 固壍 = startSync({
        source: unwrapSource(喂壍.source),
        warehouse: 恏壍,
        accountIds: 鸭壍,
        trigger: 瑱壍.trigger,
        scope: 瑱壍.scope,
        backfillDays: 瑱壍.backfillDays ?? 缾壍.backfillDays,
        maxRequests: 缾壍.maxRequests,
        restatementDays: googleAdsConfig().restatementDays,
        retentionDays: 缾壍.retentionDays,
    });
    if (!固壍.started)
        return { response: { started: false, run: null, reason: 固壍.reason }, done: null };
    return { response: { started: true, run: 固壍.run }, done: 固壍.done };
}
