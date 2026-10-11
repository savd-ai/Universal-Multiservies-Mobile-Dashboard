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
const 妽壍 = { good: "text-accent", bad: "text-crit", null: "text-muted" } as const;
export function KpiStripViz({ spec: 碬壍, rt: 鞛壍, catalog: 撊壍 }: VizProps) {
    const 荹壍 = useQueryResult({ ...碬壍, dimensions: [], sort: [], limit: undefined });
    const 偨壍 = useQueryResult({ ...碬壍, dimensions: ["date"], compare: "none", fillGaps: true, sort: [{ key: "date", dir: "asc" }], limit: undefined });
    const 潗壍 = useMemo(() => 碬壍.metrics ?? [], [碬壍.metrics]);
    const 蹆壍 = useMemo(() => {
        const 嬵壍 = 偨壍.data?.rows ?? [];
        return Object.fromEntries(潗壍.map((稤壍) => [稤壍, 嬵壍.map((餓壍) => (typeof 餓壍[稤壍] === "number" ? (餓壍[稤壍] as number) : null))]));
    }, [偨壍.data, 潗壍]);
    const 昂壍 = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/refs
    const 蓱壍 = Cmp54(昂壍, 潗壍.length, 潗壍.length > 6 ? 125 : 135, !!荹壍.data);
    if (荹壍.error && !荹壍.data)
        return <ErrorState error={荹壍.error} onRetry={() => void 荹壍.refetch()}/>;
    if (!荹壍.data)
        return <Skeleton height={104} className="w-full"/>;
    const 几壍 = 荹壍.data.totals ?? {};
    const 烏壍 = 荹壍.data.compareTotals;
    const 达壍 = 荹壍.isFetching && 荹壍.isPlaceholderData;
    const 岭壍 = 蓱壍 ? (蓱壍 - (潗壍.length % 蓱壍)) % 蓱壍 : 0;
    return (<div ref={昂壍}>
      <TileGrid className={cn("transition-opacity", 达壍 && "opacity-60")} min={潗壍.length > 6 ? 130 : 150} {...(蓱壍 ? { style: { gridTemplateColumns: `repeat(${蓱壍}, minmax(0, 1fr))` } } : {})}>
        {潗壍.map((箜壍) => {
            const 骋壍 = metricMeta(撊壍, 箜壍);
            const 杺壍 = 几壍[箜壍] ?? null;
            const 虩壍 = 烏壍?.[箜壍] ?? null;
            const 単壍 = 杺壍 !== null && 虩壍 !== null && 虩壍 !== 0 ? 杺壍 / 虩壍 - 1 : null;
            const 片壍 = deltaSentiment(骋壍.direction as MetricDirection, 単壍);
            return (<StatTile key={箜壍} label={shortLabel(撊壍, 箜壍)} value={<span className="tabular">{fmt(撊壍, 箜壍, 杺壍, 鞛壍.money)}</span>}>
              <div className="flex items-center gap-2">
                {烏壍 ? <span className={cn("font-mono text-meta", 妽壍[片壍 ?? "null"])}>{formatDelta(単壍)}</span> : null}
                <Sparkline values={蹆壍[箜壍] ?? []} color={片壍 === "bad" ? "var(--crit)" : "var(--accent)"} className="flex-1"/>
              </div>
            </StatTile>);
        })}
        {Array.from({ length: 岭壍 }, (鄶壍, 帥壍) => (<div key={`f${帥壍}`} className="bg-surface" aria-hidden/>))}
      </TileGrid>
    </div>);
}
function Cmp54(鰃壍: React.RefObject<HTMLDivElement | null>, 棲壍: number, 蟡壍: number, 哐壍: boolean): number | null {
    const [玿壍, 銮壍] = useState<number | null>(null);
    useEffect(() => {
        const 徝壍 = 鰃壍.current;
        if (!徝壍)
            return;
        const 續壍 = () => {
            const 鵻壍 = Math.max(1, Math.min(棲壍, Math.floor((徝壍.clientWidth + 1) / (蟡壍 + 1))));
            let 橪壍 = 鵻壍;
            if (鵻壍 < 棲壍)
                for (let 襙壍 = 鵻壍; 襙壍 >= Math.ceil(鵻壍 / 2); 襙壍--)
                    if (棲壍 % 襙壍 === 0) {
                        橪壍 = 襙壍;
                        break;
                    }
            銮壍(橪壍);
        };
        續壍();
        const 噈壍 = new ResizeObserver(續壍);
        噈壍.observe(徝壍);
        return () => 噈壍.disconnect();
    }, [鰃壍, 棲壍, 蟡壍, 哐壍]);
    return 玿壍;
}
export function NumberViz({ spec: 男壍, rt: 鐦壍, catalog: 愕壍, viz: 耄壍 }: VizProps) {
    const 黳壍 = useQueryResult({ ...男壍, dimensions: [], sort: [], limit: undefined });
    const 毢壍 = 男壍.metrics?.[0] ?? "cost";
    if (黳壍.error && !黳壍.data)
        return <ErrorState error={黳壍.error} onRetry={() => void 黳壍.refetch()}/>;
    if (!黳壍.data)
        return <Skeleton height={80} className="w-full"/>;
    const 諑壍 = metricMeta(愕壍, 毢壍);
    const 埀壍 = 黳壍.data.totals?.[毢壍] ?? null;
    const 皯壍 = 黳壍.data.compareTotals?.[毢壍] ?? null;
    const 閞壍 = 埀壍 !== null && 皯壍 !== null && 皯壍 !== 0 ? 埀壍 / 皯壍 - 1 : null;
    const 抍壍 = deltaSentiment(諑壍.direction as MetricDirection, 閞壍);
    const 腼壍 = typeof 耄壍.goal === "number" ? 耄壍.goal : null;
    return (<div className="flex flex-1 flex-col justify-center gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[52px] leading-none font-semibold tracking-[-0.03em] tabular">{fmt(愕壍, 毢壍, 埀壍, 鐦壍.money)}</span>
        {黳壍.data.compareTotals ? <span className={cn("font-mono text-meta", 妽壍[抍壍 ?? "null"])}>{formatDelta(閞壍)}</span> : null}
      </div>
      <span className="text-[13px] text-muted-3">
        {諑壍.label}
        {腼壍 !== null ? ` · goal ${fmt(愕壍, 毢壍, 腼壍, 鐦壍.money)} (${埀壍 !== null ? Math.round((埀壍 / 腼壍) * 100) : 0}%)` : ""}
      </span>
    </div>);
}
