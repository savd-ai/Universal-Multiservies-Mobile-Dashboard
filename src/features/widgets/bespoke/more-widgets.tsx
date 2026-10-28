"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { axisLabel, baseOption, categoryAxis, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ErrorState, InlineEmpty, Refetching, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/inputs";
import { Dot, Meter, SEVERITY_META } from "@/components/ui/status";
import { MetaStat } from "@/components/ui/surfaces";
import { useAnomalies, usePacing } from "@/lib/api/analytics";
import { useBudgetForecast } from "@/lib/api/budget";
import { useCatalog, useQueryResult, useSettings, useStatus, useUpdateSettings } from "@/lib/api/hooks";
import { addDays, daysInMonth as daysInMonthOf, formatShort, parts } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricDirection, MetricFormat } from "@/lib/domain/types";
import { displayMoney, moneyOpts, type MoneyLike } from "@/lib/money";
import { tickIndices } from "../question/viz-trend";
import { fmt, metricMeta } from "../question/shared";
import { resolveWidgetSpec } from "../resolve-spec";
import type { WidgetProps } from "../types";
import { useWidgetHints, useWidgetSubtitle } from "../widget-frame";
const Markdown = dynamic(() => import("./markdown").then((m) => m.Markdown), { ssr: false, loading: () => <SkeletonLines lines={2}/> });
const money = (v: number | null | undefined, m: MoneyLike) => displayMoney(v, m);
const GOAL_FIELD: Record<string, "monthlyConversions" | "monthlyRevenue"> = { conversions: "monthlyConversions", conv_value: "monthlyRevenue" };
export function GoalTrackerWidget({ config, rt }: WidgetProps<{
    metric?: string;
}>) {
    const metric = config.metric === "conv_value" ? "conv_value" : "conversions";
    const settings = useSettings();
    const save = useUpdateSettings();
    const catalog = useCatalog();
    const mtd = useQueryResult({ source: "google_ads", metrics: [metric], dimensions: [], dateRange: { preset: "mtd" } });
    const lastMonth = useQueryResult({ source: "google_ads", metrics: [metric], dimensions: [], dateRange: { preset: "last_month" } });
    const [draft, setDraft] = useState("");
    const goal = settings.data?.goals[GOAL_FIELD[metric] ?? "monthlyConversions"] ?? null;
    const through = rt.dataThrough;
    const dim = through ? daysInMonthOf(through) : 30;
    const elapsed = through ? parts(through).day : 1;
    useWidgetSubtitle(`${metricMeta(catalog.data, metric).label} vs target · ${elapsed} of ${dim} days`);
    if (mtd.error && !mtd.data)
        return <ErrorState error={mtd.error} onRetry={() => void mtd.refetch()}/>;
    if (!mtd.data || !settings.data)
        return <SkeletonLines lines={3}/>;
    const actual = mtd.data.totals?.[metric] ?? 0;
    const projected = (actual / Math.max(1, elapsed)) * dim;
    const suggestion = Math.round(((lastMonth.data?.totals?.[metric] ?? projected) * 1.1) / 10) * 10;
    if (goal === null) {
        return (<div className="flex flex-1 flex-col justify-center gap-3">
        <span className="text-[13px] text-muted">No monthly {metric === "conversions" ? "conversion" : "revenue"} goal yet. Last month +10% would be {fmt(catalog.data, metric, suggestion, rt.money)}.</span>
        <form className="flex items-center gap-2" onSubmit={(e) => {
                e.preventDefault();
                const v = Number(draft || suggestion);
                if (!Number.isFinite(v) || v <= 0 || !settings.data)
                    return;
                save.mutate({ goals: { ...settings.data.goals, [GOAL_FIELD[metric] ?? "monthlyConversions"]: v } });
            }}>
          <Input variant="field" inputMode="decimal" aria-label="Monthly goal" placeholder={String(suggestion)} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-32"/>
          <Button type="submit" variant="accent" size="xs" loading={save.isPending}>
            Set goal
          </Button>
        </form>
      </div>);
    }
    const ratio = goal > 0 ? projected / goal : 0;
    const onTrack = ratio >= 0.97;
    return (<div className="flex flex-1 flex-col justify-center gap-4">
      <div className="flex items-baseline gap-2.5">
        <span className={cn("font-display text-[44px] leading-none font-semibold tracking-[-0.03em] tabular", onTrack ? "text-accent" : "text-warn")}>{`${Math.round(ratio * 100)}%`}</span>
        <span className="text-[13px] text-muted-3">of goal projected</span>
      </div>
      <Meter value={actual / goal} projected={projected / goal} marker={elapsed / dim} tone={onTrack ? "accent" : "warn"} label={`Goal progress ${Math.round((actual / goal) * 100)}%`}/>
      <div className="grid grid-cols-3 gap-3">
        <MetaStat label="MTD" value={fmt(catalog.data, metric, actual, rt.money)}/>
        <MetaStat label="Projected" value={fmt(catalog.data, metric, projected, rt.money)} tone={onTrack ? undefined : "warn"}/>
        <MetaStat label="Goal" value={fmt(catalog.data, metric, goal, rt.money)}/>
      </div>
    </div>);
}
export function TopMoversWidget({ config, rt, instance }: WidgetProps<{
    metric?: string;
    limit?: number;
}>) {
    const catalog = useCatalog();
    const metric = config.metric ?? "conversions";
    const { spec, ignored } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: [metric, "cost"], dimensions: ["campaign"], compare: "previous_period" }, rt.filters, catalog.data, instance.filterOptOut), [metric, rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(ignored);
    const q = useQueryResult(catalog.data ? spec : null);
    const rows = useMemo(() => [...(q.data?.rows ?? [])]
        .filter((r) => typeof r[`${metric}__delta`] === "number")
        .sort((a, b) => Math.abs(b[`${metric}__delta`] as number) - Math.abs(a[`${metric}__delta`] as number))
        .slice(0, config.limit ?? 5), [q.data, metric, config.limit]);
    if (spec.compare === "none")
        return <InlineEmpty>Turn on a comparison period (top bar → More) to see movers.</InlineEmpty>;
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={5}/>;
    const meta = metricMeta(catalog.data, metric);
    const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r[`${metric}__delta`] as number)));
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {rows.map((r) => {
            const d = r[`${metric}__delta`] as number;
            const pct = r[`${metric}__pct`] as number | null;
            const s = deltaSentiment(meta.direction as MetricDirection, pct);
            return (<button key={String(r.campaign_id)} type="button" onClick={() => rt.openCampaign(String(r.campaign_id))} className="grid grid-cols-[minmax(0,1fr)_90px_70px] items-center gap-3 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-medium">{String(r.campaign)}</span>
              <span className="h-1 rounded-pill bg-tone/5">
                <span className="block h-full rounded-pill" style={{ width: `${(Math.abs(d) / maxAbs) * 100}%`, background: s === "bad" ? "var(--crit)" : s === "good" ? "var(--accent)" : "var(--faint)" }}/>
              </span>
            </span>
            <span className="text-right tabular">{`${d >= 0 ? "+" : "−"}${fmt(catalog.data, metric, Math.abs(d), rt.money)}`}</span>
            <span className={cn("text-right font-mono text-meta", s === "good" ? "text-accent" : s === "bad" ? "text-crit" : "text-muted")}>{formatDelta(pct)}</span>
          </button>);
        })}
      {!rows.length ? <InlineEmpty>No changes to rank.</InlineEmpty> : null}
    </Refetching>);
}
export function CumulativeSpendWidget({ rt }: WidgetProps) {
    const q = usePacing();
    const reduced = useMemo(() => prefersReducedMotion(), []);
    useWidgetSubtitle(q.data ? `${q.data.monthLabel} · actual · projected · ideal` : null);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <Skeleton height="100%" className="min-h-[160px] w-full"/>;
    const r = q.data;
    const dates = r.cumulative.map((c) => c.date);
    const build = (t: ChartTokens) => {
        const ticks = tickIndices(dates.length, 5);
        return {
            ...baseOption(t, reduced),
            grid: { left: 52, right: 8, top: 14, bottom: 22 },
            xAxis: categoryAxis(t, dates, { boundaryGap: false, axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v) } }),
            yAxis: valueAxis(t, "money", rt.money, { splitNumber: 4, max: (v: {
                    max: number;
                }) => Math.max(v.max, r.totals.monthlyTarget) * 1.06 }),
            tooltip: {
                ...baseOption(t, reduced).tooltip,
                trigger: "axis",
                formatter: (ps: {
                    dataIndex: number;
                }[]) => {
                    const c = r.cumulative[ps[0]?.dataIndex ?? 0];
                    if (!c)
                        return "";
                    const rows: TipRow[] = [];
                    if (c.actual !== null)
                        rows.push({ color: t.accentLine, label: "Actual", value: money(c.actual, rt.money) });
                    if (c.projected !== null)
                        rows.push({ color: t.accentLine, dashed: true, label: "Projected", value: money(c.projected, rt.money) });
                    rows.push({ color: t.faint, label: "Ideal pace", value: money(c.ideal, rt.money) });
                    return tooltipHtml(formatShort(c.date), rows);
                },
            },
            series: [
                {
                    name: "Actual",
                    type: "line",
                    data: r.cumulative.map((c) => c.actual),
                    symbol: "none",
                    lineStyle: { color: t.accentLine, width: 2 },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    markLine: {
                        symbol: "none",
                        silent: true,
                        label: { show: true, position: "insideEndTop", formatter: `Budget ${money(r.totals.monthlyTarget, rt.money)}`, color: t.muted3, fontFamily: t.fontMono, fontSize: 10 },
                        lineStyle: { color: t.muted3, width: 1, type: "solid" },
                        data: [{ yAxis: r.totals.monthlyTarget }],
                    },
                },
                { name: "Projected", type: "line", data: r.cumulative.map((c) => c.projected), symbol: "none", lineStyle: { color: r.totals.paceRatio > 1.05 ? t.warn : t.accentLine, width: 1.75, type: [5, 4] } },
                { name: "Ideal", type: "line", data: r.cumulative.map((c) => c.ideal), symbol: "none", lineStyle: { color: t.faint, width: 1 } },
            ],
        };
    };
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-[18px] text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-accent-line"/>Actual</span>
        <span className="flex items-center gap-2"><span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: r.totals.paceRatio > 1.05 ? "var(--warn)" : "var(--accent-line)" }}/>Projected</span>
        <span className="flex items-center gap-2"><span className="h-px w-3.5 bg-faint"/>Ideal pace</span>
      </div>
      <div className="relative min-h-[140px] flex-1">
        <EChart className="absolute inset-0" build={build} deps={[r, rt.money]} ariaLabel={`Cumulative spend for ${r.monthLabel}: ${money(r.totals.mtdSpend, rt.money)} to date, projected ${money(r.totals.projected, rt.money)} against ${money(r.totals.monthlyTarget, rt.money)}`}/>
      </div>
    </div>);
}
export function ForecastWidget({ config, rt }: WidgetProps<{
    metric?: string;
}>) {
    const metric = (["cost", "conversions", "conv_value", "clicks"].includes(config.metric ?? "") ? config.metric : "cost") as "cost" | "conversions" | "conv_value" | "clicks";
    const q = useBudgetForecast(metric, { horizon: 30 });
    const catalog = useCatalog();
    const reduced = useMemo(() => prefersReducedMotion(), []);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <Skeleton height="100%" className="min-h-[160px] w-full"/>;
    const history = q.data.history.slice(-42);
    const fc = q.data.points;
    const dates = [...history.map((h) => h.date), ...fc.map((f) => f.date)];
    const format = metricMeta(catalog.data, metric).format as MetricFormat;
    const mape = q.data.backtestMape;
    const next30 = q.data.totals.next30;
    const build = (t: ChartTokens) => {
        const ticks = tickIndices(dates.length, 5);
        const pad = history.map(() => null);
        const lo = [...pad, ...fc.map((f) => f.lo)];
        const band = [...pad, ...fc.map((f) => f.hi - f.lo)];
        return {
            ...baseOption(t, reduced),
            grid: { left: 52, right: 8, top: 10, bottom: 22 },
            xAxis: categoryAxis(t, dates, { boundaryGap: false, axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v) } }),
            yAxis: valueAxis(t, format, rt.money, { splitNumber: 4 }),
            tooltip: {
                ...baseOption(t, reduced).tooltip,
                trigger: "axis",
                formatter: (ps: {
                    dataIndex: number;
                }[]) => {
                    const i = ps[0]?.dataIndex ?? 0;
                    const h = history[i];
                    if (h)
                        return tooltipHtml(formatShort(h.date), [{ color: t.accentLine, label: "Actual", value: formatMetricValue(format, h.value, moneyOpts(rt.money)) }]);
                    const f = fc[i - history.length];
                    if (!f)
                        return "";
                    return tooltipHtml(formatShort(f.date), [
                        { color: t.accentLine, dashed: true, label: "Forecast", value: formatMetricValue(format, f.yhat, moneyOpts(rt.money)) },
                        { label: "80% range", value: `${formatMetricValue(format, f.lo, moneyOpts(rt.money))} – ${formatMetricValue(format, f.hi, moneyOpts(rt.money))}` },
                    ]);
                },
            },
            series: [
                { name: "lo", type: "line", data: lo, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, silent: true },
                { name: "band", type: "line", data: band, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(4,191,157,0.14)" }, silent: true },
                { name: "Actual", type: "line", data: [...history.map((h) => h.value), ...fc.map(() => null)], symbol: "none", lineStyle: { color: t.accentLine, width: 2 } },
                { name: "Forecast", type: "line", data: [...history.map((_, i) => (i === history.length - 1 ? (history[i]?.value ?? null) : null)), ...fc.map((f) => f.yhat)], symbol: "none", lineStyle: { color: t.accentLine, width: 1.75, type: [5, 4] } },
            ],
        };
    };
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-[18px] text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-accent-line"/>Actual</span>
        <span className="flex items-center gap-2"><span className="w-3.5 border-t-[1.5px] border-dashed border-accent-line"/>Forecast</span>
        <span className="flex items-center gap-2"><span className="h-2 w-3.5 rounded-[2px] bg-teal/14"/>80% range</span>
        <span className="ml-auto font-mono text-micro tracking-label text-faint uppercase">{`Next 30 days ${formatMetricValue(format, next30.yhat, moneyOpts(rt.money))}${mape !== null ? ` · backtest error ${(mape * 100).toFixed(1)}%` : ""}`}</span>
      </div>
      <div className="relative min-h-[140px] flex-1">
        <EChart className="absolute inset-0" build={build} deps={[q.data, rt.money, format]} ariaLabel={`30-day ${metricMeta(catalog.data, metric).label} forecast with 80% range: about ${formatMetricValue(format, next30.yhat, moneyOpts(rt.money))}`}/>
      </div>
    </div>);
}
export function TodaySoFarWidget({ rt, instance }: WidgetProps) {
    const catalog = useCatalog();
    const day = rt.dataThrough;
    const filt = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], dimensions: ["hour"] }, rt.filters, catalog.data, [...(instance.filterOptOut ?? []), "range", "compare"]), [rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(filt.ignored);
    const dayQ = useQueryResult(day && catalog.data ? { ...filt.spec, dateRange: { start: day, end: day }, compare: "none" } : null);
    const typQ = useQueryResult(day && catalog.data ? { ...filt.spec, dateRange: { start: addDays(day, -28), end: addDays(day, -1) }, compare: "none" } : null);
    const reduced = useMemo(() => prefersReducedMotion(), []);
    useWidgetSubtitle(day ? `${formatShort(day)} · hourly spend vs 28-day typical` : null);
    if (dayQ.error && !dayQ.data)
        return <ErrorState error={dayQ.error} onRetry={() => void dayQ.refetch()}/>;
    if (!dayQ.data || !typQ.data)
        return <Skeleton height="100%" className="min-h-[140px] w-full"/>;
    const byHour = (rows: Record<string, unknown>[], div = 1) => Array.from({ length: 24 }, (_, h) => {
        const r = rows.find((x) => Number(x.hour) === h);
        return r && typeof r.cost === "number" ? r.cost / div : 0;
    });
    const actual = byHour(dayQ.data.rows);
    const typical = byHour(typQ.data.rows, 28);
    const total = actual.reduce((s, v) => s + v, 0);
    const typTotal = typical.reduce((s, v) => s + v, 0);
    const pct = typTotal ? total / typTotal - 1 : null;
    const build = (t: ChartTokens) => ({
        ...baseOption(t, reduced),
        grid: { left: 44, right: 6, top: 8, bottom: 20 },
        xAxis: categoryAxis(t, Array.from({ length: 24 }, (_, h) => String(h)), { axisLabel: { ...axisLabel(t), interval: 5, formatter: (v: string) => `${v.padStart(2, "0")}h` } }),
        yAxis: valueAxis(t, "money", rt.money, { splitNumber: 3 }),
        tooltip: { ...baseOption(t, reduced).tooltip, trigger: "axis", formatter: (ps: {
                dataIndex: number;
            }[]) => {
                const h = ps[0]?.dataIndex ?? 0;
                return tooltipHtml(`${String(h).padStart(2, "0")}:00`, [{ color: t.accentLine, label: formatShort(day), value: money(actual[h], rt.money) }, { color: t.faint, dashed: true, label: "Typical", value: money(typical[h], rt.money) }]);
            } },
        series: [
            { type: "bar", data: actual, barMaxWidth: 12, itemStyle: { color: t.accentLine, borderRadius: [3, 3, 0, 0] } },
            { type: "line", data: typical, symbol: "none", lineStyle: { color: t.faint, width: 1.25, type: [4, 4] } },
        ],
    });
    return (<div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[26px] leading-none font-semibold tabular">{money(total, rt.money)}</span>
        <span className={cn("font-mono text-meta", pct === null ? "text-muted" : Math.abs(pct) < 0.1 ? "text-muted" : pct > 0 ? "text-warn" : "text-muted")}>{pct === null ? "" : `${formatDelta(pct)} vs typical`}</span>
      </div>
      <div className="relative min-h-[100px] flex-1">
        <EChart className="absolute inset-0" build={build} deps={[dayQ.data, typQ.data, rt.money]} ariaLabel={`Hourly spend on ${day}: ${money(total, rt.money)}`}/>
      </div>
    </div>);
}
export function OpportunitiesWidget({ rt, instance }: WidgetProps) {
    const catalog = useCatalog();
    const { spec, ignored } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "roas", "lost_is_budget", "search_is"], dimensions: ["campaign"], sort: [{ key: "lost_is_budget", dir: "desc" }], having: [{ metric: "lost_is_budget", op: "gt", value: 0.1 }], limit: 6 }, rt.filters, catalog.data, instance.filterOptOut), [rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(ignored);
    const q = useQueryResult(catalog.data ? { ...spec, totals: true } : null);
    const account = useQueryResult(catalog.data ? { ...spec, dimensions: [], having: [], sort: [], limit: undefined } : null);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={4}/>;
    const avgRoas = account.data?.totals?.roas ?? null;
    const rows = q.data.rows.filter((r) => avgRoas === null || (typeof r.roas === "number" && r.roas >= avgRoas));
    if (!rows.length)
        return <InlineEmpty>No budget-limited campaigns beat the account ROAS right now.</InlineEmpty>;
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {rows.map((r) => {
            const lost = r.lost_is_budget as number;
            const is = (r.search_is as number | null) ?? null;
            const headroom = is && is > 0 ? ((r.cost as number) * lost) / is / Math.max(1, q.data?.meta.range.days ?? 30) : null;
            return (<button key={String(r.campaign_id)} type="button" onClick={() => rt.openCampaign(String(r.campaign_id))} className="flex items-center gap-3 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <Dot tone="accent" halo/>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{String(r.campaign)}</span>
              <span className="text-xs text-muted-3">{`Loses ${(lost * 100).toFixed(0)}% of impressions to budget · ROAS ${formatMetricValue("ratio", r.roas as number)}${avgRoas !== null ? ` vs ${formatMetricValue("ratio", avgRoas)} account` : ""}`}</span>
            </span>
            {headroom !== null ? <span className="font-mono text-meta whitespace-nowrap text-accent">{`≈ +${money(headroom, rt.money)}/day`}</span> : null}
          </button>);
        })}
    </Refetching>);
}
export function AlertStatusWidget() {
    const q = useAnomalies({ status: "open" });
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={3}/>;
    const open = q.data.signals.filter((s) => s.status === "open");
    const by = (sev: "critical" | "warning" | "info") => open.filter((s) => s.severity === sev).length;
    return (<div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {(["critical", "warning", "info"] as const).map((sev) => (<Link key={sev} href={`/anomalies?sev=${sev}`} className="flex min-w-0 flex-col gap-2 rounded-mini border border-line-soft bg-fill px-3 py-2.5 text-fg hover:border-tone/18 hover:opacity-100">
            <span className="truncate font-mono text-[9px] tracking-[0.08em] text-muted-3 uppercase">{SEVERITY_META[sev].label}</span>
            <span className="flex items-center gap-2">
              <Dot tone={SEVERITY_META[sev].tone} halo size={7}/>
              <span className="font-display text-[26px] leading-none font-semibold tabular">{by(sev)}</span>
            </span>
          </Link>))}
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-muted-3">
        <span>{q.data.dataThrough ? `Evaluated through ${formatShort(q.data.dataThrough)}` : "Evaluated on the latest complete day"}</span>
        <Link href="/anomalies/notifications">Alert routes →</Link>
      </div>
    </div>);
}
export function DataHealthWidget() {
    const q = useStatus();
    if (!q.data)
        return <SkeletonLines lines={4}/>;
    const s = q.data;
    const rows: {
        label: string;
        value: string;
        tone: "accent" | "warn" | "faint";
    }[] = [
        { label: "Google Ads", value: s.mode === "live" ? `Live · API ${s.googleAds.apiVersion}` : s.reason?.code === "demo" ? `Demo data · ${s.reason.cause.code.replace(/_/g, " ")}` : `No live data · ${(s.reason?.code ?? "no_env").replace(/_/g, " ")}`, tone: s.mode === "live" ? "accent" : "warn" },
        { label: "Data through", value: formatShort(s.dataThrough), tone: "accent" },
        { label: "Storage", value: s.store.driver === "file" ? "File store" : "Memory (not persisted)", tone: s.store.driver === "file" ? "accent" : "warn" },
    ];
    return (<div className="flex flex-col">
      {rows.map((r) => (<div key={r.label} className="flex items-center gap-2.5 border-b border-line-soft py-2 text-[13px] last:border-0">
          <Dot tone={r.tone} size={7}/>
          <span className="flex-1 text-muted">{r.label}</span>
          <span className="truncate text-right font-medium">{r.value}</span>
        </div>))}
    </div>);
}
export function SearchTermWasteWidget({ config, rt, instance }: WidgetProps<{
    limit?: number;
}>) {
    const catalog = useCatalog();
    const { spec, ignored } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "clicks", "conversions"], dimensions: ["search_term", "campaign"], having: [{ metric: "conversions", op: "eq", value: 0 }], sort: [{ key: "cost", dir: "desc" }], limit: config.limit ?? 8 }, rt.filters, catalog.data, instance.filterOptOut), [config.limit, rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(ignored);
    const q = useQueryResult(catalog.data ? { ...spec, totals: true } : null);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={5}/>;
    if (!q.data.rows.length)
        return <InlineEmpty>No search terms spent money without converting in this range.</InlineEmpty>;
    const total = q.data.rows.reduce((s, r) => s + ((r.cost as number) ?? 0), 0);
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-3">
        <span>{`${money(total, rt.money)} on ${q.data.rows.length} terms with no conversions`}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-[520px] grid-cols-[minmax(160px,2fr)_minmax(140px,1.4fr)_80px_60px] gap-x-3 text-[13px] tabular">
          <span className="border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">Search term</span>
          <span className="border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">Campaign</span>
          <span className="border-b border-line pb-2 text-right font-mono text-micro tracking-label text-faint uppercase">Cost</span>
          <span className="border-b border-line pb-2 text-right font-mono text-micro tracking-label text-faint uppercase">Clicks</span>
          {q.data.rows.map((r, i) => (<div key={i} className="contents">
              <span className="truncate border-b border-line-soft py-2 font-medium">{String(r.search_term)}</span>
              <button type="button" onClick={() => rt.openCampaign(String(r.campaign_id))} className="truncate border-b border-line-soft py-2 text-left text-muted hover:text-accent">
                {String(r.campaign)}
              </button>
              <span className="border-b border-line-soft py-2 text-right">{money(r.cost as number, rt.money)}</span>
              <span className="border-b border-line-soft py-2 text-right text-muted">{formatMetricValue("number", r.clicks as number)}</span>
            </div>))}
        </div>
      </div>
    </Refetching>);
}
export function NoteWidget({ config, rt, setConfig }: WidgetProps<{
    text?: string;
}>) {
    const text = config.text ?? "";
    if (rt.editing) {
        return <Textarea aria-label="Note text (Markdown)" value={text} onChange={(e) => setConfig({ text: e.target.value.slice(0, 4000) })} className="min-h-0 flex-1 resize-none font-mono text-xs" placeholder="Write context for this dashboard — **Markdown** supported."/>;
    }
    if (!text.trim())
        return <InlineEmpty>Empty note — press Customize to write one.</InlineEmpty>;
    return (<div className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-muted">
      <Markdown text={text}/>
    </div>);
}
export { fmt as formatWidgetValue };
