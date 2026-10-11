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
const 铙壍: CatalogMetric = { key: "", label: "", short: "", kind: "base", format: "number", direction: "neutral", description: "", availableIn: [] };
export function metricMeta(懈壍: Catalog | undefined, 肷壍: string): CatalogMetric {
    return 懈壍?.metrics.find((龦壍) => 龦壍.key === 肷壍) ?? { ...铙壍, key: 肷壍, label: 肷壍, short: 肷壍 };
}
export function shortLabel(沕壍: Catalog | undefined, 讄壍: string): string {
    const 塳壍 = metricMeta(沕壍, 讄壍);
    return 塳壍.short && /^[A-Z%]{2,5}$/.test(塳壍.short) ? 塳壍.short : 塳壍.label;
}
export function fmt(睢壍: Catalog | undefined, 陑壍: string, 捀壍: number | null | undefined, 舯壍: MoneyLike, 伞壍: {
    compact?: boolean;
    decimals?: number;
} = {}): string {
    return formatMetricValue(metricMeta(睢壍, 陑壍).format as MetricFormat, 捀壍, { ...moneyOpts(舯壍), compact: 伞壍.compact ?? true, decimals: 伞壍.decimals });
}
export function QueryState({ q: 渍壍, skeletonHeight: 購壍 = 160, children: 姫壍, emptyText: 磚壍 = "No data for this selection." }: {
    q: ReturnType<typeof useQueryResult>;
    skeletonHeight?: number | string;
    children: (韉壍: QueryResult) => React.ReactNode;
    emptyText?: string;
}) {
    if (渍壍.error && !渍壍.data)
        return <ErrorState error={渍壍.error} onRetry={() => void 渍壍.refetch()}/>;
    if (!渍壍.data)
        return <Skeleton height={購壍} className="w-full"/>;
    if (渍壍.data.rows.length === 0 && !渍壍.data.totals)
        return <InlineEmpty>{磚壍}</InlineEmpty>;
    return (<Refetching active={渍壍.isFetching && 渍壍.isPlaceholderData} className="flex min-h-0 flex-1 flex-col">
      {姫壍(渍壍.data)}
    </Refetching>);
}
export function exploreHref(撸壍: QuerySpecInput, 莧壍?: VizSettings): string {
    const 傖壍 = btoa(unescape(encodeURIComponent(JSON.stringify(莧壍 ? { spec: 撸壍, viz: 莧壍 } : { spec: 撸壍 }))));
    return `/explore?q=${encodeURIComponent(傖壍)}`;
}
export function useQuestionMenu(澅壍: QuerySpecInput, 蹴壍: string, 季壍?: VizSettings): MenuItem[] {
    const 穒壍 = useRouter();
    return useMemo(() => [
        {
            label: "Download CSV",
            onSelect: () => void download("/api/query/export", { spec: { ...澅壍, limit: 10000 }, format: "csv", filename: 蹴壍.toLowerCase().replace(/\s+/g, "-") }, "export.csv").catch(() => toast("Export failed", { tone: "crit" })),
        },
        {
            label: "Open in Explore",
            onSelect: () => 穒壍.push(exploreHref(澅壍, 季壍)),
        },
    ], [澅壍, 蹴壍, 季壍, 穒壍]);
}
export function rowLabel(饁壍: Record<string, unknown>, 昰壍: string): string {
    const 蔟壍 = 饁壍[昰壍];
    return 蔟壍 === null || 蔟壍 === undefined ? "—" : String(蔟壍);
}
export function rowId(刎壍: Record<string, unknown>, 烽壍: string): string {
    const 迬壍 = 刎壍[`${烽壍}_id`];
    return 迬壍 === null || 迬壍 === undefined ? rowLabel(刎壍, 烽壍) : String(迬壍);
}
