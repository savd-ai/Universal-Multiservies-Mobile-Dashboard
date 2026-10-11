import { describe, expect, it } from "vitest";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { executeQuery, planQuery } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import type { EntityDims } from "@/lib/domain/schema/facts";
const 官壍 = new MetricRegistry([]);
const 窇壍 = { campaigns: new Map(), adGroups: new Map(), keywords: new Map() } as unknown as EntityDims;
const 饶壍 = { dims: 窇壍, registry: 官壍, currency: "USD", timezone: "America/New_York", sources: [] };
const 晥壍 = (蕔壍: string, 剃壍: number, 焲壍: number) => ({ search_term: 蕔壍, campaign_id: "c1", ad_group_id: "ag1", st_status: "none", st_match_type: "Exact", cost: 剃壍, clicks: 焲壍, impressions: 焲壍 * 20, conversions: 0, conv_value: 0 });
describe("range-grain comparisons", () => {
    const 逡壍 = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "clicks"], dimensions: ["search_term"], dateRange: { preset: "last_7d" }, compare: "previous_period" });
    const 崐壍 = planQuery(逡壍, { today: "2026-09-29", registry: 官壍 });
    it("uses compareRows for the previous period", () => {
        const 篿壍 = executeQuery(崐壍, { rows: [晥壍("trail shoes", 120, 60)], compareRows: [晥壍("trail shoes", 80, 40)], grain: "range" }, 饶壍);
        expect(篿壍.rows[0]?.cost).toBe(120);
        expect(篿壍.rows[0]?.cost__prev).toBe(80);
        expect(篿壍.compareTotals?.cost).toBe(80);
    });
    it("shows no previous value rather than a wrong one when compare rows are missing", () => {
        const 髮壍 = executeQuery(崐壍, { rows: [晥壍("trail shoes", 120, 60)], grain: "range" }, 饶壍);
        expect(髮壍.rows[0]?.cost).toBe(120);
        expect(髮壍.rows[0]?.cost__prev ?? null).toBeNull();
    });
});
