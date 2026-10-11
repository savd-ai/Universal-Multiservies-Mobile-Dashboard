"use client";
import { useMemo } from "react";
import { EChart } from "@/components/charts/echart";
import { axisLabel, baseOption, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import type { ChartTokens } from "@/components/charts/tokens";
import { useAnnotations, useQueryResult } from "@/lib/api/hooks";
import { formatShort } from "@/lib/domain/dates";
import type { MetricFormat } from "@/lib/domain/types";
import { fmt, metricMeta, QueryState, shortLabel, type VizProps } from "./shared";
export function tickIndices(法壍: number, 评壍 = 5): Set<number> {
    if (法壍 <= 评壍)
        return new Set(Array.from({ length: 法壍 }, (墳壍, 瞢壍) => 瞢壍));
    return new Set(Array.from({ length: 评壍 }, (隑壍, 掀壍) => Math.round(((法壍 - 1) * 掀壍) / (评壍 - 1))));
}
function 良壍({ color: 佞壍, dashed: 湍壍, label: 贼壍, opacity: 娫壍 = 1 }: {
    color: string;
    dashed?: boolean;
    label: string;
    opacity?: number;
}) {
    return (<span className="flex items-center gap-2">
      <span aria-hidden className="w-3.5" style={湍壍 ? { height: 0, borderTop: `1.5px dashed ${佞壍}` } : { height: 2, background: 佞壍, opacity: 娫壍 }}/>
      {贼壍}
    </span>);
}
export function TrendMultiplesViz({ spec: 礚壍, rt: 頉壍, catalog: 擸壍, title: 菧壍 }: VizProps) {
    const 僖壍 = useQueryResult({ ...礚壍, dimensions: ["date"], fillGaps: true, sort: [{ key: "date", dir: "asc" }] });
    const [濅壍 = "cost", 躴壍 = "conversions", 宣壍 = "cpa"] = 礚壍.metrics ?? [];
    const 窒壍 = 礚壍.compare !== "none";
    const 馁壍 = metricMeta(擸壍, 濅壍);
    const 晰壍 = metricMeta(擸壍, 躴壍);
    const 蕟壍 = 僖壍.data?.meta.range;
    const 剎壍 = useAnnotations(蕟壍?.start ?? "", 蕟壍?.end ?? "", { includeChanges: true, enabled: !!蕟壍 });
    const 焽壍 = useMemo(() => {
        const 逬壍 = new Map<string, {
            notes: number;
            texts: string[];
        }>();
        for (const 崛壍 of 剎壍.data ?? []) {
            const 簊壍 = 逬壍.get(崛壍.date) ?? { notes: 0, texts: [] };
            簊壍.texts.push(崛壍.source === "note" ? `Note: ${崛壍.text}` : 崛壍.text);
            if (崛壍.source === "note")
                簊壍.notes++;
            逬壍.set(崛壍.date, 簊壍);
        }
        return 逬壍;
    }, [剎壍.data]);
    return (<div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-[18px] text-xs text-muted">
        <良壍 color="var(--accent)" label={馁壍.label}/>
        <良壍 color="var(--mint)" opacity={0.85} label={晰壍.label}/>
        {窒壍 ? <良壍 color="var(--faint)" dashed label={`${馁壍.label}, ${礚壍.compare === "previous_year" ? "previous year" : "previous period"}`}/> : null}
        {焽壍.size ? (<span className="flex items-center gap-2">
            <span aria-hidden className="text-[9px] text-faint">◆</span>
            Changes &amp; notes
          </span>) : null}
      </div>
      <QueryState q={僖壍} skeletonHeight="100%">
        {(髹壍) => <Cmp56 rows={髹壍.rows} top={濅壍} bottom={躴壍} extra={宣壍} showCompare={窒壍} marks={焽壍} rt={頉壍} catalog={擸壍} title={菧壍}/>}
      </QueryState>
    </div>);
}
function Cmp56({ rows: 蛗壍, top: 叆壍, bottom: 犵壍, extra: 醤壍, showCompare: 库壍, marks: 綂壍, rt: 鱱壍, catalog: 楠壍, title: 衏壍 }: {
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
    const 唾壍 = useMemo(() => prefersReducedMotion(), []);
    const 琭壍 = (錜壍: ChartTokens) => {
        const 怋壍 = 蛗壍.map((绺壍) => String(绺壍.date));
        const 鷩壍 = tickIndices(怋壍.length);
        const 櫘壍 = (觇壍: string) => 蛗壍.map((嚶壍) => (typeof 嚶壍[觇壍] === "number" ? (嚶壍[觇壍] as number) : null));
        const 疥壍 = metricMeta(楠壍, 叆壍).format as MetricFormat;
        const 钔壍 = metricMeta(楠壍, 犵壍).format as MetricFormat;
        const 憃壍 = { type: "category" as const, data: 怋壍, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false } };
        const 聲壍 = Math.max(0, ...蛗壍.map((齡壍) => Math.max(typeof 齡壍[叆壍] === "number" ? (齡壍[叆壍] as number) : 0, typeof 齡壍[`${叆壍}__prev`] === "number" ? (齡壍[`${叆壍}__prev`] as number) : 0)));
        return {
            ...baseOption(錜壍, 唾壍),
            grid: [
                { left: 48, right: 6, top: 6, height: "60%", containLabel: false },
                { left: 48, right: 6, top: "71%", bottom: 22, containLabel: false },
            ],
            axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: 錜壍.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } },
            xAxis: [
                { ...憃壍, gridIndex: 0, axisLabel: { show: false }, axisPointer: { show: true, label: { show: false } } },
                {
                    ...憃壍,
                    gridIndex: 1,
                    axisLabel: { ...axisLabel(錜壍), interval: (汐壍: number) => 鷩壍.has(汐壍), formatter: (謿壍: string) => formatShort(謿壍), alignMinLabel: "left", alignMaxLabel: "right" },
                    axisPointer: { show: true, label: { show: false } },
                },
            ],
            yAxis: [
                valueAxis(錜壍, 疥壍, 鱱壍.money, { gridIndex: 0, splitNumber: 4 }),
                valueAxis(錜壍, 钔壍, 鱱壍.money, { gridIndex: 1, splitNumber: 2 }),
            ],
            tooltip: {
                ...baseOption(錜壍, 唾壍).tooltip,
                trigger: "axis",
                formatter: (堮壍: {
                    dataIndex: number;
                }[]) => {
                    const 眝壍 = 堮壍[0]?.dataIndex ?? 0;
                    const 阌壍 = 蛗壍[眝壍] ?? {};
                    const 拻壍: TipRow[] = [
                        { color: 錜壍.accentLine, label: metricMeta(楠壍, 叆壍).label, value: fmt(楠壍, 叆壍, 阌壍[叆壍] as number, 鱱壍.money, { compact: false }) },
                        { color: 錜壍.mint, label: metricMeta(楠壍, 犵壍).label, value: fmt(楠壍, 犵壍, 阌壍[犵壍] as number, 鱱壍.money, { compact: false }) },
                    ];
                    if (醤壍 && 阌壍[醤壍] !== undefined)
                        拻壍.push({ label: shortLabel(楠壍, 醤壍), value: fmt(楠壍, 醤壍, 阌壍[醤壍] as number, 鱱壍.money, { compact: false }) });
                    if (库壍 && 阌壍[`${叆壍}__prev`] !== undefined)
                        拻壍.push({ color: 錜壍.faint, dashed: true, label: `${metricMeta(楠壍, 叆壍).label}, previous`, value: fmt(楠壍, 叆壍, 阌壍[`${叆壍}__prev`] as number, 鱱壍.money, { compact: false }) });
                    const 自壍 = 綂壍.get(String(阌壍.date));
                    if (自壍) {
                        for (const 仙壍 of 自壍.texts.slice(0, 4))
                            拻壍.push({ label: `◆ ${仙壍.length > 48 ? `${仙壍.slice(0, 47)}…` : 仙壍}`, value: "" });
                        if (自壍.texts.length > 4)
                            拻壍.push({ label: `+${自壍.texts.length - 4} more changes`, value: "" });
                    }
                    return tooltipHtml(formatShort(String(阌壍.date ?? "")), 拻壍);
                },
            },
            series: [
                {
                    name: `${metricMeta(楠壍, 叆壍).label}, previous`,
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: 库壍 ? 櫘壍(`${叆壍}__prev`) : [],
                    symbol: "none",
                    lineStyle: { color: 錜壍.faint, width: 1.25, type: [4, 4] },
                    silent: true,
                    z: 1,
                },
                {
                    name: metricMeta(楠壍, 叆壍).label,
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: 櫘壍(叆壍),
                    symbol: "circle",
                    symbolSize: 9,
                    showSymbol: false,
                    lineStyle: { color: 錜壍.accentLine, width: 2 },
                    itemStyle: { color: 錜壍.accent, borderColor: 錜壍.surface, borderWidth: 2 },
                    emphasis: { scale: false, itemStyle: { shadowBlur: 0 } },
                    areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.26)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
                    z: 3,
                },
                {
                    name: "Changes & notes",
                    type: "scatter",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: 蛗壍.map((淈壍) => {
                        const 買壍 = 綂壍.get(String(淈壍.date));
                        return 買壍 ? { value: 聲壍 * 1.06, itemStyle: { color: 買壍.notes ? 錜壍.accent : 錜壍.faint } } : null;
                    }),
                    symbol: "diamond",
                    symbolSize: 7,
                    silent: true,
                    z: 4,
                },
                {
                    name: metricMeta(楠壍, 犵壍).label,
                    type: "line",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: 櫘壍(犵壍),
                    symbol: "circle",
                    symbolSize: 8,
                    showSymbol: false,
                    lineStyle: { color: 錜壍.mint, width: 1.5, opacity: 錜壍.theme === "dark" ? 0.8 : 1 },
                    itemStyle: { color: 錜壍.mint, borderColor: 錜壍.surface, borderWidth: 2 },
                    z: 2,
                },
            ],
        };
    };
    return (<div className="relative min-h-[140px] flex-1 cursor-crosshair">
      <EChart className="absolute inset-0" build={琭壍} deps={[蛗壍, 叆壍, 犵壍, 醤壍, 库壍, 綂壍, 鱱壍.money, 楠壍]} ariaLabel={`${衏壍}: daily ${metricMeta(楠壍, 叆壍).label.toLowerCase()} and ${metricMeta(楠壍, 犵壍).label.toLowerCase()}`}/>
    </div>);
}
