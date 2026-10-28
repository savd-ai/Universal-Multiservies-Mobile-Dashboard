import { describe, expect, it } from "vitest";
import { covers, dimensionAvailability, fixSuggestions, metricAvailability, plannedTable, pruneForSource, shapeOf } from "@/features/explore/compat";
import { emptySpec, type ExploreSpec } from "@/features/explore/notebook-state";
import { planQuery, QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { DIMENSION_KEYS, type DimensionKey } from "@/lib/domain/schema/dimensions";
import { makeCatalog } from "./fixtures";
const { catalog, registry } = makeCatalog([{ key: "cm_profit", label: "Profit", formula: "conv_value - cost", format: "money", direction: "up_good" }]);
const spec = (over: Partial<ExploreSpec>): ExploreSpec => emptySpec({ metrics: ["cost"], ...over });
function engineRuns(s: ExploreSpec): boolean {
    try {
        planQuery(querySpecSchema.parse({ ...s, dateRange: { preset: "last_30d" } }), { today: "2026-09-29", registry });
        return true;
    }
    catch (e) {
        if (e instanceof QueryError && e.code === "QUERY_UNSUPPORTED")
            return false;
        throw e;
    }
}
describe("compat mirrors the query planner", () => {
    it("agrees with planQuery for every pair of breakdowns, several metrics and all sources", () => {
        const metricSets = [["cost"], ["cost", "roas"], ["search_is"], ["avg_qs"], ["mer"], ["cm_profit"], ["ctr", "lost_is_budget"]];
        let checked = 0;
        for (const source of ["google_ads", "blended"]) {
            for (const metrics of metricSets) {
                for (let i = 0; i < DIMENSION_KEYS.length; i++) {
                    for (let j = i; j < DIMENSION_KEYS.length; j++) {
                        const dims = [...new Set([DIMENSION_KEYS[i], DIMENSION_KEYS[j]])] as DimensionKey[];
                        const s = spec({ source, metrics, dimensions: dims });
                        expect(covers(catalog, shapeOf(s)), `${source} ${metrics.join("+")} by ${dims.join("×")}`).toBe(engineRuns(s));
                        checked++;
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(3000);
    });
    it("counts filter dimensions and having metrics like the planner does", () => {
        const withFilter = spec({ dimensions: ["hour"], filters: [{ dim: "device", op: "eq", value: "Mobile" }] });
        expect(covers(catalog, shapeOf(withFilter))).toBe(false);
        expect(engineRuns(withFilter)).toBe(false);
        const withHaving = spec({ dimensions: ["device"], having: [{ metric: "search_is", op: "gt", value: 0.5 }] });
        expect(covers(catalog, shapeOf(withHaving))).toBe(false);
        expect(engineRuns(withHaving)).toBe(false);
    });
    it("names the table the engine reads", () => {
        expect(plannedTable(catalog, spec({ dimensions: ["hour"] }))?.id).toBe("campaign_hourly");
        expect(plannedTable(catalog, spec({ metrics: ["avg_qs"], dimensions: ["campaign"] }))?.id).toBe("keyword_daily");
        expect(plannedTable(catalog, spec({ dimensions: ["campaign_type"] }))?.id).toBe("campaign_daily");
        expect(plannedTable(catalog, spec({ source: "blended", dimensions: ["platform"] }))?.id).toBe("platform_daily");
        expect(plannedTable(catalog, spec({ dimensions: ["hour", "device"] }))).toBeNull();
    });
});
describe("availability reasons", () => {
    it("greys out hour × device with the conflicting breakdown", () => {
        expect(dimensionAvailability(catalog, spec({ dimensions: ["hour"] }), "device")).toEqual({ ok: false, reason: "Can't be combined with Hour." });
        expect(dimensionAvailability(catalog, spec({ dimensions: ["device"] }), "hour")).toEqual({ ok: false, reason: "Can't be combined with Device." });
        expect(dimensionAvailability(catalog, spec({ dimensions: ["hour"] }), "device", { asFilter: true }).ok).toBe(false);
        expect(dimensionAvailability(catalog, spec({ dimensions: ["hour"] }), "dow").ok).toBe(true);
    });
    it("explains source limits", () => {
        expect(dimensionAvailability(catalog, spec({ source: "blended" }), "campaign").reason).toBe("Cross-channel data breaks down by date and platform only.");
        expect(dimensionAvailability(catalog, spec({}), "platform").reason).toBe("Platform needs the Blended (all platforms) source.");
        expect(metricAvailability(catalog, spec({}), "mer").reason).toBe("MER needs the Blended (all platforms) source.");
        expect(metricAvailability(catalog, spec({ source: "blended" }), "search_is").reason).toMatch(/isn't reported for cross-channel data/);
    });
    it("explains metric × breakdown limits using availableIn tables", () => {
        expect(metricAvailability(catalog, spec({ dimensions: ["device"] }), "search_is").reason).toBe("Search impr. share is only in Campaign · daily — not by Device.");
        expect(dimensionAvailability(catalog, spec({ metrics: ["search_is"] }), "device").reason).toBe("Search impr. share isn't available by Device.");
        expect(metricAvailability(catalog, spec({ metrics: ["avg_qs"], dimensions: ["campaign"] }), "search_is").reason).toBe("Can't be combined with Avg. Quality Score (different tables).");
        expect(metricAvailability(catalog, spec({ dimensions: ["keyword"] }), "cm_profit").ok).toBe(true);
        expect(metricAvailability(catalog, spec({}), "cm_missing").ok).toBe(false);
    });
    it("limits breakdowns to three", () => {
        expect(dimensionAvailability(catalog, spec({ dimensions: ["date", "device", "campaign_type"] }), "country").reason).toMatch(/Up to 3/);
    });
});
describe("fixes", () => {
    it("offers single-step fixes that make the question answerable", () => {
        const labels = fixSuggestions(catalog, spec({ dimensions: ["hour", "device"] })).map((f) => f.label);
        expect(labels).toEqual(["Remove Hour from Group by", "Remove Device from Group by"]);
        const platform = fixSuggestions(catalog, spec({ dimensions: ["platform"] }));
        expect(platform[0]?.label).toBe("Switch to Blended (all platforms)");
        for (const f of platform)
            expect(engineRuns(f.spec)).toBe(true);
        expect(fixSuggestions(catalog, spec({ dimensions: ["device"] }))).toEqual([]);
    });
    it("removes unknown (deleted) metrics", () => {
        const [fix] = fixSuggestions(catalog, spec({ metrics: ["cost", "cm_gone"] }));
        expect(fix?.label).toBe("Remove cm_gone");
        expect(fix?.spec.metrics).toEqual(["cost"]);
    });
    it("prunes what a new source can't serve", () => {
        const { spec: next, removed } = pruneForSource(catalog, spec({ metrics: ["cost", "search_is"], dimensions: ["date", "campaign"], filters: [{ dim: "device", op: "eq", value: "Mobile" }] }), "blended");
        expect(next).toMatchObject({ source: "blended", metrics: ["cost"], dimensions: ["date"], filters: [] });
        expect(removed).toEqual(["Campaign", "Device filter", "Search impr. share"]);
        expect(pruneForSource(catalog, spec({ metrics: ["mer"] }), "google_ads").spec.metrics).toEqual(["cost"]);
    });
});
