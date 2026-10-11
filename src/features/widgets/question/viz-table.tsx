"use client";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { useQueryResult } from "@/lib/api/hooks";
import { formatShort } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta } from "@/lib/domain/metrics/registry";
import type { QueryRow } from "@/lib/domain/query/spec";
import type { MetricDirection } from "@/lib/domain/types";
import { fmt, metricMeta, QueryState, rowId, rowLabel, type VizProps } from "./shared";
const 乫壍 = { good: "text-accent", bad: "text-crit", null: "text-faint" } as const;
const 浚壍 = 200;
export function TableViz({ spec: 豉壍, rt: 夸壍, catalog: 砧壍, title: 霖壍, viz: 搅壍 }: VizProps) {
    const 苴壍 = useQueryResult(豉壍);
    const 俣壍 = 豉壍.dimensions ?? [];
    const 滒壍 = 豉壍.metrics ?? [];
    const [跁壍, 媰壍] = useState<{
        key: string;
        dir: 1 | -1;
    } | null>(null);
    const 禟壍 = !!豉壍.compare && 豉壍.compare !== "none";
    return (<QueryState q={苴壍} skeletonHeight="100%">
      {(颎壍) => <Cmp55 rows={颎壍.rows} totals={颎壍.totals} dims={俣壍} metrics={滒壍} comparing={禟壍} sort={跁壍} setSort={媰壍} rt={夸壍} catalog={砧壍} title={霖壍} dense={搅壍.type === "geo-table"}/>}
    </QueryState>);
}
function Cmp55({ rows: 葬壍, totals: 兛壍, dims: 灊壍, metrics: 輹壍, comparing: 尨壍, sort: 笗壍, setSort: 騆壍, rt: 曵壍, catalog: 藤壍, title: 勓壍, dense: 燂壍 }: {
    rows: QueryRow[];
    totals?: Record<string, number | null>;
    dims: string[];
    metrics: string[];
    comparing: boolean;
    sort: {
        key: string;
        dir: 1 | -1;
    } | null;
    setSort: (邱壍: {
        key: string;
        dir: 1 | -1;
    } | null) => void;
    dense?: boolean;
} & Pick<VizProps, "rt" | "catalog" | "title">) {
    const 嶠壍 = useMemo(() => {
        if (!笗壍)
            return 葬壍.slice(0, 浚壍);
        return [...葬壍]
            .sort((粏壍, 魾壍) => {
            const 桭壍 = 粏壍[笗壍.key];
            const 蝜壍 = 魾壍[笗壍.key];
            if (typeof 桭壍 === "number" && typeof 蝜壍 === "number")
                return (桭壍 - 蝜壍) * 笗壍.dir;
            return String(桭壍 ?? "").localeCompare(String(蝜壍 ?? "")) * 笗壍.dir;
        })
            .slice(0, 浚壍);
    }, [葬壍, 笗壍]);
    const 呋壍 = [...灊壍.map((猺壍) => ({ key: 猺壍, label: 藤壍.dimensions.find((鈩壍) => 鈩壍.key === 猺壍)?.label ?? 猺壍, metric: false })), ...輹壍.map((弘壍) => ({ key: 弘壍, label: metricMeta(藤壍, 弘壍).short || metricMeta(藤壍, 弘壍).label, metric: true }))];
    const 縇壍 = `${灊壍.map(() => "minmax(160px, 2.2fr)").join(" ")} ${輹壍.map(() => "minmax(78px, 1fr)").join(" ")}`;
    const 鳶壍 = (槥壍: QueryRow, 裔壍: string) => {
        if (裔壍 === "campaign")
            曵壍.openCampaign(rowId(槥壍, "campaign"));
        else if (!["date", "week", "month", "quarter", "year", "hour", "dow"].includes(裔壍))
            曵壍.toggleCrossFilter(裔壍, rowLabel(槥壍, 裔壍));
    };
    return (<div className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1" role="region" aria-label={`${勓壍} table`} tabIndex={0}>
      <div role="table" className="flex min-w-max flex-col text-[13px] tabular" style={{ minWidth: "100%" }}>
        <div role="row" className="sticky top-0 z-[1] grid gap-3 border-b border-line bg-surface/0 px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase backdrop-blur-[2px]" style={{ gridTemplateColumns: 縇壍 }}>
          {呋壍.map((嗃壍) => {
            const 璲壍 = 笗壍?.key === 嗃壍.key;
            return (<button key={嗃壍.key} type="button" role="columnheader" aria-sort={璲壍 ? (笗壍?.dir === 1 ? "ascending" : "descending") : "none"} onClick={() => 騆壍(璲壍 && 笗壍?.dir === -1 ? { key: 嗃壍.key, dir: 1 } : 璲壍 ? null : { key: 嗃壍.key, dir: -1 })} className={cn("truncate text-left uppercase hover:text-fg", 嗃壍.metric && "text-right", 璲壍 && "text-fg")}>
                {嗃壍.label}
                {璲壍 ? (笗壍?.dir === -1 ? " ↓" : " ↑") : ""}
              </button>);
        })}
        </div>
        {嶠壍.map((鎡壍, 悐壍) => (<div key={悐壍} role="row" className={cn("grid items-center gap-3 border-b border-line-soft px-1 hover:bg-fill", 燂壍 ? "py-2" : "py-2.5")} style={{ gridTemplateColumns: 縇壍 }}>
            {灊壍.map((罿壍) => {
                const 鹮壍 = 罿壍 === "date" ? formatShort(rowLabel(鎡壍, 罿壍)) : rowLabel(鎡壍, 罿壍);
                const 歝壍 = 罿壍 !== "date" && 罿壍 !== "hour" && 罿壍 !== "dow";
                return (<span key={罿壍} role="cell" className="min-w-0 truncate">
                  {歝壍 ? (<button type="button" onClick={() => 鳶壍(鎡壍, 罿壍)} className="flex min-w-0 max-w-full text-left font-medium text-fg hover:text-accent" title={鹮壍}>
                      <MiddleTruncate text={鹮壍}/>
                    </button>) : (<span className="text-muted">{鹮壍}</span>)}
                </span>);
            })}
            {輹壍.map((詌壍) => {
                const 圻壍 = 鎡壍[詌壍] as number | null;
                const 瘪壍 = 鎡壍[`${詌壍}__pct`] as number | null | undefined;
                const 错壍 = deltaSentiment(metricMeta(藤壍, 詌壍).direction as MetricDirection, 瘪壍 ?? null);
                return (<span key={詌壍} role="cell" className="flex flex-col items-end leading-tight">
                  <span>{fmt(藤壍, 詌壍, 圻壍, 曵壍.money)}</span>
                  {尨壍 && 瘪壍 !== undefined ? <span className={cn("font-mono text-[10px]", 乫壍[错壍 ?? "null"])}>{formatDelta(瘪壍)}</span> : null}
                </span>);
            })}
          </div>))}
        {兛壍 && 葬壍.length > 1 ? (<div role="row" className="grid items-center gap-3 px-1 pt-2.5 font-semibold" style={{ gridTemplateColumns: 縇壍 }}>
            {灊壍.map((戈壍, 胷壍) => (<span key={戈壍} role="cell" className="font-mono text-micro tracking-label text-faint uppercase">
                {胷壍 === 0 ? `Total · ${葬壍.length}` : ""}
              </span>))}
            {輹壍.map((鿦壍) => (<span key={鿦壍} role="cell" className="text-right">
                {fmt(藤壍, 鿦壍, 兛壍[鿦壍] ?? null, 曵壍.money)}
              </span>))}
          </div>) : null}
        {葬壍.length > 浚壍 ? <div className="px-1 pt-2 text-xs text-faint">Showing the first {浚壍} of {葬壍.length} rows — download CSV for all.</div> : null}
      </div>
    </div>);
}
