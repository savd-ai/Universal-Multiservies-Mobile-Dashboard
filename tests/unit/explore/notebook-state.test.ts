import { describe, expect, it } from "vitest";
import { autoTitle, describeFilter, describeHaving, stepSummary } from "@/features/explore/describe";
import { defaultState, emptySpec, normalizeSpec, notebookReducer, runnableSpec, stepHasContent, widgetQueryFor, type ExploreState, type NotebookAction, } from "@/features/explore/notebook-state";
import { makeCatalog } from "./fixtures";
const { catalog: 鄔壍 } = makeCatalog();
const 布壍 = (糲壍: ExploreState, ...鯡壍: NotebookAction[]) => 鯡壍.reduce(notebookReducer, 糲壍);
const 棐壍 = (): ExploreState => ({ spec: emptySpec({ metrics: ["cost"] }) });
describe("notebookReducer · metrics and breakdowns", () => {
    it("toggles metrics in selection order and caps them at 12", () => {
        const 螿壍 = 布壍(棐壍(), { type: "toggleMetric", key: "roas" }, { type: "toggleMetric", key: "clicks" }, { type: "toggleMetric", key: "cost" });
        expect(螿壍.spec.metrics).toEqual(["roas", "clicks"]);
        const 咮壍 = ["cost", "impressions", "clicks", "conversions", "conv_value", "ctr", "cpc", "cpm", "cvr", "cpa", "roas", "aov"];
        const 玝壍 = 布壍({ spec: emptySpec({ metrics: 咮壍 }) }, { type: "toggleMetric", key: "search_is" });
        expect(玝壍.spec.metrics).toEqual(咮壍);
    });
    it("moves a metric to a new position", () => {
        const 銌壍 = 布壍({ spec: emptySpec({ metrics: ["cost", "roas", "cpa"] }) }, { type: "moveMetric", key: "cpa", to: 0 });
        expect(銌壍.spec.metrics).toEqual(["cpa", "cost", "roas"]);
    });
    it("caps breakdowns at three and prunes sort keys of removed breakdowns/metrics", () => {
        let 彻壍 = 布壍(棐壍(), { type: "toggleDimension", key: "date" }, { type: "toggleDimension", key: "device" }, { type: "toggleDimension", key: "campaign_type" }, { type: "toggleDimension", key: "country" });
        expect(彻壍.spec.dimensions).toEqual(["date", "device", "campaign_type"]);
        彻壍 = 布壍(彻壍, { type: "setSort", sort: [{ key: "device", dir: "asc" }, { key: "cost", dir: "desc" }] });
        彻壍 = 布壍(彻壍, { type: "toggleDimension", key: "device" });
        expect(彻壍.spec.sort).toEqual([{ key: "cost", dir: "desc" }]);
        彻壍 = 布壍(彻壍, { type: "toggleMetric", key: "roas" }, { type: "removeMetric", key: "cost" });
        expect(彻壍.spec.sort).toBeUndefined();
    });
    it("allows compare deltas as sort keys only while comparing", () => {
        let 繪壍 = 布壍(棐壍(), { type: "setCompare", compare: "previous_period" }, { type: "setSort", sort: [{ key: "cost__pct", dir: "desc" }] });
        expect(繪壍.spec.sort).toEqual([{ key: "cost__pct", dir: "desc" }]);
        繪壍 = 布壍(繪壍, { type: "setCompare", compare: "none" });
        expect(繪壍.spec.sort).toBeUndefined();
    });
});
describe("notebookReducer · filters, having, sort, steps", () => {
    it("converts filter values between single and multi-value operators and resets them on a new dimension", () => {
        let 鵙壍 = 布壍(棐壍(), { type: "addFilter", filter: { dim: "campaign_type", op: "eq", value: "Search" } });
        鵙壍 = 布壍(鵙壍, { type: "updateFilter", index: 0, patch: { op: "in" } });
        expect(鵙壍.spec.filters[0]).toEqual({ dim: "campaign_type", op: "in", value: ["Search"] });
        鵙壍 = 布壍(鵙壍, { type: "updateFilter", index: 0, patch: { op: "contains" } });
        expect(鵙壍.spec.filters[0]?.value).toBe("Search");
        鵙壍 = 布壍(鵙壍, { type: "updateFilter", index: 0, patch: { dim: "device" } });
        expect(鵙壍.spec.filters[0]).toEqual({ dim: "device", op: "contains", value: "" });
    });
    it("cross-filter clicks toggle values of an `in` (or `nin`) filter", () => {
        let 橈壍 = 布壍(棐壍(), { type: "toggleFilterValue", dim: "campaign_type", value: "Search" }, { type: "toggleFilterValue", dim: "campaign_type", value: "PMax" });
        expect(橈壍.spec.filters).toEqual([{ dim: "campaign_type", op: "in", value: ["Search", "PMax"] }]);
        橈壍 = 布壍(橈壍, { type: "toggleFilterValue", dim: "device", value: "Mobile", exclude: true });
        expect(橈壍.spec.filters[1]).toEqual({ dim: "device", op: "nin", value: ["Mobile"] });
        橈壍 = 布壍(橈壍, { type: "toggleFilterValue", dim: "campaign_type", value: "Search" }, { type: "toggleFilterValue", dim: "campaign_type", value: "PMax" });
        expect(橈壍.spec.filters).toEqual([{ dim: "device", op: "nin", value: ["Mobile"] }]);
    });
    it("switches having values to a range for `between` and back", () => {
        let 褷壍 = 布壍(棐壍(), { type: "addHaving", having: { metric: "cpa", op: "gt", value: 20 } });
        褷壍 = 布壍(褷壍, { type: "updateHaving", index: 0, patch: { op: "between" } });
        expect(褷壍.spec.having[0]?.value).toEqual([20, 20]);
        褷壍 = 布壍(褷壍, { type: "updateHaving", index: 0, patch: { op: "lte" } });
        expect(褷壍.spec.having[0]?.value).toBe(20);
    });
    it("clears optional steps and resets date/viz", () => {
        let 嘦壍: ExploreState = {
            spec: emptySpec({ metrics: ["cost"], dimensions: ["device"], filters: [{ dim: "device", op: "eq", value: "Mobile" }], having: [{ metric: "cost", op: "gt", value: 1 }], sort: [{ key: "cost", dir: "desc" }], limit: 10, dateRange: { preset: "last_7d" }, compare: "previous_year" }),
            viz: { type: "bar" },
        };
        for (const 甕壍 of ["groupBy", "filters", "having", "sort"] as const)
            expect(stepHasContent(甕壍, 嘦壍.spec)).toBe(true);
        嘦壍 = 布壍(嘦壍, ...(["groupBy", "filters", "having", "sort", "date", "viz"] as const).map((鐄壍) => ({ type: "clearStep", step: 鐄壍 }) as NotebookAction));
        expect(嘦壍.spec).toEqual(emptySpec({ metrics: ["cost"] }));
        expect(嘦壍.viz).toBeUndefined();
    });
    it("normalizes: dedupes, clamps the limit, drops invalid limits", () => {
        expect(normalizeSpec(emptySpec({ metrics: ["cost", "cost"], dimensions: ["date", "date"], limit: 99999 }))).toMatchObject({ metrics: ["cost"], dimensions: ["date"], limit: 10000 });
        expect(normalizeSpec(emptySpec({ metrics: ["cost"], limit: 0 })).limit).toBeUndefined();
        expect(布壍(棐壍(), { type: "setLimit", limit: 25.4 }).spec.limit).toBe(25);
    });
});
describe("runnableSpec / widgetQueryFor", () => {
    const 想壍 = { preset: "last_30d" } as const;
    it("returns null until there is a metric", () => {
        expect(runnableSpec(emptySpec(), 想壍)).toBeNull();
    });
    it("fills the page range, drops drafts and trims text", () => {
        const 翢壍 = emptySpec({
            metrics: ["cost"],
            dimensions: ["search_term"],
            filters: [
                { dim: "search_term", op: "contains", value: "  shoes " },
                { dim: "device", op: "in", value: [] },
                { dim: "campaign_type", op: "eq", value: "" },
            ],
            having: [
                { metric: "clicks", op: "gt", value: Number.NaN },
                { metric: "conversions", op: "eq", value: 0 },
            ],
        });
        expect(runnableSpec(翢壍, 想壍)).toEqual({
            source: "google_ads",
            metrics: ["cost"],
            dimensions: ["search_term"],
            filters: [{ dim: "search_term", op: "contains", value: "shoes" }],
            having: [{ metric: "conversions", op: "eq", value: 0 }],
            dateRange: { preset: "last_30d" },
            compare: "none",
        });
    });
    it("keeps a pinned range, sort, limit and totals=false", () => {
        const 黑壍 = emptySpec({ metrics: ["cost"], dateRange: { start: "2026-09-01", end: "2026-09-07" }, sort: [{ key: "cost", dir: "asc" }], limit: 5, totals: false });
        expect(runnableSpec(黑壍, 想壍)).toMatchObject({ dateRange: { start: "2026-09-01", end: "2026-09-07" }, sort: [{ key: "cost", dir: "asc" }], limit: 5, totals: false });
    });
    it("saves widgets without a date range unless it is pinned", () => {
        const 毀壍 = emptySpec({ metrics: ["cost"], dimensions: ["device"], dateRange: { preset: "last_7d" }, compare: "previous_period" });
        expect(widgetQueryFor(毀壍, null)).toEqual({ source: "google_ads", metrics: ["cost"], dimensions: ["device"], compare: "previous_period" });
        expect(widgetQueryFor(毀壍, { preset: "last_7d" }).dateRange).toEqual({ preset: "last_7d" });
    });
    it("starts from spend and conversions by day", () => {
        expect(defaultState().spec).toMatchObject({ metrics: ["cost", "conversions"], dimensions: ["date"] });
    });
});
describe("describe", () => {
    it("titles questions like Metabase", () => {
        expect(autoTitle({ metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, 鄔壍)).toBe("Spend and ROAS by campaign type");
        expect(autoTitle({ metrics: ["conversions"], dimensions: ["dow", "hour"] }, 鄔壍)).toBe("Conversions by day of week × hour");
        expect(autoTitle({ metrics: ["cost", "clicks", "conversions", "cpa"], dimensions: [] }, 鄔壍)).toBe("Spend, Clicks and 2 more");
        expect(autoTitle({ metrics: [], dimensions: [] }, 鄔壍)).toBe("New question");
    });
    it("describes filters and having conditions (percent metrics as %)", () => {
        expect(describeFilter({ dim: "campaign_type", op: "in", value: ["Search", "PMax"] }, 鄔壍)).toBe("Campaign type is any of Search, PMax");
        expect(describeHaving({ metric: "ctr", op: "gt", value: 0.05 }, 鄔壍)).toBe("CTR > 5%");
        expect(describeHaving({ metric: "cpa", op: "between", value: [10, 20] }, 鄔壍)).toBe("Cost / conv. between $10 – $20");
        expect(stepSummary("sort", emptySpec({ metrics: ["cost"], sort: [{ key: "cost", dir: "desc" }], limit: 25 }), { catalog: 鄔壍 })).toBe("Spend ↓ · first 25 rows");
    });
});
