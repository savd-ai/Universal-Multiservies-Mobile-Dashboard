"use client";
import { useMemo } from "react";
import { EChart } from "@/components/charts/echart";
import { axisLabel, baseOption, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import type { ChartTokens } from "@/components/charts/tokens";
import { useAnnotations, useQueryResult } from "@/lib/api/hooks";
import { formatShort } from "@/lib/domain/dates";
import type { MetricFormat } from "@/lib/domain/types";
import { fmt, metricMeta, QueryState, shortLabel, type VizProps } from "./shared";
export function tickIndices(n: number, count = 5): Set<number> {
    if (n <= count)
        return new Set(Array.from({ length: n }, (_, i) => i));
    return new Set(Array.from({ length: count }, (_, j) => Math.round(((n - 1) * j) / (count - 1))));
}
function LegendKey({ color, dashed, label, opacity = 1 }: {
    color: string;
    dashed?: boolean;
    label: string;
    opacity?: number;
}) {
    return (<span className="flex items-center gap-2">
      <span aria-hidden className="w-3.5" style={dashed ? { height: 0, borderTop: `1.5px dashed ${color}` } : { height: 2, background: color, opacity }}/>
      {label}
    </span>);
}
export function TrendMultiplesViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult({ ...spec, dimensions: ["date"], fillGaps: true, sort: [{ key: "date", dir: "asc" }] });
    const [top = "cost", bottom = "conversions", extra = "cpa"] = spec.metrics ?? [];
    const showCompare = spec.compare !== "none";
    const topMeta = metricMeta(catalog, top);
    const bottomMeta = metricMeta(catalog, bottom);
    const range = q.data?.meta.range;
    const ann = useAnnotations(range?.start ?? "", range?.end ?? "", { includeChanges: true, enabled: !!range });
    const marks = useMemo(() => {
        const m = new Map<string, {
            notes: number;
            texts: string[];
        }>();
        for (const a of ann.data ?? []) {
            const e = m.get(a.date) ?? { notes: 0, texts: [] };
            e.texts.push(a.source === "note" ? `Note: ${a.text}` : a.text);
            if (a.source === "note")
                e.notes++;
            m.set(a.date, e);
        }
        return m;
    }, [ann.data]);
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-[18px] text-xs text-muted">
        <LegendKey color="var(--accent)" label={topMeta.label}/>
        <LegendKey color="var(--mint)" opacity={0.85} label={bottomMeta.label}/>
        {showCompare ? <LegendKey color="var(--faint)" dashed label={`${topMeta.label}, ${spec.compare === "previous_year" ? "previous year" : "previous period"}`}/> : null}
        {marks.size ? (<span className="flex items-center gap-2">
            <span aria-hidden className="text-[9px] text-faint">◆</span>
            Changes &amp; notes
          </span>) : null}
      </div>
      <QueryState q={q} skeletonHeight="100%">
        {(data) => <TrendChart rows={data.rows} top={top} bottom={bottom} extra={extra} showCompare={showCompare} marks={marks} rt={rt} catalog={catalog} title={title}/>}
      </QueryState>
    </div>);
}
function TrendChart({ rows, top, bottom, extra, showCompare, marks, rt, catalog, title }: {
    rows: Record<string, unknown>[];
    top: string;
    bottom: string;
    extra: string;
    marks: Map<string, {
        notes: number;
        texts: string[];
    }>;
} & Pick<VizProps, "rt" | "catalog" | "title"> & {
    showCompare: boolean;
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const build = (t: ChartTokens) => {
        const dates = rows.map((r) => String(r.date));
        const ticks = tickIndices(dates.length);
        const num = (k: string) => rows.map((r) => (typeof r[k] === "number" ? (r[k] as number) : null));
        const topFmt = metricMeta(catalog, top).format as MetricFormat;
        const bottomFmt = metricMeta(catalog, bottom).format as MetricFormat;
        const xBase = { type: "category" as const, data: dates, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false } };
        const peak = Math.max(0, ...rows.map((x) => Math.max(typeof x[top] === "number" ? (x[top] as number) : 0, typeof x[`${top}__prev`] === "number" ? (x[`${top}__prev`] as number) : 0)));
        return {
            ...baseOption(t, reduced),
            grid: [
                { left: 48, right: 6, top: 6, height: "60%", containLabel: false },
                { left: 48, right: 6, top: "71%", bottom: 22, containLabel: false },
            ],
            axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } },
            xAxis: [
                { ...xBase, gridIndex: 0, axisLabel: { show: false }, axisPointer: { show: true, label: { show: false } } },
                {
                    ...xBase,
                    gridIndex: 1,
                    axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v), alignMinLabel: "left", alignMaxLabel: "right" },
                    axisPointer: { show: true, label: { show: false } },
                },
            ],
            yAxis: [
                valueAxis(t, topFmt, rt.money, { gridIndex: 0, splitNumber: 4 }),
                valueAxis(t, bottomFmt, rt.money, { gridIndex: 1, splitNumber: 2 }),
            ],
            tooltip: {
                ...baseOption(t, reduced).tooltip,
                trigger: "axis",
                formatter: (params: {
                    dataIndex: number;
                }[]) => {
                    const i = params[0]?.dataIndex ?? 0;
                    const r = rows[i] ?? {};
                    const tip: TipRow[] = [
                        { color: t.accentLine, label: metricMeta(catalog, top).label, value: fmt(catalog, top, r[top] as number, rt.money, { compact: false }) },
                        { color: t.mint, label: metricMeta(catalog, bottom).label, value: fmt(catalog, bottom, r[bottom] as number, rt.money, { compact: false }) },
                    ];
                    if (extra && r[extra] !== undefined)
                        tip.push({ label: shortLabel(catalog, extra), value: fmt(catalog, extra, r[extra] as number, rt.money, { compact: false }) });
                    if (showCompare && r[`${top}__prev`] !== undefined)
                        tip.push({ color: t.faint, dashed: true, label: `${metricMeta(catalog, top).label}, previous`, value: fmt(catalog, top, r[`${top}__prev`] as number, rt.money, { compact: false }) });
                    const m = marks.get(String(r.date));
                    if (m) {
                        for (const text of m.texts.slice(0, 4))
                            tip.push({ label: `◆ ${text.length > 48 ? `${text.slice(0, 47)}…` : text}`, value: "" });
                        if (m.texts.length > 4)
                            tip.push({ label: `+${m.texts.length - 4} more changes`, value: "" });
                    }
                    return tooltipHtml(formatShort(String(r.date ?? "")), tip);
                },
            },
            series: [
                {
                    name: `${metricMeta(catalog, top).label}, previous`,
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: showCompare ? num(`${top}__prev`) : [],
                    symbol: "none",
                    lineStyle: { color: t.faint, width: 1.25, type: [4, 4] },
                    silent: true,
                    z: 1,
                },
                {
                    name: metricMeta(catalog, top).label,
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: num(top),
                    symbol: "circle",
                    symbolSize: 9,
                    showSymbol: false,
                    lineStyle: { color: t.accentLine, width: 2 },
                    itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
                    emphasis: { scale: false, itemStyle: { shadowBlur: 0 } },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.26)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    z: 3,
                },
                {
                    name: "Changes & notes",
                    type: "scatter",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: rows.map((r) => {
                        const m = marks.get(String(r.date));
                        return m ? { value: peak * 1.06, itemStyle: { color: m.notes ? t.accent : t.faint } } : null;
                    }),
                    symbol: "diamond",
                    symbolSize: 7,
                    silent: true,
                    z: 4,
                },
                {
                    name: metricMeta(catalog, bottom).label,
                    type: "line",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: num(bottom),
                    symbol: "circle",
                    symbolSize: 8,
                    showSymbol: false,
                    lineStyle: { color: t.mint, width: 1.5, opacity: t.theme === "dark" ? 0.8 : 1 },
                    itemStyle: { color: t.mint, borderColor: t.surface, borderWidth: 2 },
                    z: 2,
                },
            ],
        };
    };
    return (<div className="relative min-h-[140px] flex-1 cursor-crosshair">
      <EChart className="absolute inset-0" build={build} deps={[rows, top, bottom, extra, showCompare, marks, rt.money, catalog]} ariaLabel={`${title}: daily ${metricMeta(catalog, top).label.toLowerCase()} and ${metricMeta(catalog, bottom).label.toLowerCase()}`}/>
    </div>);
}
