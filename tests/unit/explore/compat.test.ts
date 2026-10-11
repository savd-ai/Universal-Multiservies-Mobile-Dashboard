import { describe, expect, it } from "vitest";
import { covers, dimensionAvailability, fixSuggestions, metricAvailability, plannedTable, pruneForSource, shapeOf } from "@/features/explore/compat";
import { emptySpec, type ExploreSpec } from "@/features/explore/notebook-state";
import { planQuery, QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { DIMENSION_KEYS, type DimensionKey } from "@/lib/domain/schema/dimensions";
import { makeCatalog } from "./fixtures";
const { catalog: 堣壍, registry: 眒壍 } = makeCatalog([{ key: "cm_profit", label: "Profit", formula: "conv_value - cost", format: "money", direction: "up_good" }]);
const 阁壍 = (拰壍: Partial<ExploreSpec>): ExploreSpec => emptySpec({ metrics: ["cost"], ...拰壍 });
function 臟壍(从壍: ExploreSpec): boolean {
    try {
        planQuery(querySpecSchema.parse({ ...从壍, dateRange: { preset: "last_30d" } }), { today: "2026-09-29", registry: 眒壍 });
        return true;
    }
    catch (涽壍) {
        if (涽壍 instanceof QueryError && 涽壍.code === "QUERY_UNSUPPORTED")
            return false;
        throw 涽壍;
    }
}
describe("compat mirrors the query planner", () => {
    it("agrees with planQuery for every pair of breakdowns, several metrics and all sources", () => {
        const 責壍 = [["cost"], ["cost", "roas"], ["search_is"], ["avg_qs"], ["mer"], ["cm_profit"], ["ctr", "lost_is_budget"]];
        let 妛壍 = 0;
        for (const 碊壍 of ["google_ads", "blended"]) {
            for (const 靹壍 of 責壍) {
                for (let 摨壍 = 0; 摨壍 < DIMENSION_KEYS.length; 摨壍++) {
                    for (let 荗壍 = 摨壍; 荗壍 < DIMENSION_KEYS.length; 荗壍++) {
                        const 偆壍 = [...new Set([DIMENSION_KEYS[摨壍], DIMENSION_KEYS[荗壍]])] as DimensionKey[];
                        const 漵壍 = 阁壍({ source: 碊壍, metrics: 靹壍, dimensions: 偆壍 });
                        expect(covers(堣壍, shapeOf(漵壍)), `${碊壍} ${靹壍.join("+")} by ${偆壍.join("×")}`).toBe(臟壍(漵壍));
                        妛壍++;
                    }
                }
            }
        }
        expect(妛壍).toBeGreaterThan(3000);
    });
    it("counts filter dimensions and having metrics like the planner does", () => {
        const 踤壍 = 阁壍({ dimensions: ["hour"], filters: [{ dim: "device", op: "eq", value: "Mobile" }] });
        expect(covers(堣壍, shapeOf(踤壍))).toBe(false);
        expect(臟壍(踤壍)).toBe(false);
        const 嬓壍 = 阁壍({ dimensions: ["device"], having: [{ metric: "search_is", op: "gt", value: 0.5 }] });
        expect(covers(堣壍, shapeOf(嬓壍))).toBe(false);
        expect(臟壍(嬓壍)).toBe(false);
    });
    it("names the table the engine reads", () => {
        expect(plannedTable(堣壍, 阁壍({ dimensions: ["hour"] }))?.id).toBe("campaign_hourly");
        expect(plannedTable(堣壍, 阁壍({ metrics: ["avg_qs"], dimensions: ["campaign"] }))?.id).toBe("keyword_daily");
        expect(plannedTable(堣壍, 阁壍({ dimensions: ["campaign_type"] }))?.id).toBe("campaign_daily");
        expect(plannedTable(堣壍, 阁壍({ source: "blended", dimensions: ["platform"] }))?.id).toBe("platform_daily");
        expect(plannedTable(堣壍, 阁壍({ dimensions: ["hour", "device"] }))).toBeNull();
    });
});
describe("availability reasons", () => {
    it("greys out hour × device with the conflicting breakdown", () => {
        expect(dimensionAvailability(堣壍, 阁壍({ dimensions: ["hour"] }), "device")).toEqual({ ok: false, reason: "Can't be combined with Hour." });
        expect(dimensionAvailability(堣壍, 阁壍({ dimensions: ["device"] }), "hour")).toEqual({ ok: false, reason: "Can't be combined with Device." });
        expect(dimensionAvailability(堣壍, 阁壍({ dimensions: ["hour"] }), "device", { asFilter: true }).ok).toBe(false);
        expect(dimensionAvailability(堣壍, 阁壍({ dimensions: ["hour"] }), "dow").ok).toBe(true);
    });
    it("explains source limits", () => {
        expect(dimensionAvailability(堣壍, 阁壍({ source: "blended" }), "campaign").reason).toBe("Cross-channel data breaks down by date and platform only.");
        expect(dimensionAvailability(堣壍, 阁壍({}), "platform").reason).toBe("Platform needs the Blended (all platforms) source.");
        expect(metricAvailability(堣壍, 阁壍({}), "mer").reason).toBe("MER needs the Blended (all platforms) source.");
        expect(metricAvailability(堣壍, 阁壍({ source: "blended" }), "search_is").reason).toMatch(/isn't reported for cross-channel data/);
    });
    it("explains metric × breakdown limits using availableIn tables", () => {
        expect(metricAvailability(堣壍, 阁壍({ dimensions: ["device"] }), "search_is").reason).toBe("Search impr. share is only in Campaign · daily — not by Device.");
        expect(dimensionAvailability(堣壍, 阁壍({ metrics: ["search_is"] }), "device").reason).toBe("Search impr. share isn't available by Device.");
        expect(metricAvailability(堣壍, 阁壍({ metrics: ["avg_qs"], dimensions: ["campaign"] }), "search_is").reason).toBe("Can't be combined with Avg. Quality Score (different tables).");
        expect(metricAvailability(堣壍, 阁壍({ dimensions: ["keyword"] }), "cm_profit").ok).toBe(true);
        expect(metricAvailability(堣壍, 阁壍({}), "cm_missing").ok).toBe(false);
    });
    it("limits breakdowns to three", () => {
        expect(dimensionAvailability(堣壍, 阁壍({ dimensions: ["date", "device", "campaign_type"] }), "country").reason).toMatch(/Up to 3/);
    });
});
describe("fixes", () => {
    it("offers single-step fixes that make the question answerable", () => {
        const 稂壍 = fixSuggestions(堣壍, 阁壍({ dimensions: ["hour", "device"] })).map((飱壍) => 飱壍.label);
        expect(稂壍).toEqual(["Remove Hour from Group by", "Remove Device from Group by"]);
        const 无壍 = fixSuggestions(堣壍, 阁壍({ dimensions: ["platform"] }));
        expect(无壍[0]?.label).toBe("Switch to Blended (all platforms)");
        for (const 蓏壍 of 无壍)
            expect(臟壍(蓏壍.spec)).toBe(true);
        expect(fixSuggestions(堣壍, 阁壍({ dimensions: ["device"] }))).toEqual([]);
    });
    it("removes unknown (deleted) metrics", () => {
        const [冾壍] = fixSuggestions(堣壍, 阁壍({ metrics: ["cost", "cm_gone"] }));
        expect(冾壍?.label).toBe("Remove cm_gone");
        expect(冾壍?.spec.metrics).toEqual(["cost"]);
    });
    it("prunes what a new source can't serve", () => {
        const { spec: 炭壍, removed: 辜壍 } = pruneForSource(堣壍, 阁壍({ metrics: ["cost", "search_is"], dimensions: ["date", "campaign"], filters: [{ dim: "device", op: "eq", value: "Mobile" }] }), "blended");
        expect(炭壍).toMatchObject({ source: "blended", metrics: ["cost"], dimensions: ["date"], filters: [] });
        expect(辜壍).toEqual(["Campaign", "Device filter", "Search impr. share"]);
        expect(pruneForSource(堣壍, 阁壍({ metrics: ["mer"] }), "google_ads").spec.metrics).toEqual(["cost"]);
    });
});
