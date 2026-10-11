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
const 钌壍: {
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
const 慻壍 = (聪壍: number, 齙壍: number) => (齙壍 > 0 ? 聪壍 / 齙壍 : null);
const 汈壍: Record<string, (謷壍: Daily) => number | null> = {
    cost: (堦壍) => 堦壍.cost,
    conversions: (眕壍) => 眕壍.conversions,
    cpa: (阄壍) => 慻壍(阄壍.cost, 阄壍.conversions),
    roas: (拳壍) => 慻壍(拳壍.conv_value, 拳壍.cost),
    ctr: (臢壍) => 慻壍(臢壍.clicks, 臢壍.impressions),
    cpc: (仑壍) => 慻壍(仑壍.cost, 仑壍.clicks),
};
export function OverviewTab({ detail: 淀壍, onTab: 貯壍 }: {
    detail: CampaignDetail;
    onTab: (妞壍: DetailTab) => void;
}) {
    const { money: 碍壍, compareOn: 靼壍, filters: 摫壍 } = useCampaignContext();
    const 荚壍 = useAnnotations(淀壍.range.start, 淀壍.range.end, { includeChanges: true, campaignId: 淀壍.campaign.id });
    const 偉壍 = 淀壍.signals.filter((漸壍) => 漸壍.status === "open");
    const 踧壍 = [...淀壍.changes].sort((嬖壍, 稅壍) => 稅壍.ts.localeCompare(嬖壍.ts)).slice(0, 3);
    return (<>
      <TileGrid min={150}>
        {钌壍.map((飴壍) => {
            const 旣壍 = 淀壍.kpis[飴壍.key];
            const 蓒壍 = 淀壍.prev?.[飴壍.key];
            const 凁壍 = 靼壍 && 淀壍.prev ? metricSentiment(飴壍.key, pctChange(旣壍, 蓒壍)) : null;
            return (<StatTile key={飴壍.key} label={飴壍.label} value={<span className="tabular">{formatMetric(飴壍.key, 旣壍, 碍壍)}</span>}>
              <div className="flex items-center gap-2">
                {靼壍 && 淀壍.prev ? <MetricDelta metric={飴壍.key} cur={旣壍} prev={蓒壍}/> : null}
                <Sparkline values={淀壍.daily.map(汈壍[飴壍.key] ?? (() => null))} color={凁壍 === "bad" ? "var(--crit)" : "var(--accent)"} className="min-w-0 flex-1"/>
              </div>
            </StatTile>);
        })}
      </TileGrid>

      <div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex min-w-0 flex-col gap-4">
          <CardHeader title="Daily trend" sub={`${rangeShortLabel(摫壍.rangeKey, 摫壍.range)} · spend vs daily budget · conversions`}/>
          <鯤壍 hasMarks={!!荚壍.data?.length}/>
          <Cmp32 detail={淀壍} money={碍壍} marks={荚壍.data ?? []}/>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          {淀壍.pacing && 淀壍.pacing.monthlyTarget > 0 ? <Cmp31 detail={淀壍} money={碍壍}/> : null}
          <Card className="flex flex-col gap-3.5">
            <CardHeader title="Open signals" sub={偉壍.length ? `${偉壍.length} need${偉壍.length === 1 ? "s" : ""} attention` : "Nothing open"} action={<Button variant="link" className="text-xs" onClick={() => 貯壍("signals")}>
                  All signals →
                </Button>}/>
            {偉壍.length ? 偉壍.slice(0, 3).map((炰壍) => <SignalItem key={炰壍.id} signal={炰壍}/>) : <span className="text-[13px] text-muted-3">Operating within expected range.</span>}
          </Card>
          <Card className="flex flex-col gap-3">
            <CardHeader title="Recent changes" sub="Google Ads change history" action={<Button variant="link" className="text-xs" onClick={() => 貯壍("changes")}>
                  All changes →
                </Button>}/>
            {踧壍.length ? (<div className="flex flex-col">
                {踧壍.map((辟壍) => (<div key={辟壍.id} className="flex gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                    <span className="w-12 shrink-0 font-mono text-micro tracking-[0.08em] text-faint uppercase">{formatShort(辟壍.date)}</span>
                    <span className="min-w-0 flex-1 leading-snug text-muted">{辟壍.summary}</span>
                  </div>))}
              </div>) : (<span className="text-[13px] text-muted-3">No changes in the last 30 days.</span>)}
          </Card>
        </div>
      </div>
    </>);
}
function Cmp31({ detail: 筽壍, money: 马壍 }: {
    detail: CampaignDetail;
    money: MoneyFmt;
}) {
    const { status: 杛壍 } = useCampaignContext();
    const 虊壍 = pacingMonthOf(杛壍.data?.dataThrough);
    if (!筽壍.pacing)
        return null;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Budget pacing" sub={`${虊壍.label} · month to date`}/>
      <PacingBlock pacing={筽壍.pacing} money={马壍} monthLabel={虊壍.month} marker={虊壍.marker}/>
      {筽壍.pacing.recommendedDaily ? <span className="text-xs text-muted-3">{`Recommended daily budget: ${money(筽壍.pacing.recommendedDaily, 马壍)}`}</span> : null}
    </Card>);
}
function 匹壍({ color: 爨壍, dashed: 鄗壍, label: 帆壍, dot: 糵壍 }: {
    color: string;
    dashed?: boolean;
    label: string;
    dot?: boolean;
}) {
    return (<span className="flex items-center gap-2">
      {糵壍 ? (<span aria-hidden className="text-[9px] leading-none" style={{ color: 爨壍 }}>
          ●
        </span>) : (<span aria-hidden className="w-3.5" style={鄗壍 ? { height: 0, borderTop: `1.5px dashed ${爨壍}` } : { height: 2, background: 爨壍 }}/>)}
      {帆壍}
    </span>);
}
function 鯤壍({ hasMarks: 棓壍 }: {
    hasMarks: boolean;
}) {
    return (<div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
      <匹壍 color="var(--accent-line)" label="Spend"/>
      <匹壍 color="var(--faint)" dashed label="Daily budget"/>
      <匹壍 color="var(--mint)" label="Conversions"/>
      {棓壍 ? (<>
          <匹壍 color="var(--muted-3)" dot label="Change"/>
          <匹壍 color="var(--accent)" dot label="Note"/>
        </>) : null}
    </div>);
}
const 蟂壍 = (咱壍: string, 玠壍 = 64) => (咱壍.length > 玠壍 ? `${咱壍.slice(0, 玠壍 - 1)}…` : 咱壍);
function Cmp32({ detail: 彾壍, money: 繭壍, marks: 鵜壍 }: {
    detail: CampaignDetail;
    money: MoneyFmt;
    marks: AnnotationMark[];
}) {
    const 橋壍 = useMemo(() => prefersReducedMotion(), []);
    const 褺壍 = useMemo(() => {
        const 嘩壍 = new Map<string, {
            changes: string[];
            notes: string[];
        }>();
        for (const 甘壍 of 鵜壍) {
            const 鐇壍 = 嘩壍.get(甘壍.date) ?? { changes: [], notes: [] };
            (甘壍.source === "change" ? 鐇壍.changes : 鐇壍.notes).push(甘壍.text);
            嘩壍.set(甘壍.date, 鐇壍);
        }
        return 嘩壍;
    }, [鵜壍]);
    const 惶壍 = useMemo(() => new Map(彾壍.budgetLine.map((翥壍) => [翥壍.date, 翥壍.value])), [彾壍.budgetLine]);
    const 黔壍 = (毃壍: ChartTokens) => {
        const 課壍 = 彾壍.daily.map((垡壍) => 垡壍.date);
        const 皐壍 = new Set(課壍);
        const 长壍 = tickIndices(課壍.length);
        const 扮壍 = (腝壍: 0 | 1) => [...褺壍.entries()]
            .filter(([乌壍]) => 皐壍.has(乌壍))
            .map(([活壍, 谪壍]) => ({
            xAxis: 活壍,
            lineStyle: { color: 谪壍.changes.length ? 毃壍.muted3 : 毃壍.accentLine, type: [3, 3], width: 1, opacity: 0.8 },
            label: 腝壍 === 0 ? { show: true, position: "end", formatter: "●", color: 谪壍.changes.length ? 毃壍.muted3 : 毃壍.accent, fontSize: 9, distance: 2 } : { show: false },
        }));
        const 夙壍 = { type: "category" as const, data: 課壍, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false } };
        const 砈壍 = (雷壍: number) => money(雷壍, 繭壍, Math.abs(雷壍) < 100 && !Number.isInteger(雷壍) ? 2 : 0);
        return {
            ...baseOption(毃壍, 橋壍),
            grid: [
                { left: 52, right: 8, top: 16, height: "58%" },
                { left: 52, right: 8, top: "74%", bottom: 22 },
            ],
            axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: 毃壍.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } },
            xAxis: [
                { ...夙壍, gridIndex: 0, axisLabel: { show: false }, axisPointer: { show: true, label: { show: false } } },
                { ...夙壍, gridIndex: 1, axisLabel: { ...axisLabel(毃壍), interval: (揦壍: number) => 长壍.has(揦壍), formatter: (苕壍: string) => formatShort(苕壍), alignMinLabel: "left", alignMaxLabel: "right" }, axisPointer: { show: true, label: { show: false } } },
            ],
            yAxis: [valueAxis(毃壍, "money", 繭壍.currency, { gridIndex: 0, splitNumber: 4, axisLabel: { ...axisLabel(毃壍), formatter: 砈壍 } }), valueAxis(毃壍, "decimal", undefined, { gridIndex: 1, splitNumber: 2 })],
            tooltip: {
                ...baseOption(毃壍, 橋壍).tooltip,
                trigger: "axis",
                formatter: (俄壍: {
                    dataIndex: number;
                }[]) => {
                    const 溳壍 = 彾壍.daily[俄壍[0]?.dataIndex ?? 0];
                    if (!溳壍)
                        return "";
                    const 趢壍 = 惶壍.get(溳壍.date);
                    const 媑壍: TipRow[] = [
                        { color: 毃壍.accentLine, label: "Spend", value: money(溳壍.cost, 繭壍, undefined, false) },
                        ...(趢壍 ? [{ color: 毃壍.faint, dashed: true, label: "Daily budget", value: money(趢壍, 繭壍, undefined, false) }] : []),
                        { color: 毃壍.mint, label: "Conversions", value: formatMetricValue("decimal", 溳壍.conversions) },
                        { label: "CPA", value: money(慻壍(溳壍.cost, 溳壍.conversions), 繭壍, 2) },
                    ];
                    const 禀壍 = 褺壍.get(溳壍.date);
                    禀壍?.changes.slice(0, 3).forEach((顯壍) => 媑壍.push({ color: 毃壍.muted3, label: `Change · ${蟂壍(顯壍)}`, value: "" }));
                    禀壍?.notes.slice(0, 3).forEach((敞壍) => 媑壍.push({ color: 毃壍.accent, label: `Note · ${蟂壍(敞壍)}`, value: "" }));
                    return tooltipHtml(formatLong(溳壍.date), 媑壍);
                },
            },
            series: [
                {
                    name: "Daily budget",
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: 彾壍.daily.map((葍壍) => 惶壍.get(葍壍.date) ?? null),
                    symbol: "none",
                    step: "middle",
                    lineStyle: { color: 毃壍.faint, width: 1.25, type: [4, 4] },
                    silent: true,
                    z: 1,
                },
                {
                    name: "Spend",
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: 彾壍.daily.map((儼壍) => 儼壍.cost),
                    symbol: "circle",
                    symbolSize: 8,
                    showSymbol: false,
                    lineStyle: { color: 毃壍.accentLine, width: 2 },
                    itemStyle: { color: 毃壍.accent, borderColor: 毃壍.surface, borderWidth: 2 },
                    emphasis: { scale: false, itemStyle: { shadowBlur: 0 } },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    markLine: { symbol: "none", silent: true, animation: false, data: 扮壍(0) },
                    z: 3,
                },
                {
                    name: "Conversions",
                    type: "line",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: 彾壍.daily.map((瀫壍) => 瀫壍.conversions),
                    symbol: "circle",
                    symbolSize: 7,
                    showSymbol: false,
                    lineStyle: { color: 毃壍.mint, width: 1.5, opacity: 毃壍.theme === "dark" ? 0.85 : 1 },
                    itemStyle: { color: 毃壍.mint, borderColor: 毃壍.surface, borderWidth: 2 },
                    markLine: { symbol: "none", silent: true, animation: false, data: 扮壍(1) },
                    z: 2,
                },
            ],
        };
    };
    const 輚壍 = [...褺壍.values()].reduce((尉壍, 竸壍) => 尉壍 + 竸壍.changes.length, 0);
    return (<div className="relative h-[280px] cursor-crosshair">
      <EChart className="absolute inset-0" build={黔壍} deps={[彾壍.daily, 彾壍.budgetLine, 褺壍, 繭壍.currency, 繭壍.fx]} ariaLabel={`${彾壍.campaign.name}: daily spend against the daily budget and daily conversions, ${formatLong(彾壍.range.start)} to ${formatLong(彾壍.range.end)}${輚壍 ? `, ${輚壍} change event${輚壍 === 1 ? "" : "s"} marked` : ""}`}/>
    </div>);
}
