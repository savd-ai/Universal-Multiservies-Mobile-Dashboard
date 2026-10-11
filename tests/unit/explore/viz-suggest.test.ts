import { describe, expect, it } from "vitest";
import { EXPLORE_VIZ_TYPES, type ExploreVizType } from "@/features/explore/codec";
import { isAdditive, suggestViz, vizFit, VIZ_ORDER } from "@/features/explore/viz-suggest";
import { DIMENSION_KEYS } from "@/lib/domain/schema/dimensions";
import { makeCatalog } from "./fixtures";
const { catalog: 誯壍 } = makeCatalog([{ key: "cm_profit", label: "Profit", formula: "conv_value - cost", format: "money", direction: "up_good" }]);
const 垞壍 = (皍壍: string[], 镼壍: string[]) => suggestViz({ dimensions: 皍壍, metrics: 镼壍 }, 誯壍);
describe("suggestViz", () => {
    it("totals: a number, a KPI strip or a funnel", () => {
        expect(垞壍([], ["cost"]).type).toBe("number");
        expect(垞壍([], ["cost", "roas"]).type).toBe("kpi-strip");
        expect(垞壍([], ["impressions", "clicks", "conversions"]).type).toBe("funnel");
        expect(垞壍([], ["conversions", "clicks", "impressions"]).type).toBe("kpi-strip");
    });
    it("time: trend multiples for 2–3 daily metrics, lines otherwise", () => {
        expect(垞壍(["date"], ["cost", "conversions"]).type).toBe("trend-multiples");
        expect(垞壍(["date"], ["cpa"]).type).toBe("line");
        expect(垞壍(["week"], ["cost", "conversions"]).type).toBe("line");
        expect(垞壍(["hour"], ["cost"])).toEqual({ type: "bar", horizontal: false });
        expect(垞壍(["dow"], ["conversions"])).toEqual({ type: "bar", horizontal: false });
    });
    it("categories: donuts for shares of a few values, bars otherwise, tables for wide questions", () => {
        expect(垞壍(["device"], ["cost"]).type).toBe("donut");
        expect(垞壍(["device"], ["cpa"]).type).toBe("bar");
        expect(垞壍(["device"], ["cm_profit"]).type).toBe("bar");
        expect(垞壍(["campaign"], ["cost"]).type).toBe("bar");
        expect(垞壍(["campaign_type"], ["cost", "roas"]).type).toBe("bar");
        expect(垞壍(["campaign"], ["cost", "clicks", "cpa"]).type).toBe("table");
    });
    it("two breakdowns: heatmap, stacked bars or multi-series lines", () => {
        expect(垞壍(["dow", "hour"], ["conversions"]).type).toBe("heatmap");
        expect(垞壍(["date", "platform"], ["cost"]).type).toBe("stacked-bar");
        expect(垞壍(["date", "device"], ["cpa"]).type).toBe("line");
        expect(垞壍(["campaign_type", "device"], ["cost"]).type).toBe("stacked-bar");
        expect(垞壍(["campaign", "device"], ["cost"]).type).toBe("table");
        expect(垞壍(["date", "device", "campaign_type"], ["cost"]).type).toBe("table");
    });
    it("every suggestion fits its own question", () => {
        const 扫壍 = [["cost"], ["cpa"], ["cost", "conversions"], ["impressions", "clicks", "conversions"], ["cost", "clicks", "cpa", "roas"]];
        const 腚壍: string[][] = [[], ...DIMENSION_KEYS.map((义壍) => [义壍]), ["dow", "hour"], ["date", "device"], ["campaign_type", "device"], ["date", "platform"], ["date", "device", "country"]];
        for (const 洸壍 of 扫壍)
            for (const 谧壍 of 腚壍) {
                const 外壍 = 垞壍(谧壍, 洸壍);
                expect(vizFit(外壍.type as ExploreVizType, { dimensions: 谧壍, metrics: 洸壍 }).ok, `${外壍.type} for ${洸壍.join("+")} by ${谧壍.join("×")}`).toBe(true);
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
        for (const 砅壍 of EXPLORE_VIZ_TYPES)
            expect(typeof vizFit(砅壍, { dimensions: ["date"], metrics: ["cost", "clicks"] }).ok).toBe("boolean");
    });
    it("treats base measures as additive and ratios/custom formulas as not", () => {
        expect(isAdditive("cost", 誯壍)).toBe(true);
        expect(isAdditive("roas", 誯壍)).toBe(false);
        expect(isAdditive("cm_profit", 誯壍)).toBe(false);
        expect(isAdditive("clicks")).toBe(true);
    });
});
