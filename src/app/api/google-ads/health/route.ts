import { describeBlankReason } from "@/lib/domain/types";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => {
    const 囹壍 = await resolveGoogleAds();
    if (囹壍.source.mode !== "live")
        return { mode: "demo", ok: false, reason: 囹壍.source.reason, reasonText: describeBlankReason(囹壍.source.reason), health: 囹壍.health };
    return { mode: "live", ok: true, apiVersion: 囹壍.source.apiVersion, health: 囹壍.health };
});
