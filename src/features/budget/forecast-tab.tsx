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
const METRICS = ["cost", "conversions", "conv_value", "clicks"] as const;
type Metric = (typeof METRICS)[number];
const METRIC_META: Record<Metric, {
    label: string;
    format: MetricFormat;
    noun: string;
}> = {
    cost: { label: "Spend", format: "money", noun: "spend" },
    conversions: { label: "Conversions", format: "decimal", noun: "conversions" },
    conv_value: { label: "Value", format: "money", noun: "conversion value" },
    clicks: { label: "Clicks", format: "number", noun: "clicks" },
};
const HISTORY_SHOWN = 56;
export function ForecastTab({ rows, currentMonth, currency, onOpenSimulators }: {
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    onOpenSimulators?: () => void;
}) {
    const [metric, setMetric] = useQueryState("metric", parseAsStringLiteral(METRICS).withDefault("cost").withOptions({ history: "replace", scroll: false }));
    const [scope, setScope] = useQueryState("scope", parseAsString.withOptions({ history: "replace", scroll: false }));
    const campaigns = useMemo(() => rows.filter((r) => r.type !== "Shared" && r.campaignIds.length === 1).map((r) => ({ id: r.campaignIds[0] as string, name: r.name, row: r })), [rows]);
    const scoped = campaigns.find((c) => c.id === scope);
    const q = useBudgetForecast(metric, { campaignId: scoped?.id });
    const pacing = usePacing(currentMonth);
    const [table, setTable] = useState(false);
    const meta = METRIC_META[metric];
    const fmt = (v: number | null | undefined, compact = true) => formatMetricValue(meta.format, v, { currency, compact });
    const f = q.data;
    const monthEnd = useMemo(() => {
        if (!f || metric !== "cost" || !pacing.data)
            return null;
        const row = scoped ? pacing.data.rows.find((r) => r.campaignIds.length === 1 && r.campaignIds[0] === scoped.id) : null;
        const mtd = scoped ? (row?.mtdSpend ?? null) : pacing.data.totals.mtdSpend;
        const budget = scoped ? (row?.monthlyTarget ?? null) : pacing.data.totals.monthlyTarget;
        if (mtd === null || budget === null)
            return null;
        return { value: mtd + f.totals.restOfMonth.yhat, budget };
    }, [f, metric, pacing.data, scoped]);
    return (<div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <CardHeader title={`30-day ${meta.noun} forecast`} sub={`${scoped ? scoped.name : "All campaigns"} · damped trend + weekday seasonality · 80% range`} action={<div className="flex flex-wrap items-center gap-2.5">
              <Select aria-label="Campaign" value={scoped?.id ?? ""} onChange={(e) => void setScope(e.target.value || null)} className="max-w-[240px] py-2">
                <option value="">All campaigns</option>
                {campaigns.map((c) => (<option key={c.id} value={c.id}>
                    {c.name}
                  </option>))}
              </Select>
              <Segmented ariaLabel="Forecast metric" variant="sans" value={metric} onChange={(m) => void setMetric(m)} options={METRICS.map((m) => ({ value: m, label: METRIC_META[m].label }))}/>
            </div>}/>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed text-muted-3" role="note">
          <span aria-hidden className="text-accent">
            ⓘ
          </span>
          <span>Our trend forecast: where the next 30 days go if nothing changes. For “what if I change a budget or target?”, Google&apos;s simulators answer better.</span>
          {onOpenSimulators ? (<Button variant="link" className="text-xs" onClick={onOpenSimulators}>
              Open Simulators →
            </Button>) : null}
        </p>
        <div className="flex flex-wrap items-center gap-[18px]">
          <LegendKey kind="line" label="Actual"/>
          <LegendKey kind="dashed" label="Forecast"/>
          <LegendKey kind="band" label="80% range"/>
        </div>
        {q.error && !f ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
        {!f && !q.error ? <Skeleton height={280}/> : null}
        {f ? (<Refetching active={q.isPlaceholderData || q.isFetching} className="flex flex-col gap-3">
            <ForecastChart forecast={f} format={meta.format} currency={currency} label={meta.label}/>
            <div className="flex justify-end">
              <Button variant="link" className="text-xs" onClick={() => setTable((v) => !v)} aria-expanded={table}>
                {table ? "Hide table" : "View as table"}
              </Button>
            </div>
            {table ? <ForecastTable forecast={f} fmt={(v) => fmt(v, false)}/> : null}
          </Refetching>) : null}
      </Card>

      {f ? (<div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <StatCard className="shadow-card" label={`Rest of ${monthName(currentMonth)}`} value={fmt(f.totals.restOfMonth.yhat)} caption={`80% range ${fmt(f.totals.restOfMonth.lo)} – ${fmt(f.totals.restOfMonth.hi)}`}/>
          <StatCard className="shadow-card" label="Next 30 days" value={fmt(f.totals.next30.yhat)} caption={`80% range ${fmt(f.totals.next30.lo)} – ${fmt(f.totals.next30.hi)}`}/>
          {monthEnd ? (<StatCard className="shadow-card" label="Month-end spend estimate" value={money(monthEnd.value, currency)} caption={monthEnd.budget > 0 ? `${Math.round((monthEnd.value / monthEnd.budget) * 100)}% of the ${money(monthEnd.budget, currency)} budget` : "No budget set"} tone={monthEnd.budget > 0 && monthEnd.value / monthEnd.budget > 1.05 ? "warn" : "accent"}/>) : null}
          <StatCard className="shadow-card" label="Backtest error" value={f.backtestMape === null ? "—" : `${(f.backtestMape * 100).toFixed(1)}%`} caption={f.backtestMape === null ? "Not enough history to backtest" : "Mean absolute % error, last 14 days held out"}/>
        </div>) : null}
    </div>);
}
function ForecastChart({ forecast, format, currency, label }: {
    forecast: ForecastResult;
    format: MetricFormat;
    currency: string;
    label: string;
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const days = Math.min(HISTORY_SHOWN, forecast.history.length);
    const fmt = (v: number | null | undefined) => formatMetricValue(format, v, { currency, compact: false, decimals: format === "decimal" ? 1 : undefined });
    const total = forecast.totals.next30;
    return (<div className="relative h-[280px]">
      <EChart className="absolute inset-0" build={(t: ChartTokens) => forecastOption(t, forecast, HISTORY_SHOWN, format, currency, label, reduced)} deps={[forecast, format, currency, label]} ariaLabel={`${label}: last ${days} days and a 30-day forecast of ${fmt(total.yhat)} (80% range ${fmt(total.lo)} – ${fmt(total.hi)})`}/>
    </div>);
}
function ForecastTable({ forecast, fmt }: {
    forecast: ForecastResult;
    fmt: (v: number) => string;
}) {
    type P = ForecastResult["points"][number];
    const columns: Column<P>[] = [
        { key: "date", header: "Date", width: "minmax(100px,1fr)", cell: (p) => formatShort(p.date), sortValue: (p) => p.date },
        { key: "yhat", header: "Forecast", align: "right", width: "minmax(100px,1fr)", cell: (p) => <span className="font-semibold">{fmt(p.yhat)}</span>, sortValue: (p) => p.yhat },
        { key: "lo", header: "Low (80%)", align: "right", width: "minmax(100px,1fr)", cell: (p) => <span className="text-muted">{fmt(p.lo)}</span> },
        { key: "hi", header: "High (80%)", align: "right", width: "minmax(100px,1fr)", cell: (p) => <span className="text-muted">{fmt(p.hi)}</span> },
    ];
    return <DataTable rows={forecast.points} columns={columns} rowKey={(p) => p.date} ariaLabel="Forecast by day" density="compact" minWidth={440} maxHeight={320}/>;
}
