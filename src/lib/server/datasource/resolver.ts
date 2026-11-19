import "server-only";
import type { DemoReason } from "@/lib/domain/types";
import { singleton } from "../cache";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { REQUIRED_LIVE_KEYS } from "../env/registry";
import { missingLiveKeys } from "../env/status";
import { log } from "../log";
import { getWarehouse } from "../warehouse";
import { WarehouseSource } from "../warehouse/source";
import { DemoGoogleAdsSource } from "./demo-source";
import type { GoogleAdsSource, HealthResult } from "./types";

// Decides live vs demo for every request, with the exact reason shown in the banner:
// forced → no .env keys → missing keys → auth failed → API error → live. The chosen source is wrapped by the
// analytics warehouse (SQLite, one file per mode) unless WAREHOUSE_ENABLED=false or SQLite is unavailable.

export interface ResolvedGoogleAds {
  source: GoogleAdsSource;
  health: HealthResult | null;
}

// A health check costs one API operation; a Cloud project at Explorer access allows 2,880/day on production accounts,
// so a healthy result is trusted for 30 minutes (any GOOGLE_ADS_ERROR during normal requests, or "Refresh", re-checks
// immediately).
const HEALTH_TTL_MS = 30 * 60_000;
const FAILURE_TTL_MS = 60_000;

/** Credential/access problems (shown as "credentials were rejected"); account problems such as CUSTOMER_NOT_ENABLED
 * or a manager id in GOOGLE_ADS_CUSTOMER_ID stay api_error, whose banner now includes the explanation. */
const AUTH_LIKE = /AUTH|INVALID_GRANT|UNAUTHENTICATED|PERMISSION|DEVELOPER_TOKEN|CLIENT|NOT_ADS_USER|CLOUD_PROJECT/i;

interface CachedResolution {
  at: number;
  fingerprint: string;
  value: ResolvedGoogleAds;
}

const state = () => singleton("resolver:state", () => ({ cached: null as CachedResolution | null, inflight: null as Promise<ResolvedGoogleAds> | null }));

function fingerprint(): string {
  const c = googleAdsConfig();
  return [c.forceDemo, c.developerToken?.slice(-6), c.clientId?.slice(-6), c.refreshToken?.slice(-6), c.customerId, c.loginCustomerId, c.apiVersion].join("|");
}

function withWarehouse(value: ResolvedGoogleAds): ResolvedGoogleAds {
  const w = getWarehouse(value.source.mode);
  if (!w) return value;
  return { ...value, source: new WarehouseSource(value.source, w, { reads: warehouseConfig().reads, restatementDays: googleAdsConfig().restatementDays }) };
}

function demo(reason: DemoReason): ResolvedGoogleAds {
  return withWarehouse({ source: new DemoGoogleAdsSource(reason), health: null });
}

export async function resolveGoogleAds(opts: { fresh?: boolean } = {}): Promise<ResolvedGoogleAds> {
  const cfg = googleAdsConfig();
  if (cfg.forceDemo) return demo({ code: "forced" });
  const missing = missingLiveKeys();
  if (missing.length === REQUIRED_LIVE_KEYS.length) return demo({ code: "no_env" });
  if (missing.length > 0) return demo({ code: "missing_keys", missing });

  const s = state();
  const fp = fingerprint();
  const cached = s.cached;
  if (!opts.fresh && cached && cached.fingerprint === fp) {
    const ttl = cached.value.source.mode === "live" ? HEALTH_TTL_MS : FAILURE_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.value;
  }
  if (s.inflight) return s.inflight;
  s.inflight = (async () => {
    try {
      const { createLiveGoogleAdsSource } = await import("../google-ads/source");
      const live = createLiveGoogleAdsSource();
      const health = await live.healthCheck();
      let value: ResolvedGoogleAds;
      if (health.ok) value = withWarehouse({ source: live, health });
      else if (health.errorCode && AUTH_LIKE.test(health.errorCode)) {
        value = { source: new DemoGoogleAdsSource({ code: "auth_failed", errorCode: health.errorCode, detail: health.detail ?? "" }), health };
      } else value = { source: new DemoGoogleAdsSource({ code: "api_error", errorCode: health.errorCode ?? "UNKNOWN", detail: health.detail ?? "" }), health };
      if (value.source.mode === "demo") value = withWarehouse(value);
      s.cached = { at: Date.now(), fingerprint: fp, value };
      return value;
    } catch (err) {
      log.warn("Google Ads live source unavailable", { error: err instanceof Error ? err.message : String(err) });
      const value = demo({ code: "api_error", errorCode: "LIVE_SOURCE_ERROR", detail: err instanceof Error ? err.message : "unknown" });
      s.cached = { at: Date.now(), fingerprint: fp, value };
      return value;
    } finally {
      s.inflight = null;
    }
  })();
  return s.inflight;
}

export function invalidateResolution(): void {
  state().cached = null;
}
