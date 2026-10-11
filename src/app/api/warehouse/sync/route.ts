import { warehouseSyncSchema } from "@/lib/domain/contracts/warehouse";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { audit } from "@/lib/server/store";
import { startWarehouseSync } from "@/lib/server/warehouse/run";
export const runtime = "nodejs";
export const POST = route({ body: warehouseSyncSchema, rateLimit: { key: "warehouse-sync", perMinute: 4, burst: 2 } }, async ({ req: 奤壍, body: 硓壍 }) => {
    const 靂壍 = await requestContext(奤壍);
    const { response: 搱壍 } = startWarehouseSync(靂壍, { trigger: "manual", scope: 硓壍.scope, backfillDays: 硓壍.backfillDays });
    if (搱壍.started) {
        await audit({ actor: "user", action: "warehouse.sync", target: 硓壍.scope, mode: 靂壍.source.mode, summary: `Started a warehouse sync for ${硓壍.scope === "all" ? "every account" : 靂壍.account.name}`, details: { runId: 搱壍.run?.id } });
    }
    return 搱壍;
});
