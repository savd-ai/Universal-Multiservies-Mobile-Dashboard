import { describe, expect, it } from "vitest";
import { EXPLORE_VIZ_TYPES, type ExploreVizType } from "@/features/explore/codec";
import { isAdditive, suggestViz, vizFit, VIZ_ORDER } from "@/features/explore/viz-suggest";
import { DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { makeCatalog } from "./fixtures";
const { catalog } = makeCatalog([{ key: "cm_profit", label: "Profit", formula: "conv_value - cost", format: "money", direction: "up_good" }]);
const suggest = (dimensions: string[], metrics: string[]) => suggestViz({ dimensions, metrics }, catalog);
describe("suggestViz", () => {
    it("totals: a number, a KPI strip or a funnel", () => {
        expect(suggest([], ["cost"]).type).toBe("number");
        expect(suggest([], ["cost", "roas"]).type).toBe("kpi-strip");
        expect(suggest([], ["impressions", "clicks", "conversions"]).type).toBe("funnel");
        expect(suggest([], ["conversions", "clicks", "impressions"]).type).toBe("kpi-strip");
    });
    it("time: trend multiples for 2–3 daily metrics, lines otherwise", () => {
        expect(suggest(["date"], ["cost", "conversions"]).type).toBe("trend-multiples");
        expect(suggest(["date"], ["cpa"]).type).toBe("line");
        expect(suggest(["week"], ["cost", "conversions"]).type).toBe("line");
        expect(suggest(["hour"], ["cost"])).toEqual({ type: "bar", horizontal: false });
        expect(suggest(["dow"], ["conversions"])).toEqual({ type: "bar", horizontal: false });
    });
    it("categories: donuts for shares of a few values, bars otherwise, tables for wide questions", () => {
        expect(suggest(["device"], ["cost"]).type).toBe("donut");
        expect(suggest(["device"], ["cpa"]).type).toBe("bar");
        expect(suggest(["device"], ["cm_profit"]).type).toBe("bar");
        expect(suggest(["campaign"], ["cost"]).type).toBe("bar");
        expect(suggest(["campaign_type"], ["cost", "roas"]).type).toBe("bar");
        expect(suggest(["campaign"], ["cost", "clicks", "cpa"]).type).toBe("table");
    });
    it("two breakdowns: heatmap, stacked bars or multi-series lines", () => {
        expect(suggest(["dow", "hour"], ["conversions"]).type).toBe("heatmap");
        expect(suggest(["date", "platform"], ["cost"]).type).toBe("stacked-bar");
        expect(suggest(["date", "device"], ["cpa"]).type).toBe("line");
        expect(suggest(["campaign_type", "device"], ["cost"]).type).toBe("stacked-bar");
        expect(suggest(["campaign", "device"], ["cost"]).type).toBe("table");
        expect(suggest(["date", "device", "campaign_type"], ["cost"]).type).toBe("table");
    });
    it("every suggestion fits its own question", () => {
        const metricSets = [["cost"], ["cpa"], ["cost", "conversions"], ["impressions", "clicks", "conversions"], ["cost", "clicks", "cpa", "roas"]];
        const dimSets: string[][] = [[], ...DIMENSION_KEYS.map((d) => [d]), ["dow", "hour"], ["date", "device"], ["campaign_type", "device"], ["date", "platform"], ["date", "device", "country"]];
        for (const metrics of metricSets)
            for (const dims of dimSets) {
                const v = suggest(dims, metrics);
                expect(vizFit(v.type as ExploreVizType, { dimensions: dims, metrics }).ok, `${v.type} for ${metrics.join("+")} by ${dims.join("×")}`).toBe(true);
            }
    });
});
describe("vizFit", () => {
    it("explains why a chart doesn't fit", () => {
        expect(vizFit("line", { dimensions: ["campaign"], metrics: ["cost"] })).toEqual({ ok: false, hint: "Needs a date, week, month, quarter or year breakdown." });
        expect(vizFit("heatmap", { dimensions: ["hour"], metrics: ["cost"] }).ok).toBe(false);
        expect(vizFit("scatter", { dimensions: ["campaign"], metrics: ["cost"] }).ok).toBe(false);
        expect(vizFit("scatter", { dimensions: ["campaign"], metrics: ["cost", "cpa", "conversions"] }).ok).toBe(true);
        expect(vizFit("donut", { dimensions: ["date"], metrics: ["cost"] }).ok).toBe(false);
        expect(vizFit("bar", { dimensions: [], metrics: ["cost"] }).ok).toBe(false);
        expect(vizFit("number", { dimensions: ["device"], metrics: ["cost"] })).toMatchObject({ ok: true, hint: expect.stringMatching(/ignored/) });
    });
    it("covers every picker type", () => {
        expect([...VIZ_ORDER].sort()).toEqual([...EXPLORE_VIZ_TYPES].sort());
        for (const t of EXPLORE_VIZ_TYPES)
            expect(typeof vizFit(t, { dimensions: ["date"], metrics: ["cost", "clicks"] }).ok).toBe("boolean");
    });
    it("treats base measures as additive and ratios/custom formulas as not", () => {
        expect(isAdditive("cost", catalog)).toBe(true);
        expect(isAdditive("roas", catalog)).toBe(false);
        expect(isAdditive("cm_profit", catalog)).toBe(false);
        expect(isAdditive("clicks")).toBe(true);
    });
});
