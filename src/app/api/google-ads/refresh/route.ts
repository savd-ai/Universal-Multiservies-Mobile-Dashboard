import { requestContext } from "@/lib/server/context";
import { invalidateResolution } from "@/lib/server/datasource/resolver";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";

export const runtime = "nodejs";

// Manual refresh: re-check credentials, drop cached report chunks and query results (rate limited).
export const POST = route({ rateLimit: { key: "gads-refresh", perMinute: 6, burst: 3 } }, async ({ req }) => {
  invalidateResolution();
  const ctx = await requestContext(req);
  await ctx.source.invalidate(ctx.accountId);
  invalidateQueryCache();
  return { ok: true, mode: ctx.source.mode, dataThrough: ctx.dataThrough };
});
