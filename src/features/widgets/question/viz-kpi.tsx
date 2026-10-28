"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Sparkline } from "@/components/ui/spark";
import { StatTile, TileGrid } from "@/components/ui/surfaces";
import { useQueryResult } from "@/lib/api/hooks";
import { deltaSentiment, formatDelta } from "@/lib/domain/metrics/registry";
import type { MetricDirection } from "@/lib/domain/types";
import { fmt, metricMeta, shortLabel, type VizProps } from "./shared";
const DELTA_CLASS = { good: "text-accent", bad: "text-crit", null: "text-muted" } as const;
export function KpiStripViz({ spec, rt, catalog }: VizProps) {
    const totals = useQueryResult({ ...spec, dimensions: [], sort: [], limit: undefined });
    const daily = useQueryResult({ ...spec, dimensions: ["date"], compare: "none", fillGaps: true, sort: [{ key: "date", dir: "asc" }], limit: undefined });
    const metrics = useMemo(() => spec.metrics ?? [], [spec.metrics]);
    const series = useMemo(() => {
        const rows = daily.data?.rows ?? [];
        return Object.fromEntries(metrics.map((m) => [m, rows.map((r) => (typeof r[m] === "number" ? (r[m] as number) : null))]));
    }, [daily.data, metrics]);
    const box = useRef<HTMLDivElement>(null);
    const cols = useTileColumns(box, metrics.length, metrics.length > 6 ? 125 : 135, !!totals.data);
    if (totals.error && !totals.data)
        return <ErrorState error={totals.error} onRetry={() => void totals.refetch()}/>;
    if (!totals.data)
        return <Skeleton height={104} className="w-full"/>;
    const t = totals.data.totals ?? {};
    const p = totals.data.compareTotals;
    const dimmed = totals.isFetching && totals.isPlaceholderData;
    const fillers = cols ? (cols - (metrics.length % cols)) % cols : 0;
    return (<div ref={box}>
      <TileGrid className={cn("transition-opacity", dimmed && "opacity-60")} min={metrics.length > 6 ? 130 : 150} {...(cols ? { style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } } : {})}>
        {metrics.map((m) => {
            const meta = metricMeta(catalog, m);
            const cur = t[m] ?? null;
            const prev = p?.[m] ?? null;
            const pct = cur !== null && prev !== null && prev !== 0 ? cur / prev - 1 : null;
            const sentiment = deltaSentiment(meta.direction as MetricDirection, pct);
            return (<StatTile key={m} label={shortLabel(catalog, m)} value={<span className="tabular">{fmt(catalog, m, cur, rt.money)}</span>}>
              <div className="flex items-center gap-2">
                {p ? <span className={cn("font-mono text-meta", DELTA_CLASS[sentiment ?? "null"])}>{formatDelta(pct)}</span> : null}
                <Sparkline values={series[m] ?? []} color={sentiment === "bad" ? "var(--crit)" : "var(--accent)"} className="flex-1"/>
              </div>
            </StatTile>);
        })}
        {Array.from({ length: fillers }, (_, i) => (<div key={`f${i}`} className="bg-surface" aria-hidden/>))}
      </TileGrid>
    </div>);
}
function useTileColumns(ref: React.RefObject<HTMLDivElement | null>, n: number, min: number, ready: boolean): number | null {
    const [cols, setCols] = useState<number | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const measure = () => {
            const fit = Math.max(1, Math.min(n, Math.floor((el.clientWidth + 1) / (min + 1))));
            let c = fit;
            if (fit < n)
                for (let k = fit; k >= Math.ceil(fit / 2); k--)
                    if (n % k === 0) {
                        c = k;
                        break;
                    }
            setCols(c);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref, n, min, ready]);
    return cols;
}
export function NumberViz({ spec, rt, catalog, viz }: VizProps) {
    const q = useQueryResult({ ...spec, dimensions: [], sort: [], limit: undefined });
    const m = spec.metrics?.[0] ?? "cost";
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <Skeleton height={80} className="w-full"/>;
    const meta = metricMeta(catalog, m);
    const cur = q.data.totals?.[m] ?? null;
    const prev = q.data.compareTotals?.[m] ?? null;
    const pct = cur !== null && prev !== null && prev !== 0 ? cur / prev - 1 : null;
    const sentiment = deltaSentiment(meta.direction as MetricDirection, pct);
    const goal = typeof viz.goal === "number" ? viz.goal : null;
    return (<div className="flex flex-1 flex-col justify-center gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[52px] leading-none font-semibold tracking-[-0.03em] tabular">{fmt(catalog, m, cur, rt.money)}</span>
        {q.data.compareTotals ? <span className={cn("font-mono text-meta", DELTA_CLASS[sentiment ?? "null"])}>{formatDelta(pct)}</span> : null}
      </div>
      <span className="text-[13px] text-muted-3">
        {meta.label}
        {goal !== null ? ` · goal ${fmt(catalog, m, goal, rt.money)} (${cur !== null ? Math.round((cur / goal) * 100) : 0}%)` : ""}
      </span>
    </div>);
}
