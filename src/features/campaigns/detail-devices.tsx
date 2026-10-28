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
const SPLIT: {
    key: "cost" | "clicks" | "conversions" | "conv_value";
    label: string;
}[] = [
    { key: "cost", label: "Spend" },
    { key: "clicks", label: "Clicks" },
    { key: "conversions", label: "Conversions" },
    { key: "conv_value", label: "Conv. value" },
];
export function DevicesTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    return (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <DeviceSplit detail={d}/>
      <HourHeatmap detail={d}/>
    </div>);
}
function DeviceSplit({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m, filters } = useCampaignContext();
    const t = useChartTokens();
    const devices = useMemo(() => [...d.devices].sort((a, b) => b.cost - a.cost), [d.devices]);
    const totals = useMemo(() => totalsOf(devices), [devices]);
    const color = (name: string, i: number) => colorFor("device", name, i, t);
    const columns = useMemo<Column<DeviceRow>[]>(() => [
        {
            key: "device",
            header: "Device",
            width: "minmax(120px,1.4fr)",
            sortValue: (r) => r.device,
            cell: (r) => (<span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-3.5 shrink-0 rounded-pill" style={{ background: colorFor("device", r.device, devices.indexOf(r), t) }}/>
            <span className="truncate font-medium">{r.device}</span>
          </span>),
            total: "Total",
        },
        ...(["cost", "clicks", "ctr", "conversions", "cpa", "roas", "cvr"] as MetricKey[]).map((k) => ({
            key: k,
            header: METRIC_META[k].label,
            width: "minmax(60px,1fr)",
            align: "right" as const,
            sortValue: (r: DeviceRow) => r[k],
            cell: (r: DeviceRow) => formatMetric(k, r[k], m),
            total: formatMetric(k, totals[k], m),
        })),
    ], [devices, m, t, totals]);
    if (!devices.length)
        return <EmptyState>No device data in this range.</EmptyState>;
    return (<Card className="flex min-w-0 flex-col gap-5">
      <CardHeader title="Device split" sub={`Share of each metric · ${rangeShortLabel(filters.rangeKey, filters.range)}`}/>
      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
        {devices.map((r, i) => (<span key={r.device} className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-3.5 rounded-pill" style={{ background: color(r.device, i) }}/>
            {r.device}
          </span>))}
      </div>
      <div className="flex flex-col gap-3.5">
        {SPLIT.map((s) => {
            const total = devices.reduce((sum, r) => sum + r[s.key], 0);
            return (<div key={s.key} className="grid items-center gap-3" style={{ gridTemplateColumns: "96px minmax(0,1fr)" }}>
              <span className="label-mono">{s.label}</span>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={`${s.label} by device: ${devices.map((r) => `${r.device} ${total > 0 ? Math.round((r[s.key] / total) * 100) : 0}%`).join(", ")}`}>
                {total > 0 ? (devices.map((r, i) => r[s.key] > 0 ? (<span key={r.device} className="h-full" style={{ width: `${(r[s.key] / total) * 100}%`, background: color(r.device, i) }} title={`${r.device}: ${((r[s.key] / total) * 100).toFixed(1)}% · ${s.key === "cost" || s.key === "conv_value" ? money(r[s.key], m, undefined, false) : formatMetricValue(s.key === "clicks" ? "number" : "decimal", r[s.key], { compact: false })}`}/>) : null)) : (<span className="h-full w-full bg-tone/6"/>)}
              </div>
            </div>);
        })}
      </div>
      <DataTable rows={devices} columns={columns} rowKey={(r) => r.device} ariaLabel="Metrics by device" initialSort={{ key: "cost", dir: "desc" }} minWidth={620}/>
    </Card>);
}
type HeatMetric = "conversions" | "clicks" | "cost";
const HEAT_OPTIONS: {
    value: HeatMetric;
    label: string;
}[] = [
    { value: "conversions", label: "Conversions" },
    { value: "clicks", label: "Clicks" },
    { value: "cost", label: "Spend" },
];
function heatValue(metric: HeatMetric, v: number, m: MoneyFmt, compact = true): string {
    if (metric === "cost")
        return money(v, m, undefined, compact);
    return formatMetricValue(metric === "clicks" ? "number" : "decimal", v, { compact });
}
function HourHeatmap({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m, filters } = useCampaignContext();
    const status = useStatus();
    const [metric, setMetric] = useState<HeatMetric>("conversions");
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const { dows, hours } = d.hourDow;
    const matrix = d.hourDow[metric];
    const { cells, max, peak } = useMemo(() => {
        const out: [
            number,
            number,
            number
        ][] = [];
        let best: {
            d: number;
            h: number;
            v: number;
        } | null = null;
        for (let di = 0; di < matrix.length; di++) {
            const row = matrix[di] ?? [];
            for (let hi = 0; hi < row.length; hi++) {
                const v = row[hi] ?? 0;
                out.push([hi, di, v]);
                if (!best || v > best.v)
                    best = { d: di, h: hi, v };
            }
        }
        return { cells: out, max: best ? best.v : 0, peak: best };
    }, [matrix]);
    const dayTotals = matrix.map((row) => row.reduce((s, v) => s + v, 0));
    const bestDay = dayTotals.indexOf(Math.max(...dayTotals));
    const build = (t: ChartTokens) => ({
        ...baseOption(t, reduced),
        grid: { left: 40, right: 8, top: 4, bottom: 40 },
        xAxis: categoryAxis(t, hours.map(String), { splitArea: { show: false }, axisLabel: { ...axisLabel(t), interval: 2, formatter: (v: string) => `${v.padStart(2, "0")}h` } }),
        yAxis: categoryAxis(t, dows, { inverse: true, axisLabel: { ...axisLabel(t) } }),
        visualMap: {
            show: true,
            min: 0,
            max: max || 1,
            orient: "horizontal",
            left: "center",
            bottom: 0,
            itemWidth: 10,
            itemHeight: 120,
            calculable: false,
            inRange: { color: sequentialRamp(t) },
            textStyle: { color: t.faint, fontFamily: t.fontMono, fontSize: 10 },
            formatter: (v: number) => heatValue(metric, v, m),
        },
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "item",
            formatter: (p: {
                value: [
                    number,
                    number,
                    number
                ];
            }) => tooltipHtml(`${dows[p.value[1]] ?? ""} · ${String(hours[p.value[0]] ?? 0).padStart(2, "0")}:00`, [{ label: HEAT_OPTIONS.find((o) => o.value === metric)?.label ?? metric, value: heatValue(metric, p.value[2], m, false) }]),
        },
        series: [{ type: "heatmap", data: cells, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } } }],
    });
    const label = HEAT_OPTIONS.find((o) => o.value === metric)?.label.toLowerCase() ?? metric;
    return (<Card className="flex min-w-0 flex-col gap-4">
      <CardHeader title="Hour × weekday" sub={`${rangeShortLabel(filters.rangeKey, filters.range)} · account time zone${status.data ? ` (${status.data.account.timezone})` : ""}`} action={<Segmented ariaLabel="Heatmap metric" options={HEAT_OPTIONS} value={metric} onChange={setMetric}/>}/>
      {max > 0 ? (<>
          <div className="relative h-[280px]">
            <EChart className="absolute inset-0" build={build} deps={[cells, max, metric, m.currency, m.fx]} ariaLabel={`${d.campaign.name}: ${label} by hour of day and weekday`}/>
          </div>
          <p className="m-0 text-[13px] text-muted">
            {peak ? (<>
                {"Peak hour "}
                <span className="font-semibold text-fg">{`${dows[peak.d] ?? ""} ${String(hours[peak.h] ?? 0).padStart(2, "0")}:00`}</span>
                {` · ${heatValue(metric, peak.v, m, false)} ${metric === "cost" ? "spent" : label}. Strongest day: `}
                <span className="font-semibold text-fg">{dows[bestDay] ?? "—"}</span>
                {` (${heatValue(metric, dayTotals[bestDay] ?? 0, m)}).`}
              </>) : null}
          </p>
        </>) : (<InlineEmpty>{`No ${label} by hour in this range.`}</InlineEmpty>)}
    </Card>);
}
