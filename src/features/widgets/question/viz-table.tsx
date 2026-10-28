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
const DELTA_CLASS = { good: "text-accent", bad: "text-crit", null: "text-faint" } as const;
const MAX_ROWS = 200;
export function TableViz({ spec, rt, catalog, title, viz }: VizProps) {
    const q = useQueryResult(spec);
    const dims = spec.dimensions ?? [];
    const metrics = spec.metrics ?? [];
    const [sort, setSort] = useState<{
        key: string;
        dir: 1 | -1;
    } | null>(null);
    const comparing = !!spec.compare && spec.compare !== "none";
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => <Table rows={data.rows} totals={data.totals} dims={dims} metrics={metrics} comparing={comparing} sort={sort} setSort={setSort} rt={rt} catalog={catalog} title={title} dense={viz.type === "geo-table"}/>}
    </QueryState>);
}
function Table({ rows, totals, dims, metrics, comparing, sort, setSort, rt, catalog, title, dense }: {
    rows: QueryRow[];
    totals?: Record<string, number | null>;
    dims: string[];
    metrics: string[];
    comparing: boolean;
    sort: {
        key: string;
        dir: 1 | -1;
    } | null;
    setSort: (s: {
        key: string;
        dir: 1 | -1;
    } | null) => void;
    dense?: boolean;
} & Pick<VizProps, "rt" | "catalog" | "title">) {
    const sorted = useMemo(() => {
        if (!sort)
            return rows.slice(0, MAX_ROWS);
        return [...rows]
            .sort((a, b) => {
            const x = a[sort.key];
            const y = b[sort.key];
            if (typeof x === "number" && typeof y === "number")
                return (x - y) * sort.dir;
            return String(x ?? "").localeCompare(String(y ?? "")) * sort.dir;
        })
            .slice(0, MAX_ROWS);
    }, [rows, sort]);
    const cols = [...dims.map((d) => ({ key: d, label: catalog.dimensions.find((x) => x.key === d)?.label ?? d, metric: false })), ...metrics.map((m) => ({ key: m, label: metricMeta(catalog, m).short || metricMeta(catalog, m).label, metric: true }))];
    const template = `${dims.map(() => "minmax(160px, 2.2fr)").join(" ")} ${metrics.map(() => "minmax(78px, 1fr)").join(" ")}`;
    const clickDim = (row: QueryRow, dim: string) => {
        if (dim === "campaign")
            rt.openCampaign(rowId(row, "campaign"));
        else if (!["date", "week", "month", "quarter", "year", "hour", "dow"].includes(dim))
            rt.toggleCrossFilter(dim, rowLabel(row, dim));
    };
    return (<div className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1" role="region" aria-label={`${title} table`} tabIndex={0}>
      <div role="table" className="flex min-w-max flex-col text-[13px] tabular" style={{ minWidth: "100%" }}>
        <div role="row" className="sticky top-0 z-[1] grid gap-3 border-b border-line bg-surface/0 px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase backdrop-blur-[2px]" style={{ gridTemplateColumns: template }}>
          {cols.map((c) => {
            const active = sort?.key === c.key;
            return (<button key={c.key} type="button" role="columnheader" aria-sort={active ? (sort?.dir === 1 ? "ascending" : "descending") : "none"} onClick={() => setSort(active && sort?.dir === -1 ? { key: c.key, dir: 1 } : active ? null : { key: c.key, dir: -1 })} className={cn("truncate text-left uppercase hover:text-fg", c.metric && "text-right", active && "text-fg")}>
                {c.label}
                {active ? (sort?.dir === -1 ? " ↓" : " ↑") : ""}
              </button>);
        })}
        </div>
        {sorted.map((r, i) => (<div key={i} role="row" className={cn("grid items-center gap-3 border-b border-line-soft px-1 hover:bg-fill", dense ? "py-2" : "py-2.5")} style={{ gridTemplateColumns: template }}>
            {dims.map((d) => {
                const label = d === "date" ? formatShort(rowLabel(r, d)) : rowLabel(r, d);
                const clickable = d !== "date" && d !== "hour" && d !== "dow";
                return (<span key={d} role="cell" className="min-w-0 truncate">
                  {clickable ? (<button type="button" onClick={() => clickDim(r, d)} className="flex min-w-0 max-w-full text-left font-medium text-fg hover:text-accent" title={label}>
                      <MiddleTruncate text={label}/>
                    </button>) : (<span className="text-muted">{label}</span>)}
                </span>);
            })}
            {metrics.map((m) => {
                const v = r[m] as number | null;
                const pct = r[`${m}__pct`] as number | null | undefined;
                const s = deltaSentiment(metricMeta(catalog, m).direction as MetricDirection, pct ?? null);
                return (<span key={m} role="cell" className="flex flex-col items-end leading-tight">
                  <span>{fmt(catalog, m, v, rt.money)}</span>
                  {comparing && pct !== undefined ? <span className={cn("font-mono text-[10px]", DELTA_CLASS[s ?? "null"])}>{formatDelta(pct)}</span> : null}
                </span>);
            })}
          </div>))}
        {totals && rows.length > 1 ? (<div role="row" className="grid items-center gap-3 px-1 pt-2.5 font-semibold" style={{ gridTemplateColumns: template }}>
            {dims.map((d, i) => (<span key={d} role="cell" className="font-mono text-micro tracking-label text-faint uppercase">
                {i === 0 ? `Total · ${rows.length}` : ""}
              </span>))}
            {metrics.map((m) => (<span key={m} role="cell" className="text-right">
                {fmt(catalog, m, totals[m] ?? null, rt.money)}
              </span>))}
          </div>) : null}
        {rows.length > MAX_ROWS ? <div className="px-1 pt-2 text-xs text-faint">Showing the first {MAX_ROWS} of {rows.length} rows — download CSV for all.</div> : null}
      </div>
    </div>);
}
