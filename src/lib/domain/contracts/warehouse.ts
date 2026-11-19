import { z } from "zod";
import type { CivilDate, Mode } from "../types";

// Analytics warehouse: a SQLite database (one file per data mode) that keeps Google Ads facts, entity history,
// change events and Google's estimates for longer than Google does (37 months daily, 92 days hourly, 12 months of
// search terms, 30 days of change history). Shared between the API and the Data source › Warehouse tab.

/** The Google Ads tables the warehouse stores, in display order. */
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
  /** first and last stored day (search terms: first day of the first month, last day of the last month) */
  firstDay: CivilDate | null;
  lastDay: CivilDate | null;
  /** stored days (search terms: months) */
  periods: number;
  /** days whose numbers can no longer restate (fetched after the restatement window) */
  settledPeriods: number;
  lastFetchedAt: string | null;
  /** first day Google itself still serves for this table */
  googleFrom: CivilDate | null;
  /** stored days older than what Google still serves */
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
  /** Google Ads API requests the run asked for (free in demo mode) */
  requests: number;
  rowsWritten: number;
  /** the request budget ran out before every planned fetch was done; the next run continues */
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
  /** false when SQLite can't be opened (Node.js older than 22.13, unwritable folder); `reason` says why */
  available: boolean;
  reason: string | null;
  engine: "SQLite";
  sqliteVersion: string | null;
  mode: Mode;
  /** file path relative to the working directory, or ":memory:" */
  file: string | null;
  sizeBytes: number | null;
  schemaVersion: number;
  reads: boolean;
  scheduler: { enabled: boolean; running: boolean; intervalMinutes: number; lastTickAt: string | null };
  backfillDays: number;
  retentionDays: number;
  maxRequests: number;
  restatementDays: number;
  /** the active account the coverage below is about */
  account: { id: string; name: string; currency: string };
  accountsStored: number;
  tables: WarehouseTableCoverage[];
  dims: { campaigns: number; adGroups: number; keywords: number; campaignVersions: number };
  changeEvents: { count: number; firstDay: CivilDate | null; lastDay: CivilDate | null };
  estimates: { simulations: number; recommendations: number; lastCapturedAt: string | null };
  /** monthly totals of the active account from fact_campaign_daily (ratio-of-sums metrics are left to the UI) */
  months: WarehouseMonth[];
  runs: WarehouseRun[];
  /** a sync is running right now */
  running: WarehouseRun | null;
  /** demo mode: why the demo warehouse is rebuilt when the demo anchor moves */
  note: string | null;
}

export const warehouseSyncSchema = z.object({
  /** "account" = the active account, "all" = every account you can open */
  scope: z.enum(["account", "all"]).default("account"),
  /** override WAREHOUSE_BACKFILL_DAYS for this run */
  backfillDays: z.number().int().min(0).max(1200).optional(),
});
export type WarehouseSyncBody = z.infer<typeof warehouseSyncSchema>;

export interface WarehouseSyncResponse {
  started: boolean;
  run: WarehouseRun | null;
  /** why nothing started (another sync is running, the warehouse is off…) */
  reason?: string;
}
