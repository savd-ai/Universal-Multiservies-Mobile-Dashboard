"use client";
import { useMemo } from "react";
import { axisLabel, baseOption, categoryAxis, escapeHtml, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import { colorFor, ordinalRamp, sequentialRamp } from "@/components/charts/palette";
import type { ChartTokens } from "@/components/charts/tokens";
import { middleEllipsis } from "@/components/ui/middle-truncate";
import { useQueryResult } from "@/lib/api/hooks";
import { formatShort } from "@/lib/domain/dates";
import type { QueryResult } from "@/lib/domain/query/spec";
import type { MetricFormat } from "@/lib/domain/types";
import { tickIndices } from "./viz-trend";
import { fmt, metricMeta, QueryState, rowId, rowLabel, type VizProps } from "./shared";
const TIME_DIMS = new Set(["date", "week", "month", "quarter", "year"]);
const MAX_SERIES = 6;
function HtmlLegend({ items }: {
    items: {
        label: string;
        color: string;
    }[];
}) {
    if (items.length < 2)
        return null;
    return (<div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
      {items.map((it) => (<span key={it.label} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }}/>
          {it.label}
        </span>))}
    </div>);
}
function ChartBox({ children }: {
    children: React.ReactNode;
}) {
    return <div className="relative min-h-[120px] flex-1">{children}</div>;
}
function timeLabel(dim: string, v: string): string {
    if (dim === "date" || dim === "week")
        return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatShort(v) : v;
    return v;
}
function pivotSeries(rows: QueryResult["rows"], timeDim: string, seriesDim: string, metric: string) {
    const times: string[] = [];
    const seen = new Set<string>();
    const totals = new Map<string, number>();
    for (const r of rows) {
        const tv = String(r[timeDim]);
        if (!seen.has(tv)) {
            seen.add(tv);
            times.push(tv);
        }
        const s = rowLabel(r, seriesDim);
        totals.set(s, (totals.get(s) ?? 0) + (typeof r[metric] === "number" ? (r[metric] as number) : 0));
    }
    times.sort();
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const keep = ranked.slice(0, ranked.length > MAX_SERIES ? MAX_SERIES - 1 : MAX_SERIES);
    const hasOther = ranked.length > keep.length;
    const idx = new Map(times.map((t, i) => [t, i]));
    const data = new Map<string, (number | null)[]>([...keep, ...(hasOther ? ["Other"] : [])].map((k) => [k, times.map(() => null)]));
    for (const r of rows) {
        const s = rowLabel(r, seriesDim);
        const key = keep.includes(s) ? s : "Other";
        const arr = data.get(key);
        const i = idx.get(String(r[timeDim]));
        if (!arr || i === undefined)
            continue;
        const v = typeof r[metric] === "number" ? (r[metric] as number) : 0;
        arr[i] = (arr[i] ?? 0) + v;
    }
    return { times, series: [...data.entries()].map(([name, values]) => ({ name, values })) };
}
type Slot = number | "accent" | "faint" | "other";
const slotColor = (t: ChartTokens, s: Slot) => (s === "accent" ? t.accentLine : s === "faint" ? t.faint : s === "other" ? t.other : (t.series[s % 6] ?? t.other));
const slotCss = (s: Slot) => (s === "accent" ? "var(--accent-line)" : s === "faint" ? "var(--faint)" : s === "other" ? "var(--series-other)" : `var(--series-${(s % 6) + 1})`);
interface Line {
    name: string;
    key: string;
    values: (number | null)[];
    slot: Slot;
    dashed?: boolean;
}
export function LineViz(props: VizProps & {
    area?: boolean;
}) {
    const { spec, rt, catalog, title, area } = props;
    const q = useQueryResult(spec);
    const dims = spec.dimensions ?? [];
    const timeDim = dims.find((d) => TIME_DIMS.has(d)) ?? dims[0] ?? "date";
    const seriesDim = dims.find((d) => d !== timeDim);
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const metrics = spec.metrics ?? [];
            type Panel = {
                format: MetricFormat;
                lines: Line[];
            };
            let times: string[];
            let panels: Panel[];
            if (seriesDim) {
                const m = metrics[0] ?? "cost";
                const p = pivotSeries(data.rows, timeDim, seriesDim, m);
                times = p.times;
                panels = [{ format: metricMeta(catalog, m).format as MetricFormat, lines: p.series.map((s, i) => ({ name: s.name, key: m, values: s.values, slot: s.name === "Other" ? "other" : colorSlot(seriesDim, s.name, i) })) }];
            }
            else {
                const rows = [...data.rows].sort((a, b) => String(a[timeDim]).localeCompare(String(b[timeDim])));
                times = rows.map((r) => String(r[timeDim]));
                const byFormat = new Map<MetricFormat, Panel>();
                const values = (k: string) => rows.map((r) => (typeof r[k] === "number" ? (r[k] as number) : null));
                for (const m of metrics) {
                    const f = metricMeta(catalog, m).format as MetricFormat;
                    const panel = byFormat.get(f) ?? { format: f, lines: [] };
                    byFormat.set(f, panel);
                    panel.lines.push({ name: metricMeta(catalog, m).label, key: m, values: values(m), slot: panel.lines.length });
                    if (spec.compare && spec.compare !== "none" && metrics.length === 1)
                        panel.lines.push({ name: `${metricMeta(catalog, m).label}, previous`, key: `${m}__prev`, dashed: true, values: values(`${m}__prev`), slot: "faint" });
                }
                panels = [...byFormat.values()];
                for (const p of panels)
                    if (p.lines.filter((l) => !l.dashed).length === 1)
                        for (const l of p.lines)
                            if (!l.dashed)
                                l.slot = "accent";
            }
            const flat = panels.flatMap((p) => p.lines);
            const legendItems = flat.filter((l) => !l.dashed).map((l) => ({ label: l.name, color: slotCss(l.slot) }));
            const build = (t: ChartTokens) => {
                const ticks = tickIndices(times.length);
                const n = panels.length;
                const grids = panels.map((_, i) => ({ left: 52, right: 8, top: `${(i * 100) / n + 2}%`, height: `${100 / n - (n > 1 ? 10 : 12)}%` }));
                const series = panels.flatMap((p, pi) => p.lines.map((l) => {
                    const color = slotColor(t, l.slot);
                    const single = p.lines.filter((x) => !x.dashed).length === 1;
                    return {
                        name: l.name,
                        type: "line",
                        xAxisIndex: pi,
                        yAxisIndex: pi,
                        data: l.values,
                        symbol: "circle",
                        symbolSize: 8,
                        showSymbol: false,
                        lineStyle: { color, width: l.dashed ? 1.25 : 2, type: l.dashed ? [4, 4] : "solid" },
                        itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
                        areaStyle: area && !l.dashed ? (single && !seriesDim ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } } : { color, opacity: 0.16 }) : undefined,
                        stack: area && seriesDim ? "total" : undefined,
                    };
                }));
                return {
                    ...baseOption(t, reduced),
                    grid: grids,
                    axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.line } },
                    xAxis: panels.map((_, i) => ({
                        type: "category",
                        data: times,
                        gridIndex: i,
                        boundaryGap: false,
                        axisLine: { show: false },
                        axisTick: { show: false },
                        axisLabel: i === n - 1 ? { ...axisLabel(t), interval: (k: number) => ticks.has(k), formatter: (v: string) => timeLabel(timeDim, v) } : { show: false },
                    })),
                    yAxis: panels.map((p, i) => valueAxis(t, p.format, rt.money, { gridIndex: i, splitNumber: n > 1 ? 2 : 4 })),
                    tooltip: {
                        ...baseOption(t, reduced).tooltip,
                        trigger: "axis",
                        formatter: (params: {
                            seriesIndex: number;
                            dataIndex: number;
                            value: number | null;
                        }[]) => {
                            const i = params[0]?.dataIndex ?? 0;
                            const rows: TipRow[] = params
                                .map((pt) => {
                                const line = flat[pt.seriesIndex];
                                if (!line)
                                    return null;
                                return { color: slotColor(t, line.slot), dashed: line.dashed, label: line.name, value: fmt(catalog, line.key.replace("__prev", ""), pt.value, rt.money, { compact: false }) } as TipRow;
                            })
                                .filter((r): r is TipRow => !!r);
                            return tooltipHtml(timeLabel(timeDim, times[i] ?? ""), rows);
                        },
                    },
                    series,
                };
            };
            return (<div className="flex min-h-0 flex-1 flex-col gap-3">
            <HtmlLegend items={legendItems}/>
            <ChartBox>
              <EChart className="absolute inset-0" build={build} deps={[data, area, seriesDim, rt.money, catalog]} ariaLabel={`${title}: line chart`}/>
            </ChartBox>
          </div>);
        }}
    </QueryState>);
}
const TYPE_ORDER = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
const PLATFORM_ORDER = ["Google Ads", "Meta Ads", "Microsoft Advertising", "TikTok Ads", "LinkedIn Ads"];
const DEVICE_ORDER = ["Mobile", "Desktop", "Tablet", "Connected TV", "Other"];
function colorSlot(dim: string, value: string, index: number): number {
    const order = dim === "campaign_type" ? TYPE_ORDER : dim === "platform" ? PLATFORM_ORDER : dim === "device" ? DEVICE_ORDER : null;
    const i = order ? order.indexOf(value) : -1;
    return i >= 0 ? i : index;
}
export function BarViz({ spec, rt, catalog, title, viz }: VizProps) {
    const q = useQueryResult(spec);
    const dim = spec.dimensions?.[0] ?? "campaign_type";
    const [metric = "cost", secondary] = spec.metrics ?? [];
    const horizontal = viz.horizontal ?? !TIME_DIMS.has(dim);
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const identity = dim === "campaign_type" || dim === "platform" || dim === "device";
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const rows = TIME_DIMS.has(dim) ? [...data.rows].sort((a, b) => String(a[dim]).localeCompare(String(b[dim]))) : data.rows.slice(0, 24);
            const labels = rows.map((r) => (TIME_DIMS.has(dim) ? timeLabel(dim, rowLabel(r, dim)) : rowLabel(r, dim)));
            const total = rows.reduce((s, r) => s + (typeof r[metric] === "number" ? (r[metric] as number) : 0), 0);
            const build = (t: ChartTokens) => {
                const values = rows.map((r, i) => ({
                    value: typeof r[metric] === "number" ? (r[metric] as number) : 0,
                    itemStyle: { color: identity ? colorFor(dim, rowLabel(r, dim), i, t) : t.accentLine, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
                }));
                const cat = categoryAxis(t, horizontal ? [...labels].reverse() : labels, horizontal ? { axisLabel: { ...axisLabel(t), fontFamily: t.fontSans, fontSize: 12, color: t.muted, width: 120, overflow: "truncate", formatter: (v: string) => middleEllipsis(v, 20) } } : {});
                const val = valueAxis(t, metricMeta(catalog, metric).format as MetricFormat, rt.money, { splitNumber: 4 });
                return {
                    ...baseOption(t, reduced),
                    grid: horizontal ? { left: 8, right: secondary ? 88 : 56, top: 4, bottom: 20, containLabel: true } : { left: 52, right: 8, top: 16, bottom: 24 },
                    xAxis: horizontal ? val : cat,
                    yAxis: horizontal ? cat : val,
                    tooltip: {
                        ...baseOption(t, reduced).tooltip,
                        trigger: "item",
                        formatter: (p: {
                            dataIndex: number;
                        }) => {
                            const i = horizontal ? rows.length - 1 - p.dataIndex : p.dataIndex;
                            const r = rows[i] ?? {};
                            const tip: TipRow[] = (spec.metrics ?? []).map((m) => ({ label: metricMeta(catalog, m).label, value: fmt(catalog, m, r[m] as number, rt.money, { compact: false }) }));
                            if (total > 0 && metricMeta(catalog, metric).format === "money")
                                tip.push({ label: "Share", value: `${(((r[metric] as number) / total) * 100).toFixed(1)}%` });
                            return tooltipHtml(rowLabel(r, dim), tip);
                        },
                    },
                    series: [
                        {
                            type: "bar",
                            data: horizontal ? [...values].reverse() : values,
                            barMaxWidth: 24,
                            label: secondary
                                ? {
                                    show: true,
                                    position: horizontal ? "right" : "top",
                                    fontFamily: t.fontMono,
                                    fontSize: 10,
                                    color: t.muted3,
                                    formatter: (p: {
                                        dataIndex: number;
                                    }) => {
                                        const i = horizontal ? rows.length - 1 - p.dataIndex : p.dataIndex;
                                        return `${fmt(catalog, metric, rows[i]?.[metric] as number, rt.money)} · ${fmt(catalog, secondary, rows[i]?.[secondary] as number, rt.money)}`;
                                    },
                                }
                                : { show: false },
                            emphasis: { itemStyle: { opacity: 0.85 } },
                        },
                    ],
                };
            };
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, horizontal, rt.money, catalog]} ariaLabel={`${title}: bar chart of ${metricMeta(catalog, metric).label} by ${dim.replace("_", " ")}`} events={{
                    click: (p) => {
                        const i = horizontal ? rows.length - 1 - Number(p.dataIndex) : Number(p.dataIndex);
                        const r = rows[i];
                        if (!r)
                            return;
                        if (dim === "campaign")
                            rt.openCampaign(rowId(r, "campaign"));
                        else if (!TIME_DIMS.has(dim))
                            rt.toggleCrossFilter(dim, rowLabel(r, dim));
                    },
                }}/>
          </ChartBox>);
        }}
    </QueryState>);
}
export function StackedBarViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult(spec);
    const dims = spec.dimensions ?? [];
    const timeDim = dims.find((d) => TIME_DIMS.has(d)) ?? dims[0] ?? "date";
    const seriesDim = dims.find((d) => d !== timeDim) ?? "campaign_type";
    const metric = spec.metrics?.[0] ?? "cost";
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const p = pivotSeries(data.rows, timeDim, seriesDim, metric);
            const legend = p.series.map((s, i) => ({ label: s.name, color: s.name === "Other" ? "var(--series-other)" : `var(--series-${(colorSlot(seriesDim, s.name, i) % 6) + 1})` }));
            const build = (t: ChartTokens) => {
                const ticks = tickIndices(p.times.length, 6);
                return {
                    ...baseOption(t, reduced),
                    grid: { left: 52, right: 8, top: 8, bottom: 24 },
                    xAxis: categoryAxis(t, p.times, { axisLabel: { ...axisLabel(t), interval: (k: number) => ticks.has(k), formatter: (v: string) => timeLabel(timeDim, v) } }),
                    yAxis: valueAxis(t, metricMeta(catalog, metric).format as MetricFormat, rt.money, { splitNumber: 4 }),
                    tooltip: {
                        ...baseOption(t, reduced).tooltip,
                        trigger: "axis",
                        axisPointer: { type: "shadow", shadowStyle: { color: t.theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(60,60,67,0.05)" } },
                        formatter: (params: {
                            dataIndex: number;
                            seriesName: string;
                            value: number;
                            color: string;
                        }[]) => {
                            const i = params[0]?.dataIndex ?? 0;
                            const sum = params.reduce((s, x) => s + (x.value ?? 0), 0);
                            const rows: TipRow[] = [...params].reverse().map((x) => ({ color: x.color, label: x.seriesName, value: fmt(catalog, metric, x.value, rt.money, { compact: false }) }));
                            rows.push({ label: "Total", value: fmt(catalog, metric, sum, rt.money, { compact: false }) });
                            return tooltipHtml(timeLabel(timeDim, p.times[i] ?? ""), rows);
                        },
                    },
                    series: p.series.map((s, i) => ({
                        name: s.name,
                        type: "bar",
                        stack: "total",
                        data: s.values,
                        barMaxWidth: 24,
                        itemStyle: { color: s.name === "Other" ? t.other : colorFor(seriesDim, s.name, i, t), borderColor: t.surface, borderWidth: 1 },
                    })),
                };
            };
            return (<div className="flex min-h-0 flex-1 flex-col gap-3">
            <HtmlLegend items={legend}/>
            <ChartBox>
              <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: stacked bars of ${metricMeta(catalog, metric).label} by ${seriesDim.replace("_", " ")}`}/>
            </ChartBox>
          </div>);
        }}
    </QueryState>);
}
export function DonutViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult(spec);
    const dim = spec.dimensions?.[0] ?? "device";
    const metric = spec.metrics?.[0] ?? "cost";
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const sorted = [...data.rows].sort((a, b) => ((b[metric] as number) ?? 0) - ((a[metric] as number) ?? 0));
            const top = sorted.slice(0, sorted.length > 5 ? 4 : 5);
            const rest = sorted.slice(top.length);
            const slices = [
                ...top.map((r) => ({ name: rowLabel(r, dim), value: (r[metric] as number) ?? 0 })),
                ...(rest.length ? [{ name: "Other", value: rest.reduce((s, r) => s + ((r[metric] as number) ?? 0), 0) }] : []),
            ];
            const total = slices.reduce((s, x) => s + x.value, 0);
            const build = (t: ChartTokens) => ({
                ...baseOption(t, reduced),
                tooltip: {
                    ...baseOption(t, reduced).tooltip,
                    trigger: "item",
                    formatter: (p: {
                        name: string;
                        value: number;
                        percent: number;
                    }) => tooltipHtml(p.name, [{ label: metricMeta(catalog, metric).label, value: fmt(catalog, metric, p.value, rt.money, { compact: false }) }, { label: "Share", value: `${p.percent.toFixed(1)}%` }]),
                },
                series: [
                    {
                        type: "pie",
                        radius: ["58%", "82%"],
                        center: ["50%", "50%"],
                        padAngle: 1,
                        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
                        label: { show: true, position: "outside", color: t.muted, fontFamily: t.fontSans, fontSize: 11, formatter: (p: {
                                name: string;
                                percent: number;
                            }) => `${escapeHtml(p.name)}\n{pct|${p.percent.toFixed(0)}%}`, rich: { pct: { fontFamily: t.fontMono, color: t.faint, fontSize: 10 } } },
                        labelLine: { length: 8, length2: 6, lineStyle: { color: t.line } },
                        data: slices.map((s, i) => ({ ...s, itemStyle: { color: s.name === "Other" ? t.other : colorFor(dim, s.name, i, t) } })),
                    },
                ],
                graphic: [
                    { type: "text", left: "center", top: "44%", style: { text: fmt(catalog, metric, total, rt.money), fill: t.text, font: `600 18px ${t.fontDisplay}`, textAlign: "center" } },
                    { type: "text", left: "center", top: "54%", style: { text: metricMeta(catalog, metric).label.toUpperCase(), fill: t.faint, font: `10px ${t.fontMono}`, textAlign: "center" } },
                ],
            });
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: share of ${metricMeta(catalog, metric).label} by ${dim}`} events={{ click: (p) => p.name && p.name !== "Other" && rt.toggleCrossFilter(dim, String(p.name)) }}/>
          </ChartBox>);
        }}
    </QueryState>);
}
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function HeatmapViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult(spec);
    const [rowDim = "dow", colDim = "hour"] = spec.dimensions ?? [];
    const metric = spec.metrics?.[0] ?? "conversions";
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const rowVals = rowDim === "dow" ? WEEKDAYS : [...new Set(data.rows.map((r) => rowLabel(r, rowDim)))];
            const colVals = colDim === "hour" ? Array.from({ length: 24 }, (_, h) => String(h)) : [...new Set(data.rows.map((r) => rowLabel(r, colDim)))];
            const cells: [
                number,
                number,
                number
            ][] = [];
            let max = 0;
            for (const r of data.rows) {
                const rl = rowLabel(r, rowDim);
                const ri = rowDim === "dow" ? WEEKDAYS.findIndex((d) => rl.startsWith(d)) : rowVals.indexOf(rl);
                const ci = colVals.indexOf(colDim === "hour" ? String(Number(r[colDim] ?? rl)) : rowLabel(r, colDim));
                const v = typeof r[metric] === "number" ? (r[metric] as number) : 0;
                if (ri < 0 || ci < 0)
                    continue;
                cells.push([ci, ri, v]);
                max = Math.max(max, v);
            }
            const build = (t: ChartTokens) => ({
                ...baseOption(t, reduced),
                grid: { left: 40, right: 8, top: 4, bottom: 50 },
                xAxis: categoryAxis(t, colVals, { splitArea: { show: false }, axisLabel: { ...axisLabel(t), interval: colDim === "hour" ? 2 : "auto", formatter: (v: string) => (colDim === "hour" ? `${v.padStart(2, "0")}h` : v) } }),
                yAxis: categoryAxis(t, rowVals, { inverse: true, axisLabel: { ...axisLabel(t) } }),
                visualMap: { show: true, min: 0, max: max || 1, orient: "horizontal", left: "center", bottom: 2, itemWidth: 8, itemHeight: 120, calculable: false, text: [`More ${metricMeta(catalog, metric).label.toLowerCase()}`, "Fewer"], inRange: { color: sequentialRamp(t) }, textStyle: { color: t.faint, fontFamily: t.fontMono, fontSize: 10 } },
                tooltip: {
                    ...baseOption(t, reduced).tooltip,
                    trigger: "item",
                    formatter: (p: {
                        value: [
                            number,
                            number,
                            number
                        ];
                    }) => tooltipHtml(`${rowVals[p.value[1]]} · ${colDim === "hour" ? `${String(colVals[p.value[0]]).padStart(2, "0")}:00` : colVals[p.value[0]]}`, [{ label: metricMeta(catalog, metric).label, value: fmt(catalog, metric, p.value[2], rt.money, { compact: false }) }]),
                },
                series: [{ type: "heatmap", data: cells, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } } }],
            });
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: heatmap of ${metricMeta(catalog, metric).label} by ${rowDim} and ${colDim}`}/>
          </ChartBox>);
        }}
    </QueryState>);
}
export function FunnelViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult({ ...spec, dimensions: [], sort: [] });
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const metrics = spec.metrics?.length ? spec.metrics : ["impressions", "clicks", "conversions"];
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const steps = metrics.map((m) => ({ name: metricMeta(catalog, m).label, key: m, value: data.totals?.[m] ?? 0 }));
            const build = (t: ChartTokens) => {
                const colors = ordinalRamp(t, steps.length);
                return {
                    ...baseOption(t, reduced),
                    tooltip: { ...baseOption(t, reduced).tooltip, trigger: "item", formatter: (p: {
                            dataIndex: number;
                        }) => {
                            const s = steps[p.dataIndex];
                            const prev = steps[p.dataIndex - 1];
                            const rows: TipRow[] = [{ label: s?.name ?? "", value: fmt(catalog, s?.key ?? "", s?.value, rt.money, { compact: false }) }];
                            if (prev && prev.value)
                                rows.push({ label: `Rate from ${prev.name.toLowerCase()}`, value: `${(((s?.value ?? 0) / prev.value) * 100).toFixed(2)}%` });
                            return tooltipHtml(s?.name ?? "", rows);
                        } },
                    series: [
                        {
                            type: "funnel",
                            left: "8%",
                            right: "8%",
                            top: 6,
                            bottom: 6,
                            minSize: "18%",
                            gap: 2,
                            sort: "none",
                            label: { show: true, position: "inside", color: "#fff", fontFamily: t.fontSans, fontSize: 12, formatter: (p: {
                                    dataIndex: number;
                                }) => `${steps[p.dataIndex]?.name}  ${fmt(catalog, steps[p.dataIndex]?.key ?? "", steps[p.dataIndex]?.value, rt.money)}` },
                            itemStyle: { borderColor: t.surface, borderWidth: 1 },
                            data: steps.map((s, i) => ({ name: s.name, value: Math.log10(Math.max(1, s.value)) + 1, itemStyle: { color: colors[i] } })),
                        },
                    ],
                };
            };
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: funnel`}/>
          </ChartBox>);
        }}
    </QueryState>);
}
export function ScatterViz({ spec, rt, catalog, title, viz }: VizProps) {
    const q = useQueryResult(spec);
    const dim = spec.dimensions?.[0] ?? "campaign";
    const [xKey = "cost", yKey = "cpa", sizeKey = viz.sizeKey ?? "conversions"] = spec.metrics ?? [];
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const rows = data.rows.filter((r) => typeof r[xKey] === "number" && typeof r[yKey] === "number");
            const maxSize = Math.max(1, ...rows.map((r) => (typeof r[sizeKey] === "number" ? (r[sizeKey] as number) : 0)));
            const build = (t: ChartTokens) => ({
                ...baseOption(t, reduced),
                grid: { left: 56, right: 16, top: 12, bottom: 32 },
                xAxis: valueAxis(t, metricMeta(catalog, xKey).format as MetricFormat, rt.money, { name: metricMeta(catalog, xKey).label, nameLocation: "middle", nameGap: 22, nameTextStyle: { ...axisLabel(t) }, splitNumber: 4 }),
                yAxis: valueAxis(t, metricMeta(catalog, yKey).format as MetricFormat, rt.money, { name: metricMeta(catalog, yKey).label, nameTextStyle: { ...axisLabel(t), align: "left" }, splitNumber: 4 }),
                tooltip: { ...baseOption(t, reduced).tooltip, trigger: "item", formatter: (p: {
                        dataIndex: number;
                    }) => {
                        const r = rows[p.dataIndex] ?? {};
                        return tooltipHtml(rowLabel(r, dim), [xKey, yKey, sizeKey].map((m) => ({ label: metricMeta(catalog, m).label, value: fmt(catalog, m, r[m] as number, rt.money, { compact: false }) })));
                    } },
                series: [
                    {
                        type: "scatter",
                        data: rows.map((r) => [r[xKey], r[yKey], r[sizeKey]]),
                        symbolSize: (v: number[]) => 8 + Math.sqrt(Math.max(0, v[2] ?? 0) / maxSize) * 26,
                        itemStyle: { color: t.accentLine, opacity: 0.75, borderColor: t.surface, borderWidth: 1.5 },
                        emphasis: { itemStyle: { opacity: 1 } },
                    },
                ],
            });
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: ${metricMeta(catalog, yKey).label} vs ${metricMeta(catalog, xKey).label}`} events={{ click: (p) => { const r = rows[Number(p.dataIndex)]; if (r && dim === "campaign")
                    rt.openCampaign(rowId(r, "campaign")); } }}/>
          </ChartBox>);
        }}
    </QueryState>);
}
function isDarkHex(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m?.[1])
        return false;
    const n = parseInt(m[1], 16);
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) < 0.3;
}
export function TreemapViz({ spec, rt, catalog, title }: VizProps) {
    const q = useQueryResult(spec);
    const dim = spec.dimensions?.[0] ?? "campaign";
    const metric = spec.metrics?.[0] ?? "cost";
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={q} skeletonHeight="100%">
      {(data) => {
            const build = (t: ChartTokens) => {
                const ramp = sequentialRamp(t);
                const rows = [...data.rows].sort((a, b) => ((b[metric] as number) ?? 0) - ((a[metric] as number) ?? 0));
                return {
                    ...baseOption(t, reduced),
                    tooltip: { ...baseOption(t, reduced).tooltip, trigger: "item", formatter: (p: {
                            name: string;
                            value: number;
                        }) => tooltipHtml(p.name, [{ label: metricMeta(catalog, metric).label, value: fmt(catalog, metric, p.value, rt.money, { compact: false }) }]) },
                    series: [
                        {
                            type: "treemap",
                            roam: false,
                            nodeClick: false,
                            breadcrumb: { show: false },
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2, borderRadius: 4 },
                            label: { show: true, fontFamily: t.fontSans, fontSize: 12, formatter: (p: {
                                    name: string;
                                    value: number;
                                }) => `${p.name}\n${fmt(catalog, metric, p.value, rt.money)}`, overflow: "truncate" },
                            data: rows.map((r, i) => {
                                const color = ramp[Math.max(1, ramp.length - 1 - Math.floor((i / Math.max(1, rows.length)) * (ramp.length - 1)))] ?? t.accentLine;
                                return { name: rowLabel(r, dim), value: (r[metric] as number) ?? 0, itemStyle: { color }, label: { color: isDarkHex(color) ? "#ffffff" : "#0b2a24" } };
                            }),
                        },
                    ],
                };
            };
            return (<ChartBox>
            <EChart className="absolute inset-0" build={build} deps={[data, rt.money, catalog]} ariaLabel={`${title}: treemap of ${metricMeta(catalog, metric).label}`}/>
          </ChartBox>);
        }}
    </QueryState>);
}
