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
const 峛壍 = new Set(["date", "week", "month", "quarter", "year"]);
const 篊壍 = 6;
function 骹壍({ items: 枨壍 }: {
    items: {
        label: string;
        color: string;
    }[];
}) {
    if (枨壍.length < 2)
        return null;
    return (<div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
      {枨壍.map((蚗壍) => (<span key={蚗壍.label} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: 蚗壍.color }}/>
          {蚗壍.label}
        </span>))}
    </div>);
}
function 历壍({ children: 牵壍 }: {
    children: React.ReactNode;
}) {
    return <div className="relative min-h-[120px] flex-1">{牵壍}</div>;
}
function 酤壍(幓壍: string, 終壍: string): string {
    if (幓壍 === "date" || 幓壍 === "week")
        return /^\d{4}-\d{2}-\d{2}$/.test(終壍) ? formatShort(終壍) : 終壍;
    return 終壍;
}
function 鰱壍(椠壍: QueryResult["rows"], 蠏壍: string, 哾壍: string, 班壍: string) {
    const 鋜壍: string[] = [];
    const 忋壍 = new Set<string>();
    const 纺壍 = new Map<string, number>();
    for (const 鶩壍 of 椠壍) {
        const 檘壍 = String(鶩壍[蠏壍]);
        if (!忋壍.has(檘壍)) {
            忋壍.add(檘壍);
            鋜壍.push(檘壍);
        }
        const 覇壍 = rowLabel(鶩壍, 哾壍);
        纺壍.set(覇壍, (纺壍.get(覇壍) ?? 0) + (typeof 鶩壍[班壍] === "number" ? (鶩壍[班壍] as number) : 0));
    }
    鋜壍.sort();
    const 噶壍 = [...纺壍.entries()].sort((略壍, 鑔壍) => 鑔壍[1] - 略壍[1]).map(([慃壍]) => 慃壍);
    const 耲壍 = 噶壍.slice(0, 噶壍.length > 篊壍 ? 篊壍 - 1 : 篊壍);
    const 鼡壍 = 噶壍.length > 耲壍.length;
    const 氐壍 = new Map(鋜壍.map((諿壍, 埮壍) => [諿壍, 埮壍]));
    const 盝壍 = new Map<string, (number | null)[]>([...耲壍, ...(鼡壍 ? ["Other"] : [])].map((闌壍) => [闌壍, 鋜壍.map(() => null)]));
    for (const 抻壍 of 椠壍) {
        const 膪壍 = rowLabel(抻壍, 哾壍);
        const 亙壍 = 耲壍.includes(膪壍) ? 膪壍 : "Other";
        const 消壍 = 盝壍.get(亙壍);
        const 豷壍 = 氐壍.get(String(抻壍[蠏壍]));
        if (!消壍 || 豷壍 === undefined)
            continue;
        const 奦壍 = typeof 抻壍[班壍] === "number" ? (抻壍[班壍] as number) : 0;
        消壍[豷壍] = (消壍[豷壍] ?? 0) + 奦壍;
    }
    return { times: 鋜壍, series: [...盝壍.entries()].map(([硕壍, 靄壍]) => ({ name: 硕壍, values: 靄壍 })) };
}
type Slot = number | "accent" | "faint" | "other";
const 搳壍 = (茢壍: ChartTokens, 們壍: Slot) => (們壍 === "accent" ? 茢壍.accentLine : 們壍 === "faint" ? 茢壍.faint : 們壍 === "other" ? 茢壍.other : (茢壍.series[們壍 % 6] ?? 茢壍.other));
const 漀壍 = (路壍: Slot) => (路壍 === "accent" ? "var(--accent-line)" : 路壍 === "faint" ? "var(--faint)" : 路壍 === "other" ? "var(--series-other)" : `var(--series-${(路壍 % 6) + 1})`);
interface Line {
    name: string;
    key: string;
    values: (number | null)[];
    slot: Slot;
    dashed?: boolean;
}
export function LineViz(嫞壍: VizProps & {
    area?: boolean;
}) {
    const { spec: 种壍, rt: 颼壍, catalog: 斫壍, title: 蒚壍, area: 冉壍 } = 嫞壍;
    const 灸壍 = useQueryResult(种壍);
    const 轧壍 = 种壍.dimensions ?? [];
    const 屖壍 = 轧壍.find((筅壍) => 峛壍.has(筅壍)) ?? 轧壍[0] ?? "date";
    const 騴壍 = 轧壍.find((朣壍) => 朣壍 !== 屖壍);
    const 蘒壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={灸壍} skeletonHeight="100%">
      {(匁壍) => {
            const 燰壍 = 种壍.metrics ?? [];
            type Panel = {
                format: MetricFormat;
                lines: Line[];
            };
            let 郟壍: string[];
            let 巎壍: Panel[];
            if (騴壍) {
                const 粽壍 = 燰壍[0] ?? "cost";
                const 鮬壍 = 鰱壍(匁壍.rows, 屖壍, 騴壍, 粽壍);
                郟壍 = 鮬壍.times;
                巎壍 = [{ format: metricMeta(斫壍, 粽壍).format as MetricFormat, lines: 鮬壍.series.map((梛壍, 螊壍) => ({ name: 梛壍.name, key: 粽壍, values: 梛壍.values, slot: 梛壍.name === "Other" ? "other" : 嵉壍(騴壍, 梛壍.name, 螊壍) })) }];
            }
            else {
                const 呹壍 = [...匁壍.rows].sort((獨壍, 鉗壍) => String(獨壍[屖壍]).localeCompare(String(鉗壍[屖壍])));
                郟壍 = 呹壍.map((彆壍) => String(彆壍[屖壍]));
                const 縵壍 = new Map<MetricFormat, Panel>();
                const 鴤壍 = (樓壍: string) => 呹壍.map((褂壍) => (typeof 褂壍[樓壍] === "number" ? (褂壍[樓壍] as number) : null));
                for (const 嗱壍 of 燰壍) {
                    const 瓠壍 = metricMeta(斫壍, 嗱壍).format as MetricFormat;
                    const 鏏壍 = 縵壍.get(瓠壍) ?? { format: 瓠壍, lines: [] };
                    縵壍.set(瓠壍, 鏏壍);
                    鏏壍.lines.push({ name: metricMeta(斫壍, 嗱壍).label, key: 嗱壍, values: 鴤壍(嗱壍), slot: 鏏壍.lines.length });
                    if (种壍.compare && 种壍.compare !== "none" && 燰壍.length === 1)
                        鏏壍.lines.push({ name: `${metricMeta(斫壍, 嗱壍).label}, previous`, key: `${嗱壍}__prev`, dashed: true, values: 鴤壍(`${嗱壍}__prev`), slot: "faint" });
                }
                巎壍 = [...縵壍.values()];
                for (const 悾壍 of 巎壍)
                    if (悾壍.lines.filter((羭壍) => !羭壍.dashed).length === 1)
                        for (const 麜壍 of 悾壍.lines)
                            if (!麜壍.dashed)
                                麜壍.slot = "accent";
            }
            const 残壍 = 巎壍.flatMap((詺壍) => 詺壍.lines);
            const 坩壍 = 残壍.filter((癘壍) => !癘壍.dashed).map((镇壍) => ({ label: 镇壍.name, color: 漀壍(镇壍.slot) }));
            const 戶壍 = (脥壍: ChartTokens) => {
                const 且壍 = tickIndices(郟壍.length);
                const 洃壍 = 巎壍.length;
                const 诲壍 = 巎壍.map((壡壍, 矐壍) => ({ left: 52, right: 8, top: `${(矐壍 * 100) / 洃壍 + 2}%`, height: `${100 / 洃壍 - (洃壍 > 1 ? 10 : 12)}%` }));
                const 隿壍 = 巎壍.flatMap((掮壍, 芝壍) => 掮壍.lines.map((侌壍) => {
                    const 湻壍 = 搳壍(脥壍, 侌壍.slot);
                    const 赪壍 = 掮壍.lines.filter((婙壍) => !婙壍.dashed).length === 1;
                    return {
                        name: 侌壍.name,
                        type: "line",
                        xAxisIndex: 芝壍,
                        yAxisIndex: 芝壍,
                        data: 侌壍.values,
                        symbol: "circle",
                        symbolSize: 8,
                        showSymbol: false,
                        lineStyle: { color: 湻壍, width: 侌壍.dashed ? 1.25 : 2, type: 侌壍.dashed ? [4, 4] : "solid" },
                        itemStyle: { color: 湻壍, borderColor: 脥壍.surface, borderWidth: 2 },
                        areaStyle: 冉壍 && !侌壍.dashed ? (赪壍 && !騴壍 ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } } : { color: 湻壍, opacity: 0.16 }) : undefined,
                        stack: 冉壍 && 騴壍 ? "total" : undefined,
                    };
                }));
                return {
                    ...baseOption(脥壍, 蘒壍),
                    grid: 诲壍,
                    axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: 脥壍.line } },
                    xAxis: 巎壍.map((祈壍, 頷壍) => ({
                        type: "category",
                        data: 郟壍,
                        gridIndex: 頷壍,
                        boundaryGap: false,
                        axisLine: { show: false },
                        axisTick: { show: false },
                        axisLabel: 頷壍 === 洃壍 - 1 ? { ...axisLabel(脥壍), interval: (攦壍: number) => 且壍.has(攦壍), formatter: (萕壍: string) => 酤壍(屖壍, 萕壍) } : { show: false },
                    })),
                    yAxis: 巎壍.map((億壍, 濳壍) => valueAxis(脥壍, 億壍.format, 颼壍.money, { gridIndex: 濳壍, splitNumber: 洃壍 > 1 ? 2 : 4 })),
                    tooltip: {
                        ...baseOption(脥壍, 蘒壍).tooltip,
                        trigger: "axis",
                        formatter: (転壍: {
                            seriesIndex: number;
                            dataIndex: number;
                            value: number | null;
                        }[]) => {
                            const 寑壍 = 転壍[0]?.dataIndex ?? 0;
                            const 竀壍: TipRow[] = 転壍
                                .map((馯壍) => {
                                const 暞壍 = 残壍[馯壍.seriesIndex];
                                if (!暞壍)
                                    return null;
                                return { color: 搳壍(脥壍, 暞壍.slot), dashed: 暞壍.dashed, label: 暞壍.name, value: fmt(斫壍, 暞壍.key.replace("__prev", ""), 馯壍.value, 颼壍.money, { compact: false }) } as TipRow;
                            })
                                .filter((薍壍): 薍壍 is TipRow => !!薍壍);
                            return tooltipHtml(酤壍(屖壍, 郟壍[寑壍] ?? ""), 竀壍);
                        },
                    },
                    series: 隿壍,
                };
            };
            return (<div className="flex min-h-0 flex-1 flex-col gap-3">
            <骹壍 items={坩壍}/>
            <历壍>
              <EChart className="absolute inset-0" build={戶壍} deps={[匁壍, 冉壍, 騴壍, 颼壍.money, 斫壍]} ariaLabel={`${蒚壍}: line chart`}/>
            </历壍>
          </div>);
        }}
    </QueryState>);
}
const 剼壍 = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
const 煫壍 = ["Google Ads", "Meta Ads", "Microsoft Advertising", "TikTok Ads", "LinkedIn Ads"];
const 遚壍 = ["Mobile", "Desktop", "Tablet", "Connected TV", "Other"];
function 嵉壍(簸壍: string, 鬧壍: string, 栖壍: number): number {
    const 蜅壍 = 簸壍 === "campaign_type" ? 剼壍 : 簸壍 === "platform" ? 煫壍 : 簸壍 === "device" ? 遚壍 : null;
    const 叴壍 = 蜅壍 ? 蜅壍.indexOf(鬧壍) : -1;
    return 叴壍 >= 0 ? 叴壍 : 栖壍;
}
export function BarViz({ spec: 狣壍, rt: 釒壍, catalog: 廁壍, title: 綰壍, viz: 鲟壍 }: VizProps) {
    const 榎壍 = useQueryResult(狣壍);
    const 衽壍 = 狣壍.dimensions?.[0] ?? "campaign_type";
    const [啬壍 = "cost", 瑛壍] = 狣壍.metrics ?? [];
    const 鍊壍 = 鲟壍.horizontal ?? !峛壍.has(衽壍);
    const 怹壍 = useMemo(() => prefersReducedMotion(), []);
    const 缨壍 = 衽壍 === "campaign_type" || 衽壍 === "platform" || 衽壍 === "device";
    return (<QueryState q={榎壍} skeletonHeight="100%">
      {(鸗壍) => {
            const 欆壍 = 峛壍.has(衽壍) ? [...鸗壍.rows].sort((觵壍, 囤壍) => String(觵壍[衽壍]).localeCompare(String(囤壍[衽壍]))) : 鸗壍.rows.slice(0, 24);
            const 痓壍 = 欆壍.map((铂壍) => (峛壍.has(衽壍) ? 酤壍(衽壍, rowLabel(铂壍, 衽壍)) : rowLabel(铂壍, 衽壍)));
            const 憱壍 = 欆壍.reduce((肠壍, 龏壍) => 肠壍 + (typeof 龏壍[啬壍] === "number" ? (龏壍[啬壍] as number) : 0), 0);
            const 汾壍 = (譭壍: ChartTokens) => {
                const 塜壍 = 欆壍.map((睋壍, 阺壍) => ({
                    value: typeof 睋壍[啬壍] === "number" ? (睋壍[啬壍] as number) : 0,
                    itemStyle: { color: 缨壍 ? colorFor(衽壍, rowLabel(睋壍, 衽壍), 阺壍, 譭壍) : 譭壍.accentLine, borderRadius: 鍊壍 ? [0, 4, 4, 0] : [4, 4, 0, 0] },
                }));
                const 挩壍 = categoryAxis(譭壍, 鍊壍 ? [...痓壍].reverse() : 痓壍, 鍊壍 ? { axisLabel: { ...axisLabel(譭壍), fontFamily: 譭壍.fontSans, fontSize: 12, color: 譭壍.muted, width: 120, overflow: "truncate", formatter: (舘壍: string) => middleEllipsis(舘壍, 20) } } : {});
                const 伇壍 = valueAxis(譭壍, metricMeta(廁壍, 啬壍).format as MetricFormat, 釒壍.money, { splitNumber: 4 });
                return {
                    ...baseOption(譭壍, 怹壍),
                    grid: 鍊壍 ? { left: 8, right: 瑛壍 ? 88 : 56, top: 4, bottom: 20, containLabel: true } : { left: 52, right: 8, top: 16, bottom: 24 },
                    xAxis: 鍊壍 ? 伇壍 : 挩壍,
                    yAxis: 鍊壍 ? 挩壍 : 伇壍,
                    tooltip: {
                        ...baseOption(譭壍, 怹壍).tooltip,
                        trigger: "item",
                        formatter: (淶壍: {
                            dataIndex: number;
                        }) => {
                            const 賥壍 = 鍊壍 ? 欆壍.length - 1 - 淶壍.dataIndex : 淶壍.dataIndex;
                            const 委壍 = 欆壍[賥壍] ?? {};
                            const 磃壍: TipRow[] = (狣壍.metrics ?? []).map((鞲壍) => ({ label: metricMeta(廁壍, 鞲壍).label, value: fmt(廁壍, 鞲壍, 委壍[鞲壍] as number, 釒壍.money, { compact: false }) }));
                            if (憱壍 > 0 && metricMeta(廁壍, 啬壍).format === "money")
                                磃壍.push({ label: "Share", value: `${(((委壍[啬壍] as number) / 憱壍) * 100).toFixed(1)}%` });
                            return tooltipHtml(rowLabel(委壍, 衽壍), 磃壍);
                        },
                    },
                    series: [
                        {
                            type: "bar",
                            data: 鍊壍 ? [...塜壍].reverse() : 塜壍,
                            barMaxWidth: 24,
                            label: 瑛壍
                                ? {
                                    show: true,
                                    position: 鍊壍 ? "right" : "top",
                                    fontFamily: 譭壍.fontMono,
                                    fontSize: 10,
                                    color: 譭壍.muted3,
                                    formatter: (撡壍: {
                                        dataIndex: number;
                                    }) => {
                                        const 莐壍 = 鍊壍 ? 欆壍.length - 1 - 撡壍.dataIndex : 撡壍.dataIndex;
                                        return `${fmt(廁壍, 啬壍, 欆壍[莐壍]?.[啬壍] as number, 釒壍.money)} · ${fmt(廁壍, 瑛壍, 欆壍[莐壍]?.[瑛壍] as number, 釒壍.money)}`;
                                    },
                                }
                                : { show: false },
                            emphasis: { itemStyle: { opacity: 0.85 } },
                        },
                    ],
                };
            };
            return (<历壍>
            <EChart className="absolute inset-0" build={汾壍} deps={[鸗壍, 鍊壍, 釒壍.money, 廁壍]} ariaLabel={`${綰壍}: bar chart of ${metricMeta(廁壍, 啬壍).label} by ${衽壍.replace("_", " ")}`} events={{
                    click: (偿壍) => {
                        const 潮壍 = 鍊壍 ? 欆壍.length - 1 - Number(偿壍.dataIndex) : Number(偿壍.dataIndex);
                        const 蹝壍 = 欆壍[潮壍];
                        if (!蹝壍)
                            return;
                        if (衽壍 === "campaign")
                            釒壍.openCampaign(rowId(蹝壍, "campaign"));
                        else if (!峛壍.has(衽壍))
                            釒壍.toggleCrossFilter(衽壍, rowLabel(蹝壍, 衽壍));
                    },
                }}/>
          </历壍>);
        }}
    </QueryState>);
}
export function StackedBarViz({ spec: 孌壍, rt: 稻壍, catalog: 餪壍, title: 昙壍 }: VizProps) {
    const 蔈壍 = useQueryResult(孌壍);
    const 凷壍 = 孌壍.dimensions ?? [];
    const 烦壍 = 凷壍.find((迕壍) => 峛壍.has(迕壍)) ?? 凷壍[0] ?? "date";
    const 峄壍 = 凷壍.find((箳壍) => 箳壍 !== 烦壍) ?? "campaign_type";
    const 骢壍 = 孌壍.metrics?.[0] ?? "cost";
    const 枑壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={蔈壍} skeletonHeight="100%">
      {(蚀壍) => {
            const 卯壍 = 鰱壍(蚀壍.rows, 烦壍, 峄壍, 骢壍);
            const 牞壍 = 卯壍.series.map((配壍, 帼壍) => ({ label: 配壍.name, color: 配壍.name === "Other" ? "var(--series-other)" : `var(--series-${(嵉壍(峄壍, 配壍.name, 帼壍) % 6) + 1})` }));
            const 紫壍 = (鰚壍: ChartTokens) => {
                const 椉壍 = tickIndices(卯壍.times.length, 6);
                return {
                    ...baseOption(鰚壍, 枑壍),
                    grid: { left: 52, right: 8, top: 8, bottom: 24 },
                    xAxis: categoryAxis(鰚壍, 卯壍.times, { axisLabel: { ...axisLabel(鰚壍), interval: (蟸壍: number) => 椉壍.has(蟸壍), formatter: (哧壍: string) => 酤壍(烦壍, 哧壍) } }),
                    yAxis: valueAxis(鰚壍, metricMeta(餪壍, 骢壍).format as MetricFormat, 稻壍.money, { splitNumber: 4 }),
                    tooltip: {
                        ...baseOption(鰚壍, 枑壍).tooltip,
                        trigger: "axis",
                        axisPointer: { type: "shadow", shadowStyle: { color: 鰚壍.theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(60,60,67,0.05)" } },
                        formatter: (珖壍: {
                            dataIndex: number;
                            seriesName: string;
                            value: number;
                            color: string;
                        }[]) => {
                            const 鋅壍 = 珖壍[0]?.dataIndex ?? 0;
                            const 徴壍 = 珖壍.reduce((纣壍, 鶒壍) => 纣壍 + (鶒壍.value ?? 0), 0);
                            const 檁壍: TipRow[] = [...珖壍].reverse().map((襰壍) => ({ color: 襰壍.color, label: 襰壍.seriesName, value: fmt(餪壍, 骢壍, 襰壍.value, 稻壍.money, { compact: false }) }));
                            檁壍.push({ label: "Total", value: fmt(餪壍, 骢壍, 徴壍, 稻壍.money, { compact: false }) });
                            return tooltipHtml(酤壍(烦壍, 卯壍.times[鋅壍] ?? ""), 檁壍);
                        },
                    },
                    series: 卯壍.series.map((噟壍, 畎壍) => ({
                        name: 噟壍.name,
                        type: "bar",
                        stack: "total",
                        data: 噟壍.values,
                        barMaxWidth: 24,
                        itemStyle: { color: 噟壍.name === "Other" ? 鰚壍.other : colorFor(峄壍, 噟壍.name, 畎壍, 鰚壍), borderColor: 鰚壍.surface, borderWidth: 1 },
                    })),
                };
            };
            return (<div className="flex min-h-0 flex-1 flex-col gap-3">
            <骹壍 items={牞壍}/>
            <历壍>
              <EChart className="absolute inset-0" build={紫壍} deps={[蚀壍, 稻壍.money, 餪壍]} ariaLabel={`${昙壍}: stacked bars of ${metricMeta(餪壍, 骢壍).label} by ${峄壍.replace("_", " ")}`}/>
            </历壍>
          </div>);
        }}
    </QueryState>);
}
export function DonutViz({ spec: 鐽壍, rt: 愬壍, catalog: 耛壍, title: 鼊壍 }: VizProps) {
    const 毹壍 = useQueryResult(鐽壍);
    const 諨壍 = 鐽壍.dimensions?.[0] ?? "device";
    const 埗壍 = 鐽壍.metrics?.[0] ?? "cost";
    const 盆壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={毹壍} skeletonHeight="100%">
      {(閵壍) => {
            const 护壍 = [...閵壍.rows].sort((膓壍, 亂壍) => ((亂壍[埗壍] as number) ?? 0) - ((膓壍[埗壍] as number) ?? 0));
            const 浱壍 = 护壍.slice(0, 护壍.length > 5 ? 4 : 5);
            const 豠壍 = 护壍.slice(浱壍.length);
            const 奏壍 = [
                ...浱壍.map((砾壍) => ({ name: rowLabel(砾壍, 諨壍), value: (砾壍[埗壍] as number) ?? 0 })),
                ...(豠壍.length ? [{ name: "Other", value: 豠壍.reduce((霭壍, 搜壍) => 霭壍 + ((搜壍[埗壍] as number) ?? 0), 0) }] : []),
            ];
            const 茋壍 = 奏壍.reduce((俺壍, 滩壍) => 俺壍 + 滩壍.value, 0);
            const 跘壍 = (嫇壍: ChartTokens) => ({
                ...baseOption(嫇壍, 盆壍),
                tooltip: {
                    ...baseOption(嫇壍, 盆壍).tooltip,
                    trigger: "item",
                    formatter: (禶壍: {
                        name: string;
                        value: number;
                        percent: number;
                    }) => tooltipHtml(禶壍.name, [{ label: metricMeta(耛壍, 埗壍).label, value: fmt(耛壍, 埗壍, 禶壍.value, 愬壍.money, { compact: false }) }, { label: "Share", value: `${禶壍.percent.toFixed(1)}%` }]),
                },
                series: [
                    {
                        type: "pie",
                        radius: ["58%", "82%"],
                        center: ["50%", "50%"],
                        padAngle: 1,
                        itemStyle: { borderColor: 嫇壍.surface, borderWidth: 2, borderRadius: 3 },
                        label: { show: true, position: "outside", color: 嫇壍.muted, fontFamily: 嫇壍.fontSans, fontSize: 11, formatter: (颥壍: {
                                name: string;
                                percent: number;
                            }) => `${escapeHtml(颥壍.name)}\n{pct|${颥壍.percent.toFixed(0)}%}`, rich: { pct: { fontFamily: 嫇壍.fontMono, color: 嫇壍.faint, fontSize: 10 } } },
                        labelLine: { length: 8, length2: 6, lineStyle: { color: 嫇壍.line } },
                        data: 奏壍.map((斔壍, 蒃壍) => ({ ...斔壍, itemStyle: { color: 斔壍.name === "Other" ? 嫇壍.other : colorFor(諨壍, 斔壍.name, 蒃壍, 嫇壍) } })),
                    },
                ],
                graphic: [
                    { type: "text", left: "center", top: "44%", style: { text: fmt(耛壍, 埗壍, 茋壍, 愬壍.money), fill: 嫇壍.text, font: `600 18px ${嫇壍.fontDisplay}`, textAlign: "center" } },
                    { type: "text", left: "center", top: "54%", style: { text: metricMeta(耛壍, 埗壍).label.toUpperCase(), fill: 嫇壍.faint, font: `10px ${嫇壍.fontMono}`, textAlign: "center" } },
                ],
            });
            return (<历壍>
            <EChart className="absolute inset-0" build={跘壍} deps={[閵壍, 愬壍.money, 耛壍]} ariaLabel={`${鼊壍}: share of ${metricMeta(耛壍, 埗壍).label} by ${諨壍}`} events={{ click: (兲壍) => 兲壍.name && 兲壍.name !== "Other" && 愬壍.toggleCrossFilter(諨壍, String(兲壍.name)) }}/>
          </历壍>);
        }}
    </QueryState>);
}
const 灡壍 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function HeatmapViz({ spec: 轐壍, rt: 尿壍, catalog: 笮壍, title: 騝壍 }: VizProps) {
    const 朌壍 = useQueryResult(轐壍);
    const [藻壍 = "dow", 勪壍 = "hour"] = 轐壍.dimensions ?? [];
    const 燙壍 = 轐壍.metrics?.[0] ?? "conversions";
    const 郈壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={朌壍} skeletonHeight="100%">
      {(嶷壍) => {
            const 粦壍 = 藻壍 === "dow" ? 灡壍 : [...new Set(嶷壍.rows.map((鮕壍) => rowLabel(鮕壍, 藻壍)))];
            const 梄壍 = 勪壍 === "hour" ? Array.from({ length: 24 }, (蝳壍, 呢壍) => String(呢壍)) : [...new Set(嶷壍.rows.map((獑壍) => rowLabel(獑壍, 勪壍)))];
            const 鉀壍: [
                number,
                number,
                number
            ][] = [];
            let 弯壍 = 0;
            for (const 縞壍 of 嶷壍.rows) {
                const 鴍壍 = rowLabel(縞壍, 藻壍);
                const 槼壍 = 藻壍 === "dow" ? 灡壍.findIndex((裫壍) => 鴍壍.startsWith(裫壍)) : 粦壍.indexOf(鴍壍);
                const 嗚壍 = 梄壍.indexOf(勪壍 === "hour" ? String(Number(縞壍[勪壍] ?? 鴍壍)) : rowLabel(縞壍, 勪壍));
                const 瓉壍 = typeof 縞壍[燙壍] === "number" ? (縞壍[燙壍] as number) : 0;
                if (槼壍 < 0 || 嗚壍 < 0)
                    continue;
                鉀壍.push([嗚壍, 槼壍, 瓉壍]);
                弯壍 = Math.max(弯壍, 瓉壍);
            }
            const 鎸壍 = (悧壍: ChartTokens) => ({
                ...baseOption(悧壍, 郈壍),
                grid: { left: 40, right: 8, top: 4, bottom: 50 },
                xAxis: categoryAxis(悧壍, 梄壍, { splitArea: { show: false }, axisLabel: { ...axisLabel(悧壍), interval: 勪壍 === "hour" ? 2 : "auto", formatter: (羖壍: string) => (勪壍 === "hour" ? `${羖壍.padStart(2, "0")}h` : 羖壍) } }),
                yAxis: categoryAxis(悧壍, 粦壍, { inverse: true, axisLabel: { ...axisLabel(悧壍) } }),
                visualMap: { show: true, min: 0, max: 弯壍 || 1, orient: "horizontal", left: "center", bottom: 2, itemWidth: 8, itemHeight: 120, calculable: false, text: [`More ${metricMeta(笮壍, 燙壍).label.toLowerCase()}`, "Fewer"], inRange: { color: sequentialRamp(悧壍) }, textStyle: { color: 悧壍.faint, fontFamily: 悧壍.fontMono, fontSize: 10 } },
                tooltip: {
                    ...baseOption(悧壍, 郈壍).tooltip,
                    trigger: "item",
                    formatter: (麅壍: {
                        value: [
                            number,
                            number,
                            number
                        ];
                    }) => tooltipHtml(`${粦壍[麅壍.value[1]]} · ${勪壍 === "hour" ? `${String(梄壍[麅壍.value[0]]).padStart(2, "0")}:00` : 梄壍[麅壍.value[0]]}`, [{ label: metricMeta(笮壍, 燙壍).label, value: fmt(笮壍, 燙壍, 麅壍.value[2], 尿壍.money, { compact: false }) }]),
                },
                series: [{ type: "heatmap", data: 鉀壍, itemStyle: { borderColor: 悧壍.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: 悧壍.text, borderWidth: 1 } } }],
            });
            return (<历壍>
            <EChart className="absolute inset-0" build={鎸壍} deps={[嶷壍, 尿壍.money, 笮壍]} ariaLabel={`${騝壍}: heatmap of ${metricMeta(笮壍, 燙壍).label} by ${藻壍} and ${勪壍}`}/>
          </历壍>);
        }}
    </QueryState>);
}
export function FunnelViz({ spec: 歴壍, rt: 詣壍, catalog: 坒壍, title: 癁壍 }: VizProps) {
    const 锰壍 = useQueryResult({ ...歴壍, dimensions: [], sort: [] });
    const 戟壍 = useMemo(() => prefersReducedMotion(), []);
    const 脎壍 = 歴壍.metrics?.length ? 歴壍.metrics : ["impressions", "clicks", "conversions"];
    return (<QueryState q={锰壍} skeletonHeight="100%">
      {(鿽壍) => {
            const 泬壍 = 脎壍.map((诛壍) => ({ name: metricMeta(坒壍, 诛壍).label, key: 诛壍, value: 鿽壍.totals?.[诛壍] ?? 0 }));
            const 壊壍 = (瞹壍: ChartTokens) => {
                const 隨壍 = ordinalRamp(瞹壍, 泬壍.length);
                return {
                    ...baseOption(瞹壍, 戟壍),
                    tooltip: { ...baseOption(瞹壍, 戟壍).tooltip, trigger: "item", formatter: (掗壍: {
                            dataIndex: number;
                        }) => {
                            const 芆壍 = 泬壍[掗壍.dataIndex];
                            const 併壍 = 泬壍[掗壍.dataIndex - 1];
                            const 湤壍: TipRow[] = [{ label: 芆壍?.name ?? "", value: fmt(坒壍, 芆壍?.key ?? "", 芆壍?.value, 詣壍.money, { compact: false }) }];
                            if (併壍 && 併壍.value)
                                湤壍.push({ label: `Rate from ${併壍.name.toLowerCase()}`, value: `${(((芆壍?.value ?? 0) / 併壍.value) * 100).toFixed(2)}%` });
                            return tooltipHtml(芆壍?.name ?? "", 湤壍);
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
                            label: { show: true, position: "inside", color: "#fff", fontFamily: 瞹壍.fontSans, fontSize: 12, formatter: (赓壍: {
                                    dataIndex: number;
                                }) => `${泬壍[赓壍.dataIndex]?.name}  ${fmt(坒壍, 泬壍[赓壍.dataIndex]?.key ?? "", 泬壍[赓壍.dataIndex]?.value, 詣壍.money)}` },
                            itemStyle: { borderColor: 瞹壍.surface, borderWidth: 1 },
                            data: 泬壍.map((婂壍, 礱壍) => ({ name: 婂壍.name, value: Math.log10(Math.max(1, 婂壍.value)) + 1, itemStyle: { color: 隨壍[礱壍] } })),
                        },
                    ],
                };
            };
            return (<历壍>
            <EChart className="absolute inset-0" build={壊壍} deps={[鿽壍, 詣壍.money, 坒壍]} ariaLabel={`${癁壍}: funnel`}/>
          </历壍>);
        }}
    </QueryState>);
}
export function ScatterViz({ spec: 頠壍, rt: 攏壍, catalog: 菾壍, title: 僭壍, viz: 濜壍 }: VizProps) {
    const 軋壍 = useQueryResult(頠壍);
    const 宺壍 = 頠壍.dimensions?.[0] ?? "campaign";
    const [窩壍 = "cost", 馘壍 = "cpa", 暇壍 = 濜壍.sizeKey ?? "conversions"] = 頠壍.metrics ?? [];
    const 蕶壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={軋壍} skeletonHeight="100%">
      {(剥壍) => {
            const 煔壍 = 剥壍.rows.filter((遃壍) => typeof 遃壍[窩壍] === "number" && typeof 遃壍[馘壍] === "number");
            const 崲壍 = Math.max(1, ...煔壍.map((簡壍) => (typeof 簡壍[暇壍] === "number" ? (簡壍[暇壍] as number) : 0)));
            const 鬐壍 = (柿壍: ChartTokens) => ({
                ...baseOption(柿壍, 蕶壍),
                grid: { left: 56, right: 16, top: 12, bottom: 32 },
                xAxis: valueAxis(柿壍, metricMeta(菾壍, 窩壍).format as MetricFormat, 攏壍.money, { name: metricMeta(菾壍, 窩壍).label, nameLocation: "middle", nameGap: 22, nameTextStyle: { ...axisLabel(柿壍) }, splitNumber: 4 }),
                yAxis: valueAxis(柿壍, metricMeta(菾壍, 馘壍).format as MetricFormat, 攏壍.money, { name: metricMeta(菾壍, 馘壍).label, nameTextStyle: { ...axisLabel(柿壍), align: "left" }, splitNumber: 4 }),
                tooltip: { ...baseOption(柿壍, 蕶壍).tooltip, trigger: "item", formatter: (蛮壍: {
                        dataIndex: number;
                    }) => {
                        const 叝壍 = 煔壍[蛮壍.dataIndex] ?? {};
                        return tooltipHtml(rowLabel(叝壍, 宺壍), [窩壍, 馘壍, 暇壍].map((狌壍) => ({ label: metricMeta(菾壍, 狌壍).label, value: fmt(菾壍, 狌壍, 叝壍[狌壍] as number, 攏壍.money, { compact: false }) })));
                    } },
                series: [
                    {
                        type: "scatter",
                        data: 煔壍.map((醻壍) => [醻壍[窩壍], 醻壍[馘壍], 醻壍[暇壍]]),
                        symbolSize: (庪壍: number[]) => 8 + Math.sqrt(Math.max(0, 庪壍[2] ?? 0) / 崲壍) * 26,
                        itemStyle: { color: 柿壍.accentLine, opacity: 0.75, borderColor: 柿壍.surface, borderWidth: 1.5 },
                        emphasis: { itemStyle: { opacity: 1 } },
                    },
                ],
            });
            return (<历壍>
            <EChart className="absolute inset-0" build={鬐壍} deps={[剥壍, 攏壍.money, 菾壍]} ariaLabel={`${僭壍}: ${metricMeta(菾壍, 馘壍).label} vs ${metricMeta(菾壍, 窩壍).label}`} events={{ click: (継壍) => { const 鲈壍 = 煔壍[Number(継壍.dataIndex)]; if (鲈壍 && 宺壍 === "campaign")
                    攏壍.openCampaign(rowId(鲈壍, "campaign")); } }}/>
          </历壍>);
        }}
    </QueryState>);
}
function 楷壍(衦壍: string): boolean {
    const 啕壍 = /^#?([0-9a-f]{6})$/i.exec(衦壍);
    if (!啕壍?.[1])
        return false;
    const 瑄壍 = parseInt(啕壍[1], 16);
    const 錳壍 = (怢壍: number) => ((怢壍 /= 255) <= 0.03928 ? 怢壍 / 12.92 : ((怢壍 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * 錳壍((瑄壍 >> 16) & 255) + 0.7152 * 錳壍((瑄壍 >> 8) & 255) + 0.0722 * 錳壍(瑄壍 & 255) < 0.3;
}
export function TreemapViz({ spec: 缑壍, rt: 鸀壍, catalog: 櫯壍, title: 觞壍 }: VizProps) {
    const 囍壍 = useQueryResult(缑壍);
    const 疼壍 = 缑壍.dimensions?.[0] ?? "campaign";
    const 钫壍 = 缑壍.metrics?.[0] ?? "cost";
    const 憚壍 = useMemo(() => prefersReducedMotion(), []);
    return (<QueryState q={囍壍} skeletonHeight="100%">
      {(肉壍) => {
            const 齸壍 = (汧壍: ChartTokens) => {
                const 譖壍 = sequentialRamp(汧壍);
                const 塅壍 = [...肉壍.rows].sort((眴壍, 阣壍) => ((阣壍[钫壍] as number) ?? 0) - ((眴壍[钫壍] as number) ?? 0));
                return {
                    ...baseOption(汧壍, 憚壍),
                    tooltip: { ...baseOption(汧壍, 憚壍).tooltip, trigger: "item", formatter: (挒壍: {
                            name: string;
                            value: number;
                        }) => tooltipHtml(挒壍.name, [{ label: metricMeta(櫯壍, 钫壍).label, value: fmt(櫯壍, 钫壍, 挒壍.value, 鸀壍.money, { compact: false }) }]) },
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
                            itemStyle: { borderColor: 汧壍.surface, borderWidth: 2, gapWidth: 2, borderRadius: 4 },
                            label: { show: true, fontFamily: 汧壍.fontSans, fontSize: 12, formatter: (舁壍: {
                                    name: string;
                                    value: number;
                                }) => `${舁壍.name}\n${fmt(櫯壍, 钫壍, 舁壍.value, 鸀壍.money)}`, overflow: "truncate" },
                            data: 塅壍.map((仰壍, 淟壍) => {
                                const 賎壍 = 譖壍[Math.max(1, 譖壍.length - 1 - Math.floor((淟壍 / Math.max(1, 塅壍.length)) * (譖壍.length - 1)))] ?? 汧壍.accentLine;
                                return { name: rowLabel(仰壍, 疼壍), value: (仰壍[钫壍] as number) ?? 0, itemStyle: { color: 賎壍 }, label: { color: 楷壍(賎壍) ? "#ffffff" : "#0b2a24" } };
                            }),
                        },
                    ],
                };
            };
            return (<历壍>
            <EChart className="absolute inset-0" build={齸壍} deps={[肉壍, 鸀壍.money, 櫯壍]} ariaLabel={`${觞壍}: treemap of ${metricMeta(櫯壍, 钫壍).label}`}/>
          </历壍>);
        }}
    </QueryState>);
}
