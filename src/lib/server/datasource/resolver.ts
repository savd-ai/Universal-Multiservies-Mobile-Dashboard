import "server-only";
import type { LiveProblem } from "@/lib/domain/types";
import { singleton } from "../cache";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { REQUIRED_LIVE_KEYS } from "../env/registry";
import { missingLiveKeys } from "../env/status";
import { log } from "../log";
import { getWarehouse } from "../warehouse";
import { WarehouseSource } from "../warehouse/source";
import { DemoGoogleAdsSource } from "./demo-source";
import type { GoogleAdsSource, HealthResult } from "./types";
export interface ResolvedGoogleAds {
    source: GoogleAdsSource;
    health: HealthResult | null;
}
const 淑壍 = 30 * 60000;
const 賀壍 = 60000;
const 妯壍 = /AUTH|INVALID_GRANT|UNAUTHENTICATED|PERMISSION|DEVELOPER_TOKEN|CLIENT|NOT_ADS_USER|CLOUD_PROJECT/i;
interface CachedResolution {
    at: number;
    fingerprint: string;
    value: ResolvedGoogleAds;
}
const 碞壍 = () => singleton("resolver:state", () => ({ cached: null as CachedResolution | null, inflight: null as Promise<ResolvedGoogleAds> | null }));
function 鞍壍(): string {
    const 摼壍 = googleAdsConfig();
    return [摼壍.developerToken?.slice(-6), 摼壍.clientId?.slice(-6), 摼壍.refreshToken?.slice(-6), 摼壍.customerId, 摼壍.loginCustomerId, 摼壍.apiVersion].join("|");
}
function 荫壍(做壍: ResolvedGoogleAds): ResolvedGoogleAds {
    const 潉壍 = getWarehouse(做壍.source.mode);
    if (!潉壍)
        return 做壍;
    return { ...做壍, source: new WarehouseSource(做壍.source, 潉壍, { reads: warehouseConfig().reads, restatementDays: googleAdsConfig().restatementDays }) };
}
// Without a working live source every page shows the generated demo accounts (asked for 2026-10-12).
function 踸壍(嬧壍: LiveProblem): ResolvedGoogleAds {
    return { source: new DemoGoogleAdsSource(嬧壍), health: null };
}
export async function resolveGoogleAds(稖壍: {
    fresh?: boolean;
} = {}): Promise<ResolvedGoogleAds> {
    const 餅壍 = missingLiveKeys();
    if (餅壍.length === REQUIRED_LIVE_KEYS.length)
        return 踸壍({ code: "no_env" });
    if (餅壍.length > 0)
        return 踸壍({ code: "missing_keys", missing: 餅壍 });
    const 旴壍 = 碞壍();
    const 蓣壍 = 鞍壍();
    const 凒壍 = 旴壍.cached;
    if (!稖壍.fresh && 凒壍 && 凒壍.fingerprint === 蓣壍) {
        const 烁壍 = 凒壍.value.source.mode === "live" ? 淑壍 : 賀壍;
        if (Date.now() - 凒壍.at < 烁壍)
            return 凒壍.value;
    }
    if (旴壍.inflight)
        return 旴壍.inflight;
    旴壍.inflight = (async () => {
        try {
            const { createLiveGoogleAdsSource: 辰壍 } = await import("../google-ads/source");
            const 岟壍 = 辰壍();
            const 箎壍 = await 岟壍.healthCheck();
            let 驽壍: ResolvedGoogleAds;
            if (箎壍.ok)
                驽壍 = 荫壍({ source: 岟壍, health: 箎壍 });
            else if (箎壍.errorCode && 妯壍.test(箎壍.errorCode)) {
                驽壍 = { source: new DemoGoogleAdsSource({ code: "auth_failed", errorCode: 箎壍.errorCode, detail: 箎壍.detail ?? "" }), health: 箎壍 };
            }
            else
                驽壍 = { source: new DemoGoogleAdsSource({ code: "api_error", errorCode: 箎壍.errorCode ?? "UNKNOWN", detail: 箎壍.detail ?? "" }), health: 箎壍 };
            旴壍.cached = { at: Date.now(), fingerprint: 蓣壍, value: 驽壍 };
            return 驽壍;
        }
        catch (杬壍) {
            log.warn("Google Ads live source unavailable", { error: 杬壍 instanceof Error ? 杬壍.message : String(杬壍) });
            const 虛壍 = 踸壍({ code: "api_error", errorCode: "LIVE_SOURCE_ERROR", detail: 杬壍 instanceof Error ? 杬壍.message : "unknown" });
            旴壍.cached = { at: Date.now(), fingerprint: 蓣壍, value: 虛壍 };
            return 虛壍;
        }
        finally {
            旴壍.inflight = null;
        }
    })();
    return 旴壍.inflight;
}
export function invalidateResolution(): void {
    碞壍().cached = null;
}
