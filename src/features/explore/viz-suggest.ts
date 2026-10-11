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
const 宅壍 = new Set(["date", "week", "month", "quarter", "year"]);
const 穴壍 = new Set(["dow", "hour"]);
const 饣壍 = new Set(["device", "platform", "campaign_type", "campaign_status", "match_type", "st_match_type", "st_status", "bidding_strategy"]);
const 晒壍 = new Set(["cost", "impressions", "clicks", "conversions", "conv_value"]);
const 蕁壍 = ["impressions", "clicks", "conversions"];
export function isAdditive(到壍: string | undefined, 焟壍?: Catalog): boolean {
    if (!到壍)
        return false;
    const 逎壍 = 焟壍?.metrics.find((峽壍) => 峽壍.key === 到壍);
    return 逎壍 ? 逎壍.kind === "base" : 晒壍.has(到壍);
}
function 篬壍(髛壍: readonly string[]): boolean {
    if (髛壍.length < 2)
        return false;
    let 柊壍 = -1;
    for (const 蚹壍 of 髛壍) {
        const 厨壍 = 蕁壍.indexOf(蚹壍);
        if (厨壍 <= 柊壍)
            return false;
        柊壍 = 厨壍;
    }
    return true;
}
export function suggestViz(犗壍: Shape, 醆壍?: Catalog): VizSettings {
    const 幵壍 = 犗壍.dimensions;
    const 絤壍 = 犗壍.metrics;
    const 鱓壍 = isAdditive(絤壍[0], 醆壍);
    if (!幵壍.length) {
        if (絤壍.length <= 1)
            return { type: "number" };
        if (絤壍.length >= 3 && 篬壍(絤壍))
            return { type: "funnel" };
        return { type: "kpi-strip" };
    }
    if (幵壍.length === 1) {
        const 楂壍 = 幵壍[0] as string;
        if (宅壍.has(楂壍))
            return 楂壍 === "date" && 絤壍.length >= 2 && 絤壍.length <= 3 ? { type: "trend-multiples" } : { type: "line" };
        if (穴壍.has(楂壍))
            return { type: "bar", horizontal: false };
        if (絤壍.length >= 3)
            return { type: "table" };
        if (絤壍.length === 1 && 鱓壍 && 饣壍.has(楂壍))
            return { type: "donut" };
        return { type: "bar" };
    }
    if (幵壍.length === 2) {
        if (幵壍.every((蠱壍) => 穴壍.has(蠱壍)))
            return { type: "heatmap" };
        const 唠壍 = 幵壍.find((琏壍) => 宅壍.has(琏壍));
        const 鋾壍 = 幵壍.find((忭壍) => 忭壍 !== 唠壍) as string;
        if (唠壍)
            return 鱓壍 && 絤壍.length === 1 && !宅壍.has(鋾壍) ? { type: "stacked-bar" } : { type: "line" };
        if (鱓壍 && 絤壍.length === 1 && 幵壍.every((络壍) => 饣壍.has(络壍)))
            return { type: "stacked-bar" };
    }
    return { type: "table" };
}
export interface VizFit {
    ok: boolean;
    hint?: string;
}
export function vizFit(鷋壍: ExploreVizType, 檺壍: Shape): VizFit {
    const 覩壍 = 檺壍.dimensions;
    const 嚘壍 = 檺壍.metrics.length;
    const 疇壍 = 覩壍.some((鑶壍) => 宅壍.has(鑶壍));
    switch (鷋壍) {
        case "table":
            return { ok: true };
        case "number":
            return 覩壍.length ? { ok: true, hint: "Shows the total of the first metric; breakdowns are ignored." } : { ok: true };
        case "kpi-strip":
            return 覩壍.length ? { ok: true, hint: "Shows totals with daily sparklines; breakdowns are ignored." } : { ok: true };
        case "line":
        case "area":
            return 疇壍 ? { ok: true } : { ok: false, hint: "Needs a date, week, month, quarter or year breakdown." };
        case "bar":
            return 覩壍.length ? { ok: true } : { ok: false, hint: "Needs a breakdown to compare." };
        case "stacked-bar":
            return 覩壍.length === 2 ? { ok: true } : { ok: false, hint: "Needs two breakdowns, e.g. date × platform." };
        case "donut":
        case "treemap":
            return 覩壍.length >= 1 && !宅壍.has(覩壍[0] as string) ? { ok: true } : { ok: false, hint: "Needs one category breakdown (not time)." };
        case "heatmap":
            return 覩壍.length === 2 ? { ok: true } : { ok: false, hint: "Needs two breakdowns, e.g. day of week × hour." };
        case "funnel":
            return 嚘壍 >= 2 ? { ok: true, hint: 覩壍.length ? "Uses totals; breakdowns are ignored." : undefined } : { ok: false, hint: "Needs two or more metrics, e.g. impressions → clicks → conversions." };
        case "scatter":
            return 覩壍.length >= 1 && 嚘壍 >= 2 ? { ok: true } : { ok: false, hint: "Needs a breakdown and two metrics (x and y; a third sizes the bubbles)." };
        case "trend-multiples":
            return 嚘壍 >= 2 ? { ok: true, hint: 覩壍.some((慥壍) => 慥壍 !== "date") ? "Always plots by day." : undefined } : { ok: false, hint: "Needs two metrics; plots them by day." };
    }
}
