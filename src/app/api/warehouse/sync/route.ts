import { warehouseSyncSchema } from "@/lib/domain/contracts/warehouse";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { audit } from "@/lib/server/store";
import { startWarehouseSync } from "@/lib/server/warehouse/run";

export const runtime = "nodejs";

// "Sync now": starts a warehouse sync for the active account or every account and returns at once; the run keeps
// going in the background and GET /api/warehouse shows its progress. Reads Google Ads only (search/searchStream).
export const POST = route({ body: warehouseSyncSchema, rateLimit: { key: "warehouse-sync", perMinute: 4, burst: 2 } }, async ({ req, body }) => {
  const ctx = await requestContext(req);
  const { response } = startWarehouseSync(ctx, { trigger: "manual", scope: body.scope, backfillDays: body.backfillDays });
  if (response.started) {
    await audit({ actor: "user", action: "warehouse.sync", target: body.scope, mode: ctx.source.mode, summary: `Started a warehouse sync for ${body.scope === "all" ? "every account" : ctx.account.name}`, details: { runId: response.run?.id } });
  }
  return response;
});
