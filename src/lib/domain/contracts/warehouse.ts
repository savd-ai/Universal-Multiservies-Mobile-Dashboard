import { z } from "zod";
import type { CivilDate, Mode } from "../types";
export const WAREHOUSE_TABLES = [
    { id: "campaign_daily", label: "Campaign · daily", sql: "fact_campaign_daily" },
    { id: "campaign_device_daily", label: "Campaign × device · daily", sql: "fact_campaign_device_daily" },
    { id: "campaign_geo_daily", label: "Campaign × country · daily", sql: "fact_campaign_geo_daily" },
    { id: "campaign_hourly", label: "Campaign × hour", sql: "fact_campaign_hourly" },
    { id: "ad_group_daily", label: "Ad group · daily", sql: "fact_ad_group_daily" },
    { id: "keyword_daily", label: "Keyword · daily", sql: "fact_keyword_daily" },
    { id: "search_term_daily", label: "Search term · monthly", sql: "fact_search_term_monthly" },
] as const;
export type WarehouseTableId = (typeof WAREHOUSE_TABLES)[number]["id"];
export const SYNC_TRIGGERS = ["manual", "schedule", "cron", "cli"] as const;
export type SyncTrigger = (typeof SYNC_TRIGGERS)[number];
export type SyncStatus = "running" | "ok" | "partial" | "failed";
export interface WarehouseTableCoverage {
    table: WarehouseTableId;
    label: string;
    sqlTable: string;
    rows: number;
    firstDay: CivilDate | null;
    lastDay: CivilDate | null;
    periods: number;
    settledPeriods: number;
    lastFetchedAt: string | null;
    googleFrom: CivilDate | null;
    beyondGoogle: number;
}
export interface WarehouseRun {
    id: string;
    mode: Mode;
    trigger: SyncTrigger;
    scope: "account" | "all";
    startedAt: string;
    finishedAt: string | null;
    status: SyncStatus;
    accounts: number;
    requests: number;
    rowsWritten: number;
    budgetExhausted: boolean;
    error: string | null;
}
export interface WarehouseMonth {
    month: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    convValue: number;
}
export interface WarehouseStatus {
    enabled: boolean;
    available: boolean;
    reason: string | null;
    engine: "SQLite";
    sqliteVersion: string | null;
    mode: Mode;
    file: string | null;
    sizeBytes: number | null;
    schemaVersion: number;
    reads: boolean;
    scheduler: {
        enabled: boolean;
        running: boolean;
        intervalMinutes: number;
        lastTickAt: string | null;
    };
    backfillDays: number;
    retentionDays: number;
    maxRequests: number;
    restatementDays: number;
    account: {
        id: string;
        name: string;
        currency: string;
    };
    accountsStored: number;
    tables: WarehouseTableCoverage[];
    dims: {
        campaigns: number;
        adGroups: number;
        keywords: number;
        campaignVersions: number;
    };
    changeEvents: {
        count: number;
        firstDay: CivilDate | null;
        lastDay: CivilDate | null;
    };
    estimates: {
        simulations: number;
        recommendations: number;
        lastCapturedAt: string | null;
    };
    months: WarehouseMonth[];
    runs: WarehouseRun[];
    running: WarehouseRun | null;
    note: string | null;
}
export const warehouseSyncSchema = z.object({
    scope: z.enum(["account", "all"]).default("account"),
    backfillDays: z.number().int().min(0).max(1200).optional(),
});
export type WarehouseSyncBody = z.infer<typeof warehouseSyncSchema>;
export interface WarehouseSyncResponse {
    started: boolean;
    run: WarehouseRun | null;
    reason?: string;
}
