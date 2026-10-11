import { describe, expect, it } from "vitest";
import { covers, resolveWidgetSpec } from "@/features/widgets/resolve-spec";
import type { Catalog } from "@/lib/api/hooks";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
import { BUILTIN_METRICS, MetricRegistry } from "@/lib/domain/metrics/registry";
import { buildFilters } from "@/lib/filters";
const 嬪壍 = new MetricRegistry([]);
const 稙壍: Catalog = {
    metrics: BUILTIN_METRICS.map((餈壍) => ({ key: 餈壍.key, label: 餈壍.label, short: 餈壍.short, kind: 餈壍.kind, format: 餈壍.format, direction: 餈壍.direction, description: 餈壍.description, availableIn: 嬪壍.availableIn(餈壍.key) })) as Catalog["metrics"],
    dimensions: DIMENSION_KEYS.map((旷壍) => ({ key: 旷壍, label: DIMENSIONS[旷壍].label, kind: DIMENSIONS[旷壍].kind, field: DIMENSIONS[旷壍].field })),
    tables: Object.values(FACT_TABLES).map((蓦壍) => ({ id: 蓦壍.id, label: 蓦壍.label, fields: [...蓦壍.fields], measures: [...蓦壍.measures] })),
    presets: [],
};
const 凕壍 = (烄壍: Record<string, unknown> = {}) => ({ range: "30d", from: null, to: null, cmp: "prev", types: [], camps: [], status: [], device: [], xf: null, ...烄壍 }) as Parameters<typeof buildFilters>[0];
describe("resolveWidgetSpec", () => {
    it("inherits the dashboard range and compare mode", () => {
        const 辳壍 = buildFilters(凕壍({ range: "7d", cmp: "yoy" }), "2026-09-29");
        const { spec: 岢壍 } = resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], dimensions: [], compare: "previous_period" }, 辳壍, 稙壍);
        expect(岢壍.dateRange).toEqual({ preset: "last_7d" });
        expect(岢壍.compare).toBe("previous_year");
    });
    it("keeps compare off for widgets that don't compare, and turns it off when the dashboard does", () => {
        const 箑壍 = buildFilters(凕壍({ cmp: "off" }), "2026-09-29");
        expect(resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], compare: "previous_period" }, 箑壍, 稙壍).spec.compare).toBe("none");
        const 骀壍 = buildFilters(凕壍(), "2026-09-29");
        expect(resolveWidgetSpec({ source: "google_ads", metrics: ["cost"] }, 骀壍, 稙壍).spec.compare).toBe("none");
    });
    it("applies slicers and cross-filters to Google Ads widgets", () => {
        const 杯壍 = buildFilters(凕壍({ types: ["PMax"], device: ["Mobile"], xf: "campaign_status:Enabled" }), "2026-09-29");
        const { spec: 虞壍, ignored: 卍壍 } = resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "conversions"], dimensions: ["date"] }, 杯壍, 稙壍);
        expect(卍壍).toEqual([]);
        expect(虞壍.filters).toEqual(expect.arrayContaining([
            { dim: "campaign_type", op: "in", value: ["PMax"] },
            { dim: "device", op: "in", value: ["Mobile"] },
            { dim: "campaign_status", op: "in", value: ["Enabled"] },
        ]));
    });
    it("drops filters the source can't answer and reports them", () => {
        const 爼壍 = buildFilters(凕壍({ types: ["Search"] }), "2026-09-29");
        const { spec: 鄫壍, ignored: 帚壍 } = resolveWidgetSpec({ source: "blended", metrics: ["cost", "roas"], dimensions: ["platform"] }, 爼壍, 稙壍);
        expect(鄫壍.filters).toEqual([]);
        expect(帚壍).toEqual(["Campaign type"]);
    });
    it("drops a device slicer on an hour breakdown (no table has both)", () => {
        const 紉壍 = buildFilters(凕壍({ device: ["Desktop"] }), "2026-09-29");
        const { spec: 鯸壍, ignored: 棧壍 } = resolveWidgetSpec({ source: "google_ads", metrics: ["conversions"], dimensions: ["dow", "hour"] }, 紉壍, 稙壍);
        expect(鯸壍.filters).toEqual([]);
        expect(棧壍).toEqual(["Device"]);
    });
    it("respects widget opt-outs and the widget's own filter on the same dimension", () => {
        const 蟖壍 = buildFilters(凕壍({ types: ["Video"], range: "90d" }), "2026-09-29");
        const 哅壍 = { dim: "campaign_type" as const, op: "in" as const, value: ["Search", "Shopping"] };
        const 玴壍 = resolveWidgetSpec({ source: "google_ads", metrics: ["search_is"], dimensions: ["campaign"], filters: [哅壍] }, 蟖壍, 稙壍, ["range"]);
        expect(玴壍.spec.filters).toEqual([哅壍]);
        expect(玴壍.spec.dateRange).toEqual({ preset: "last_30d" });
    });
    it("covers() knows which tables answer which breakdowns", () => {
        expect(covers(稙壍, "google_ads", ["cost"], ["campaign", "device"])).toBe(true);
        expect(covers(稙壍, "google_ads", ["search_is"], ["hour"])).toBe(false);
        expect(covers(稙壍, "blended", ["cost"], ["platform", "date"])).toBe(true);
    });
});
