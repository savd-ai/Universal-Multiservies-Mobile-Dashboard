import { describe, expect, it } from "vitest";
import { covers, resolveWidgetSpec } from "@/features/widgets/resolve-spec";
import type { Catalog } from "@/lib/api/hooks";
import { DIMENSIONS, DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { FACT_TABLES } from "@/lib/domain/schema/facts";
import { BUILTIN_METRICS, MetricRegistry } from "@/lib/domain/metrics/registry";
import { buildFilters } from "@/lib/filters";
const registry = new MetricRegistry([]);
const catalog: Catalog = {
    metrics: BUILTIN_METRICS.map((m) => ({ key: m.key, label: m.label, short: m.short, kind: m.kind, format: m.format, direction: m.direction, description: m.description, availableIn: registry.availableIn(m.key) })) as Catalog["metrics"],
    dimensions: DIMENSION_KEYS.map((k) => ({ key: k, label: DIMENSIONS[k].label, kind: DIMENSIONS[k].kind, field: DIMENSIONS[k].field })),
    tables: Object.values(FACT_TABLES).map((t) => ({ id: t.id, label: t.label, fields: [...t.fields], measures: [...t.measures] })),
    presets: [],
};
const state = (over: Record<string, unknown> = {}) => ({ range: "30d", from: null, to: null, cmp: "prev", types: [], camps: [], status: [], device: [], xf: null, ...over }) as Parameters<typeof buildFilters>[0];
describe("resolveWidgetSpec", () => {
    it("inherits the dashboard range and compare mode", () => {
        const f = buildFilters(state({ range: "7d", cmp: "yoy" }), "2026-09-29");
        const { spec } = resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], dimensions: [], compare: "previous_period" }, f, catalog);
        expect(spec.dateRange).toEqual({ preset: "last_7d" });
        expect(spec.compare).toBe("previous_year");
    });
    it("keeps compare off for widgets that don't compare, and turns it off when the dashboard does", () => {
        const f = buildFilters(state({ cmp: "off" }), "2026-09-29");
        expect(resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], compare: "previous_period" }, f, catalog).spec.compare).toBe("none");
        const on = buildFilters(state(), "2026-09-29");
        expect(resolveWidgetSpec({ source: "google_ads", metrics: ["cost"] }, on, catalog).spec.compare).toBe("none");
    });
    it("applies slicers and cross-filters to Google Ads widgets", () => {
        const f = buildFilters(state({ types: ["PMax"], device: ["Mobile"], xf: "campaign_status:Enabled" }), "2026-09-29");
        const { spec, ignored } = resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "conversions"], dimensions: ["date"] }, f, catalog);
        expect(ignored).toEqual([]);
        expect(spec.filters).toEqual(expect.arrayContaining([
            { dim: "campaign_type", op: "in", value: ["PMax"] },
            { dim: "device", op: "in", value: ["Mobile"] },
            { dim: "campaign_status", op: "in", value: ["Enabled"] },
        ]));
    });
    it("drops filters the source can't answer and reports them", () => {
        const f = buildFilters(state({ types: ["Search"] }), "2026-09-29");
        const { spec, ignored } = resolveWidgetSpec({ source: "blended", metrics: ["cost", "roas"], dimensions: ["platform"] }, f, catalog);
        expect(spec.filters).toEqual([]);
        expect(ignored).toEqual(["Campaign type"]);
    });
    it("drops a device slicer on an hour breakdown (no table has both)", () => {
        const f = buildFilters(state({ device: ["Desktop"] }), "2026-09-29");
        const { spec, ignored } = resolveWidgetSpec({ source: "google_ads", metrics: ["conversions"], dimensions: ["dow", "hour"] }, f, catalog);
        expect(spec.filters).toEqual([]);
        expect(ignored).toEqual(["Device"]);
    });
    it("respects widget opt-outs and the widget's own filter on the same dimension", () => {
        const f = buildFilters(state({ types: ["Video"], range: "90d" }), "2026-09-29");
        const own = { dim: "campaign_type" as const, op: "in" as const, value: ["Search", "Shopping"] };
        const r = resolveWidgetSpec({ source: "google_ads", metrics: ["search_is"], dimensions: ["campaign"], filters: [own] }, f, catalog, ["range"]);
        expect(r.spec.filters).toEqual([own]);
        expect(r.spec.dateRange).toEqual({ preset: "last_30d" });
    });
    it("covers() knows which tables answer which breakdowns", () => {
        expect(covers(catalog, "google_ads", ["cost"], ["campaign", "device"])).toBe(true);
        expect(covers(catalog, "google_ads", ["search_is"], ["hour"])).toBe(false);
        expect(covers(catalog, "blended", ["cost"], ["platform", "date"])).toBe(true);
    });
});
