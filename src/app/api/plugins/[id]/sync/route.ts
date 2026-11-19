import { addDays } from "@/lib/domain/dates";
import { requestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { findPlugin, pluginContext, pluginMode, recordSync } from "@/lib/server/plugins/registry";
import { invalidateRestCache } from "@/lib/server/plugins/rest-engine";
import { auditUser, idParam } from "@/lib/server/plugins/route-helpers";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sync = drop cached plugin rows and query results; live metrics plugins are re-fetched for the last 30 days
// right away so the answer says whether the endpoint still works.
export const POST = route({ rateLimit: { key: "plugins:sync", perMinute: 10 } }, async ({ req, params }) => {
  const id = idParam(params);
  const plugin = await findPlugin(id);
  if (!plugin) throw notFound("Plugin");
  invalidateRestCache(id);
  invalidateQueryCache();
  const lastSyncAt = await recordSync(id);
  const conn = (await getStore().pluginConnections.get(id)) ?? undefined;
  let ok = true;
  let rows: number | null = null;
  let message = "Caches cleared — the next query fetches fresh data.";
  if (plugin.fetchMetrics && conn?.enabled && pluginMode(plugin, conn) === "live") {
    const ctx = await requestContext(req);
    const end = addDays(ctx.today, -1);
    try {
      rows = (await plugin.fetchMetrics({ start: addDays(end, -29), end }, await pluginContext(plugin, conn, ctx.account))).length;
      message = `Synced ${rows} row${rows === 1 ? "" : "s"} for the last 30 days.`;
    } catch (err) {
      ok = false;
      message = `Sync failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  await auditUser("plugin.sync", id, `Synced ${plugin.manifest.name}`, { ok, rows });
  return { ok, lastSyncAt, rows, message };
});
