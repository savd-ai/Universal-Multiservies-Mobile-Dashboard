import { describe, expect, it } from "vitest";
import { generateDemoDataset, googleDailyTotals, PROTOTYPE_END } from "../../support/synthetic/generator";
import { DEMO_ACCOUNTS } from "../../support/synthetic/scenario";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { executeQuery, planQuery, QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { FactTableId } from "@/lib/domain/schema/facts";
const acme = DEMO_ACCOUNTS[0]!;
const opts = { profile: "realistic" as const, seed: "savd-demo-v1", anchor: "2026-09-28", scenarios: "extended" as const, timezone: "America/New_York" };
describe("demo generator", () => {
    const ds = generateDemoDataset(acme, opts);
    it("is deterministic", () => {
        const again = generateDemoDataset(acme, opts);
        expect(again.tables.campaign_daily.slice(0, 20)).toEqual(ds.tables.campaign_daily.slice(0, 20));
    });
    it("keeps history stable when the anchor moves", () => {
        const later = generateDemoDataset(acme, { ...opts, anchor: "2026-10-05" });
        const pick = (rows: typeof ds.tables.campaign_daily, date: string) => rows.find((r) => r.campaign_id === "c2" && r.date === date);
        expect(pick(later.tables.campaign_daily, "2026-06-15")).toEqual(pick(ds.tables.campaign_daily, "2026-06-15"));
    });
    it("reconciles child tables to campaign totals", () => {
        const date = "2026-09-20";
        const camp = ds.tables.campaign_daily.find((r) => r.campaign_id === "c2" && r.date === date)!;
        for (const table of ["campaign_device_daily", "campaign_geo_daily", "campaign_hourly", "ad_group_daily"] as const) {
            const rows = (ds.tables[table] as {
                campaign_id: string;
                date: string;
                clicks: number;
                cost: number;
            }[]).filter((r) => r.campaign_id === "c2" && r.date === date);
            expect(rows.reduce((s, r) => s + r.clicks, 0)).toBe(camp.clicks);
            expect(Math.round(rows.reduce((s, r) => s + r.cost, 0) * 100)).toBe(Math.round(camp.cost * 100));
        }
    });
    it("plants the prototype anomalies", () => {
        const avg = (id: string, key: "cost" | "conversions", value: number, to: number) => {
            const rows = ds.tables.campaign_daily.filter((r) => r.campaign_id === id);
            const slice = rows.slice(rows.length - to, rows.length - value);
            return slice.reduce((s, r) => s + r[key], 0) / slice.length;
        };
        expect(avg("c6", "cost", 0, 3)).toBeGreaterThan(avg("c6", "cost", 10, 24) * 1.4);
        expect(avg("c7", "conversions", 0, 2)).toBe(0);
        expect(ds.changeEvents.some((e) => e.campaign_id === "c6" && e.changed_fields.includes("bidding_strategy_type"))).toBe(true);
    });
    it("plants a +40% budget raise on c2 (spend, dims and change log agree) and keeps c8's change log quiet", () => {
        const cost = (id: string, value: number, to: number) => {
            const r = ds.tables.campaign_daily.filter((x) => x.campaign_id === id).slice(-to, value ? -value : undefined);
            return r.reduce((s, x) => s + x.cost, 0) / r.length;
        };
        expect(cost("c2", 0, 3) / cost("c2", 10, 24)).toBeGreaterThan(1.25);
        expect(ds.dims.campaigns.get("c2")?.budget_daily).toBe(1092);
        const raise = ds.changeEvents.find((e) => e.id.endsWith("-ce-c2-budget"));
        expect(raise).toMatchObject({ date: "2026-09-26", resource_type: "CAMPAIGN_BUDGET", campaign_id: "c2", diffs: [{ field: "amount", before: 780, after: 1092 }], summary: "Budget changed from $780.00 to $1,092.00", client_type: "GOOGLE_ADS_WEB_CLIENT" });
        expect(ds.changeEvents.filter((e) => e.campaign_id === "c8" && e.date >= "2026-09-12")).toEqual([]);
        expect(ds.changeEvents.find((e) => e.id.endsWith("-ce-c6-bid"))?.diffs).toContainEqual({ field: "target_cpa.target_cpa", before: 28, after: null });
        const proto = generateDemoDataset(acme, { ...opts, profile: "prototype" });
        expect(proto.dims.campaigns.get("c2")?.budget_daily).toBe(780);
        expect(proto.changeEvents.some((e) => e.id.endsWith("-ce-c2-budget"))).toBe(false);
        const basic = generateDemoDataset(acme, { ...opts, scenarios: "basic" });
        expect(basic.dims.campaigns.get("c2")?.budget_daily).toBe(780);
        expect(generateDemoDataset(DEMO_ACCOUNTS[1]!, opts).changeEvents.some((e) => e.resource_type === "CAMPAIGN_BUDGET")).toBe(false);
    });
    it("reproduces the prototype window in prototype profile", () => {
        const proto = generateDemoDataset(acme, { ...opts, profile: "prototype" });
        expect(proto.anchor).toBe(PROTOTYPE_END);
        expect(proto.tables.campaign_daily.filter((r) => r.campaign_id === "c1")).toHaveLength(180);
        expect(googleDailyTotals(proto)).toHaveLength(180);
    });
});
describe("query engine", () => {
    const ds = generateDemoDataset(acme, opts);
    const registry = new MetricRegistry();
    const run = (input: unknown) => {
        const spec = querySpecSchema.parse(input);
        const plan = planQuery(spec, { today: "2026-09-29", registry });
        const rows = ds.tables[plan.table as Exclude<FactTableId, "platform_daily">] as unknown as Record<string, unknown>[];
        return executeQuery(plan, { rows, grain: "daily", coverage: ds.coverage.campaign_daily }, { dims: ds.dims, registry, currency: "USD", timezone: "America/New_York", sources: [] });
    };
    it("uses the smallest covering table", () => {
        expect(planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["campaign"] }), { today: "2026-09-29", registry }).table).toBe("campaign_daily");
        expect(planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["device"] }), { today: "2026-09-29", registry }).table).toBe("campaign_device_daily");
        expect(planQuery(querySpecSchema.parse({ metrics: ["avg_qs"], dimensions: ["keyword"] }), { today: "2026-09-29", registry }).table).toBe("keyword_daily");
    });
    it("computes ratio of sums, not average of ratios", () => {
        const res = run({ metrics: ["cost", "conversions", "cpa"], dimensions: ["campaign"], dateRange: { preset: "last_30d" } });
        const cost = res.rows.reduce((s, r) => s + (r.cost as number), 0);
        const conv = res.rows.reduce((s, r) => s + (r.conversions as number), 0);
        expect(res.totals?.cpa).toBeCloseTo(cost / conv, 6);
        expect(res.rows).toHaveLength(8);
        expect(res.rows[0]!.cost as number).toBeGreaterThanOrEqual(res.rows[1]!.cost as number);
    });
    it("filters, sorts, limits and compares", () => {
        const res = run({
            metrics: ["roas", "cost"],
            dimensions: ["campaign"],
            filters: [{ dim: "campaign_type", op: "eq", value: "Search" }],
            sort: [{ key: "roas", dir: "desc" }],
            limit: 2,
            compare: "previous_period",
            dateRange: { preset: "last_7d" },
        });
        expect(res.rows).toHaveLength(2);
        expect(res.meta.truncated).toBe(true);
        expect(res.rows[0]!.campaign).toBe("Brand — Core Terms");
        expect(typeof res.rows[0]!.roas__pct).toBe("number");
    });
    it("aligns daily compare rows by offset and fills gaps", () => {
        const res = run({ metrics: ["cost"], dimensions: ["date"], dateRange: { preset: "last_7d" }, compare: "previous_period", fillGaps: true });
        expect(res.rows).toHaveLength(7);
        expect(res.rows.every((r) => typeof r.cost__prev === "number")).toBe(true);
    });
    it("explains unsupported combinations", () => {
        expect(() => planQuery(querySpecSchema.parse({ metrics: ["cost"], dimensions: ["hour", "device"] }), { today: "2026-09-29", registry })).toThrow(QueryError);
    });
});
