"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ErrorState, InlineEmpty, Refetching, Skeleton } from "@/components/ui/feedback";
import type { MenuItem } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { download } from "@/lib/api/client";
import { useQueryResult, type Catalog, type CatalogMetric } from "@/lib/api/hooks";
import type { VizSettings } from "@/lib/domain/contracts/dashboard";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { moneyOpts, type MoneyLike } from "@/lib/money";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";
import type { MetricFormat } from "@/lib/domain/types";
import type { WidgetRuntime } from "../types";
export interface VizProps {
    spec: QuerySpecInput;
    viz: VizSettings;
    rt: WidgetRuntime;
    catalog: Catalog;
    title: string;
    widgetId: string;
}
const FALLBACK_META: CatalogMetric = { key: "", label: "", short: "", kind: "base", format: "number", direction: "neutral", description: "", availableIn: [] };
export function metricMeta(catalog: Catalog | undefined, key: string): CatalogMetric {
    return catalog?.metrics.find((m) => m.key === key) ?? { ...FALLBACK_META, key, label: key, short: key };
}
export function shortLabel(catalog: Catalog | undefined, key: string): string {
    const m = metricMeta(catalog, key);
    return m.short && /^[A-Z%]{2,5}$/.test(m.short) ? m.short : m.label;
}
export function fmt(catalog: Catalog | undefined, key: string, v: number | null | undefined, money: MoneyLike, opts: {
    compact?: boolean;
    decimals?: number;
} = {}): string {
    return formatMetricValue(metricMeta(catalog, key).format as MetricFormat, v, { ...moneyOpts(money), compact: opts.compact ?? true, decimals: opts.decimals });
}
export function QueryState({ q, skeletonHeight = 160, children, emptyText = "No data for this selection." }: {
    q: ReturnType<typeof useQueryResult>;
    skeletonHeight?: number | string;
    children: (data: QueryResult) => React.ReactNode;
    emptyText?: string;
}) {
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <Skeleton height={skeletonHeight} className="w-full"/>;
    if (q.data.rows.length === 0 && !q.data.totals)
        return <InlineEmpty>{emptyText}</InlineEmpty>;
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex min-h-0 flex-1 flex-col">
      {children(q.data)}
    </Refetching>);
}
export function exploreHref(spec: QuerySpecInput, viz?: VizSettings): string {
    const q = btoa(unescape(encodeURIComponent(JSON.stringify(viz ? { spec, viz } : { spec }))));
    return `/explore?q=${encodeURIComponent(q)}`;
}
export function useQuestionMenu(spec: QuerySpecInput, title: string, viz?: VizSettings): MenuItem[] {
    const router = useRouter();
    return useMemo(() => [
        {
            label: "Download CSV",
            onSelect: () => void download("/api/query/export", { spec: { ...spec, limit: 10000 }, format: "csv", filename: title.toLowerCase().replace(/\s+/g, "-") }, "export.csv").catch(() => toast("Export failed", { tone: "crit" })),
        },
        {
            label: "Open in Explore",
            onSelect: () => router.push(exploreHref(spec, viz)),
        },
    ], [spec, title, viz, router]);
}
export function rowLabel(row: Record<string, unknown>, dim: string): string {
    const v = row[dim];
    return v === null || v === undefined ? "—" : String(v);
}
export function rowId(row: Record<string, unknown>, dim: string): string {
    const id = row[`${dim}_id`];
    return id === null || id === undefined ? rowLabel(row, dim) : String(id);
}
