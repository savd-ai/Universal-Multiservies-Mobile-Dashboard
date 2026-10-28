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
export function sourceLabel(text: string): string {
    return text === "google_ads" ? "Google Ads" : text;
}
export function metricLabel(catalog: Catalog | undefined, key: string): string {
    return catalog?.metrics.find((m) => m.key === key)?.label ?? key;
}
export function metricFormat(catalog: Catalog | undefined, key: string): MetricFormat {
    return (catalog?.metrics.find((m) => m.key === key)?.format ?? "number") as MetricFormat;
}
export function dimLabel(catalog: Catalog | undefined, key: string): string {
    return catalog?.dimensions.find((d) => d.key === key)?.label ?? key;
}
export function sortKeyLabel(catalog: Catalog | undefined, key: string): string {
    const [base, suffix] = key.split("__");
    const known = catalog?.dimensions.some((d) => d.key === base);
    const label = known ? dimLabel(catalog, base as string) : metricLabel(catalog, base as string);
    return suffix === "pct" ? `${label} Δ%` : suffix === "delta" ? `${label} Δ` : label;
}
export function havingScale(format: MetricFormat): number {
    return format === "percent" ? 100 : 1;
}
export function formatHavingValue(format: MetricFormat, v: number, currency = "USD"): string {
    if (format === "percent")
        return `${+(v * 100).toFixed(4)}%`;
    if (format === "ratio")
        return `${v}x`;
    return formatMetricValue(format, v, { currency, compact: false });
}
export function describeFilter(f: QueryFilter, catalog?: Catalog): string {
    const values = (Array.isArray(f.value) ? f.value : [f.value]).map(String).filter((v) => v !== "");
    const shown = values.length > 3 ? `${values.slice(0, 3).join(", ")} +${values.length - 3}` : values.join(", ");
    return `${dimLabel(catalog, f.dim)} ${FILTER_OP_LABEL[f.op]} ${shown || "…"}`;
}
export function describeHaving(h: QueryHaving, catalog?: Catalog, currency?: string): string {
    const fmt = metricFormat(catalog, h.metric);
    const v = Array.isArray(h.value) ? `${formatHavingValue(fmt, h.value[0], currency)} – ${formatHavingValue(fmt, h.value[1], currency)}` : formatHavingValue(fmt, h.value, currency);
    return `${metricLabel(catalog, h.metric)} ${HAVING_OP_LABEL[h.op]} ${v}`;
}
export function dateRangeLabel(range: DateRangeSpec | undefined): string {
    if (!range)
        return "Page range";
    if ("preset" in range)
        return `${PRESET_LABELS[range.preset as DatePreset] ?? range.preset}${range.includeToday ? " (incl. today)" : ""}`;
    return formatRange(range.start <= range.end ? { start: range.start, end: range.end } : { start: range.end, end: range.start });
}
export function resolvedRangeLabel(range: DateRangeSpec, today: string | undefined): string {
    if ("start" in range)
        return dateRangeLabel(range);
    if (!today)
        return "";
    return formatRange(resolvePreset(range.preset, today, range.includeToday));
}
function lowerFirst(s: string): string {
    return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
export function autoTitle(spec: Pick<ExploreSpec, "metrics" | "dimensions">, catalog?: Catalog): string {
    const labels = spec.metrics.map((m) => metricLabel(catalog, m));
    let what: string;
    if (!labels.length)
        what = "New question";
    else if (labels.length <= 3)
        what = labels.length === 1 ? (labels[0] as string) : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
    else
        what = `${labels.slice(0, 2).join(", ")} and ${labels.length - 2} more`;
    if (!spec.dimensions.length)
        return what;
    return `${what} by ${spec.dimensions.map((d) => lowerFirst(dimLabel(catalog, d))).join(" × ")}`;
}
export function stepSummary(step: "data" | "metrics" | "groupBy" | "filters" | "having" | "sort" | "date" | "viz", spec: ExploreSpec, ctx: {
    catalog?: Catalog;
    vizLabel?: string;
    today?: string;
    currency?: string;
}): string {
    const { catalog } = ctx;
    switch (step) {
        case "data":
            return sourceLabel(spec.source);
        case "metrics":
            return spec.metrics.length ? spec.metrics.map((m) => metricLabel(catalog, m)).join(", ") : "Pick at least one metric";
        case "groupBy":
            return spec.dimensions.length ? spec.dimensions.map((d) => dimLabel(catalog, d)).join(" × ") : "No breakdown — totals";
        case "filters":
            return spec.filters.length ? spec.filters.map((f) => describeFilter(f, catalog)).join(" · ") : "No filters";
        case "having":
            return spec.having.length ? spec.having.map((h) => describeHaving(h, catalog, ctx.currency)).join(" · ") : "No conditions";
        case "sort": {
            const sort = spec.sort?.map((s) => `${sortKeyLabel(catalog, s.key)} ${s.dir === "desc" ? "↓" : "↑"}`).join(", ") || "Default order";
            return spec.limit ? `${sort} · first ${spec.limit.toLocaleString("en-US")} rows` : sort;
        }
        case "date":
            return `${dateRangeLabel(spec.dateRange)}${spec.compare !== "none" ? ` · ${COMPARE_LABEL[spec.compare]}` : ""}`;
        case "viz":
            return ctx.vizLabel ?? "Auto";
    }
}
export function slugify(s: string): string {
    return (s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "explore");
}
