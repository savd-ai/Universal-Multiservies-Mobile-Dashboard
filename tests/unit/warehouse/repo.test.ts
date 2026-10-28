import { describe, expect, it } from "vitest";
import { buildDemoEstimates } from "../../support/synthetic/estimates";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { migrate, MIGRATIONS, SCHEMA_VERSION, schemaVersion } from "@/lib/server/warehouse/schema";
import { DAILY_TABLE_IDS } from "@/lib/server/warehouse/tables";
import { demoDataset } from "../analytics/helpers";
import { memoryWarehouse, sorted } from "./helpers";
const opts = (hotFrom = "2026-09-15") => ({ fetchedAt: "2026-09-29T10:00:00.000Z", hotFrom, runId: "run-1" });
describe("schema", () => {
    it("migrates once and records the version", () => {
        const w = memoryWarehouse();
        expect(schemaVersion(w.repo.db)).toBe(SCHEMA_VERSION);
        expect(migrate(w.repo.db, "2026-09-30T00:00:00.000Z")).toEqual([]);
        expect(MIGRATIONS.map((m) => m.version)).toEqual([...MIGRATIONS.keys()].map((i) => i + 1));
        const tables = (w.repo.db.prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY name").all() as {
            name: string;
        }[]).map((r) => r.name);
        expect(tables).toEqual(expect.arrayContaining(["dim_account", "dim_campaign", "dim_campaign_history", "fact_campaign_daily", "fact_keyword_daily", "fact_search_term_monthly", "change_event", "google_simulation", "google_recommendation", "sync_run", "sync_ledger", "v_account_monthly", "v_campaign_monthly"]));
    });
});
describe("facts", () => {
    const ds = demoDataset();
    const account = ds.account;
    it("stores and returns every daily table exactly (absent optional measures stay absent)", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(account, "2026-09-29T10:00:00.000Z");
        const range = { start: "2026-09-01", end: "2026-09-28" };
        for (const table of DAILY_TABLE_IDS) {
            const rows = (ds.tables[table] as unknown as Record<string, unknown>[]).filter((r) => typeof r.date === "string" && r.date >= range.start && r.date <= range.end);
            expect(rows.length).toBeGreaterThan(0);
            expect(w.repo.replaceDays(account.id, table, range, rows, opts())).toBe(rows.length);
            expect(sorted(w.repo.readDays(account.id, table, range.start, range.end))).toEqual(sorted(rows));
        }
        const withoutIs = (ds.tables.campaign_daily as unknown as Record<string, unknown>[]).find((r) => r.is_search_impr === undefined && r.date === "2026-09-10");
        if (withoutIs)
            expect(w.repo.readDays(account.id, "campaign_daily", "2026-09-10", "2026-09-10").find((r) => r.campaign_id === withoutIs.campaign_id)).not.toHaveProperty("is_search_impr");
    });
    it("records every day of a fetch in the ledger, settled only before the hot window, and replaces on refetch", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(account, "2026-09-29T10:00:00.000Z");
        const range = { start: "2026-09-10", end: "2026-09-20" };
        const rows = (ds.tables.campaign_daily as unknown as Record<string, unknown>[]).filter((r) => typeof r.date === "string" && r.date >= range.start && r.date <= range.end);
        w.repo.replaceDays(account.id, "campaign_daily", range, rows, opts("2026-09-15"));
        const ledger = w.repo.ledger(account.id, "campaign_daily", range.start, range.end);
        expect(ledger.size).toBe(11);
        expect(ledger.get("2026-09-14")?.settled).toBe(true);
        expect(ledger.get("2026-09-15")?.settled).toBe(false);
        expect(w.repo.storedSpan(account.id, "campaign_daily")).toEqual(range);
        w.repo.replaceDays(account.id, "campaign_daily", range, rows, opts("2026-09-30"));
        expect(w.repo.readDays(account.id, "campaign_daily", range.start, range.end)).toHaveLength(rows.length);
        expect(w.repo.ledger(account.id, "campaign_daily", range.start, range.end).get("2026-09-20")?.settled).toBe(true);
        w.repo.replaceDays(account.id, "campaign_daily", { start: "2026-09-21", end: "2026-09-21" }, [], opts());
        expect(w.repo.ledger(account.id, "campaign_daily", "2026-09-21", "2026-09-21").get("2026-09-21")).toMatchObject({ settled: false });
    });
    it("adds up a key that comes back twice in one fetch instead of losing it", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(account, "2026-09-29T10:00:00.000Z");
        const row = { date: "2026-09-10", account_id: account.id, campaign_id: "c1", country: "US", impressions: 10, clicks: 2, cost: 5.5, conversions: 1, conv_value: 20 };
        w.repo.replaceDays(account.id, "campaign_geo_daily", { start: "2026-09-10", end: "2026-09-10" }, [row, { ...row, clicks: 3, cost: 4.5 }], opts());
        expect(w.repo.readDays(account.id, "campaign_geo_daily", "2026-09-10", "2026-09-10")).toEqual([{ ...row, impressions: 20, clicks: 5, cost: 10, conversions: 2, conv_value: 40 }]);
    });
    it("keeps search terms per month, summing daily rows of the same term", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(account, "2026-09-29T10:00:00.000Z");
        const month = { start: "2026-08-01", end: "2026-08-31" };
        const daily = (ds.tables.search_term_daily as unknown as Record<string, unknown>[]).filter((r) => typeof r.date === "string" && r.date >= month.start && r.date <= month.end);
        const stored = w.repo.replaceMonth(account.id, month, daily, opts("2026-09-15"));
        const back = w.repo.readSearchTermMonths(account.id, "2026-08", "2026-08");
        expect(back).toHaveLength(stored);
        const total = (rows: readonly Record<string, unknown>[]) => Math.round(rows.reduce((s, r) => s + Number(r.cost), 0) * 100) / 100;
        expect(total(back)).toBe(total(daily));
        expect(w.repo.ledger(account.id, "search_term_daily", month.start, month.start).get(month.start)?.settled).toBe(true);
    });
    it("monthly views compute ratios of sums, with NULL on division by zero", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(account, "2026-09-29T10:00:00.000Z");
        const base = { account_id: account.id, conversions: 0, conv_value: 0 };
        w.repo.replaceDays(account.id, "campaign_daily", { start: "2026-08-30", end: "2026-09-01" }, [
            { ...base, date: "2026-08-30", campaign_id: "c1", impressions: 100, clicks: 10, cost: 20, conversions: 2, conv_value: 60 },
            { ...base, date: "2026-08-31", campaign_id: "c1", impressions: 300, clicks: 10, cost: 30 },
            { ...base, date: "2026-09-01", campaign_id: "c1", impressions: 0, clicks: 0, cost: 0 },
        ], opts());
        const months = w.repo.db.prepare("SELECT month, ctr, cpc, cpa, roas FROM v_account_monthly WHERE account_id = ? ORDER BY month").all(account.id) as Record<string, unknown>[];
        expect(months.map((m) => ({ ...m }))).toEqual([
            { month: "2026-08", ctr: 20 / 400, cpc: 50 / 20, cpa: 25, roas: 60 / 50 },
            { month: "2026-09", ctr: null, cpc: null, cpa: null, roas: null },
        ]);
        expect(w.repo.months(account.id)).toEqual([
            { month: "2026-08", impressions: 400, clicks: 20, cost: 50, conversions: 2, convValue: 60 },
            { month: "2026-09", impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 },
        ]);
    });
});
describe("dimensions", () => {
    const ds = demoDataset();
    it("keeps entities Google stops listing and versions campaign settings (type 2)", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(ds.account, "2026-09-29T10:00:00.000Z");
        w.repo.upsertDims(ds.account.id, ds.dims, "2026-09-20", "2026-09-20T10:00:00.000Z");
        const stored = w.repo.storedDims(ds.account.id);
        expect([...stored.campaigns.values()].map((c) => ({ ...c, simulated: undefined }))).toEqual([...ds.dims.campaigns.values()].map((c) => ({ ...c, simulated: undefined })));
        expect(stored.adGroups.size).toBe(ds.dims.adGroups.size);
        expect(stored.keywords.size).toBe(ds.dims.keywords.size);
        const c1 = ds.dims.campaigns.get("c1");
        if (!c1)
            throw new Error("c1 missing");
        const paused = { ...ds.dims, campaigns: new Map([["c1", { ...c1, status: "Paused" as const }]]) };
        expect(w.repo.upsertDims(ds.account.id, paused, "2026-09-25", "2026-09-25T10:00:00.000Z").versions).toBe(1);
        expect(w.repo.upsertDims(ds.account.id, paused, "2026-09-25", "2026-09-25T11:00:00.000Z").versions).toBe(0);
        const raised = { ...ds.dims, campaigns: new Map([["c1", { ...c1, status: "Paused" as const, budget_daily: 999 }]]) };
        w.repo.upsertDims(ds.account.id, raised, "2026-09-25", "2026-09-25T12:00:00.000Z");
        const history = w.repo.campaignHistory(ds.account.id, "c1").map((r) => ({ from: r.valid_from, to: r.valid_to, status: r.status, budget: r.budget_daily }));
        expect(history).toEqual([
            { from: "2026-09-20", to: "2026-09-24", status: "Enabled", budget: c1.budget_daily },
            { from: "2026-09-25", to: null, status: "Paused", budget: 999 },
        ]);
        expect(w.repo.storedDims(ds.account.id).campaigns.get("c2")?.name).toBe(ds.dims.campaigns.get("c2")?.name);
    });
});
describe("change events and estimates", () => {
    const ds = demoDataset();
    it("keeps change events with their diffs, newest first", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(ds.account, "2026-09-29T10:00:00.000Z");
        const events: ChangeEvent[] = ds.changeEvents;
        expect(w.repo.upsertChangeEvents(ds.account.id, events, "2026-09-29T10:00:00.000Z")).toBe(events.length);
        expect(w.repo.upsertChangeEvents(ds.account.id, events, "2026-09-30T10:00:00.000Z")).toBe(events.length);
        const back = w.repo.readChangeEvents(ds.account.id, "2000-01-01", "2100-01-01");
        expect(back).toHaveLength(events.length);
        expect(sorted(back as unknown as Record<string, unknown>[])).toEqual(sorted(events as unknown as Record<string, unknown>[]));
        expect(back.map((e) => e.ts)).toEqual([...back.map((e) => e.ts)].sort().reverse());
    });
    it("snapshots simulations by window and recommendations by day", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(ds.account, "2026-09-29T10:00:00.000Z");
        const est = buildDemoEstimates(ds, { seed: "savd-demo-v1" });
        expect(w.repo.upsertEstimates(ds.account.id, est, "2026-09-29", "2026-09-29T10:00:00.000Z")).toEqual({ simulations: est.simulations.length, recommendations: est.recommendations.length });
        w.repo.upsertEstimates(ds.account.id, est, "2026-09-29", "2026-09-29T11:00:00.000Z");
        w.repo.upsertEstimates(ds.account.id, est, "2026-09-30", "2026-09-30T10:00:00.000Z");
        const c = w.repo.counts(ds.account.id);
        expect(c.estimates.simulations).toBe(est.simulations.length);
        expect(c.estimates.recommendations).toBe(est.recommendations.length * 2);
        const points = w.repo.db.prepare("SELECT points FROM google_simulation WHERE account_id = ? AND campaign_id = ? AND type = 'BUDGET'").get(ds.account.id, "c1") as {
            points: string;
        };
        expect(JSON.parse(points.points)).toEqual(est.simulations.find((s) => s.campaignId === "c1" && s.type === "BUDGET")?.points);
    });
});
describe("maintenance", () => {
    const ds = demoDataset();
    it("prunes old facts but keeps dimensions and change history; purging an account cascades everywhere", () => {
        const w = memoryWarehouse();
        w.repo.upsertAccount(ds.account, "2026-09-29T10:00:00.000Z");
        const range = { start: "2026-09-01", end: "2026-09-28" };
        w.repo.replaceDays(ds.account.id, "campaign_daily", range, (ds.tables.campaign_daily as unknown as Record<string, unknown>[]).filter((r) => typeof r.date === "string" && r.date >= range.start && r.date <= range.end), opts());
        w.repo.upsertDims(ds.account.id, ds.dims, "2026-09-28", "2026-09-28T10:00:00.000Z");
        w.repo.upsertChangeEvents(ds.account.id, ds.changeEvents, "2026-09-28T10:00:00.000Z");
        expect(w.repo.prune("2026-09-15")).toBeGreaterThan(0);
        expect(w.repo.storedSpan(ds.account.id, "campaign_daily")?.start).toBe("2026-09-15");
        expect(w.repo.counts(ds.account.id).changeEvents.count).toBe(ds.changeEvents.length);
        expect(w.repo.purgeAccount(ds.account.id)).toBe(true);
        for (const t of ["fact_campaign_daily", "sync_ledger", "dim_campaign", "dim_campaign_history", "change_event"]) {
            expect((w.repo.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as {
                n: number;
            }).n).toBe(0);
        }
        expect(w.repo.accountCount()).toBe(0);
    });
    it("records sync runs and marks runs a stopped process left behind", () => {
        const w = memoryWarehouse();
        w.repo.startRun({ id: "r1", mode: "live", trigger: "manual", scope: "all", startedAt: "2026-09-29T10:00:00.000Z" });
        w.repo.startRun({ id: "r2", mode: "live", trigger: "cli", scope: "account", startedAt: "2026-09-29T11:00:00.000Z" });
        w.repo.finishRun("r2", { finishedAt: "2026-09-29T11:01:00.000Z", status: "ok", accounts: 1, requests: 12, rowsWritten: 300, budgetExhausted: false, error: null, details: {} });
        w.repo.abandonRuns("2026-09-29T12:00:00.000Z");
        expect(w.repo.runs().map((r) => [r.id, r.status, r.requests])).toEqual([
            ["r2", "ok", 12],
            ["r1", "failed", 0],
        ]);
    });
});
