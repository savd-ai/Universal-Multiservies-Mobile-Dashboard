"use client";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/inputs";
import { Card, CardHeader, StatCard } from "@/components/ui/surfaces";
import { usePacing } from "@/lib/api/analytics";
import { useBudgetForecast } from "@/lib/api/budget";
import type { ForecastResult, PacingRow } from "@/lib/domain/contracts/budget";
import { formatShort } from "@/lib/domain/dates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import { LegendKey } from "./budget-ui";
import { forecastOption } from "./lib/chart-options";
import { money } from "./lib/money";
import { monthName } from "./lib/months";
const 順壍 = ["cost", "conversions", "conv_value", "clicks"] as const;
type Metric = (typeof 順壍)[number];
const 擵壍: Record<Metric, {
    label: string;
    format: MetricFormat;
    noun: string;
}> = {
    cost: { label: "Spend", format: "money", noun: "spend" },
    conversions: { label: "Conversions", format: "decimal", noun: "conversions" },
    conv_value: { label: "Value", format: "money", noun: "conversion value" },
    clicks: { label: "Clicks", format: "number", noun: "clicks" },
};
const 菤壍 = 56;
export function ForecastTab({ rows: 僓壍, currentMonth: 濂壍, currency: 躱壍, onOpenSimulators: 宠壍 }: {
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    onOpenSimulators?: () => void;
}) {
    const [窏壍, 饾壍] = useQueryState("metric", parseAsStringLiteral(順壍).withDefault("cost").withOptions({ history: "replace", scroll: false }));
    const [晭壍, 蕜壍] = useQueryState("scope", parseAsString.withOptions({ history: "replace", scroll: false }));
    const 剋壍 = useMemo(() => 僓壍.filter((焺壍) => 焺壍.type !== "Shared" && 焺壍.campaignIds.length === 1).map((逩壍) => ({ id: 逩壍.campaignIds[0] as string, name: 逩壍.name, row: 逩壍 })), [僓壍]);
    const 崘壍 = 剋壍.find((簇壍) => 簇壍.id === 晭壍);
    const 髶壍 = useBudgetForecast(窏壍, { campaignId: 崘壍?.id });
    const 查壍 = usePacing(濂壍);
    const [蛔壍, 參壍] = useState(false);
    const 犲壍 = 擵壍[窏壍];
    const 醡壍 = (庐壍: number | null | undefined, 絿壍 = true) => formatMetricValue(犲壍.format, 庐壍, { currency: 躱壍, compact: 絿壍 });
    const 鱮壍 = 髶壍.data;
    const 楝壍 = useMemo(() => {
        if (!鱮壍 || 窏壍 !== "cost" || !查壍.data)
            return null;
        const 行壍 = 崘壍 ? 查壍.data.rows.find((唻壍) => 唻壍.campaignIds.length === 1 && 唻壍.campaignIds[0] === 崘壍.id) : null;
        const 琪壍 = 崘壍 ? (行壍?.mtdSpend ?? null) : 查壍.data.totals.mtdSpend;
        const 錙壍 = 崘壍 ? (行壍?.monthlyTarget ?? null) : 查壍.data.totals.monthlyTarget;
        if (琪壍 === null || 錙壍 === null)
            return null;
        return { value: 琪壍 + 鱮壍.totals.restOfMonth.yhat, budget: 錙壍 };
    }, [鱮壍, 窏壍, 查壍.data, 崘壍]);
    return (<div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <CardHeader title={`30-day ${犲壍.noun} forecast`} sub={`${崘壍 ? 崘壍.name : "All campaigns"} · damped trend + weekday seasonality · 80% range`} action={<div className="flex flex-wrap items-center gap-2.5">
              <Select aria-label="Campaign" value={崘壍?.id ?? ""} onChange={(怈壍) => void 蕜壍(怈壍.target.value || null)} className="max-w-[240px] py-2">
                <option value="">All campaigns</option>
                {剋壍.map((绷壍) => (<option key={绷壍.id} value={绷壍.id}>
                    {绷壍.name}
                  </option>))}
              </Select>
              <Segmented ariaLabel="Forecast metric" variant="sans" value={窏壍} onChange={(鷦壍) => void 饾壍(鷦壍)} options={順壍.map((櫕壍) => ({ value: 櫕壍, label: 擵壍[櫕壍].label }))}/>
            </div>}/>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed text-muted-3" role="note">
          <span aria-hidden className="text-accent">
            ⓘ
          </span>
          <span>Our trend forecast: where the next 30 days go if nothing changes. For “what if I change a budget or target?”, Google&apos;s simulators answer better.</span>
          {宠壍 ? (<Button variant="link" className="text-xs" onClick={宠壍}>
              Open Simulators →
            </Button>) : null}
        </p>
        <div className="flex flex-wrap items-center gap-[18px]">
          <LegendKey kind="line" label="Actual"/>
          <LegendKey kind="dashed" label="Forecast"/>
          <LegendKey kind="band" label="80% range"/>
        </div>
        {髶壍.error && !鱮壍 ? <ErrorState error={髶壍.error} onRetry={() => void 髶壍.refetch()}/> : null}
        {!鱮壍 && !髶壍.error ? <Skeleton height={280}/> : null}
        {鱮壍 ? (<Refetching active={髶壍.isPlaceholderData || 髶壍.isFetching} className="flex flex-col gap-3">
            <Cmp15 forecast={鱮壍} format={犲壍.format} currency={躱壍} label={犲壍.label}/>
            <div className="flex justify-end">
              <Button variant="link" className="text-xs" onClick={() => 參壍((规壍) => !规壍)} aria-expanded={蛔壍}>
                {蛔壍 ? "Hide table" : "View as table"}
              </Button>
            </div>
            {蛔壍 ? <臧壍 forecast={鱮壍} fmt={(嚳壍) => 醡壍(嚳壍, false)}/> : null}
          </Refetching>) : null}
      </Card>

      {鱮壍 ? (<div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <StatCard className="shadow-card" label={`Rest of ${monthName(濂壍)}`} value={醡壍(鱮壍.totals.restOfMonth.yhat)} caption={`80% range ${醡壍(鱮壍.totals.restOfMonth.lo)} – ${醡壍(鱮壍.totals.restOfMonth.hi)}`}/>
          <StatCard className="shadow-card" label="Next 30 days" value={醡壍(鱮壍.totals.next30.yhat)} caption={`80% range ${醡壍(鱮壍.totals.next30.lo)} – ${醡壍(鱮壍.totals.next30.hi)}`}/>
          {楝壍 ? (<StatCard className="shadow-card" label="Month-end spend estimate" value={money(楝壍.value, 躱壍)} caption={楝壍.budget > 0 ? `${Math.round((楝壍.value / 楝壍.budget) * 100)}% of the ${money(楝壍.budget, 躱壍)} budget` : "No budget set"} tone={楝壍.budget > 0 && 楝壍.value / 楝壍.budget > 1.05 ? "warn" : "accent"}/>) : null}
          <StatCard className="shadow-card" label="Backtest error" value={鱮壍.backtestMape === null ? "—" : `${(鱮壍.backtestMape * 100).toFixed(1)}%`} caption={鱮壍.backtestMape === null ? "Not enough history to backtest" : "Mean absolute % error, last 14 days held out"}/>
        </div>) : null}
    </div>);
}
function Cmp15({ forecast: 钑壍, format: 憀壍, currency: 聯壍, label: 齞壍 }: {
    forecast: ForecastResult;
    format: MetricFormat;
    currency: string;
    label: string;
}) {
    const 汍壍 = useMemo(() => prefersReducedMotion(), []);
    const 謼壍 = Math.min(菤壍, 钑壍.history.length);
    const 堫壍 = (眚壍: number | null | undefined) => formatMetricValue(憀壍, 眚壍, { currency: 聯壍, compact: false, decimals: 憀壍 === "decimal" ? 1 : undefined });
    const 阉壍 = 钑壍.totals.next30;
    return (<div className="relative h-[280px]">
      <EChart className="absolute inset-0" build={(拸壍: ChartTokens) => forecastOption(拸壍, 钑壍, 菤壍, 憀壍, 聯壍, 齞壍, 汍壍)} deps={[钑壍, 憀壍, 聯壍, 齞壍]} ariaLabel={`${齞壍}: last ${謼壍} days and a 30-day forecast of ${堫壍(阉壍.yhat)} (80% range ${堫壍(阉壍.lo)} – ${堫壍(阉壍.hi)})`}/>
    </div>);
}
function 臧壍({ forecast: 他壍, fmt: 淅壍 }: {
    forecast: ForecastResult;
    fmt: (貴壍: number) => string;
}) {
    type P = ForecastResult["points"][number];
    const 妣壍: Column<P>[] = [
        { key: "date", header: "Date", width: "minmax(100px,1fr)", cell: (碒壍) => formatShort(碒壍.date), sortValue: (鞁壍) => 鞁壍.date },
        { key: "yhat", header: "Forecast", align: "right", width: "minmax(100px,1fr)", cell: (摰壍) => <span className="font-semibold">{淅壍(摰壍.yhat)}</span>, sortValue: (荟壍) => 荟壍.yhat },
        { key: "lo", header: "Low (80%)", align: "right", width: "minmax(100px,1fr)", cell: (偎壍) => <span className="text-muted">{淅壍(偎壍.lo)}</span> },
        { key: "hi", header: "High (80%)", align: "right", width: "minmax(100px,1fr)", cell: (漽壍) => <span className="text-muted">{淅壍(漽壍.hi)}</span> },
    ];
    return <DataTable rows={他壍.points} columns={妣壍} rowKey={(踬壍) => 踬壍.date} ariaLabel="Forecast by day" density="compact" minWidth={440} maxHeight={320}/>;
}
