import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { DemoDataset } from "@/lib/domain/demo/generator";
import { buildDemoEstimates } from "@/lib/domain/demo/estimates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate } from "@/lib/domain/types";
import type { GoogleAdsSource, GoogleTableId } from "@/lib/server/datasource/types";
import type { Warehouse } from "@/lib/server/warehouse";
import { WarehouseRepo } from "@/lib/server/warehouse/repo";
import { migrate } from "@/lib/server/warehouse/schema";
import { openDatabase } from "@/lib/server/warehouse/sqlite";

// Warehouse test fixtures: an in-memory warehouse and a "live" source backed by the golden demo dataset whose
// Google-side windows can shrink (time passing) and which counts every request it answers.

export function memoryWarehouse(mode: "live" | "demo" = "live"): Warehouse {
  const db = openDatabase(":memory:");
  migrate(db, "2026-09-29T00:00:00.000Z");
  return { mode, repo: new WarehouseRepo(db), location: ":memory:", sqliteVersion: null, knownAccounts: new Set() };
}

/** Rows compared as multisets (the warehouse returns them by date; sources may order them differently). */
export function sorted(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const keyed = rows.map((r) => ({ row: { ...r }, key: JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]])) }));
  return keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((k) => k.row);
}

const DATASET_DAYS: Record<GoogleTableId, number> = {
  campaign_daily: 400,
  campaign_device_daily: 400,
  campaign_geo_daily: 180,
  ad_group_daily: 180,
  keyword_daily: 180,
  campaign_hourly: 120,
  search_term_daily: 90,
};

export class FakeLiveSource implements GoogleAdsSource {
  readonly mode = "live" as const;
  readonly reason = null;
  readonly apiVersion = "v25";
  /** every getTable call (one "request" each) */
  calls: { table: GoogleTableId; range: DateRange }[] = [];
  dimsCalls = 0;
  changeCalls = 0;
  estimateCalls = 0;
  /** how many days Google still serves per table (defaults: the dataset's own history) */
  googleDays: Partial<Record<GoogleTableId, number>> = {};
  dims: EntityDims;
  failTables = new Set<GoogleTableId>();

  constructor(
    readonly ds: DemoDataset,
    public todayValue: CivilDate,
  ) {
    this.dims = ds.dims;
  }

  async listAccounts(): Promise<AccountInfo[]> {
    return [{ ...this.ds.account, mode: "live" }];
  }
  async manager() {
    return null;
  }
  defaultAccountId(): string {
    return this.ds.account.id;
  }
  async account(): Promise<AccountInfo> {
    return { ...this.ds.account, mode: "live" };
  }
  async today(): Promise<CivilDate> {
    return this.todayValue;
  }
  async dataThrough(): Promise<CivilDate> {
    return addDays(this.todayValue, -1);
  }
  async getDims(): Promise<EntityDims> {
    this.dimsCalls++;
    return this.dims;
  }
  async coverage(_accountId: string, table: GoogleTableId): Promise<DateRange> {
    const days = this.googleDays[table] ?? DATASET_DAYS[table];
    // the dataset itself ends at its anchor and starts DATASET_DAYS before it
    const datasetStart = addDays(this.ds.anchor, -(DATASET_DAYS[table] - 1));
    return { start: maxDate(datasetStart, addDays(this.todayValue, -(days - 1))), end: this.todayValue };
  }
  async getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice> {
    this.calls.push({ table, range: { ...range } });
    if (this.failTables.has(table)) throw new Error(`${table} is unavailable`);
    const cov = await this.coverage(accountId, table);
    const start = maxDate(range.start, cov.start);
    const end = minDate(range.end, cov.end);
    const rows = (this.ds.tables[table] as unknown as Record<string, unknown>[]).filter((r) => typeof r.date === "string" && r.date >= start && r.date <= end);
    return { rows: rows.map((r) => ({ ...r })), grain: "daily", coverage: cov };
  }
  async getChangeEvents(_accountId: string, range: DateRange): Promise<ChangeEvent[]> {
    this.changeCalls++;
    const from = maxDate(range.start, addDays(this.todayValue, -29));
    return this.ds.changeEvents.filter((e) => e.date >= from && e.date <= range.end).map((e) => ({ ...e }));
  }
  async getGoogleEstimates(): Promise<GoogleEstimates> {
    this.estimateCalls++;
    return buildDemoEstimates(this.ds, { seed: "savd-demo-v1" });
  }
  async invalidate(): Promise<void> {}
}
