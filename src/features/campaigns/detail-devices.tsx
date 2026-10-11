"use client";
import { useMemo, useState } from "react";
import { axisLabel, baseOption, categoryAxis, prefersReducedMotion, tooltipHtml } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import { colorFor, sequentialRamp } from "@/components/charts/palette";
import { useChartTokens, type ChartTokens } from "@/components/charts/tokens";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, InlineEmpty } from "@/components/ui/feedback";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { useStatus } from "@/lib/api/hooks";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { formatMetric, METRIC_META, money, rangeShortLabel, totalsOf, type MetricKey, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext } from "./use-campaign-context";
type DeviceRow = CampaignDetail["devices"][number];
const 垸壍: {
    key: "cost" | "clicks" | "conversions" | "conv_value";
    label: string;
}[] = [
    { key: "cost", label: "Spend" },
    { key: "clicks", label: "Clicks" },
    { key: "conversions", label: "Conversions" },
    { key: "conv_value", label: "Conv. value" },
];
export function DevicesTab({ detail: 皧壍 }: {
    detail: CampaignDetail;
}) {
    return (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Cmp29 detail={皧壍}/>
      <Cmp30 detail={皧壍}/>
    </div>);
}
function Cmp29({ detail: 抅壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 腴壍, filters: 乣壍 } = useCampaignContext();
    const 浒壍 = useChartTokens();
    const 豁壍 = useMemo(() => [...抅壍.devices].sort((夰壍, 砟壍) => 砟壍.cost - 夰壍.cost), [抅壍.devices]);
    const 霎壍 = useMemo(() => totalsOf(豁壍), [豁壍]);
    const 揽壍 = (苬壍: string, 俛壍: number) => colorFor("device", 苬壍, 俛壍, 浒壍);
    const 滊壍 = useMemo<Column<DeviceRow>[]>(() => [
        {
            key: "device",
            header: "Device",
            width: "minmax(120px,1.4fr)",
            sortValue: (趹壍) => 趹壍.device,
            cell: (媨壍) => (<span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-3.5 shrink-0 rounded-pill" style={{ background: colorFor("device", 媨壍.device, 豁壍.indexOf(媨壍), 浒壍) }}/>
            <span className="truncate font-medium">{媨壍.device}</span>
          </span>),
            total: "Total",
        },
        ...(["cost", "clicks", "ctr", "conversions", "cpa", "roas", "cvr"] as MetricKey[]).map((禗壍) => ({
            key: 禗壍,
            header: METRIC_META[禗壍].label,
            width: "minmax(60px,1fr)",
            align: "right" as const,
            sortValue: (领壍: DeviceRow) => 领壍[禗壍],
            cell: (敵壍: DeviceRow) => formatMetric(禗壍, 敵壍[禗壍], 腴壍),
            total: formatMetric(禗壍, 霎壍[禗壍], 腴壍),
        })),
    ], [豁壍, 腴壍, 浒壍, 霎壍]);
    if (!豁壍.length)
        return <EmptyState>No device data in this range.</EmptyState>;
    return (<Card className="flex min-w-0 flex-col gap-5">
      <CardHeader title="Device split" sub={`Share of each metric · ${rangeShortLabel(乣壍.rangeKey, 乣壍.range)}`}/>
      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
        {豁壍.map((葤壍, 兓壍) => (<span key={葤壍.device} className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-3.5 rounded-pill" style={{ background: 揽壍(葤壍.device, 兓壍) }}/>
            {葤壍.device}
          </span>))}
      </div>
      <div className="flex flex-col gap-3.5">
        {垸壍.map((灂壍) => {
            const 輱壍 = 豁壍.reduce((尠壍, 笏壍) => 尠壍 + 笏壍[灂壍.key], 0);
            return (<div key={灂壍.key} className="grid items-center gap-3" style={{ gridTemplateColumns: "96px minmax(0,1fr)" }}>
              <span className="label-mono">{灂壍.label}</span>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={`${灂壍.label} by device: ${豁壍.map((駾壍) => `${駾壍.device} ${輱壍 > 0 ? Math.round((駾壍[灂壍.key] / 輱壍) * 100) : 0}%`).join(", ")}`}>
                {輱壍 > 0 ? (豁壍.map((曭壍, 藜壍) => 曭壍[灂壍.key] > 0 ? (<span key={曭壍.device} className="h-full" style={{ width: `${(曭壍[灂壍.key] / 輱壍) * 100}%`, background: 揽壍(曭壍.device, 藜壍) }} title={`${曭壍.device}: ${((曭壍[灂壍.key] / 輱壍) * 100).toFixed(1)}% · ${灂壍.key === "cost" || 灂壍.key === "conv_value" ? money(曭壍[灂壍.key], 腴壍, undefined, false) : formatMetricValue(灂壍.key === "clicks" ? "number" : "decimal", 曭壍[灂壍.key], { compact: false })}`}/>) : null)) : (<span className="h-full w-full bg-tone/6"/>)}
              </div>
            </div>);
        })}
      </div>
      <DataTable rows={豁壍} columns={滊壍} rowKey={(勋壍) => 勋壍.device} ariaLabel="Metrics by device" initialSort={{ key: "cost", dir: "desc" }} minWidth={620}/>
    </Card>);
}
type HeatMetric = "conversions" | "clicks" | "cost";
const 熺壍: {
    value: HeatMetric;
    label: string;
}[] = [
    { value: "conversions", label: "Conversions" },
    { value: "clicks", label: "Clicks" },
    { value: "cost", label: "Spend" },
];
function 邩壍(嶘壍: HeatMetric, 粇壍: number, 魶壍: MoneyFmt, 桥壍 = true): string {
    if (嶘壍 === "cost")
        return money(粇壍, 魶壍, undefined, 桥壍);
    return formatMetricValue(嶘壍 === "clicks" ? "number" : "decimal", 粇壍, { compact: 桥壍 });
}
function Cmp30({ detail: 呃壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 猲壍, filters: 鈡壍 } = useCampaignContext();
    const 弐壍 = useStatus();
    const [緿壍, 鳮壍] = useState<HeatMetric>("conversions");
    const 槝壍 = useMemo(() => prefersReducedMotion(), []);
    const { dows: 裌壍, hours: 喻壍 } = 呃壍.hourDow;
    const 璪壍 = 呃壍.hourDow[緿壍];
    const { cells: 鎙壍, max: 悈壍, peak: 罷壍 } = useMemo(() => {
        const 鹦壍: [
            number,
            number,
            number
        ][] = [];
        let 歕壍: {
            d: number;
            h: number;
            v: number;
        } | null = null;
        for (let 詄壍 = 0; 詄壍 < 璪壍.length; 詄壍++) {
            const 圳壍 = 璪壍[詄壍] ?? [];
            for (let 瘢壍 = 0; 瘢壍 < 圳壍.length; 瘢壍++) {
                const 锑壍 = 圳壍[瘢壍] ?? 0;
                鹦壍.push([瘢壍, 詄壍, 锑壍]);
                if (!歕壍 || 锑壍 > 歕壍.v)
                    歕壍 = { d: 詄壍, h: 瘢壍, v: 锑壍 };
            }
        }
        return { cells: 鹦壍, max: 歕壍 ? 歕壍.v : 0, peak: 歕壍 };
    }, [璪壍]);
    const 戀壍 = 璪壍.map((胯壍) => 胯壍.reduce((鿞壍, 泍壍) => 鿞壍 + 泍壍, 0));
    const 讼壍 = 戀壍.indexOf(Math.max(...戀壍));
    const 墫壍 = (瞚壍: ChartTokens) => ({
        ...baseOption(瞚壍, 槝壍),
        grid: { left: 40, right: 8, top: 4, bottom: 40 },
        xAxis: categoryAxis(瞚壍, 喻壍.map(String), { splitArea: { show: false }, axisLabel: { ...axisLabel(瞚壍), interval: 2, formatter: (隉壍: string) => `${隉壍.padStart(2, "0")}h` } }),
        yAxis: categoryAxis(瞚壍, 裌壍, { inverse: true, axisLabel: { ...axisLabel(瞚壍) } }),
        visualMap: {
            show: true,
            min: 0,
            max: 悈壍 || 1,
            orient: "horizontal",
            left: "center",
            bottom: 0,
            itemWidth: 10,
            itemHeight: 120,
            calculable: false,
            inRange: { color: sequentialRamp(瞚壍) },
            textStyle: { color: 瞚壍.faint, fontFamily: 瞚壍.fontMono, fontSize: 10 },
            formatter: (捸壍: number) => 邩壍(緿壍, 捸壍, 猲壍),
        },
        tooltip: {
            ...baseOption(瞚壍, 槝壍).tooltip,
            trigger: "item",
            formatter: (艧壍: {
                value: [
                    number,
                    number,
                    number
                ];
            }) => tooltipHtml(`${裌壍[艧壍.value[1]] ?? ""} · ${String(喻壍[艧壍.value[0]] ?? 0).padStart(2, "0")}:00`, [{ label: 熺壍.find((佖壍) => 佖壍.value === 緿壍)?.label ?? 緿壍, value: 邩壍(緿壍, 艧壍.value[2], 猲壍, false) }]),
        },
        series: [{ type: "heatmap", data: 鎙壍, itemStyle: { borderColor: 瞚壍.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: 瞚壍.text, borderWidth: 1 } } }],
    });
    const 湅壍 = 熺壍.find((贴壍) => 贴壍.value === 緿壍)?.label.toLowerCase() ?? 緿壍;
    return (<Card className="flex min-w-0 flex-col gap-4">
      <CardHeader title="Hour × weekday" sub={`${rangeShortLabel(鈡壍.rangeKey, 鈡壍.range)} · account time zone${弐壍.data ? ` (${弐壍.data.account.timezone})` : ""}`} action={<Segmented ariaLabel="Heatmap metric" options={熺壍} value={緿壍} onChange={鳮壍}/>}/>
      {悈壍 > 0 ? (<>
          <div className="relative h-[280px]">
            <EChart className="absolute inset-0" build={墫壍} deps={[鎙壍, 悈壍, 緿壍, 猲壍.currency, 猲壍.fx]} ariaLabel={`${呃壍.campaign.name}: ${湅壍} by hour of day and weekday`}/>
          </div>
          <p className="m-0 text-[13px] text-muted">
            {罷壍 ? (<>
                {"Peak hour "}
                <span className="font-semibold text-fg">{`${裌壍[罷壍.d] ?? ""} ${String(喻壍[罷壍.h] ?? 0).padStart(2, "0")}:00`}</span>
                {` · ${邩壍(緿壍, 罷壍.v, 猲壍, false)} ${緿壍 === "cost" ? "spent" : 湅壍}. Strongest day: `}
                <span className="font-semibold text-fg">{裌壍[讼壍] ?? "—"}</span>
                {` (${邩壍(緿壍, 戀壍[讼壍] ?? 0, 猲壍)}).`}
              </>) : null}
          </p>
        </>) : (<InlineEmpty>{`No ${湅壍} by hour in this range.`}</InlineEmpty>)}
    </Card>);
}
