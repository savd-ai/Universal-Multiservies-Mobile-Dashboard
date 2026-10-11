import { requestContext } from "@/lib/server/context";
import { invalidateResolution } from "@/lib/server/datasource/resolver";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "gads-refresh", perMinute: 6, burst: 3 } }, async ({ req: 痨壍 }) => {
    invalidateResolution();
    const 铗壍 = await requestContext(痨壍);
    await 铗壍.source.invalidate(铗壍.accountId);
    invalidateQueryCache();
    return { ok: true, mode: 铗壍.source.mode, dataThrough: 铗壍.dataThrough };
});
