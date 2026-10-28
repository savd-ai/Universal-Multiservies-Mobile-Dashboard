import { describe, expect, it } from "vitest";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { executeQuery, planQuery } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { EntityDims } from "@/lib/domain/schema/facts";
const registry = new MetricRegistry([]);
const dims = { campaigns: new Map(), adGroups: new Map(), keywords: new Map() } as unknown as EntityDims;
const ctx = { dims, registry, currency: "USD", timezone: "America/New_York", sources: [] };
const row = (term: string, cost: number, clicks: number) => ({ search_term: term, campaign_id: "c1", ad_group_id: "ag1", st_status: "none", st_match_type: "Exact", cost, clicks, impressions: clicks * 20, conversions: 0, conv_value: 0 });
describe("range-grain comparisons", () => {
    const spec = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "clicks"], dimensions: ["search_term"], dateRange: { preset: "last_7d" }, compare: "previous_period" });
    const plan = planQuery(spec, { today: "2026-09-29", registry });
    it("uses compareRows for the previous period", () => {
        const r = executeQuery(plan, { rows: [row("trail shoes", 120, 60)], compareRows: [row("trail shoes", 80, 40)], grain: "range" }, ctx);
        expect(r.rows[0]?.cost).toBe(120);
        expect(r.rows[0]?.cost__prev).toBe(80);
        expect(r.compareTotals?.cost).toBe(80);
    });
    it("shows no previous value rather than a wrong one when compare rows are missing", () => {
        const r = executeQuery(plan, { rows: [row("trail shoes", 120, 60)], grain: "range" }, ctx);
        expect(r.rows[0]?.cost).toBe(120);
        expect(r.rows[0]?.cost__prev ?? null).toBeNull();
    });
});
