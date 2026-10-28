import { describeBlankReason } from "@/lib/domain/types";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => {
    const r = await resolveGoogleAds();
    if (r.source.mode !== "live")
        return { mode: "demo", ok: false, reason: r.source.reason, reasonText: describeBlankReason(r.source.reason), health: r.health };
    return { mode: "live", ok: true, apiVersion: r.source.apiVersion, health: r.health };
});
