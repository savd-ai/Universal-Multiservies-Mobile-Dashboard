import "server-only";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import { can } from "@/lib/domain/auth/roles";
import { describeBlankReason } from "@/lib/domain/types";
import type { RequestContext } from "./context";
import { secretsEnabled } from "./crypto/secrets";
import { appConfig, env, googleAdsConfig } from "./env/config";
import { envFilePresent, envKeyStatuses, missingLiveKeys } from "./env/status";
import { currentPrincipal } from "./scope";
import { getStore } from "./store";
import { storeInfo } from "./store/store";
export async function buildStatus(ctx: RequestContext): Promise<StatusResponse> {
    const store = getStore();
    const [manager, scheduler, settings] = await Promise.all([ctx.source.manager(), store.scheduler.get(), store.settings.get()]);
    const info = storeInfo();
    const cfg = appConfig();
    const health = ctx.resolved.health;
    const system = can(currentPrincipal().role, "system.manage");
    return {
        mode: ctx.source.mode,
        reason: ctx.source.reason,
        reasonText: describeBlankReason(ctx.source.reason),
        account: ctx.account,
        accounts: ctx.accounts,
        manager,
        today: ctx.today,
        dataThrough: ctx.dataThrough,
        googleAds: {
            apiVersion: googleAdsConfig().apiVersion,
            envFile: system ? envFilePresent() : false,
            missingKeys: system ? missingLiveKeys() : [],
            health: health ? { ok: health.ok, checkedAt: health.checkedAt, latencyMs: health.latencyMs, errorCode: health.errorCode } : null,
        },
        store: { driver: info.driver, writable: info.writable, fallbackReason: info.fallbackReason },
        scheduler: { enabled: env.bool("ALERTS_SCHEDULER_ENABLED"), intervalMinutes: env.int("ALERTS_INTERVAL_MINUTES", 60, 5, 1440), lastRunAt: scheduler.lastRunAt },
        security: { basicAuth: !!cfg.basicAuth, encryption: secretsEnabled(), readOnly: true },
        display: { currency: settings.displayCurrency ?? cfg.displayCurrency ?? ctx.account.currency, fxRates: { ...cfg.fxRates, ...settings.fxRates } },
        env: system ? envKeyStatuses() : [],
        generatedAt: new Date().toISOString(),
    };
}
