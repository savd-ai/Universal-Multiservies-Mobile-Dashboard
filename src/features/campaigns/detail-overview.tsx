"use client";
import { useMemo } from "react";
import { axisLabel, baseOption, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/ui/spark";
import { Card, CardHeader, StatTile, TileGrid } from "@/components/ui/surfaces";
import { tickIndices } from "@/features/widgets/question/viz-trend";
import { useAnnotations, type AnnotationMark } from "@/lib/api/hooks";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import { formatLong, formatShort } from "@/lib/domain/dates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { MetricDelta, PacingBlock, SignalItem } from "./campaign-bits";
import { formatMetric, metricSentiment, money, pacingMonthOf, pctChange, rangeShortLabel, type DetailTab, type MetricKey, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext } from "./use-campaign-context";
const KPIS: {
    key: MetricKey;
    label: string;
}[] = [
    { key: "cost", label: "Spend" },
    { key: "conversions", label: "Conversions" },
    { key: "cpa", label: "CPA" },
    { key: "roas", label: "ROAS" },
    { key: "ctr", label: "CTR" },
    { key: "cpc", label: "CPC" },
];
type Daily = CampaignDetail["daily"][number];
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const DAILY_OF: Record<string, (p: Daily) => number | null> = {
    cost: (p) => p.cost,
    conversions: (p) => p.conversions,
    cpa: (p) => ratio(p.cost, p.conversions),
    roas: (p) => ratio(p.conv_value, p.cost),
    ctr: (p) => ratio(p.clicks, p.impressions),
    cpc: (p) => ratio(p.cost, p.clicks),
};
export function OverviewTab({ detail: d, onTab }: {
    detail: CampaignDetail;
    onTab: (t: DetailTab) => void;
}) {
    const { money: m, compareOn, filters } = useCampaignContext();
    const marks = useAnnotations(d.range.start, d.range.end, { includeChanges: true, campaignId: d.campaign.id });
    const open = d.signals.filter((s) => s.status === "open");
    const recent = [...d.changes].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 3);
    return (<>
      <TileGrid min={150}>
        {KPIS.map((k) => {
            const cur = d.kpis[k.key];
            const prev = d.prev?.[k.key];
            const s = compareOn && d.prev ? metricSentiment(k.key, pctChange(cur, prev)) : null;
            return (<StatTile key={k.key} label={k.label} value={<span className="tabular">{formatMetric(k.key, cur, m)}</span>}>
              <div className="flex items-center gap-2">
                {compareOn && d.prev ? <MetricDelta metric={k.key} cur={cur} prev={prev}/> : null}
                <Sparkline values={d.daily.map(DAILY_OF[k.key] ?? (() => null))} color={s === "bad" ? "var(--crit)" : "var(--accent)"} className="min-w-0 flex-1"/>
              </div>
            </StatTile>);
        })}
      </TileGrid>

      <div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex min-w-0 flex-col gap-4">
          <CardHeader title="Daily trend" sub={`${rangeShortLabel(filters.rangeKey, filters.range)} · spend vs daily budget · conversions`}/>
          <TrendLegend hasMarks={!!marks.data?.length}/>
          <TrendChart detail={d} money={m} marks={marks.data ?? []}/>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          {d.pacing && d.pacing.monthlyTarget > 0 ? <PacingCard detail={d} money={m}/> : null}
          <Card className="flex flex-col gap-3.5">
            <CardHeader title="Open signals" sub={open.length ? `${open.length} need${open.length === 1 ? "s" : ""} attention` : "Nothing open"} action={<Button variant="link" className="text-xs" onClick={() => onTab("signals")}>
                  All signals →
                </Button>}/>
            {open.length ? open.slice(0, 3).map((s) => <SignalItem key={s.id} signal={s}/>) : <span className="text-[13px] text-muted-3">Operating within expected range.</span>}
          </Card>
          <Card className="flex flex-col gap-3">
            <CardHeader title="Recent changes" sub="Google Ads change history" action={<Button variant="link" className="text-xs" onClick={() => onTab("changes")}>
                  All changes →
                </Button>}/>
            {recent.length ? (<div className="flex flex-col">
                {recent.map((e) => (<div key={e.id} className="flex gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                    <span className="w-12 shrink-0 font-mono text-micro tracking-[0.08em] text-faint uppercase">{formatShort(e.date)}</span>
                    <span className="min-w-0 flex-1 leading-snug text-muted">{e.summary}</span>
                  </div>))}
              </div>) : (<span className="text-[13px] text-muted-3">No changes in the last 30 days.</span>)}
          </Card>
        </div>
      </div>
    </>);
}
function PacingCard({ detail: d, money: m }: {
    detail: CampaignDetail;
    money: MoneyFmt;
}) {
    const { status } = useCampaignContext();
    const month = pacingMonthOf(status.data?.dataThrough);
    if (!d.pacing)
        return null;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Budget pacing" sub={`${month.label} · month to date`}/>
      <PacingBlock pacing={d.pacing} money={m} monthLabel={month.month} marker={month.marker}/>
      {d.pacing.recommendedDaily ? <span className="text-xs text-muted-3">{`Recommended daily budget: ${money(d.pacing.recommendedDaily, m)}`}</span> : null}
    </Card>);
}
function LegendKey({ color, dashed, label, dot }: {
    color: string;
    dashed?: boolean;
    label: string;
    dot?: boolean;
}) {
    return (<span className="flex items-center gap-2">
      {dot ? (<span aria-hidden className="text-[9px] leading-none" style={{ color }}>
          ●
        </span>) : (<span aria-hidden className="w-3.5" style={dashed ? { height: 0, borderTop: `1.5px dashed ${color}` } : { height: 2, background: color }}/>)}
      {label}
    </span>);
}
function TrendLegend({ hasMarks }: {
    hasMarks: boolean;
}) {
    return (<div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
      <LegendKey color="var(--accent-line)" label="Spend"/>
      <LegendKey color="var(--faint)" dashed label="Daily budget"/>
      <LegendKey color="var(--mint)" label="Conversions"/>
      {hasMarks ? (<>
          <LegendKey color="var(--muted-3)" dot label="Change"/>
          <LegendKey color="var(--accent)" dot label="Note"/>
        </>) : null}
    </div>);
}
const clip = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
function TrendChart({ detail: d, money: m, marks }: {
    detail: CampaignDetail;
    money: MoneyFmt;
    marks: AnnotationMark[];
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const byDate = useMemo(() => {
        const map = new Map<string, {
            changes: string[];
            notes: string[];
        }>();
        for (const a of marks) {
            const e = map.get(a.date) ?? { changes: [], notes: [] };
            (a.source === "change" ? e.changes : e.notes).push(a.text);
            map.set(a.date, e);
        }
        return map;
    }, [marks]);
    const budgetByDate = useMemo(() => new Map(d.budgetLine.map((b) => [b.date, b.value])), [d.budgetLine]);
    const build = (t: ChartTokens) => {
        const dates = d.daily.map((p) => p.date);
        const inRange = new Set(dates);
        const ticks = tickIndices(dates.length);
        const markData = (grid: 0 | 1) => [...byDate.entries()]
            .filter(([date]) => inRange.has(date))
            .map(([date, e]) => ({
            xAxis: date,
            lineStyle: { color: e.changes.length ? t.muted3 : t.accentLine, type: [3, 3], width: 1, opacity: 0.8 },
            label: grid === 0 ? { show: true, position: "end", formatter: "●", color: e.changes.length ? t.muted3 : t.accent, fontSize: 9, distance: 2 } : { show: false },
        }));
        const xBase = { type: "category" as const, data: dates, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false } };
        const moneyAxis = (v: number) => money(v, m, Math.abs(v) < 100 && !Number.isInteger(v) ? 2 : 0);
        return {
            ...baseOption(t, reduced),
            grid: [
                { left: 52, right: 8, top: 16, height: "58%" },
                { left: 52, right: 8, top: "74%", bottom: 22 },
            ],
            axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } },
            xAxis: [
                { ...xBase, gridIndex: 0, axisLabel: { show: false }, axisPointer: { show: true, label: { show: false } } },
                { ...xBase, gridIndex: 1, axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v), alignMinLabel: "left", alignMaxLabel: "right" }, axisPointer: { show: true, label: { show: false } } },
            ],
            yAxis: [valueAxis(t, "money", m.currency, { gridIndex: 0, splitNumber: 4, axisLabel: { ...axisLabel(t), formatter: moneyAxis } }), valueAxis(t, "decimal", undefined, { gridIndex: 1, splitNumber: 2 })],
            tooltip: {
                ...baseOption(t, reduced).tooltip,
                trigger: "axis",
                formatter: (params: {
                    dataIndex: number;
                }[]) => {
                    const p = d.daily[params[0]?.dataIndex ?? 0];
                    if (!p)
                        return "";
                    const budget = budgetByDate.get(p.date);
                    const rows: TipRow[] = [
                        { color: t.accentLine, label: "Spend", value: money(p.cost, m, undefined, false) },
                        ...(budget ? [{ color: t.faint, dashed: true, label: "Daily budget", value: money(budget, m, undefined, false) }] : []),
                        { color: t.mint, label: "Conversions", value: formatMetricValue("decimal", p.conversions) },
                        { label: "CPA", value: money(ratio(p.cost, p.conversions), m, 2) },
                    ];
                    const e = byDate.get(p.date);
                    e?.changes.slice(0, 3).forEach((c) => rows.push({ color: t.muted3, label: `Change · ${clip(c)}`, value: "" }));
                    e?.notes.slice(0, 3).forEach((n) => rows.push({ color: t.accent, label: `Note · ${clip(n)}`, value: "" }));
                    return tooltipHtml(formatLong(p.date), rows);
                },
            },
            series: [
                {
                    name: "Daily budget",
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: d.daily.map((p) => budgetByDate.get(p.date) ?? null),
                    symbol: "none",
                    step: "middle",
                    lineStyle: { color: t.faint, width: 1.25, type: [4, 4] },
                    silent: true,
                    z: 1,
                },
                {
                    name: "Spend",
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: d.daily.map((p) => p.cost),
                    symbol: "circle",
                    symbolSize: 8,
                    showSymbol: false,
                    lineStyle: { color: t.accentLine, width: 2 },
                    itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
                    emphasis: { scale: false, itemStyle: { shadowBlur: 0 } },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    markLine: { symbol: "none", silent: true, animation: false, data: markData(0) },
                    z: 3,
                },
                {
                    name: "Conversions",
                    type: "line",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: d.daily.map((p) => p.conversions),
                    symbol: "circle",
                    symbolSize: 7,
                    showSymbol: false,
                    lineStyle: { color: t.mint, width: 1.5, opacity: t.theme === "dark" ? 0.85 : 1 },
                    itemStyle: { color: t.mint, borderColor: t.surface, borderWidth: 2 },
                    markLine: { symbol: "none", silent: true, animation: false, data: markData(1) },
                    z: 2,
                },
            ],
        };
    };
    const changeCount = [...byDate.values()].reduce((s, e) => s + e.changes.length, 0);
    return (<div className="relative h-[280px] cursor-crosshair">
      <EChart className="absolute inset-0" build={build} deps={[d.daily, d.budgetLine, byDate, m.currency, m.fx]} ariaLabel={`${d.campaign.name}: daily spend against the daily budget and daily conversions, ${formatLong(d.range.start)} to ${formatLong(d.range.end)}${changeCount ? `, ${changeCount} change event${changeCount === 1 ? "" : "s"} marked` : ""}`}/>
    </div>);
}
