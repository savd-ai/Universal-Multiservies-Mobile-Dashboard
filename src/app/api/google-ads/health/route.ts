import { describeDemoReason } from "@/lib/domain/types";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Same path the prototype expected (/api/google-ads/health): demo → reason; live → token + customer query result.
export const GET = route({}, async () => {
  const r = await resolveGoogleAds();
  if (r.source.mode === "demo") return { mode: "demo", ok: false, reason: r.source.reason, reasonText: describeDemoReason(r.source.reason), health: r.health };
  return { mode: "live", ok: true, apiVersion: r.source.apiVersion, health: r.health };
});
