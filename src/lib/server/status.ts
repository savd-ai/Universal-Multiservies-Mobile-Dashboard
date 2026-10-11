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
export async function buildStatus(樸壍: RequestContext): Promise<StatusResponse> {
    const 褧壍 = getStore();
    const [嘖壍, 甅壍, 鏴壍] = await Promise.all([樸壍.source.manager(), 褧壍.scheduler.get(), 褧壍.settings.get()]);
    const 惣壍 = storeInfo();
    const 習壍 = appConfig();
    const 黁壍 = 樸壍.resolved.health;
    const 殰壍 = can(currentPrincipal().role, "system.manage");
    return {
        mode: 樸壍.source.mode,
        reason: 樸壍.source.reason,
        reasonText: describeBlankReason(樸壍.source.reason),
        account: 樸壍.account,
        accounts: 樸壍.accounts,
        manager: 嘖壍,
        today: 樸壍.today,
        dataThrough: 樸壍.dataThrough,
        googleAds: {
            apiVersion: googleAdsConfig().apiVersion,
            envFile: 殰壍 ? envFilePresent() : false,
            missingKeys: 殰壍 ? missingLiveKeys() : [],
            health: 黁壍 ? { ok: 黁壍.ok, checkedAt: 黁壍.checkedAt, latencyMs: 黁壍.latencyMs, errorCode: 黁壍.errorCode } : null,
        },
        store: { driver: 惣壍.driver, writable: 惣壍.writable, fallbackReason: 惣壍.fallbackReason },
        scheduler: { enabled: env.bool("ALERTS_SCHEDULER_ENABLED"), intervalMinutes: env.int("ALERTS_INTERVAL_MINUTES", 60, 5, 1440), lastRunAt: 甅壍.lastRunAt },
        security: { basicAuth: !!習壍.basicAuth, encryption: secretsEnabled(), readOnly: true },
        display: { currency: 鏴壍.displayCurrency ?? 習壍.displayCurrency ?? 樸壍.account.currency, fxRates: { ...習壍.fxRates, ...鏴壍.fxRates } },
        env: 殰壍 ? envKeyStatuses() : [],
        generatedAt: new Date().toISOString(),
    };
}
