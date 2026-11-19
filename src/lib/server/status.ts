import "server-only";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import { can } from "@/lib/domain/auth/roles";
import { describeDemoReason } from "@/lib/domain/types";
import { aiStatus } from "./ai/config";
import type { RequestContext } from "./context";
import { secretsEnabled } from "./crypto/secrets";
import { appConfig, demoConfig, env, googleAdsConfig } from "./env/config";
import { envFilePresent, envKeyStatuses, missingLiveKeys } from "./env/status";
import { pluginViews } from "./plugins/registry";
import { currentPrincipal } from "./scope";
import { getStore } from "./store";
import { storeInfo } from "./store/store";

// Assembles GET /api/status. Server Components call this directly (not via fetch). Environment details (which
// keys are set, missing Google Ads keys) are only included for roles that manage the system.

export async function buildStatus(ctx: RequestContext): Promise<StatusResponse> {
  const store = getStore();
  const [manager, plugins, scheduler, settings] = await Promise.all([ctx.source.manager(), pluginViews(), store.scheduler.get(), store.settings.get()]);
  const connected = plugins.filter((p) => p.connected);
  const info = storeInfo();
  const cfg = appConfig();
  const health = ctx.resolved.health;
  const system = can(currentPrincipal().role, "system.manage");
  return {
    mode: ctx.source.mode,
    reason: ctx.source.reason,
    reasonText: describeDemoReason(ctx.source.reason),
    account: ctx.account,
    accounts: ctx.accounts,
    manager,
    today: ctx.today,
    dataThrough: ctx.dataThrough,
    demoProfile: demoConfig().profile,
    googleAds: {
      apiVersion: googleAdsConfig().apiVersion,
      envFile: system ? envFilePresent() : false,
      missingKeys: system ? missingLiveKeys() : [],
      health: health ? { ok: health.ok, checkedAt: health.checkedAt, latencyMs: health.latencyMs, errorCode: health.errorCode } : null,
    },
    ai: aiStatus(),
    plugins: { connected: connected.length, live: connected.filter((p) => p.mode === "live").length, demo: connected.filter((p) => p.mode === "demo").length },
    store: { driver: info.driver, writable: info.writable, fallbackReason: info.fallbackReason },
    scheduler: { enabled: env.bool("ALERTS_SCHEDULER_ENABLED"), intervalMinutes: env.int("ALERTS_INTERVAL_MINUTES", 60, 5, 1440), lastRunAt: scheduler.lastRunAt },
    security: { basicAuth: !!cfg.basicAuth, encryption: secretsEnabled(), readOnly: true },
    display: { currency: settings.displayCurrency ?? cfg.displayCurrency ?? ctx.account.currency, fxRates: { ...cfg.fxRates, ...settings.fxRates } },
    env: system ? envKeyStatuses() : [],
    generatedAt: new Date().toISOString(),
  };
}
