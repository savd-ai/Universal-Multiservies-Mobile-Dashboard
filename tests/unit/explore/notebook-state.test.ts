import { describe, expect, it } from "vitest";
import { autoTitle, describeFilter, describeHaving, stepSummary } from "@/features/explore/describe";
import { defaultState, emptySpec, normalizeSpec, notebookReducer, runnableSpec, stepHasContent, widgetQueryFor, type ExploreState, type NotebookAction, } from "@/features/explore/notebook-state";
import { makeCatalog } from "./fixtures";
const { catalog } = makeCatalog();
const run = (state: ExploreState, ...actions: NotebookAction[]) => actions.reduce(notebookReducer, state);
const base = (): ExploreState => ({ spec: emptySpec({ metrics: ["cost"] }) });
describe("notebookReducer · metrics and breakdowns", () => {
    it("toggles metrics in selection order and caps them at 12", () => {
        const s = run(base(), { type: "toggleMetric", key: "roas" }, { type: "toggleMetric", key: "clicks" }, { type: "toggleMetric", key: "cost" });
        expect(s.spec.metrics).toEqual(["roas", "clicks"]);
        const many = ["cost", "impressions", "clicks", "conversions", "conv_value", "ctr", "cpc", "cpm", "cvr", "cpa", "roas", "aov"];
        const full = run({ spec: emptySpec({ metrics: many }) }, { type: "toggleMetric", key: "search_is" });
        expect(full.spec.metrics).toEqual(many);
    });
    it("moves a metric to a new position", () => {
        const s = run({ spec: emptySpec({ metrics: ["cost", "roas", "cpa"] }) }, { type: "moveMetric", key: "cpa", to: 0 });
        expect(s.spec.metrics).toEqual(["cpa", "cost", "roas"]);
    });
    it("caps breakdowns at three and prunes sort keys of removed breakdowns/metrics", () => {
        let s = run(base(), { type: "toggleDimension", key: "date" }, { type: "toggleDimension", key: "device" }, { type: "toggleDimension", key: "campaign_type" }, { type: "toggleDimension", key: "country" });
        expect(s.spec.dimensions).toEqual(["date", "device", "campaign_type"]);
        s = run(s, { type: "setSort", sort: [{ key: "device", dir: "asc" }, { key: "cost", dir: "desc" }] });
        s = run(s, { type: "toggleDimension", key: "device" });
        expect(s.spec.sort).toEqual([{ key: "cost", dir: "desc" }]);
        s = run(s, { type: "toggleMetric", key: "roas" }, { type: "removeMetric", key: "cost" });
        expect(s.spec.sort).toBeUndefined();
    });
    it("allows compare deltas as sort keys only while comparing", () => {
        let s = run(base(), { type: "setCompare", compare: "previous_period" }, { type: "setSort", sort: [{ key: "cost__pct", dir: "desc" }] });
        expect(s.spec.sort).toEqual([{ key: "cost__pct", dir: "desc" }]);
        s = run(s, { type: "setCompare", compare: "none" });
        expect(s.spec.sort).toBeUndefined();
    });
});
describe("notebookReducer · filters, having, sort, steps", () => {
    it("converts filter values between single and multi-value operators and resets them on a new dimension", () => {
        let s = run(base(), { type: "addFilter", filter: { dim: "campaign_type", op: "eq", value: "Search" } });
        s = run(s, { type: "updateFilter", index: 0, patch: { op: "in" } });
        expect(s.spec.filters[0]).toEqual({ dim: "campaign_type", op: "in", value: ["Search"] });
        s = run(s, { type: "updateFilter", index: 0, patch: { op: "contains" } });
        expect(s.spec.filters[0]?.value).toBe("Search");
        s = run(s, { type: "updateFilter", index: 0, patch: { dim: "device" } });
        expect(s.spec.filters[0]).toEqual({ dim: "device", op: "contains", value: "" });
    });
    it("cross-filter clicks toggle values of an `in` (or `nin`) filter", () => {
        let s = run(base(), { type: "toggleFilterValue", dim: "campaign_type", value: "Search" }, { type: "toggleFilterValue", dim: "campaign_type", value: "PMax" });
        expect(s.spec.filters).toEqual([{ dim: "campaign_type", op: "in", value: ["Search", "PMax"] }]);
        s = run(s, { type: "toggleFilterValue", dim: "device", value: "Mobile", exclude: true });
        expect(s.spec.filters[1]).toEqual({ dim: "device", op: "nin", value: ["Mobile"] });
        s = run(s, { type: "toggleFilterValue", dim: "campaign_type", value: "Search" }, { type: "toggleFilterValue", dim: "campaign_type", value: "PMax" });
        expect(s.spec.filters).toEqual([{ dim: "device", op: "nin", value: ["Mobile"] }]);
    });
    it("switches having values to a range for `between` and back", () => {
        let s = run(base(), { type: "addHaving", having: { metric: "cpa", op: "gt", value: 20 } });
        s = run(s, { type: "updateHaving", index: 0, patch: { op: "between" } });
        expect(s.spec.having[0]?.value).toEqual([20, 20]);
        s = run(s, { type: "updateHaving", index: 0, patch: { op: "lte" } });
        expect(s.spec.having[0]?.value).toBe(20);
    });
    it("clears optional steps and resets date/viz", () => {
        let s: ExploreState = {
            spec: emptySpec({ metrics: ["cost"], dimensions: ["device"], filters: [{ dim: "device", op: "eq", value: "Mobile" }], having: [{ metric: "cost", op: "gt", value: 1 }], sort: [{ key: "cost", dir: "desc" }], limit: 10, dateRange: { preset: "last_7d" }, compare: "previous_year" }),
            viz: { type: "bar" },
        };
        for (const step of ["groupBy", "filters", "having", "sort"] as const)
            expect(stepHasContent(step, s.spec)).toBe(true);
        s = run(s, ...(["groupBy", "filters", "having", "sort", "date", "viz"] as const).map((step) => ({ type: "clearStep", step }) as NotebookAction));
        expect(s.spec).toEqual(emptySpec({ metrics: ["cost"] }));
        expect(s.viz).toBeUndefined();
    });
    it("normalizes: dedupes, clamps the limit, drops invalid limits", () => {
        expect(normalizeSpec(emptySpec({ metrics: ["cost", "cost"], dimensions: ["date", "date"], limit: 99999 }))).toMatchObject({ metrics: ["cost"], dimensions: ["date"], limit: 10000 });
        expect(normalizeSpec(emptySpec({ metrics: ["cost"], limit: 0 })).limit).toBeUndefined();
        expect(run(base(), { type: "setLimit", limit: 25.4 }).spec.limit).toBe(25);
    });
});
describe("runnableSpec / widgetQueryFor", () => {
    const page = { preset: "last_30d" } as const;
    it("returns null until there is a metric", () => {
        expect(runnableSpec(emptySpec(), page)).toBeNull();
    });
    it("fills the page range, drops drafts and trims text", () => {
        const spec = emptySpec({
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
        expect(runnableSpec(spec, page)).toEqual({
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
        const spec = emptySpec({ metrics: ["cost"], dateRange: { start: "2026-09-01", end: "2026-09-07" }, sort: [{ key: "cost", dir: "asc" }], limit: 5, totals: false });
        expect(runnableSpec(spec, page)).toMatchObject({ dateRange: { start: "2026-09-01", end: "2026-09-07" }, sort: [{ key: "cost", dir: "asc" }], limit: 5, totals: false });
    });
    it("saves widgets without a date range unless it is pinned", () => {
        const spec = emptySpec({ metrics: ["cost"], dimensions: ["device"], dateRange: { preset: "last_7d" }, compare: "previous_period" });
        expect(widgetQueryFor(spec, null)).toEqual({ source: "google_ads", metrics: ["cost"], dimensions: ["device"], compare: "previous_period" });
        expect(widgetQueryFor(spec, { preset: "last_7d" }).dateRange).toEqual({ preset: "last_7d" });
    });
    it("starts from spend and conversions by day", () => {
        expect(defaultState().spec).toMatchObject({ metrics: ["cost", "conversions"], dimensions: ["date"] });
    });
});
describe("describe", () => {
    it("titles questions like Metabase", () => {
        expect(autoTitle({ metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, catalog)).toBe("Spend and ROAS by campaign type");
        expect(autoTitle({ metrics: ["conversions"], dimensions: ["dow", "hour"] }, catalog)).toBe("Conversions by day of week × hour");
        expect(autoTitle({ metrics: ["cost", "clicks", "conversions", "cpa"], dimensions: [] }, catalog)).toBe("Spend, Clicks and 2 more");
        expect(autoTitle({ metrics: [], dimensions: [] }, catalog)).toBe("New question");
    });
    it("describes filters and having conditions (percent metrics as %)", () => {
        expect(describeFilter({ dim: "campaign_type", op: "in", value: ["Search", "PMax"] }, catalog)).toBe("Campaign type is any of Search, PMax");
        expect(describeHaving({ metric: "ctr", op: "gt", value: 0.05 }, catalog)).toBe("CTR > 5%");
        expect(describeHaving({ metric: "cpa", op: "between", value: [10, 20] }, catalog)).toBe("Cost / conv. between $10 – $20");
        expect(stepSummary("sort", emptySpec({ metrics: ["cost"], sort: [{ key: "cost", dir: "desc" }], limit: 25 }), { catalog })).toBe("Spend ↓ · first 25 rows");
    });
});
