import "server-only";
import path from "node:path";
import { WAREHOUSE_TABLES, type WarehouseStatus } from "@/lib/domain/contracts/warehouse";
import type { RequestContext } from "../context";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { getWarehouse, warehouseAvailability, warehouseSize } from "./index";
import { SCHEMA_VERSION } from "./schema";
import { unwrapSource } from "./source";
import { warehouseSchedulerInfo } from "./scheduler";
function 洂壍(诱壍: string | null): string | null {
    if (诱壍 === null || 诱壍 === ":memory:")
        return 诱壍;
    const 壠壍 = path.relative(process.cwd(), 诱壍);
    return 壠壍 && !壠壍.startsWith("..") && !path.isAbsolute(壠壍) ? 壠壍 : 诱壍;
}
export async function warehouseStatus(矏壍: RequestContext): Promise<WarehouseStatus> {
    const 难壍 = warehouseConfig();
    const 掭壍 = 矏壍.source.mode;
    const 芜壍 = warehouseAvailability(掭壍);
    const 例壍 = getWarehouse(掭壍);
    const 湺壍: WarehouseStatus = {
        enabled: 芜壍.enabled,
        available: 芜壍.available,
        reason: 芜壍.reason,
        engine: "SQLite",
        sqliteVersion: 例壍?.sqliteVersion ?? null,
        mode: 掭壍,
        file: 洂壍(芜壍.location),
        sizeBytes: 例壍 ? warehouseSize(例壍) : null,
        schemaVersion: 例壍 ? SCHEMA_VERSION : 0,
        reads: 难壍.reads,
        scheduler: warehouseSchedulerInfo(),
        backfillDays: 难壍.backfillDays,
        retentionDays: 难壍.retentionDays,
        maxRequests: 难壍.maxRequests,
        restatementDays: googleAdsConfig().restatementDays,
        account: { id: 矏壍.accountId, name: 矏壍.account.name, currency: 矏壍.account.currency },
        accountsStored: 0,
        tables: [],
        dims: { campaigns: 0, adGroups: 0, keywords: 0, campaignVersions: 0 },
        changeEvents: { count: 0, firstDay: null, lastDay: null },
        estimates: { simulations: 0, recommendations: 0, lastCapturedAt: null },
        months: [],
        runs: [],
        running: null,
        note: 掭壍 !== "live" ? "No live Google Ads account is connected, so nothing is stored." : null,
    };
    if (!例壍)
        return 湺壍;
    const 赩壍 = unwrapSource(矏壍.source);
    const 婘壍 = await Promise.all(WAREHOUSE_TABLES.map(async (祇壍) => {
        const 頶壍 = (await 赩壍.coverage(矏壍.accountId, 祇壍.id))?.start ?? null;
        const 攥壍 = 例壍.repo.tableStats(矏壍.accountId, 祇壍.id, 祇壍.sql, 頶壍);
        return { table: 祇壍.id, label: 祇壍.label, sqlTable: 祇壍.sql, rows: 攥壍.rows, firstDay: 攥壍.firstDay, lastDay: 攥壍.lastDay, periods: 攥壍.periods, settledPeriods: 攥壍.settledPeriods, lastFetchedAt: 攥壍.lastFetchedAt, googleFrom: 頶壍, beyondGoogle: 攥壍.beyond };
    }));
    const 萔壍 = 例壍.repo.runs(8);
    return {
        ...湺壍,
        accountsStored: 例壍.repo.accountCount(),
        tables: 婘壍,
        ...例壍.repo.counts(矏壍.accountId),
        months: 例壍.repo.months(矏壍.accountId, 13),
        runs: 萔壍,
        running: 萔壍.find((儃壍) => 儃壍.status === "running") ?? null,
    };
}
