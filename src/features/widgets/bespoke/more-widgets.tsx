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
const 糫壍 = dynamic(() => import("./markdown").then((鯚壍) => 鯚壍.Markdown), { ssr: false, loading: () => <SkeletonLines lines={2}/> });
const 棉壍 = (螸壍: number | null | undefined, 咧壍: MoneyLike) => displayMoney(螸壍, 咧壍);
const 玖壍: Record<string, "monthlyConversions" | "monthlyRevenue"> = { conversions: "monthlyConversions", conv_value: "monthlyRevenue" };
export function GoalTrackerWidget({ config: 銅壍, rt: 彴壍 }: WidgetProps<{
    metric?: string;
}>) {
    const 繣壍 = 銅壍.metric === "conv_value" ? "conv_value" : "conversions";
    const 鵒壍 = useSettings();
    const 橁壍 = useUpdateSettings();
    const 褰壍 = useCatalog();
    const 嘟壍 = useQueryResult({ source: "google_ads", metrics: [繣壍], dimensions: [], dateRange: { preset: "mtd" } });
    const 甎壍 = useQueryResult({ source: "google_ads", metrics: [繣壍], dimensions: [], dateRange: { preset: "last_month" } });
    const [鏽壍, 惬壍] = useState("");
    const 翛壍 = 鵒壍.data?.goals[玖壍[繣壍] ?? "monthlyConversions"] ?? null;
    const 黊壍 = 彴壍.dataThrough;
    const 殹壍 = 黊壍 ? daysInMonthOf(黊壍) : 30;
    const 誨壍 = 黊壍 ? parts(黊壍).day : 1;
    useWidgetSubtitle(`${metricMeta(褰壍.data, 繣壍).label} vs target · ${誨壍} of ${殹壍} days`);
    if (嘟壍.error && !嘟壍.data)
        return <ErrorState error={嘟壍.error} onRetry={() => void 嘟壍.refetch()}/>;
    if (!嘟壍.data || !鵒壍.data)
        return <SkeletonLines lines={3}/>;
    const 垗壍 = 嘟壍.data.totals?.[繣壍] ?? 0;
    const 皆壍 = (垗壍 / Math.max(1, 誨壍)) * 殹壍;
    const 镵壍 = Math.round(((甎壍.data?.totals?.[繣壍] ?? 皆壍) * 1.1) / 10) * 10;
    if (翛壍 === null) {
        return (<div className="flex flex-1 flex-col justify-center gap-3">
        <span className="text-[13px] text-muted">No monthly {繣壍 === "conversions" ? "conversion" : "revenue"} goal yet. Last month +10% would be {fmt(褰壍.data, 繣壍, 镵壍, 彴壍.money)}.</span>
        <form className="flex items-center gap-2" onSubmit={(扤壍) => {
                扤壍.preventDefault();
                const 腓壍 = Number(鏽壍 || 镵壍);
                if (!Number.isFinite(腓壍) || 腓壍 <= 0 || !鵒壍.data)
                    return;
                橁壍.mutate({ goals: { ...鵒壍.data.goals, [玖壍[繣壍] ?? "monthlyConversions"]: 腓壍 } });
            }}>
          <Input variant="field" inputMode="decimal" aria-label="Monthly goal" placeholder={String(镵壍)} value={鏽壍} onChange={(乂壍) => 惬壍(乂壍.target.value)} className="w-32"/>
          <Button type="submit" variant="accent" size="xs" loading={橁壍.isPending}>
            Set goal
          </Button>
        </form>
      </div>);
    }
    const 洱壍 = 翛壍 > 0 ? 皆壍 / 翛壍 : 0;
    const 谠壍 = 洱壍 >= 0.97;
    return (<div className="flex flex-1 flex-col justify-center gap-4">
      <div className="flex items-baseline gap-2.5">
        <span className={cn("font-display text-[44px] leading-none font-semibold tracking-[-0.03em] tabular", 谠壍 ? "text-accent" : "text-warn")}>{`${Math.round(洱壍 * 100)}%`}</span>
        <span className="text-[13px] text-muted-3">of goal projected</span>
      </div>
      <Meter value={垗壍 / 翛壍} projected={皆壍 / 翛壍} marker={誨壍 / 殹壍} tone={谠壍 ? "accent" : "warn"} label={`Goal progress ${Math.round((垗壍 / 翛壍) * 100)}%`}/>
      <div className="grid grid-cols-3 gap-3">
        <MetaStat label="MTD" value={fmt(褰壍.data, 繣壍, 垗壍, 彴壍.money)}/>
        <MetaStat label="Projected" value={fmt(褰壍.data, 繣壍, 皆壍, 彴壍.money)} tone={谠壍 ? undefined : "warn"}/>
        <MetaStat label="Goal" value={fmt(褰壍.data, 繣壍, 翛壍, 彴壍.money)}/>
      </div>
    </div>);
}
export function TopMoversWidget({ config: 夏壍, rt: 矾壍, instance: 雭壍 }: WidgetProps<{
    metric?: string;
    limit?: number;
}>) {
    const 揜壍 = useCatalog();
    const 苋壍 = 夏壍.metric ?? "conversions";
    const { spec: 侺壍, ignored: 溩壍 } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: [苋壍, "cost"], dimensions: ["campaign"], compare: "previous_period" }, 矾壍.filters, 揜壍.data, 雭壍.filterOptOut), [苋壍, 矾壍.filters, 揜壍.data, 雭壍.filterOptOut]);
    useWidgetHints(溩壍);
    const 趘壍 = useQueryResult(揜壍.data ? 侺壍 : null);
    const 媇壍 = useMemo(() => [...(趘壍.data?.rows ?? [])]
        .filter((祶壍) => typeof 祶壍[`${苋壍}__delta`] === "number")
        .sort((顥壍, 敔壍) => Math.abs(敔壍[`${苋壍}__delta`] as number) - Math.abs(顥壍[`${苋壍}__delta`] as number))
        .slice(0, 夏壍.limit ?? 5), [趘壍.data, 苋壍, 夏壍.limit]);
    if (侺壍.compare === "none")
        return <InlineEmpty>Turn on a comparison period (top bar → More) to see movers.</InlineEmpty>;
    if (趘壍.error && !趘壍.data)
        return <ErrorState error={趘壍.error} onRetry={() => void 趘壍.refetch()}/>;
    if (!趘壍.data)
        return <SkeletonLines lines={5}/>;
    const 葃壍 = metricMeta(揜壍.data, 苋壍);
    const 儲壍 = Math.max(1e-9, ...媇壍.map((瀡壍) => Math.abs(瀡壍[`${苋壍}__delta`] as number)));
    return (<Refetching active={趘壍.isFetching && 趘壍.isPlaceholderData} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {媇壍.map((輐壍) => {
            const 寿壍 = 輐壍[`${苋壍}__delta`] as number;
            const 竮壍 = 輐壍[`${苋壍}__pct`] as number | null;
            const 駝壍 = deltaSentiment(葃壍.direction as MetricDirection, 竮壍);
            return (<button key={String(輐壍.campaign_id)} type="button" onClick={() => 矾壍.openCampaign(String(輐壍.campaign_id))} className="grid grid-cols-[minmax(0,1fr)_90px_70px] items-center gap-3 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-medium">{String(輐壍.campaign)}</span>
              <span className="h-1 rounded-pill bg-tone/5">
                <span className="block h-full rounded-pill" style={{ width: `${(Math.abs(寿壍) / 儲壍) * 100}%`, background: 駝壍 === "bad" ? "var(--crit)" : 駝壍 === "good" ? "var(--accent)" : "var(--faint)" }}/>
              </span>
            </span>
            <span className="text-right tabular">{`${寿壍 >= 0 ? "+" : "−"}${fmt(揜壍.data, 苋壍, Math.abs(寿壍), 矾壍.money)}`}</span>
            <span className={cn("text-right font-mono text-meta", 駝壍 === "good" ? "text-accent" : 駝壍 === "bad" ? "text-crit" : "text-muted")}>{formatDelta(竮壍)}</span>
          </button>);
        })}
      {!媇壍.length ? <InlineEmpty>No changes to rank.</InlineEmpty> : null}
    </Refetching>);
}
export function CumulativeSpendWidget({ rt: 曌壍 }: WidgetProps) {
    const 薻壍 = usePacing();
    const 努壍 = useMemo(() => prefersReducedMotion(), []);
    useWidgetSubtitle(薻壍.data ? `${薻壍.data.monthLabel} · actual · projected · ideal` : null);
    if (薻壍.error && !薻壍.data)
        return <ErrorState error={薻壍.error} onRetry={() => void 薻壍.refetch()}/>;
    if (!薻壍.data)
        return <Skeleton height="100%" className="min-h-[160px] w-full"/>;
    const 熙壍 = 薻壍.data;
    const 邈壍 = 熙壍.cumulative.map((嵷壍) => 嵷壍.date);
    const 籦壍 = (魕壍: ChartTokens) => {
        const 桄壍 = tickIndices(邈壍.length, 5);
        return {
            ...baseOption(魕壍, 努壍),
            grid: { left: 52, right: 8, top: 14, bottom: 22 },
            xAxis: categoryAxis(魕壍, 邈壍, { boundaryGap: false, axisLabel: { ...axisLabel(魕壍), interval: (蜳壍: number) => 桄壍.has(蜳壍), formatter: (吢壍: string) => formatShort(吢壍) } }),
            yAxis: valueAxis(魕壍, "money", 曌壍.money, { splitNumber: 4, max: (猑壍: {
                    max: number;
                }) => Math.max(猑壍.max, 熙壍.totals.monthlyTarget) * 1.06 }),
            tooltip: {
                ...baseOption(魕壍, 努壍).tooltip,
                trigger: "axis",
                formatter: (鈀壍: {
                    dataIndex: number;
                }[]) => {
                    const 廯壍 = 熙壍.cumulative[鈀壍[0]?.dataIndex ?? 0];
                    if (!廯壍)
                        return "";
                    const 緞壍: TipRow[] = [];
                    if (廯壍.actual !== null)
                        緞壍.push({ color: 魕壍.accentLine, label: "Actual", value: 棉壍(廯壍.actual, 曌壍.money) });
                    if (廯壍.projected !== null)
                        緞壍.push({ color: 魕壍.accentLine, dashed: true, label: "Projected", value: 棉壍(廯壍.projected, 曌壍.money) });
                    緞壍.push({ color: 魕壍.faint, label: "Ideal pace", value: 棉壍(廯壍.ideal, 曌壍.money) });
                    return tooltipHtml(formatShort(廯壍.date), 緞壍);
                },
            },
            series: [
                {
                    name: "Actual",
                    type: "line",
                    data: 熙壍.cumulative.map((鳍壍) => 鳍壍.actual),
                    symbol: "none",
                    lineStyle: { color: 魕壍.accentLine, width: 2 },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    markLine: {
                        symbol: "none",
                        silent: true,
                        label: { show: true, position: "insideEndTop", formatter: `Budget ${棉壍(熙壍.totals.monthlyTarget, 曌壍.money)}`, color: 魕壍.muted3, fontFamily: 魕壍.fontMono, fontSize: 10 },
                        lineStyle: { color: 魕壍.muted3, width: 1, type: "solid" },
                        data: [{ yAxis: 熙壍.totals.monthlyTarget }],
                    },
                },
                { name: "Projected", type: "line", data: 熙壍.cumulative.map((榼壍) => 榼壍.projected), symbol: "none", lineStyle: { color: 熙壍.totals.paceRatio > 1.05 ? 魕壍.warn : 魕壍.accentLine, width: 1.75, type: [5, 4] } },
                { name: "Ideal", type: "line", data: 熙壍.cumulative.map((被壍) => 被壍.ideal), symbol: "none", lineStyle: { color: 魕壍.faint, width: 1 } },
            ],
        };
    };
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-[18px] text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-accent-line"/>Actual</span>
        <span className="flex items-center gap-2"><span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: 熙壍.totals.paceRatio > 1.05 ? "var(--warn)" : "var(--accent-line)" }}/>Projected</span>
        <span className="flex items-center gap-2"><span className="h-px w-3.5 bg-faint"/>Ideal pace</span>
      </div>
      <div className="relative min-h-[140px] flex-1">
        <EChart className="absolute inset-0" build={籦壍} deps={[熙壍, 曌壍.money]} ariaLabel={`Cumulative spend for ${熙壍.monthLabel}: ${棉壍(熙壍.totals.mtdSpend, 曌壍.money)} to date, projected ${棉壍(熙壍.totals.projected, 曌壍.money)} against ${棉壍(熙壍.totals.monthlyTarget, 曌壍.money)}`}/>
      </div>
    </div>);
}
export function ForecastWidget({ config: 喚壍, rt: 璉壍 }: WidgetProps<{
    metric?: string;
}>) {
    const 鍸壍 = (["cost", "conversions", "conv_value", "clicks"].includes(喚壍.metric ?? "") ? 喚壍.metric : "cost") as "cost" | "conversions" | "conv_value" | "clicks";
    const 恧壍 = useBudgetForecast(鍸壍, { horizon: 30 });
    const 罖壍 = useCatalog();
    const 鹅壍 = useMemo(() => prefersReducedMotion(), []);
    if (恧壍.error && !恧壍.data)
        return <ErrorState error={恧壍.error} onRetry={() => void 恧壍.refetch()}/>;
    if (!恧壍.data)
        return <Skeleton height="100%" className="min-h-[160px] w-full"/>;
    const 欴壍 = 恧壍.data.history.slice(-42);
    const 訣壍 = 恧壍.data.points;
    const 園壍 = [...欴壍.map((瘁壍) => 瘁壍.date), ...訣壍.map((铰壍) => 铰壍.date)];
    const 懟壍 = metricMeta(罖壍.data, 鍸壍).format as MetricFormat;
    const 胎壍 = 恧壍.data.backtestMape;
    const 龽壍 = 恧壍.data.totals.next30;
    const 沬壍 = (讛壍: ChartTokens) => {
        const 墊壍 = tickIndices(園壍.length, 5);
        const 睹壍 = 欴壍.map(() => null);
        const 陨壍 = [...睹壍, ...訣壍.map((捗壍) => 捗壍.lo)];
        const 艆壍 = [...睹壍, ...訣壍.map((伵壍) => 伵壍.hi - 伵壍.lo)];
        return {
            ...baseOption(讛壍, 鹅壍),
            grid: { left: 52, right: 8, top: 10, bottom: 22 },
            xAxis: categoryAxis(讛壍, 園壍, { boundaryGap: false, axisLabel: { ...axisLabel(讛壍), interval: (渤壍: number) => 墊壍.has(渤壍), formatter: (贓壍: string) => formatShort(贓壍) } }),
            yAxis: valueAxis(讛壍, 懟壍, 璉壍.money, { splitNumber: 4 }),
            tooltip: {
                ...baseOption(讛壍, 鹅壍).tooltip,
                trigger: "axis",
                formatter: (娂壍: {
                    dataIndex: number;
                }[]) => {
                    const 磱壍 = 娂壍[0]?.dataIndex ?? 0;
                    const 韠壍 = 欴壍[磱壍];
                    if (韠壍)
                        return tooltipHtml(formatShort(韠壍.date), [{ color: 讛壍.accentLine, label: "Actual", value: formatMetricValue(懟壍, 韠壍.value, moneyOpts(璉壍.money)) }]);
                    const 擏壍 = 訣壍[磱壍 - 欴壍.length];
                    if (!擏壍)
                        return "";
                    return tooltipHtml(formatShort(擏壍.date), [
                        { color: 讛壍.accentLine, dashed: true, label: "Forecast", value: formatMetricValue(懟壍, 擏壍.yhat, moneyOpts(璉壍.money)) },
                        { label: "80% range", value: `${formatMetricValue(懟壍, 擏壍.lo, moneyOpts(璉壍.money))} – ${formatMetricValue(懟壍, 擏壍.hi, moneyOpts(璉壍.money))}` },
                    ]);
                },
            },
            series: [
                { name: "lo", type: "line", data: 陨壍, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, silent: true },
                { name: "band", type: "line", data: 艆壍, stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(4,191,157,0.14)" }, silent: true },
                { name: "Actual", type: "line", data: [...欴壍.map((莾壍) => 莾壍.value), ...訣壍.map(() => null)], symbol: "none", lineStyle: { color: 讛壍.accentLine, width: 2 } },
                { name: "Forecast", type: "line", data: [...欴壍.map((傭壍, 澜壍) => (澜壍 === 欴壍.length - 1 ? (欴壍[澜壍]?.value ?? null) : null)), ...訣壍.map((躋壍) => 躋壍.yhat)], symbol: "none", lineStyle: { color: 讛壍.accentLine, width: 1.75, type: [5, 4] } },
            ],
        };
    };
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-[18px] text-xs text-muted">
        <span className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-accent-line"/>Actual</span>
        <span className="flex items-center gap-2"><span className="w-3.5 border-t-[1.5px] border-dashed border-accent-line"/>Forecast</span>
        <span className="flex items-center gap-2"><span className="h-2 w-3.5 rounded-[2px] bg-teal/14"/>80% range</span>
        <span className="ml-auto font-mono text-micro tracking-label text-faint uppercase">{`Next 30 days ${formatMetricValue(懟壍, 龽壍.yhat, moneyOpts(璉壍.money))}${胎壍 !== null ? ` · backtest error ${(胎壍 * 100).toFixed(1)}%` : ""}`}</span>
      </div>
      <div className="relative min-h-[140px] flex-1">
        <EChart className="absolute inset-0" build={沬壍} deps={[恧壍.data, 璉壍.money, 懟壍]} ariaLabel={`30-day ${metricMeta(罖壍.data, 鍸壍).label} forecast with 80% range: about ${formatMetricValue(懟壍, 龽壍.yhat, moneyOpts(璉壍.money))}`}/>
      </div>
    </div>);
}
export function TodaySoFarWidget({ rt: 孺壍, instance: 穩壍 }: WidgetProps) {
    const 饘壍 = useCatalog();
    const 晇壍 = 孺壍.dataThrough;
    const 蔶壍 = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost"], dimensions: ["hour"] }, 孺壍.filters, 饘壍.data, [...(穩壍.filterOptOut ?? []), "range", "compare"]), [孺壍.filters, 饘壍.data, 穩壍.filterOptOut]);
    useWidgetHints(蔶壍.ignored);
    const 別壍 = useQueryResult(晇壍 && 饘壍.data ? { ...蔶壍.spec, dateRange: { start: 晇壍, end: 晇壍 }, compare: "none" } : null);
    const 焔壍 = useQueryResult(晇壍 && 饘壍.data ? { ...蔶壍.spec, dateRange: { start: addDays(晇壍, -28), end: addDays(晇壍, -1) }, compare: "none" } : null);
    const 逃壍 = useMemo(() => prefersReducedMotion(), []);
    useWidgetSubtitle(晇壍 ? `${formatShort(晇壍)} · hourly spend vs 28-day typical` : null);
    if (別壍.error && !別壍.data)
        return <ErrorState error={別壍.error} onRetry={() => void 別壍.refetch()}/>;
    if (!別壍.data || !焔壍.data)
        return <Skeleton height="100%" className="min-h-[140px] w-full"/>;
    const 峲壍 = (篡壍: Record<string, unknown>[], 髐壍 = 1) => Array.from({ length: 24 }, (枿壍, 蚮壍) => {
        const 厝壍 = 篡壍.find((犌壍) => Number(犌壍.hour) === 蚮壍);
        return 厝壍 && typeof 厝壍.cost === "number" ? 厝壍.cost / 髐壍 : 0;
    });
    const 酻壍 = 峲壍(別壍.data.rows);
    const 幪壍 = 峲壍(焔壍.data.rows, 28);
    const 絙壍 = 酻壍.reduce((鱈壍, 椷壍) => 鱈壍 + 椷壍, 0);
    const 蠦壍 = 幪壍.reduce((唕壍, 琄壍) => 唕壍 + 琄壍, 0);
    const 鋳壍 = 蠦壍 ? 絙壍 / 蠦壍 - 1 : null;
    const 忢壍 = (绑壍: ChartTokens) => ({
        ...baseOption(绑壍, 逃壍),
        grid: { left: 44, right: 6, top: 8, bottom: 20 },
        xAxis: categoryAxis(绑壍, Array.from({ length: 24 }, (鷀壍, 檯壍) => String(檯壍)), { axisLabel: { ...axisLabel(绑壍), interval: 5, formatter: (覞壍: string) => `${覞壍.padStart(2, "0")}h` } }),
        yAxis: valueAxis(绑壍, "money", 孺壍.money, { splitNumber: 3 }),
        tooltip: { ...baseOption(绑壍, 逃壍).tooltip, trigger: "axis", formatter: (嚍壍: {
                dataIndex: number;
            }[]) => {
                const 畼壍 = 嚍壍[0]?.dataIndex ?? 0;
                return tooltipHtml(`${String(畼壍).padStart(2, "0")}:00`, [{ color: 绑壍.accentLine, label: formatShort(晇壍), value: 棉壍(酻壍[畼壍], 孺壍.money) }, { color: 绑壍.faint, dashed: true, label: "Typical", value: 棉壍(幪壍[畼壍], 孺壍.money) }]);
            } },
        series: [
            { type: "bar", data: 酻壍, barMaxWidth: 12, itemStyle: { color: 绑壍.accentLine, borderRadius: [3, 3, 0, 0] } },
            { type: "line", data: 幪壍, symbol: "none", lineStyle: { color: 绑壍.faint, width: 1.25, type: [4, 4] } },
        ],
    });
    return (<div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[26px] leading-none font-semibold tabular">{棉壍(絙壍, 孺壍.money)}</span>
        <span className={cn("font-mono text-meta", 鋳壍 === null ? "text-muted" : Math.abs(鋳壍) < 0.1 ? "text-muted" : 鋳壍 > 0 ? "text-warn" : "text-muted")}>{鋳壍 === null ? "" : `${formatDelta(鋳壍)} vs typical`}</span>
      </div>
      <div className="relative min-h-[100px] flex-1">
        <EChart className="absolute inset-0" build={忢壍} deps={[別壍.data, 焔壍.data, 孺壍.money]} ariaLabel={`Hourly spend on ${晇壍}: ${棉壍(絙壍, 孺壍.money)}`}/>
      </div>
    </div>);
}
export function OpportunitiesWidget({ rt: 鑫壍, instance: 慚壍 }: WidgetProps) {
    const 聉壍 = useCatalog();
    const { spec: 鼸壍, ignored: 氧壍 } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "roas", "lost_is_budget", "search_is"], dimensions: ["campaign"], sort: [{ key: "lost_is_budget", dir: "desc" }], having: [{ metric: "lost_is_budget", op: "gt", value: 0.1 }], limit: 6 }, 鑫壍.filters, 聉壍.data, 慚壍.filterOptOut), [鑫壍.filters, 聉壍.data, 慚壍.filterOptOut]);
    useWidgetHints(氧壍);
    const 謖壍 = useQueryResult(聉壍.data ? { ...鼸壍, totals: true } : null);
    const 堅壍 = useQueryResult(聉壍.data ? { ...鼸壍, dimensions: [], having: [], sort: [], limit: undefined } : null);
    if (謖壍.error && !謖壍.data)
        return <ErrorState error={謖壍.error} onRetry={() => void 謖壍.refetch()}/>;
    if (!謖壍.data)
        return <SkeletonLines lines={4}/>;
    const 直壍 = 堅壍.data?.totals?.roas ?? null;
    const 闣壍 = 謖壍.data.rows.filter((拒壍) => 直壍 === null || (typeof 拒壍.roas === "number" && 拒壍.roas >= 直壍));
    if (!闣壍.length)
        return <InlineEmpty>No budget-limited campaigns beat the account ROAS right now.</InlineEmpty>;
    return (<Refetching active={謖壍.isFetching && 謖壍.isPlaceholderData} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {闣壍.map((臁壍) => {
            const 亰壍 = 臁壍.lost_is_budget as number;
            const 涟壍 = (臁壍.search_is as number | null) ?? null;
            const 貎壍 = 涟壍 && 涟壍 > 0 ? ((臁壍.cost as number) * 亰壍) / 涟壍 / Math.max(1, 謖壍.data?.meta.range.days ?? 30) : null;
            return (<button key={String(臁壍.campaign_id)} type="button" onClick={() => 鑫壍.openCampaign(String(臁壍.campaign_id))} className="flex items-center gap-3 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <Dot tone="accent" halo/>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{String(臁壍.campaign)}</span>
              <span className="text-xs text-muted-3">{`Loses ${(亰壍 * 100).toFixed(0)}% of impressions to budget · ROAS ${formatMetricValue("ratio", 臁壍.roas as number)}${直壍 !== null ? ` vs ${formatMetricValue("ratio", 直壍)} account` : ""}`}</span>
            </span>
            {貎壍 !== null ? <span className="font-mono text-meta whitespace-nowrap text-accent">{`≈ +${棉壍(貎壍, 鑫壍.money)}/day`}</span> : null}
          </button>);
        })}
    </Refetching>);
}
export function AlertStatusWidget() {
    const 好壍 = useAnomalies({ status: "open" });
    if (好壍.error && !好壍.data)
        return <ErrorState error={好壍.error} onRetry={() => void 好壍.refetch()}/>;
    if (!好壍.data)
        return <SkeletonLines lines={3}/>;
    const 硬壍 = 好壍.data.signals.filter((靛壍) => 靛壍.status === "open");
    const 摊壍 = (茹壍: "critical" | "warning" | "info") => 硬壍.filter((倨壍) => 倨壍.severity === 茹壍).length;
    return (<div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {(["critical", "warning", "info"] as const).map((漗壍) => (<Link key={漗壍} href={`/anomalies?sev=${漗壍}`} className="flex min-w-0 flex-col gap-2 rounded-mini border border-line-soft bg-fill px-3 py-2.5 text-fg hover:border-tone/18 hover:opacity-100">
            <span className="truncate font-mono text-[9px] tracking-[0.08em] text-muted-3 uppercase">{SEVERITY_META[漗壍].label}</span>
            <span className="flex items-center gap-2">
              <Dot tone={SEVERITY_META[漗壍].tone} halo size={7}/>
              <span className="font-display text-[26px] leading-none font-semibold tabular">{摊壍(漗壍)}</span>
            </span>
          </Link>))}
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-muted-3">
        <span>{好壍.data.dataThrough ? `Evaluated through ${formatShort(好壍.data.dataThrough)}` : "Evaluated on the latest complete day"}</span>
        <Link href="/anomalies/notifications">Alert routes →</Link>
      </div>
    </div>);
}
export function DataHealthWidget() {
    const 踆壍 = useStatus();
    if (!踆壍.data)
        return <SkeletonLines lines={4}/>;
    const 嫵壍 = 踆壍.data;
    const 秤壍: {
        label: string;
        value: string;
        tone: "accent" | "warn" | "faint";
    }[] = [
        { label: "Google Ads", value: 嫵壍.mode === "live" ? `Live · API ${嫵壍.googleAds.apiVersion}` : `No live data · ${(嫵壍.reason?.code ?? "no_env").replace(/_/g, " ")}`, tone: 嫵壍.mode === "live" ? "accent" : "warn" },
        { label: "Data through", value: formatShort(嫵壍.dataThrough), tone: "accent" },
        { label: "Storage", value: 嫵壍.store.driver === "file" ? "File store" : "Memory (not persisted)", tone: 嫵壍.store.driver === "file" ? "accent" : "warn" },
    ];
    return (<div className="flex flex-col">
      {秤壍.map((飓壍) => (<div key={飓壍.label} className="flex items-center gap-2.5 border-b border-line-soft py-2 text-[13px] last:border-0">
          <Dot tone={飓壍.tone} size={7}/>
          <span className="flex-1 text-muted">{飓壍.label}</span>
          <span className="truncate text-right font-medium">{飓壍.value}</span>
        </div>))}
    </div>);
}
export function SearchTermWasteWidget({ config: 旂壍, rt: 蒱壍, instance: 冠壍 }: WidgetProps<{
    limit?: number;
}>) {
    const 炏壍 = useCatalog();
    const { spec: 轾壍, ignored: 屭壍 } = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "clicks", "conversions"], dimensions: ["search_term", "campaign"], having: [{ metric: "conversions", op: "eq", value: 0 }], sort: [{ key: "cost", dir: "desc" }], limit: 旂壍.limit ?? 8 }, 蒱壍.filters, 炏壍.data, 冠壍.filterOptOut), [旂壍.limit, 蒱壍.filters, 炏壍.data, 冠壍.filterOptOut]);
    useWidgetHints(屭壍);
    const 筜壍 = useQueryResult(炏壍.data ? { ...轾壍, totals: true } : null);
    if (筜壍.error && !筜壍.data)
        return <ErrorState error={筜壍.error} onRetry={() => void 筜壍.refetch()}/>;
    if (!筜壍.data)
        return <SkeletonLines lines={5}/>;
    if (!筜壍.data.rows.length)
        return <InlineEmpty>No search terms spent money without converting in this range.</InlineEmpty>;
    const 驋壍 = 筜壍.data.rows.reduce((机壍, 蘩壍) => 机壍 + ((蘩壍.cost as number) ?? 0), 0);
    return (<Refetching active={筜壍.isFetching && 筜壍.isPlaceholderData} className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-3">
        <span>{`${棉壍(驋壍, 蒱壍.money)} on ${筜壍.data.rows.length} terms with no conversions`}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-[520px] grid-cols-[minmax(160px,2fr)_minmax(140px,1.4fr)_80px_60px] gap-x-3 text-[13px] tabular">
          <span className="border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">Search term</span>
          <span className="border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">Campaign</span>
          <span className="border-b border-line pb-2 text-right font-mono text-micro tracking-label text-faint uppercase">Cost</span>
          <span className="border-b border-line pb-2 text-right font-mono text-micro tracking-label text-faint uppercase">Clicks</span>
          {筜壍.data.rows.map((匘壍, 爇壍) => (<div key={爇壍} className="contents">
              <span className="truncate border-b border-line-soft py-2 font-medium">{String(匘壍.search_term)}</span>
              <button type="button" onClick={() => 蒱壍.openCampaign(String(匘壍.campaign_id))} className="truncate border-b border-line-soft py-2 text-left text-muted hover:text-accent">
                {String(匘壍.campaign)}
              </button>
              <span className="border-b border-line-soft py-2 text-right">{棉壍(匘壍.cost as number, 蒱壍.money)}</span>
              <span className="border-b border-line-soft py-2 text-right text-muted">{formatMetricValue("number", 匘壍.clicks as number)}</span>
            </div>))}
        </div>
      </div>
    </Refetching>);
}
export function NoteWidget({ config: 郶壍, rt: 工壍, setConfig: 糔壍 }: WidgetProps<{
    text?: string;
}>) {
    const 鯃壍 = 郶壍.text ?? "";
    if (工壍.editing) {
        return <Textarea aria-label="Note text (Markdown)" value={鯃壍} onChange={(梲壍) => 糔壍({ text: 梲壍.target.value.slice(0, 4000) })} className="min-h-0 flex-1 resize-none font-mono text-xs" placeholder="Write context for this dashboard — **Markdown** supported."/>;
    }
    if (!鯃壍.trim())
        return <InlineEmpty>Empty note — press Customize to write one.</InlineEmpty>;
    return (<div className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-muted">
      <糫壍 text={鯃壍}/>
    </div>);
}
export { fmt as formatWidgetValue };
