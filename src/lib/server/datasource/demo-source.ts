import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import { buildDemoEstimates } from "@/lib/domain/demo-data/estimates";
import { generateDemoDataset, type DemoDataset } from "@/lib/domain/demo-data/generator";
import { DEMO_ACCOUNTS, DEMO_MANAGER } from "@/lib/domain/demo-data/scenario";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, BlankReason, CivilDate, LiveProblem } from "@/lib/domain/types";
import { singleton } from "../cache";
import { accountYesterday } from "../clock";
import { AppError } from "../http/errors";
import type { GoogleAdsSource, GoogleTableId } from "./types";

/**
 * Demo data for every page when Google Ads isn't connected (asked for 2026-10-12). Two generated sample accounts
 * (Acme Running Co., Trail Gear Outlet) from the deterministic generator in `domain/demo-data`, anchored on
 * yesterday so "last 30 days" always has data. Mode stays "blank" with reason `demo`: the banner says it is demo
 * data, alerts never send for it, and the warehouse never stores it.
 */
export const DEMO_TIMEZONE = "America/New_York";
export const DEMO_CURRENCY = "USD";
export const DEMO_SEED = "savd-dashboard-demo-v1";

const cache = () => singleton("demo-source:datasets", () => new Map<string, DemoDataset>());

export function demoDataset(accountId: string, anchor: CivilDate): DemoDataset {
  const spec = DEMO_ACCOUNTS.find((account) => account.id === accountId);
  if (!spec) throw new AppError("NOT_FOUND", `Demo account ${accountId || "(none)"} not found`);
  const key = `${accountId}|${anchor}`;
  const datasets = cache();
  let dataset = datasets.get(key);
  if (!dataset) {
    for (const old of datasets.keys()) if (old.startsWith(`${accountId}|`)) datasets.delete(old); // yesterday's anchor
    dataset = generateDemoDataset({ ...spec, currency: DEMO_CURRENCY }, { profile: "realistic", seed: DEMO_SEED, anchor, scenarios: "extended", timezone: DEMO_TIMEZONE });
    dataset = { ...dataset, account: { ...dataset.account, mode: "blank" } };
    datasets.set(key, dataset);
  }
  return dataset;
}

export class DemoGoogleAdsSource implements GoogleAdsSource {
  readonly mode = "blank" as const;
  readonly apiVersion = "demo";
  readonly reason: BlankReason;

  constructor(cause: LiveProblem) {
    this.reason = { code: "demo", cause };
  }

  private anchor(): CivilDate {
    return accountYesterday(DEMO_TIMEZONE);
  }

  private data(accountId: string): DemoDataset {
    return demoDataset(accountId, this.anchor());
  }

  async listAccounts(): Promise<AccountInfo[]> {
    return DEMO_ACCOUNTS.map((account) => ({ id: account.id, name: account.name, currency: DEMO_CURRENCY, timezone: DEMO_TIMEZONE, isManager: false, parentId: DEMO_MANAGER.id, mode: "blank" as const }));
  }

  async manager() {
    return DEMO_MANAGER;
  }

  defaultAccountId(): string {
    return DEMO_ACCOUNTS[0]?.id ?? "";
  }

  async account(accountId: string): Promise<AccountInfo> {
    return this.data(accountId).account;
  }

  async today(accountId: string): Promise<CivilDate> {
    return addDays(this.data(accountId).anchor, 1);
  }

  async dataThrough(accountId: string): Promise<CivilDate> {
    return this.data(accountId).anchor;
  }

  async getDims(accountId: string): Promise<EntityDims> {
    return this.data(accountId).dims;
  }

  async getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice> {
    const dataset = this.data(accountId);
    const coverage = dataset.coverage[table];
    const start = maxDate(range.start, coverage.start);
    const end = minDate(range.end, coverage.end);
    const rows = (dataset.tables[table] as unknown as { date: string | null }[]).filter((row) => row.date !== null && row.date >= start && row.date <= end) as unknown as Record<string, unknown>[];
    return { rows, grain: "daily", coverage };
  }

  async getChangeEvents(accountId: string, range: DateRange): Promise<ChangeEvent[]> {
    return this.data(accountId)
      .changeEvents.filter((event) => event.date >= range.start && event.date <= range.end)
      .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }

  async getGoogleEstimates(accountId: string): Promise<GoogleEstimates> {
    return buildDemoEstimates(this.data(accountId), { seed: DEMO_SEED });
  }

  async coverage(accountId: string, table: GoogleTableId): Promise<DateRange | null> {
    return this.data(accountId).coverage[table];
  }

  async invalidate(): Promise<void> {
    cache().clear();
  }
}
