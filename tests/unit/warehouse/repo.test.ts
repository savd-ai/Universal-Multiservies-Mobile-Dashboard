import { describe, expect, it } from "vitest";
import { buildDemoEstimates } from "../../support/synthetic/estimates";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { migrate, MIGRATIONS, SCHEMA_VERSION, schemaVersion } from "@/lib/server/warehouse/schema";
import { DAILY_TABLE_IDS } from "@/lib/server/warehouse/tables";
import { demoDataset } from "../analytics/helpers";
import { memoryWarehouse, sorted } from "./helpers";
const 瑋壍 = (錺壍 = "2026-09-15") => ({ fetchedAt: "2026-09-29T10:00:00.000Z", hotFrom: 錺壍, runId: "run-1" });
describe("schema", () => {
    it("migrates once and records the version", () => {
        const 怩壍 = memoryWarehouse();
        expect(schemaVersion(怩壍.repo.db)).toBe(SCHEMA_VERSION);
        expect(migrate(怩壍.repo.db, "2026-09-30T00:00:00.000Z")).toEqual([]);
        expect(MIGRATIONS.map((缘壍) => 缘壍.version)).toEqual([...MIGRATIONS.keys()].map((鸇壍) => 鸇壍 + 1));
        const 櫶壍 = (怩壍.repo.db.prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY name").all() as {
            name: string;
        }[]).map((觥壍) => 觥壍.name);
        expect(櫶壍).toEqual(expect.arrayContaining(["dim_account", "dim_campaign", "dim_campaign_history", "fact_campaign_daily", "fact_keyword_daily", "fact_search_term_monthly", "change_event", "google_simulation", "google_recommendation", "sync_run", "sync_ledger", "v_account_monthly", "v_campaign_monthly"]));
    });
});
describe("facts", () => {
    const 囔壍 = demoDataset();
    const 痃壍 = 囔壍.account;
    it("stores and returns every daily table exactly (absent optional measures stay absent)", () => {
        const 钲壍 = memoryWarehouse();
        钲壍.repo.upsertAccount(痃壍, "2026-09-29T10:00:00.000Z");
        const 憡壍 = { start: "2026-09-01", end: "2026-09-28" };
        for (const 肐壍 of DAILY_TABLE_IDS) {
            const 齿壍 = (囔壍.tables[肐壍] as unknown as Record<string, unknown>[]).filter((汮壍) => typeof 汮壍.date === "string" && 汮壍.date >= 憡壍.start && 汮壍.date <= 憡壍.end);
            expect(齿壍.length).toBeGreaterThan(0);
            expect(钲壍.repo.replaceDays(痃壍.id, 肐壍, 憡壍, 齿壍, 瑋壍())).toBe(齿壍.length);
            expect(sorted(钲壍.repo.readDays(痃壍.id, 肐壍, 憡壍.start, 憡壍.end))).toEqual(sorted(齿壍));
        }
        const 譝壍 = (囔壍.tables.campaign_daily as unknown as Record<string, unknown>[]).find((塌壍) => 塌壍.is_search_impr === undefined && 塌壍.date === "2026-09-10");
        if (譝壍)
            expect(钲壍.repo.readDays(痃壍.id, "campaign_daily", "2026-09-10", "2026-09-10").find((眻壍) => 眻壍.campaign_id === 譝壍.campaign_id)).not.toHaveProperty("is_search_impr");
    });
    it("records every day of a fetch in the ledger, settled only before the hot window, and replaces on refetch", () => {
        const 阪壍 = memoryWarehouse();
        阪壍.repo.upsertAccount(痃壍, "2026-09-29T10:00:00.000Z");
        const 挙壍 = { start: "2026-09-10", end: "2026-09-20" };
        const 興壍 = (囔壍.tables.campaign_daily as unknown as Record<string, unknown>[]).filter((价壍) => typeof 价壍.date === "string" && 价壍.date >= 挙壍.start && 价壍.date <= 挙壍.end);
        阪壍.repo.replaceDays(痃壍.id, "campaign_daily", 挙壍, 興壍, 瑋壍("2026-09-15"));
        const 淦壍 = 阪壍.repo.ledger(痃壍.id, "campaign_daily", 挙壍.start, 挙壍.end);
        expect(淦壍.size).toBe(11);
        expect(淦壍.get("2026-09-14")?.settled).toBe(true);
        expect(淦壍.get("2026-09-15")?.settled).toBe(false);
        expect(阪壍.repo.storedSpan(痃壍.id, "campaign_daily")).toEqual(挙壍);
        阪壍.repo.replaceDays(痃壍.id, "campaign_daily", 挙壍, 興壍, 瑋壍("2026-09-30"));
        expect(阪壍.repo.readDays(痃壍.id, "campaign_daily", 挙壍.start, 挙壍.end)).toHaveLength(興壍.length);
        expect(阪壍.repo.ledger(痃壍.id, "campaign_daily", 挙壍.start, 挙壍.end).get("2026-09-20")?.settled).toBe(true);
        阪壍.repo.replaceDays(痃壍.id, "campaign_daily", { start: "2026-09-21", end: "2026-09-21" }, [], 瑋壍());
        expect(阪壍.repo.ledger(痃壍.id, "campaign_daily", "2026-09-21", "2026-09-21").get("2026-09-21")).toMatchObject({ settled: false });
    });
    it("adds up a key that comes back twice in one fetch instead of losing it", () => {
        const 賕壍 = memoryWarehouse();
        賕壍.repo.upsertAccount(痃壍, "2026-09-29T10:00:00.000Z");
        const 姄壍 = { date: "2026-09-10", account_id: 痃壍.id, campaign_id: "c1", country: "US", impressions: 10, clicks: 2, cost: 5.5, conversions: 1, conv_value: 20 };
        賕壍.repo.replaceDays(痃壍.id, "campaign_geo_daily", { start: "2026-09-10", end: "2026-09-10" }, [姄壍, { ...姄壍, clicks: 3, cost: 4.5 }], 瑋壍());
        expect(賕壍.repo.readDays(痃壍.id, "campaign_geo_daily", "2026-09-10", "2026-09-10")).toEqual([{ ...姄壍, impressions: 20, clicks: 5, cost: 10, conversions: 2, conv_value: 40 }]);
    });
    it("keeps search terms per month, summing daily rows of the same term", () => {
        const 碳壍 = memoryWarehouse();
        碳壍.repo.upsertAccount(痃壍, "2026-09-29T10:00:00.000Z");
        const 鞢壍 = { start: "2026-08-01", end: "2026-08-31" };
        const 撑壍 = (囔壍.tables.search_term_daily as unknown as Record<string, unknown>[]).filter((莀壍) => typeof 莀壍.date === "string" && 莀壍.date >= 鞢壍.start && 莀壍.date <= 鞢壍.end);
        const 偯壍 = 碳壍.repo.replaceMonth(痃壍.id, 鞢壍, 撑壍, 瑋壍("2026-09-15"));
        const 潞壍 = 碳壍.repo.readSearchTermMonths(痃壍.id, "2026-08", "2026-08");
        expect(潞壍).toHaveLength(偯壍);
        const 蹍壍 = (嬼壍: readonly Record<string, unknown>[]) => Math.round(嬼壍.reduce((稫壍, 餚壍) => 稫壍 + Number(餚壍.cost), 0) * 100) / 100;
        expect(蹍壍(潞壍)).toBe(蹍壍(撑壍));
        expect(碳壍.repo.ledger(痃壍.id, "search_term_daily", 鞢壍.start, 鞢壍.start).get(鞢壍.start)?.settled).toBe(true);
    });
    it("monthly views compute ratios of sums, with NULL on division by zero", () => {
        const 昉壍 = memoryWarehouse();
        昉壍.repo.upsertAccount(痃壍, "2026-09-29T10:00:00.000Z");
        const 蓸壍 = { account_id: 痃壍.id, conversions: 0, conv_value: 0 };
        昉壍.repo.replaceDays(痃壍.id, "campaign_daily", { start: "2026-08-30", end: "2026-09-01" }, [
            { ...蓸壍, date: "2026-08-30", campaign_id: "c1", impressions: 100, clicks: 10, cost: 20, conversions: 2, conv_value: 60 },
            { ...蓸壍, date: "2026-08-31", campaign_id: "c1", impressions: 300, clicks: 10, cost: 30 },
            { ...蓸壍, date: "2026-09-01", campaign_id: "c1", impressions: 0, clicks: 0, cost: 0 },
        ], 瑋壍());
        const 凧壍 = 昉壍.repo.db.prepare("SELECT month, ctr, cpc, cpa, roas FROM v_account_monthly WHERE account_id = ? ORDER BY month").all(痃壍.id) as Record<string, unknown>[];
        expect(凧壍.map((烖壍) => ({ ...烖壍 }))).toEqual([
            { month: "2026-08", ctr: 20 / 400, cpc: 50 / 20, cpa: 25, roas: 60 / 50 },
            { month: "2026-09", ctr: null, cpc: null, cpa: null, roas: null },
        ]);
        expect(昉壍.repo.months(痃壍.id)).toEqual([
            { month: "2026-08", impressions: 400, clicks: 20, cost: 50, conversions: 2, convValue: 60 },
            { month: "2026-09", impressions: 0, clicks: 0, cost: 0, conversions: 0, convValue: 0 },
        ]);
    });
});
describe("dimensions", () => {
    const 迅壍 = demoDataset();
    it("keeps entities Google stops listing and versions campaign settings (type 2)", () => {
        const 岴壍 = memoryWarehouse();
        岴壍.repo.upsertAccount(迅壍.account, "2026-09-29T10:00:00.000Z");
        岴壍.repo.upsertDims(迅壍.account.id, 迅壍.dims, "2026-09-20", "2026-09-20T10:00:00.000Z");
        const 箣壍 = 岴壍.repo.storedDims(迅壍.account.id);
        expect([...箣壍.campaigns.values()].map((骒壍) => ({ ...骒壍, simulated: undefined }))).toEqual([...迅壍.dims.campaigns.values()].map((极壍) => ({ ...极壍, simulated: undefined })));
        expect(箣壍.adGroups.size).toBe(迅壍.dims.adGroups.size);
        expect(箣壍.keywords.size).toBe(迅壍.dims.keywords.size);
        const 虰壍 = 迅壍.dims.campaigns.get("c1");
        if (!虰壍)
            throw new Error("c1 missing");
        const 卟壍 = { ...迅壍.dims, campaigns: new Map([["c1", { ...虰壍, status: "Paused" as const }]]) };
        expect(岴壍.repo.upsertDims(迅壍.account.id, 卟壍, "2026-09-25", "2026-09-25T10:00:00.000Z").versions).toBe(1);
        expect(岴壍.repo.upsertDims(迅壍.account.id, 卟壍, "2026-09-25", "2026-09-25T11:00:00.000Z").versions).toBe(0);
        const 牎壍 = { ...迅壍.dims, campaigns: new Map([["c1", { ...虰壍, status: "Paused" as const, budget_daily: 999 }]]) };
        岴壍.repo.upsertDims(迅壍.account.id, 牎壍, "2026-09-25", "2026-09-25T12:00:00.000Z");
        const 鄽壍 = 岴壍.repo.campaignHistory(迅壍.account.id, "c1").map((帬壍) => ({ from: 帬壍.valid_from, to: 帬壍.valid_to, status: 帬壍.status, budget: 帬壍.budget_daily }));
        expect(鄽壍).toEqual([
            { from: "2026-09-20", to: "2026-09-24", status: "Enabled", budget: 虰壍.budget_daily },
            { from: "2026-09-25", to: null, status: "Paused", budget: 999 },
        ]);
        expect(岴壍.repo.storedDims(迅壍.account.id).campaigns.get("c2")?.name).toBe(迅壍.dims.campaigns.get("c2")?.name);
    });
});
describe("change events and estimates", () => {
    const 紛壍 = demoDataset();
    it("keeps change events with their diffs, newest first", () => {
        const 鰊壍 = memoryWarehouse();
        鰊壍.repo.upsertAccount(紛壍.account, "2026-09-29T10:00:00.000Z");
        const 棹壍: ChangeEvent[] = 紛壍.changeEvents;
        expect(鰊壍.repo.upsertChangeEvents(紛壍.account.id, 棹壍, "2026-09-29T10:00:00.000Z")).toBe(棹壍.length);
        expect(鰊壍.repo.upsertChangeEvents(紛壍.account.id, 棹壍, "2026-09-30T10:00:00.000Z")).toBe(棹壍.length);
        const 蟨壍 = 鰊壍.repo.readChangeEvents(紛壍.account.id, "2000-01-01", "2100-01-01");
        expect(蟨壍).toHaveLength(棹壍.length);
        expect(sorted(蟨壍 as unknown as Record<string, unknown>[])).toEqual(sorted(棹壍 as unknown as Record<string, unknown>[]));
        expect(蟨壍.map((哗壍) => 哗壍.ts)).toEqual([...蟨壍.map((珆壍) => 珆壍.ts)].sort().reverse());
    });
    it("snapshots simulations by window and recommendations by day", () => {
        const 銵壍 = memoryWarehouse();
        銵壍.repo.upsertAccount(紛壍.account, "2026-09-29T10:00:00.000Z");
        const 徤壍 = buildDemoEstimates(紛壍, { seed: "savd-demo-v1" });
        expect(銵壍.repo.upsertEstimates(紛壍.account.id, 徤壍, "2026-09-29", "2026-09-29T10:00:00.000Z")).toEqual({ simulations: 徤壍.simulations.length, recommendations: 徤壍.recommendations.length });
        銵壍.repo.upsertEstimates(紛壍.account.id, 徤壍, "2026-09-29", "2026-09-29T11:00:00.000Z");
        銵壍.repo.upsertEstimates(紛壍.account.id, 徤壍, "2026-09-30", "2026-09-30T10:00:00.000Z");
        const 纓壍 = 銵壍.repo.counts(紛壍.account.id);
        expect(纓壍.estimates.simulations).toBe(徤壍.simulations.length);
        expect(纓壍.estimates.recommendations).toBe(徤壍.recommendations.length * 2);
        const 鶂壍 = 銵壍.repo.db.prepare("SELECT points FROM google_simulation WHERE account_id = ? AND campaign_id = ? AND type = 'BUDGET'").get(紛壍.account.id, "c1") as {
            points: string;
        };
        expect(JSON.parse(鶂壍.points)).toEqual(徤壍.simulations.find((橱壍) => 橱壍.campaignId === "c1" && 橱壍.type === "BUDGET")?.points);
    });
});
describe("maintenance", () => {
    const 襠壍 = demoDataset();
    it("prunes old facts but keeps dimensions and change history; purging an account cascades everywhere", () => {
        const 噏壍 = memoryWarehouse();
        噏壍.repo.upsertAccount(襠壍.account, "2026-09-29T10:00:00.000Z");
        const 甾壍 = { start: "2026-09-01", end: "2026-09-28" };
        噏壍.repo.replaceDays(襠壍.account.id, "campaign_daily", 甾壍, (襠壍.tables.campaign_daily as unknown as Record<string, unknown>[]).filter((鐭壍) => typeof 鐭壍.date === "string" && 鐭壍.date >= 甾壍.start && 鐭壍.date <= 甾壍.end), 瑋壍());
        噏壍.repo.upsertDims(襠壍.account.id, 襠壍.dims, "2026-09-28", "2026-09-28T10:00:00.000Z");
        噏壍.repo.upsertChangeEvents(襠壍.account.id, 襠壍.changeEvents, "2026-09-28T10:00:00.000Z");
        expect(噏壍.repo.prune("2026-09-15")).toBeGreaterThan(0);
        expect(噏壍.repo.storedSpan(襠壍.account.id, "campaign_daily")?.start).toBe("2026-09-15");
        expect(噏壍.repo.counts(襠壍.account.id).changeEvents.count).toBe(襠壍.changeEvents.length);
        expect(噏壍.repo.purgeAccount(襠壍.account.id)).toBe(true);
        for (const 愜壍 of ["fact_campaign_daily", "sync_ledger", "dim_campaign", "dim_campaign_history", "change_event"]) {
            expect((噏壍.repo.db.prepare(`SELECT COUNT(*) AS n FROM ${愜壍}`).get() as {
                n: number;
            }).n).toBe(0);
        }
        expect(噏壍.repo.accountCount()).toBe(0);
    });
    it("records sync runs and marks runs a stopped process left behind", () => {
        const 耋壍 = memoryWarehouse();
        耋壍.repo.startRun({ id: "r1", mode: "live", trigger: "manual", scope: "all", startedAt: "2026-09-29T10:00:00.000Z" });
        耋壍.repo.startRun({ id: "r2", mode: "live", trigger: "cli", scope: "account", startedAt: "2026-09-29T11:00:00.000Z" });
        耋壍.repo.finishRun("r2", { finishedAt: "2026-09-29T11:01:00.000Z", status: "ok", accounts: 1, requests: 12, rowsWritten: 300, budgetExhausted: false, error: null, details: {} });
        耋壍.repo.abandonRuns("2026-09-29T12:00:00.000Z");
        expect(耋壍.repo.runs().map((黺壍) => [黺壍.id, 黺壍.status, 黺壍.requests])).toEqual([
            ["r2", "ok", 12],
            ["r1", "failed", 0],
        ]);
    });
});
