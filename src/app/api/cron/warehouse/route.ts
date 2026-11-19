import { authorizeCron } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { startWarehouseSync } from "@/lib/server/warehouse/run";

export const runtime = "nodejs";
export const maxDuration = 300;

// Scheduled warehouse sync of every accessible account: Bearer CRON_SECRET (external cron) or the in-process
// timer's loopback token (WAREHOUSE_SYNC_ENABLED=true). Exempt from CSRF and Basic auth: bearer-authenticated.
const handler = route({ allowCrossSite: true }, async ({ req }) => {
  const via = authorizeCron(req);
  const ctx = await requestContext();
  const { response, done } = startWarehouseSync(ctx, { trigger: via === "internal" ? "schedule" : "cron", scope: "all" });
  if (!done) return { ok: true, skipped: true, reason: response.reason, via };
  return { ok: true, via, run: await done };
});

export const GET = handler;
export const POST = handler;
