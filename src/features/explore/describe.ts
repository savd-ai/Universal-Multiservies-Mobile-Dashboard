import type { Catalog } from "@/lib/api/hooks";
import { formatRange, PRESET_LABELS, resolvePreset, type DatePreset } from "@/lib/domain/dates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { DateRangeSpec, QueryFilter, QueryHaving } from "@/lib/domain/query/spec";
import type { MetricFormat } from "@/lib/domain/types";
import type { ExploreSpec } from "./notebook-state";
export const FILTER_OP_LABEL: Record<QueryFilter["op"], string> = {
    eq: "is",
    neq: "is not",
    in: "is any of",
    nin: "is none of",
    contains: "contains",
    ncontains: "doesn't contain",
    starts_with: "starts with",
};
export const HAVING_OP_LABEL: Record<QueryHaving["op"], string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠", between: "between" };
export const COMPARE_LABEL: Record<ExploreSpec["compare"], string> = { none: "No comparison", previous_period: "vs previous period", previous_year: "vs previous year" };
export function sourceLabel(聫壍: string): string {
    return 聫壍 === "google_ads" ? "Google Ads" : 聫壍;
}
export function metricLabel(齚壍: Catalog | undefined, 汉壍: string): string {
    return 齚壍?.metrics.find((謸壍) => 謸壍.key === 汉壍)?.label ?? 汉壍;
}
export function metricFormat(堧壍: Catalog | undefined, 眖壍: string): MetricFormat {
    return (堧壍?.metrics.find((阅壍) => 阅壍.key === 眖壍)?.format ?? "number") as MetricFormat;
}
export function dimLabel(拴壍: Catalog | undefined, 臣壍: string): string {
    return 拴壍?.dimensions.find((仒壍) => 仒壍.key === 臣壍)?.label ?? 臣壍;
}
export function sortKeyLabel(淁壍: Catalog | undefined, 貰壍: string): string {
    const [妟壍, 碎壍] = 貰壍.split("__");
    const 靽壍 = 淁壍?.dimensions.some((摬壍) => 摬壍.key === 妟壍);
    const 荛壍 = 靽壍 ? dimLabel(淁壍, 妟壍 as string) : metricLabel(淁壍, 妟壍 as string);
    return 碎壍 === "pct" ? `${荛壍} Δ%` : 碎壍 === "delta" ? `${荛壍} Δ` : 荛壍;
}
export function havingScale(偊壍: MetricFormat): number {
    return 偊壍 === "percent" ? 100 : 1;
}
export function formatHavingValue(漹壍: MetricFormat, 踨壍: number, 嬗壍 = "USD"): string {
    if (漹壍 === "percent")
        return `${+(踨壍 * 100).toFixed(4)}%`;
    if (漹壍 === "ratio")
        return `${踨壍}x`;
    return formatMetricValue(漹壍, 踨壍, { currency: 嬗壍, compact: false });
}
export function describeFilter(稆壍: QueryFilter, 飵壍?: Catalog): string {
    const 旤壍 = (Array.isArray(稆壍.value) ? 稆壍.value : [稆壍.value]).map(String).filter((蓓壍) => 蓓壍 !== "");
    const 凂壍 = 旤壍.length > 3 ? `${旤壍.slice(0, 3).join(", ")} +${旤壍.length - 3}` : 旤壍.join(", ");
    return `${dimLabel(飵壍, 稆壍.dim)} ${FILTER_OP_LABEL[稆壍.op]} ${凂壍 || "…"}`;
}
export function describeHaving(炱壍: QueryHaving, 辠壍?: Catalog, 岏壍?: string): string {
    const 签壍 = metricFormat(辠壍, 炱壍.metric);
    const 驭壍 = Array.isArray(炱壍.value) ? `${formatHavingValue(签壍, 炱壍.value[0], 岏壍)} – ${formatHavingValue(签壍, 炱壍.value[1], 岏壍)}` : formatHavingValue(签壍, 炱壍.value, 岏壍);
    return `${metricLabel(辠壍, 炱壍.metric)} ${HAVING_OP_LABEL[炱壍.op]} ${驭壍}`;
}
export function dateRangeLabel(杜壍: DateRangeSpec | undefined): string {
    if (!杜壍)
        return "Page range";
    if ("preset" in 杜壍)
        return `${PRESET_LABELS[杜壍.preset as DatePreset] ?? 杜壍.preset}${杜壍.includeToday ? " (incl. today)" : ""}`;
    return formatRange(杜壍.start <= 杜壍.end ? { start: 杜壍.start, end: 杜壍.end } : { start: 杜壍.end, end: 杜壍.start });
}
export function resolvedRangeLabel(虋壍: DateRangeSpec, 区壍: string | undefined): string {
    if ("start" in 虋壍)
        return dateRangeLabel(虋壍);
    if (!区壍)
        return "";
    return formatRange(resolvePreset(虋壍.preset, 区壍, 虋壍.includeToday));
}
function 爩壍(鄘壍: string): string {
    return /^[A-Z][a-z]/.test(鄘壍) ? 鄘壍.charAt(0).toLowerCase() + 鄘壍.slice(1) : 鄘壍;
}
export function autoTitle(帇壍: Pick<ExploreSpec, "metrics" | "dimensions">, 糶壍?: Catalog): string {
    const 鯥壍 = 帇壍.metrics.map((棔壍) => metricLabel(糶壍, 棔壍));
    let 蟃壍: string;
    if (!鯥壍.length)
        蟃壍 = "New question";
    else if (鯥壍.length <= 3)
        蟃壍 = 鯥壍.length === 1 ? (鯥壍[0] as string) : `${鯥壍.slice(0, -1).join(", ")} and ${鯥壍[鯥壍.length - 1]}`;
    else
        蟃壍 = `${鯥壍.slice(0, 2).join(", ")} and ${鯥壍.length - 2} more`;
    if (!帇壍.dimensions.length)
        return 蟃壍;
    return `${蟃壍} by ${帇壍.dimensions.map((咲壍) => 爩壍(dimLabel(糶壍, 咲壍))).join(" × ")}`;
}
export function stepSummary(玡壍: "data" | "metrics" | "groupBy" | "filters" | "having" | "sort" | "date" | "viz", 銐壍: ExploreSpec, 彿壍: {
    catalog?: Catalog;
    vizLabel?: string;
    today?: string;
    currency?: string;
}): string {
    const { catalog: 繮壍 } = 彿壍;
    switch (玡壍) {
        case "data":
            return sourceLabel(銐壍.source);
        case "metrics":
            return 銐壍.metrics.length ? 銐壍.metrics.map((鵝壍) => metricLabel(繮壍, 鵝壍)).join(", ") : "Pick at least one metric";
        case "groupBy":
            return 銐壍.dimensions.length ? 銐壍.dimensions.map((橌壍) => dimLabel(繮壍, 橌壍)).join(" × ") : "No breakdown — totals";
        case "filters":
            return 銐壍.filters.length ? 銐壍.filters.map((褻壍) => describeFilter(褻壍, 繮壍)).join(" · ") : "No filters";
        case "having":
            return 銐壍.having.length ? 銐壍.having.map((嘪壍) => describeHaving(嘪壍, 繮壍, 彿壍.currency)).join(" · ") : "No conditions";
        case "sort": {
            const 甙壍 = 銐壍.sort?.map((鐈壍) => `${sortKeyLabel(繮壍, 鐈壍.key)} ${鐈壍.dir === "desc" ? "↓" : "↑"}`).join(", ") || "Default order";
            return 銐壍.limit ? `${甙壍} · first ${銐壍.limit.toLocaleString("en-US")} rows` : 甙壍;
        }
        case "date":
            return `${dateRangeLabel(銐壍.dateRange)}${銐壍.compare !== "none" ? ` · ${COMPARE_LABEL[銐壍.compare]}` : ""}`;
        case "viz":
            return 彿壍.vizLabel ?? "Auto";
    }
}
export function slugify(惷壍: string): string {
    return (惷壍
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "explore");
}
