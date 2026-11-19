"use client";

import { useMemo } from "react";
import { axisLabel, baseOption, categoryAxis, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import { colorFor } from "@/components/charts/palette";
import type { ChartTokens } from "@/components/charts/tokens";
import { formatShort } from "@/lib/domain/dates";
import { formatMetricValue, formatMoney } from "@/lib/domain/metrics/registry";
import { evenTicks, type StackSeries } from "./channels-model";

// Channels charts: daily spend stacked by platform (identity colors, ≤ 6 series + Other, rounded top segment) and
// MER small multiples (store revenue vs ad spend on one money axis, MER below — never a dual axis).

export function seriesColor(s: Pick<StackSeries, "id" | "other">, index: ReadonlyMap<string, number>, t: ChartTokens): string {
  return s.other ? t.other : colorFor("platform", s.id, index.get(s.id) ?? 0, t);
}

interface DailySpendProps {
  dates: string[];
  series: StackSeries[];
  colorIndex: ReadonlyMap<string, number>;
  currency: string;
}

export function DailySpendChart({ dates, series, colorIndex, currency }: DailySpendProps) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const build = (t: ChartTokens) => {
    const ticks = evenTicks(dates.length, 6);
    // 4px rounded ends only on the top-most non-zero segment of each day
    const top = dates.map((_, i) => {
      for (let s = series.length - 1; s >= 0; s--) if ((series[s]?.trend[i] ?? 0) > 0) return s;
      return -1;
    });
    const money = (v: number) => formatMoney(v, { currency, compact: false });
    return {
      ...baseOption(t, reduced),
      grid: { left: 56, right: 8, top: 8, bottom: 24 },
      xAxis: categoryAxis(t, dates, { axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v) } }),
      yAxis: valueAxis(t, "money", currency, { splitNumber: 4 }),
      tooltip: {
        ...baseOption(t, reduced).tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: t.theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(60,60,67,0.05)" } },
        formatter: (params: { dataIndex: number; seriesIndex: number; value: number }[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const rows: TipRow[] = [...params]
            .reverse()
            .filter((p) => (p.value ?? 0) > 0)
            .map((p) => {
              const s = series[p.seriesIndex];
              return { color: s ? seriesColor(s, colorIndex, t) : t.other, label: s?.label ?? "", value: money(p.value) };
            });
          rows.push({ label: "Total", value: money(params.reduce((sum, p) => sum + (p.value ?? 0), 0)) });
          return tooltipHtml(formatShort(dates[i] ?? ""), rows);
        },
      },
      series: series.map((s, si) => ({
        name: s.label,
        type: "bar",
        stack: "spend",
        barMaxWidth: 24,
        itemStyle: { color: seriesColor(s, colorIndex, t), borderColor: t.surface, borderWidth: 1 },
        data: s.trend.map((v, i) => (top[i] === si ? { value: v, itemStyle: { borderRadius: [4, 4, 0, 0] } } : v)),
      })),
    };
  };
  return (
    <div className="relative h-[260px]">
      <EChart className="absolute inset-0" build={build} deps={[dates, series, colorIndex, currency]} ariaLabel={`Daily ad spend by platform, ${dates.length} days, stacked`} />
    </div>
  );
}

interface MerChartProps {
  dates: string[];
  revenue: number[];
  spend: number[];
  mer: (number | null)[];
  currency: string;
}

export function MerChart({ dates, revenue, spend, mer, currency }: MerChartProps) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const build = (t: ChartTokens) => {
    const ticks = evenTicks(dates.length, 5);
    const x = (gridIndex: number, show: boolean) =>
      categoryAxis(t, dates, { gridIndex, boundaryGap: false, axisLabel: show ? { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v) } : { show: false } });
    const line = (color: string, width = 2) => ({ type: "line", showSymbol: false, symbol: "circle", symbolSize: 7, lineStyle: { color, width }, itemStyle: { color, borderColor: t.surface, borderWidth: 2 } });
    return {
      ...baseOption(t, reduced),
      grid: [
        { left: 56, right: 8, top: 8, height: "44%" },
        { left: 56, right: 8, top: "62%", bottom: 24 },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.line } },
      xAxis: [x(0, false), x(1, true)],
      yAxis: [valueAxis(t, "money", currency, { gridIndex: 0, splitNumber: 3 }), valueAxis(t, "ratio", undefined, { gridIndex: 1, splitNumber: 2 })],
      tooltip: {
        ...baseOption(t, reduced).tooltip,
        trigger: "axis",
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0]?.dataIndex ?? 0;
          return tooltipHtml(formatShort(dates[i] ?? ""), [
            { color: t.accentLine, label: "Store revenue", value: formatMoney(revenue[i] ?? 0, { currency, compact: false }) },
            { color: t.other, label: "Ad spend", value: formatMoney(spend[i] ?? 0, { currency, compact: false }) },
            { color: t.accentLine, label: "MER", value: formatMetricValue("ratio", mer[i] ?? null) },
          ]);
        },
      },
      series: [
        {
          ...line(t.accentLine),
          name: "Store revenue",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: revenue,
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } },
        },
        { ...line(t.other), name: "Ad spend", xAxisIndex: 0, yAxisIndex: 0, data: spend },
        { ...line(t.accentLine), name: "MER", xAxisIndex: 1, yAxisIndex: 1, data: mer, connectNulls: false },
      ],
    };
  };
  return (
    <div className="relative h-[240px]">
      <EChart className="absolute inset-0" build={build} deps={[dates, revenue, spend, mer, currency]} ariaLabel="Store revenue and ad spend per day, with daily MER below" />
    </div>
  );
}
