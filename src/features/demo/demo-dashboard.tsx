"use client";
import { useMemo } from "react";
import { baseOption, categoryAxis, prefersReducedMotion, tooltipHtml, valueAxis } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, StatTile, TileGrid } from "@/components/ui/surfaces";
import type { DemoDataset } from "@/lib/domain/contracts/demo";
import { formatLong, formatShort } from "@/lib/domain/dates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import { campaignSummaries, dailySeries, dateSpan, summarize, type DemoCampaignSummary } from "./demo-model";
function trendOption(tokens: ChartTokens, dates: string[], values: number[], format: MetricFormat, label: string, currency: string, reduced: boolean) {
    const fmt = (value: number) => formatMetricValue(format, value, { currency });
    return {
        ...baseOption(tokens, reduced),
        grid: { left: 52, right: 10, top: 16, bottom: 24 },
        xAxis: categoryAxis(tokens, dates, { boundaryGap: false, axisLabel: { color: tokens.faint, fontFamily: tokens.fontMono, fontSize: 10, hideOverlap: true, formatter: (date: string) => formatShort(date) } }),
        yAxis: valueAxis(tokens, format, currency, { min: 0, splitNumber: 3 }),
        tooltip: {
            ...baseOption(tokens, reduced).tooltip,
            trigger: "axis",
            formatter: (points: {
                dataIndex: number;
            }[]) => {
                const i = points[0]?.dataIndex ?? 0;
                return tooltipHtml(formatShort(dates[i] ?? ""), [{ color: tokens.accentLine, label, value: fmt(values[i] ?? 0) }]);
            },
        },
        series: [{ name: label, type: "line", data: values, symbol: "none", lineStyle: { color: tokens.accentLine, width: 2 }, itemStyle: { color: tokens.accentLine } }],
    };
}
export function DemoDashboard({ data }: {
    data: DemoDataset;
}) {
    const currency = data.account.currency;
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const totals = useMemo(() => summarize(data.daily), [data]);
    const series = useMemo(() => dailySeries(data.daily), [data]);
    const rows = useMemo(() => campaignSummaries(data), [data]);
    const span = dateSpan(data.daily);
    const money = (value: number | null) => formatMetricValue("money", value, { currency });
    const columns: Column<DemoCampaignSummary>[] = [
        { key: "name", header: "Campaign", width: "minmax(200px,2fr)", sortValue: (row) => row.campaign.name, cell: (row) => <span className="truncate" title={row.campaign.name}>{row.campaign.name}</span> },
        { key: "type", header: "Type", width: "110px", sortValue: (row) => row.campaign.type, cell: (row) => <span className="text-muted">{row.campaign.type}</span> },
        { key: "cost", header: "Spend", width: "110px", align: "right", sortValue: (row) => row.cost, cell: (row) => <span className="font-mono text-xs">{money(row.cost)}</span> },
        { key: "clicks", header: "Clicks", width: "100px", align: "right", sortValue: (row) => row.clicks, cell: (row) => <span className="font-mono text-xs">{formatMetricValue("number", row.clicks)}</span> },
        { key: "conversions", header: "Conv.", width: "90px", align: "right", sortValue: (row) => row.conversions, cell: (row) => <span className="font-mono text-xs">{formatMetricValue("decimal", row.conversions)}</span> },
        { key: "cpa", header: "CPA", width: "90px", align: "right", sortValue: (row) => row.cpa, cell: (row) => <span className="font-mono text-xs">{money(row.cpa)}</span> },
        { key: "roas", header: "ROAS", width: "80px", align: "right", sortValue: (row) => row.roas, cell: (row) => <span className="font-mono text-xs">{formatMetricValue("ratio", row.roas)}</span> },
    ];
    const rangeText = span ? `${formatLong(span.start)} – ${formatLong(span.end)}` : "No days";
    return (<div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <CardHeader title={data.account.name} sub={`${rangeText} · ${currency}`} action={<Pill tone="muted">Demo data</Pill>}/>
        <TileGrid min={150}>
          <StatTile label="Spend" value={money(totals.cost)}/>
          <StatTile label="Clicks" value={formatMetricValue("number", totals.clicks, { compact: true })}/>
          <StatTile label="Conversions" value={formatMetricValue("decimal", totals.conversions)}/>
          <StatTile label="CPA" value={money(totals.cpa)}/>
          <StatTile label="ROAS" value={formatMetricValue("ratio", totals.roas)}/>
        </TileGrid>
      </Card>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Spend per day"/>
          <div className="relative h-[200px]">
            <EChart className="absolute inset-0" build={(tokens) => trendOption(tokens, series.dates, series.cost, "money", "Spend", currency, reduced)} deps={[series, currency]} ariaLabel={`Daily spend, ${rangeText}: ${money(totals.cost)} in total`}/>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Conversions per day"/>
          <div className="relative h-[200px]">
            <EChart className="absolute inset-0" build={(tokens) => trendOption(tokens, series.dates, series.conversions, "decimal", "Conversions", currency, reduced)} deps={[series, currency]} ariaLabel={`Daily conversions, ${rangeText}: ${formatMetricValue("decimal", totals.conversions)} in total`}/>
          </div>
        </Card>
      </div>
      <Card className="flex flex-col gap-4">
        <CardHeader title="Campaigns" sub={`${rows.length} campaigns · ratios are ratios of sums`}/>
        <DataTable rows={rows} columns={columns} rowKey={(row) => row.campaign.id} ariaLabel="Demo campaigns" initialSort={{ key: "cost", dir: "desc" }} minWidth={780} empty="No campaigns in the demo data."/>
      </Card>
    </div>);
}
