import type { Catalog } from "@/lib/api/hooks";
import type { VizSettings } from "@/lib/domain/contracts/dashboard";
import type { ExploreVizType } from "./codec";
type Shape = {
    dimensions: readonly string[];
    metrics: readonly string[];
};
export const VIZ_META: Record<ExploreVizType, {
    label: string;
    blurb: string;
}> = {
    table: { label: "Table", blurb: "Every row and column" },
    line: { label: "Line", blurb: "Trend over time" },
    area: { label: "Area", blurb: "Trend with volume" },
    bar: { label: "Bar", blurb: "Compare categories" },
    "stacked-bar": { label: "Stacked bars", blurb: "Composition by a second breakdown" },
    donut: { label: "Donut", blurb: "Share of a total" },
    number: { label: "Number", blurb: "One big total" },
    "kpi-strip": { label: "KPI strip", blurb: "Totals with sparklines" },
    heatmap: { label: "Heatmap", blurb: "Two breakdowns as a grid" },
    funnel: { label: "Funnel", blurb: "Step-to-step rates" },
    scatter: { label: "Scatter", blurb: "Two metrics against each other" },
    treemap: { label: "Treemap", blurb: "Share as nested tiles" },
    "trend-multiples": { label: "Trend multiples", blurb: "Two metrics, one day axis" },
};
export const VIZ_ORDER: ExploreVizType[] = ["table", "line", "area", "bar", "stacked-bar", "donut", "number", "kpi-strip", "heatmap", "funnel", "scatter", "treemap", "trend-multiples"];
const CALENDAR = new Set(["date", "week", "month", "quarter", "year"]);
const CYCLE = new Set(["dow", "hour"]);
const FEW_VALUES = new Set(["device", "platform", "campaign_type", "campaign_status", "match_type", "st_match_type", "st_status", "bidding_strategy"]);
const BASE_KEYS = new Set(["cost", "impressions", "clicks", "conversions", "conv_value"]);
const FUNNEL_STEPS = ["impressions", "clicks", "conversions"];
export function isAdditive(key: string | undefined, catalog?: Catalog): boolean {
    if (!key)
        return false;
    const m = catalog?.metrics.find((x) => x.key === key);
    return m ? m.kind === "base" : BASE_KEYS.has(key);
}
function isFunnel(metrics: readonly string[]): boolean {
    if (metrics.length < 2)
        return false;
    let at = -1;
    for (const m of metrics) {
        const i = FUNNEL_STEPS.indexOf(m);
        if (i <= at)
            return false;
        at = i;
    }
    return true;
}
export function suggestViz(spec: Shape, catalog?: Catalog): VizSettings {
    const dims = spec.dimensions;
    const metrics = spec.metrics;
    const additive = isAdditive(metrics[0], catalog);
    if (!dims.length) {
        if (metrics.length <= 1)
            return { type: "number" };
        if (metrics.length >= 3 && isFunnel(metrics))
            return { type: "funnel" };
        return { type: "kpi-strip" };
    }
    if (dims.length === 1) {
        const d = dims[0] as string;
        if (CALENDAR.has(d))
            return d === "date" && metrics.length >= 2 && metrics.length <= 3 ? { type: "trend-multiples" } : { type: "line" };
        if (CYCLE.has(d))
            return { type: "bar", horizontal: false };
        if (metrics.length >= 3)
            return { type: "table" };
        if (metrics.length === 1 && additive && FEW_VALUES.has(d))
            return { type: "donut" };
        return { type: "bar" };
    }
    if (dims.length === 2) {
        if (dims.every((d) => CYCLE.has(d)))
            return { type: "heatmap" };
        const time = dims.find((d) => CALENDAR.has(d));
        const other = dims.find((d) => d !== time) as string;
        if (time)
            return additive && metrics.length === 1 && !CALENDAR.has(other) ? { type: "stacked-bar" } : { type: "line" };
        if (additive && metrics.length === 1 && dims.every((d) => FEW_VALUES.has(d)))
            return { type: "stacked-bar" };
    }
    return { type: "table" };
}
export interface VizFit {
    ok: boolean;
    hint?: string;
}
export function vizFit(exploreVizType: ExploreVizType, spec: Shape): VizFit {
    const dims = spec.dimensions;
    const n = spec.metrics.length;
    const hasCalendar = dims.some((d) => CALENDAR.has(d));
    switch (exploreVizType) {
        case "table":
            return { ok: true };
        case "number":
            return dims.length ? { ok: true, hint: "Shows the total of the first metric; breakdowns are ignored." } : { ok: true };
        case "kpi-strip":
            return dims.length ? { ok: true, hint: "Shows totals with daily sparklines; breakdowns are ignored." } : { ok: true };
        case "line":
        case "area":
            return hasCalendar ? { ok: true } : { ok: false, hint: "Needs a date, week, month, quarter or year breakdown." };
        case "bar":
            return dims.length ? { ok: true } : { ok: false, hint: "Needs a breakdown to compare." };
        case "stacked-bar":
            return dims.length === 2 ? { ok: true } : { ok: false, hint: "Needs two breakdowns, e.g. date × platform." };
        case "donut":
        case "treemap":
            return dims.length >= 1 && !CALENDAR.has(dims[0] as string) ? { ok: true } : { ok: false, hint: "Needs one category breakdown (not time)." };
        case "heatmap":
            return dims.length === 2 ? { ok: true } : { ok: false, hint: "Needs two breakdowns, e.g. day of week × hour." };
        case "funnel":
            return n >= 2 ? { ok: true, hint: dims.length ? "Uses totals; breakdowns are ignored." : undefined } : { ok: false, hint: "Needs two or more metrics, e.g. impressions → clicks → conversions." };
        case "scatter":
            return dims.length >= 1 && n >= 2 ? { ok: true } : { ok: false, hint: "Needs a breakdown and two metrics (x and y; a third sizes the bubbles)." };
        case "trend-multiples":
            return n >= 2 ? { ok: true, hint: dims.some((d) => d !== "date") ? "Always plots by day." : undefined } : { ok: false, hint: "Needs two metrics; plots them by day." };
    }
}
