import "server-only";
import path from "node:path";
import { WAREHOUSE_TABLES, type WarehouseStatus } from "@/lib/domain/contracts/warehouse";
import type { RequestContext } from "../context";
import { googleAdsConfig, warehouseConfig } from "../env/config";
import { getWarehouse, warehouseAvailability, warehouseSize } from "./index";
import { SCHEMA_VERSION } from "./schema";
import { unwrapSource } from "./source";
import { warehouseSchedulerInfo } from "./scheduler";
function displayPath(location: string | null): string | null {
    if (location === null || location === ":memory:")
        return location;
    const rel = path.relative(process.cwd(), location);
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : location;
}
export async function warehouseStatus(ctx: RequestContext): Promise<WarehouseStatus> {
    const cfg = warehouseConfig();
    const mode = ctx.source.mode;
    const avail = warehouseAvailability(mode);
    const w = getWarehouse(mode);
    const base: WarehouseStatus = {
        enabled: avail.enabled,
        available: avail.available,
        reason: avail.reason,
        engine: "SQLite",
        sqliteVersion: w?.sqliteVersion ?? null,
        mode,
        file: displayPath(avail.location),
        sizeBytes: w ? warehouseSize(w) : null,
        schemaVersion: w ? SCHEMA_VERSION : 0,
        reads: cfg.reads,
        scheduler: warehouseSchedulerInfo(),
        backfillDays: cfg.backfillDays,
        retentionDays: cfg.retentionDays,
        maxRequests: cfg.maxRequests,
        restatementDays: googleAdsConfig().restatementDays,
        account: { id: ctx.accountId, name: ctx.account.name, currency: ctx.account.currency },
        accountsStored: 0,
        tables: [],
        dims: { campaigns: 0, adGroups: 0, keywords: 0, campaignVersions: 0 },
        changeEvents: { count: 0, firstDay: null, lastDay: null },
        estimates: { simulations: 0, recommendations: 0, lastCapturedAt: null },
        months: [],
        runs: [],
        running: null,
        note: mode !== "live" ? "No live Google Ads account is connected, so nothing is stored." : null,
    };
    if (!w)
        return base;
    const google = unwrapSource(ctx.source);
    const tables = await Promise.all(WAREHOUSE_TABLES.map(async (t) => {
        const googleFrom = (await google.coverage(ctx.accountId, t.id))?.start ?? null;
        const s = w.repo.tableStats(ctx.accountId, t.id, t.sql, googleFrom);
        return { table: t.id, label: t.label, sqlTable: t.sql, rows: s.rows, firstDay: s.firstDay, lastDay: s.lastDay, periods: s.periods, settledPeriods: s.settledPeriods, lastFetchedAt: s.lastFetchedAt, googleFrom, beyondGoogle: s.beyond };
    }));
    const runs = w.repo.runs(8);
    return {
        ...base,
        accountsStored: w.repo.accountCount(),
        tables,
        ...w.repo.counts(ctx.accountId),
        months: w.repo.months(ctx.accountId, 13),
        runs,
        running: runs.find((r) => r.status === "running") ?? null,
    };
}
