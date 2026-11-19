"use client";

import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { axisLabel, baseOption, categoryAxis, prefersReducedMotion, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import { colorFor } from "@/components/charts/palette";
import { useChartTokens, type ChartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InlineEmpty } from "@/components/ui/feedback";
import { Menu, type MenuItem } from "@/components/ui/overlays";
import { StatTile, TileGrid } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { bodyOf } from "@/features/dashboards/use-dashboard-draft";
import { exploreHref, metricMeta, rowId, rowLabel } from "@/features/widgets/question/shared";
import { tickIndices } from "@/features/widgets/question/viz-trend";
import { ApiError } from "@/lib/api/client";
import { useDashboards, useSaveDashboard, useStatus, type Catalog } from "@/lib/api/hooks";
import type { ChatResultItem } from "@/lib/api/sse";
import type { ChatChart } from "@/lib/domain/contracts/ai";
import type { Dashboard } from "@/lib/domain/contracts/dashboard";
import { formatShort } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import type { QueryColumn, QueryResult, QueryRow } from "@/lib/domain/query/spec";
import type { MetricDirection, MetricFormat } from "@/lib/domain/types";
import { moneyFromStatus, moneyOpts, type MoneyFmt } from "@/lib/money";
import { appendWidget, dashboardHref, MAX_WIDGETS, questionWidgetFor, resultRangeLabel, specOf, TIME_DIMS, vizForChart } from "./chat-model";
import { useCan } from "@/lib/api/auth";

// One `result` event of the chat stream rendered from the embedded QueryResult (no re-query): KPI tiles, a compact
// table, or a small line/bar chart, with "Open in Explore" and "Add to dashboard" (appends a Question widget).

const IDENTITY_DIMS = new Set(["campaign_type", "device", "platform"]);
const MAX_BARS = 12;
const MAX_SERIES = 6;
const DELTA_CLASS = { good: "text-accent", bad: "text-crit", null: "text-faint" } as const;

interface Ctx {
  result: QueryResult;
  catalog: Catalog | undefined;
  /** account amounts shown in the display currency */
  money: MoneyFmt;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function formatOf(ctx: Ctx, key: string): MetricFormat {
  const col = ctx.result.columns.find((c) => c.key === key);
  return (col?.format ?? metricMeta(ctx.catalog, key).format) as MetricFormat;
}

function fmtValue(ctx: Ctx, key: string, v: unknown, compact = true): string {
  return formatMetricValue(formatOf(ctx, key), num(v), { ...moneyOpts(ctx.money), compact });
}

function labelOf(ctx: Ctx, col: QueryColumn): string {
  if (col.kind === "dimension") return col.label;
  const m = metricMeta(ctx.catalog, col.key);
  return m.short && /^[A-Z%]{2,5}$/.test(m.short) ? m.short : col.label;
}

function sentimentOf(ctx: Ctx, key: string, pct: number | null) {
  return deltaSentiment(metricMeta(ctx.catalog, key).direction as MetricDirection, pct);
}

function dimText(dim: string, row: QueryRow): string {
  const v = rowLabel(row, dim);
  return dim === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatShort(v) : v;
}

// ── KPI tiles ────────────────────────────────────────────────────────────────────────────────────────

function ResultKpis({ ctx }: { ctx: Ctx }) {
  const metrics = ctx.result.columns.filter((c) => c.kind === "metric");
  const row = ctx.result.rows[0] ?? {};
  const totals = ctx.result.totals ?? row;
  const prev = ctx.result.compareTotals;
  return (
    <TileGrid min={metrics.length > 3 ? 110 : 130}>
      {metrics.map((c) => {
        const cur = num(totals[c.key]);
        const before = prev ? num(prev[c.key]) : num(row[`${c.key}__prev`]);
        const pct = num(row[`${c.key}__pct`]) ?? (cur !== null && before ? cur / before - 1 : null);
        const s = sentimentOf(ctx, c.key, pct);
        return (
          <StatTile key={c.key} label={labelOf(ctx, c)} value={<span className="tabular text-[22px]">{fmtValue(ctx, c.key, cur)}</span>}>
            {before !== null ? (
              <span className={cn("font-mono text-meta", DELTA_CLASS[s ?? "null"])}>
                {s === "good" ? "▲ " : s === "bad" ? "▼ " : ""}
                {formatDelta(pct)} <span className="text-faint">vs {fmtValue(ctx, c.key, before)}</span>
              </span>
            ) : null}
          </StatTile>
        );
      })}
    </TileGrid>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────────────────────────────

function ResultTable({ ctx, onOpenCampaign }: { ctx: Ctx; onOpenCampaign: (id: string) => void }) {
  const dims = ctx.result.columns.filter((c) => c.kind === "dimension");
  const metrics = ctx.result.columns.filter((c) => c.kind === "metric");
  const comparing = !!ctx.result.meta?.compareRange;
  const columns: Column<QueryRow>[] = [
    ...dims.map(
      (d, i): Column<QueryRow> => ({
        key: d.key,
        header: d.label,
        width: "minmax(140px,2fr)",
        sortValue: (r) => rowLabel(r, d.key),
        total: i === 0 && ctx.result.totals && ctx.result.rows.length > 1 ? <span className="font-mono text-micro tracking-label text-faint uppercase">Total</span> : undefined,
        cell: (r) =>
          d.key === "campaign" && r.campaign_id ? (
            <button type="button" onClick={() => onOpenCampaign(rowId(r, "campaign"))} className="max-w-full truncate text-left font-medium text-fg hover:text-accent" title={rowLabel(r, d.key)}>
              {dimText(d.key, r)}
            </button>
          ) : (
            <span className={cn("block truncate", d.key === "date" ? "text-muted" : "font-medium")} title={rowLabel(r, d.key)}>
              {dimText(d.key, r)}
            </span>
          ),
      }),
    ),
    ...metrics.map(
      (m): Column<QueryRow> => ({
        key: m.key,
        header: labelOf(ctx, m),
        width: "minmax(72px,1fr)",
        align: "right",
        sortValue: (r) => num(r[m.key]),
        total: ctx.result.totals && ctx.result.rows.length > 1 ? fmtValue(ctx, m.key, ctx.result.totals[m.key]) : undefined,
        cell: (r) => {
          const pct = num(r[`${m.key}__pct`]);
          const s = sentimentOf(ctx, m.key, pct);
          return (
            <span className="flex flex-col items-end leading-tight">
              <span>{fmtValue(ctx, m.key, r[m.key])}</span>
              {comparing && r[`${m.key}__pct`] !== undefined ? <span className={cn("font-mono text-[10px]", DELTA_CLASS[s ?? "null"])}>{formatDelta(pct)}</span> : null}
            </span>
          );
        },
      }),
    ),
  ];
  return (
    <DataTable
      rows={ctx.result.rows}
      columns={columns}
      rowKey={(r) => dims.map((d) => rowId(r, d.key)).join("|") || JSON.stringify(r)}
      density="compact"
      minWidth={dims.length * 150 + metrics.length * 84}
      maxHeight={300}
      ariaLabel="Query result"
      empty="No rows for this question."
    />
  );
}

// ── Charts ───────────────────────────────────────────────────────────────────────────────────────────

interface Series {
  name: string;
  values: (number | null)[];
  color: (t: ChartTokens) => string;
  dashed?: boolean;
}

function lineSeries(ctx: Ctx, timeDim: string, seriesDim: string | undefined, metric: string): { times: string[]; series: Series[] } {
  const rows = [...ctx.result.rows].sort((a, b) => String(a[timeDim]).localeCompare(String(b[timeDim])));
  if (!seriesDim) {
    const times = rows.map((r) => String(r[timeDim]));
    const series: Series[] = [{ name: metricMeta(ctx.catalog, metric).label, values: rows.map((r) => num(r[metric])), color: (t) => t.accentLine }];
    if (rows.some((r) => r[`${metric}__prev`] !== undefined)) series.push({ name: "Previous period", values: rows.map((r) => num(r[`${metric}__prev`])), color: (t) => t.faint, dashed: true });
    return { times, series };
  }
  const times = [...new Set(rows.map((r) => String(r[timeDim])))].sort();
  const idx = new Map(times.map((t, i) => [t, i]));
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(rowLabel(r, seriesDim), (totals.get(rowLabel(r, seriesDim)) ?? 0) + (num(r[metric]) ?? 0));
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const keep = ranked.slice(0, ranked.length > MAX_SERIES ? MAX_SERIES - 1 : MAX_SERIES);
  const names = ranked.length > keep.length ? [...keep, "Other"] : keep;
  const data = new Map(names.map((n) => [n, times.map(() => null as number | null)]));
  for (const r of rows) {
    const s = rowLabel(r, seriesDim);
    const arr = data.get(keep.includes(s) ? s : "Other");
    const i = idx.get(String(r[timeDim]));
    if (arr && i !== undefined) arr[i] = (arr[i] ?? 0) + (num(r[metric]) ?? 0);
  }
  return {
    times,
    series: names.map((n, i) => ({ name: n, values: data.get(n) ?? [], color: (t: ChartTokens) => (n === "Other" ? t.other : IDENTITY_DIMS.has(seriesDim) ? colorFor(seriesDim, n, i, t) : (t.series[i % t.series.length] ?? t.other)) })),
  };
}

function ResultLine({ ctx, chart, area }: { ctx: Ctx; chart: ChatChart; area: boolean }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const tokens = useChartTokens();
  const dims = ctx.result.columns.filter((c) => c.kind === "dimension").map((c) => c.key);
  const metrics = ctx.result.columns.filter((c) => c.kind === "metric").map((c) => c.key);
  const timeDim = dims.find((d) => TIME_DIMS.has(d)) ?? dims[0] ?? "date";
  const seriesDim = dims.find((d) => d !== timeDim);
  const metric = metrics[0] ?? "cost";
  const { times, series } = useMemo(() => lineSeries(ctx, timeDim, seriesDim, metric), [ctx, timeDim, seriesDim, metric]);
  const legend = series.length > 1;
  const build = (t: ChartTokens) => {
    const ticks = tickIndices(times.length);
    const single = series.filter((s) => !s.dashed).length === 1;
    return {
      ...baseOption(t, reduced),
      grid: { left: 48, right: 8, top: 8, bottom: 22 },
      xAxis: {
        type: "category",
        data: times,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatShort(v) : v) },
      },
      yAxis: valueAxis(t, formatOf(ctx, metric), ctx.money, { splitNumber: 3 }),
      tooltip: {
        ...baseOption(t, reduced).tooltip,
        trigger: "axis",
        formatter: (params: { seriesIndex: number; dataIndex: number; value: number | null }[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const rows: TipRow[] = params.map((p) => {
            const s = series[p.seriesIndex];
            return { color: s?.color(t), dashed: s?.dashed, label: s?.name ?? "", value: fmtValue(ctx, metric, p.value, false) };
          });
          const d = times[i] ?? "";
          return tooltipHtml(/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatShort(d) : d, rows);
        },
      },
      series: series.map((s) => ({
        name: s.name,
        type: "line",
        data: s.values,
        symbol: "circle",
        symbolSize: 7,
        showSymbol: false,
        lineStyle: { color: s.color(t), width: s.dashed ? 1.25 : 2, type: s.dashed ? [4, 4] : "solid" },
        itemStyle: { color: s.color(t), borderColor: t.surface, borderWidth: 2 },
        areaStyle:
          !s.dashed && (area || single) && !seriesDim
            ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] } }
            : undefined,
      })),
    };
  };
  return (
    <div className="flex flex-col gap-2">
      {legend ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="w-3" style={s.dashed ? { borderTop: `1.5px dashed ${s.color(tokens)}` } : { height: 2, background: s.color(tokens) }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative h-[180px]">
        <EChart className="absolute inset-0" build={build} deps={[ctx, series, times, area]} ariaLabel={`${chart.title}: line chart`} />
      </div>
    </div>
  );
}

/** Bars: first dimension × first metric; time dimensions stay in order, categories keep the server's order (top 12). */
function barModel(result: QueryResult) {
  const dim = result.columns.find((c) => c.kind === "dimension")?.key ?? "campaign";
  const metrics = result.columns.filter((c) => c.kind === "metric").map((c) => c.key);
  const metric = metrics[0] ?? "cost";
  const time = TIME_DIMS.has(dim);
  const rows = time ? [...result.rows].sort((a, b) => String(a[dim]).localeCompare(String(b[dim]))) : result.rows.slice(0, MAX_BARS);
  const hasPrev = rows.some((r) => r[`${metric}__prev`] !== undefined);
  return {
    dim,
    metrics,
    metric,
    horizontal: !time,
    rows,
    labels: rows.map((r) => dimText(dim, r)),
    hasPrev,
    total: rows.reduce((s, r) => s + (num(r[metric]) ?? 0), 0),
    height: time ? 180 : Math.min(360, Math.max(120, rows.length * (hasPrev ? 30 : 26) + 28)),
  };
}

function ResultBars({ ctx, chart, onOpenCampaign }: { ctx: Ctx; chart: ChatChart; onOpenCampaign: (id: string) => void }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const result = ctx.result;
  const model = useMemo(() => barModel(result), [result]);
  const { dim, metrics, metric, horizontal, rows, labels, hasPrev, total, height } = model;

  const build = (t: ChartTokens) => {
    const order = <T,>(a: T[]) => (horizontal ? [...a].reverse() : a);
    const current = rows.map((r, i) => ({
      value: num(r[metric]) ?? 0,
      itemStyle: { color: IDENTITY_DIMS.has(dim) ? colorFor(dim, rowLabel(r, dim), i, t) : t.accentLine, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    }));
    const previous = rows.map((r) => num(r[`${metric}__prev`]) ?? 0);
    const ticks = tickIndices(labels.length, 6);
    const cat = categoryAxis(
      t,
      order(labels),
      horizontal ? { axisLabel: { ...axisLabel(t), fontFamily: t.fontSans, fontSize: 12, color: t.muted, width: 128, overflow: "truncate" } } : { axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i) } },
    );
    const val = valueAxis(t, formatOf(ctx, metric), ctx.money, { splitNumber: 3 });
    return {
      ...baseOption(t, reduced),
      grid: horizontal ? { left: 8, right: 64, top: 4, bottom: 18, containLabel: true } : { left: 48, right: 8, top: 12, bottom: 22 },
      xAxis: horizontal ? val : cat,
      yAxis: horizontal ? cat : val,
      tooltip: {
        ...baseOption(t, reduced).tooltip,
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const i = horizontal ? rows.length - 1 - p.dataIndex : p.dataIndex;
          const r = rows[i] ?? {};
          const tip: TipRow[] = metrics.map((m) => ({ label: metricMeta(ctx.catalog, m).label, value: fmtValue(ctx, m, r[m], false) }));
          if (hasPrev) tip.push({ label: "Previous period", value: fmtValue(ctx, metric, r[`${metric}__prev`], false), color: t.faint, dashed: true }, { label: "Change", value: formatDelta(num(r[`${metric}__pct`])) });
          else if (total > 0 && formatOf(ctx, metric) === "money") tip.push({ label: "Share", value: `${(((num(r[metric]) ?? 0) / total) * 100).toFixed(1)}%` });
          return tooltipHtml(dimText(dim, r), tip);
        },
      },
      // the previous period is a dashed outline drawn over the bar (barGap is read from the last bar series)
      series: [
        {
          type: "bar",
          data: order(current),
          barMaxWidth: 24,
          barGap: "-100%",
          z: 2,
          label: horizontal
            ? { show: true, position: "right", fontFamily: t.fontMono, fontSize: 10, color: t.muted3, formatter: (p: { dataIndex: number }) => fmtValue(ctx, metric, rows[rows.length - 1 - p.dataIndex]?.[metric]) }
            : { show: false },
          emphasis: { itemStyle: { opacity: 0.85 } },
        },
        ...(hasPrev
          ? [
              {
                type: "bar",
                data: order(previous),
                barMaxWidth: 24,
                barGap: "-100%",
                silent: true,
                z: 3,
                itemStyle: { color: "transparent", borderColor: t.faint, borderType: "dashed", borderWidth: 1.25, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
                tooltip: { show: false },
              },
            ]
          : []),
      ],
    };
  };
  return (
    <div className="flex flex-col gap-2">
      {hasPrev ? (
        <div className="flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3 rounded-full bg-accent-line" />
            {metricMeta(ctx.catalog, metric).label}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-3 border-t-[1.5px] border-dashed border-faint" />
            Previous period
          </span>
        </div>
      ) : null}
      <div className="relative" style={{ height }}>
        <EChart
          className="absolute inset-0"
          build={build}
          deps={[ctx, model]}
          ariaLabel={`${chart.title}: bar chart of ${metricMeta(ctx.catalog, metric).label} by ${dim.replace(/_/g, " ")}`}
          events={{
            click: (p) => {
              const i = horizontal ? rows.length - 1 - Number(p.dataIndex) : Number(p.dataIndex);
              const r = rows[i];
              if (r && dim === "campaign" && r.campaign_id) onOpenCampaign(rowId(r, "campaign"));
            },
          }}
        />
      </div>
    </div>
  );
}

// ── Add to dashboard ─────────────────────────────────────────────────────────────────────────────────

function useAddToDashboard() {
  const dashboards = useDashboards();
  const save = useSaveDashboard();
  const router = useRouter();
  const add = async (d: Dashboard, chart: ChatChart) => {
    if (d.widgets.length >= MAX_WIDGETS) {
      toast(`“${d.name}” already holds ${MAX_WIDGETS} widgets.`, { tone: "warn" });
      return;
    }
    const { widget, size } = questionWidgetFor(chart, `ai-${Math.random().toString(36).slice(2, 8)}`);
    try {
      const saved = await save.mutateAsync({ id: d.id, doc: appendWidget(bodyOf(d), widget, size), version: d.version });
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("savd-dashboards");
        ch.postMessage({ id: saved.id, version: saved.version });
        ch.close();
      }
      toast(`Added “${widget.title}” to ${d.name}`, { action: { label: "Open", onClick: () => router.push(dashboardHref(d)) } });
    } catch (err) {
      toast(err instanceof ApiError && err.status === 409 ? `“${d.name}” changed elsewhere — try again.` : "Couldn't add the widget to the dashboard.", { tone: "crit" });
    }
  };
  return { dashboards: dashboards.data ?? [], add, pending: save.isPending };
}

// ── Card ─────────────────────────────────────────────────────────────────────────────────────────────

export function ChatResultCard({ item, catalog }: { item: ChatResultItem; catalog: Catalog | undefined }) {
  const router = useRouter();
  const canEdit = useCan()("dashboards.edit");
  const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
  const [asTable, setAsTable] = useState(false);
  const { dashboards, add, pending } = useAddToDashboard();
  const status = useStatus();
  const money = useMemo(() => moneyFromStatus(status.data), [status.data]);
  const ctx: Ctx = useMemo(() => ({ result: item.result, catalog, money }), [item.result, catalog, money]);
  const type = item.chart.type;
  const empty = item.result.rows.length === 0 && !item.result.totals;
  const chartable = !empty && type !== "table" && type !== "kpi" && item.result.rows.length > 0;
  const openCampaign = (id: string) => void setCampaign(id);
  const menu: MenuItem[] = dashboards.length
    ? dashboards.map((d) => ({ label: d.name, hint: d.isDefault ? "Default" : `${d.widgets.length} widgets`, disabled: d.widgets.length >= MAX_WIDGETS, onSelect: () => void add(d, item.chart) }))
    : [{ label: "No dashboards yet", onSelect: () => undefined, disabled: true }];

  let body: React.ReactNode;
  if (empty) body = <InlineEmpty>No rows matched this question.</InlineEmpty>;
  else if (type === "kpi") body = <ResultKpis ctx={ctx} />;
  else if (type === "table" || asTable) body = <ResultTable ctx={ctx} onOpenCampaign={openCampaign} />;
  else if (type === "line" || type === "area") body = <ResultLine ctx={ctx} chart={item.chart} area={type === "area"} />;
  else body = <ResultBars ctx={ctx} chart={item.chart} onOpenCampaign={openCampaign} />;

  const range = resultRangeLabel(item.result, formatShort);
  const truncated = item.result.meta?.truncated;
  return (
    <section className="flex flex-col gap-3 rounded-mini border border-line bg-card p-4 shadow-card" aria-label={item.chart.title}>
      <div className="flex flex-col gap-1">
        <div className="font-display text-sm leading-snug font-semibold tracking-title">{item.chart.title}</div>
        <div className="font-mono text-micro tracking-label text-faint uppercase">
          {range}
          {truncated ? ` · first ${item.result.rows.length} rows` : ""}
        </div>
      </div>
      {body}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        <Button variant="ghost" size="xs" onClick={() => router.push(exploreHref(specOf(item.chart), vizForChart(item.chart)))}>
          Open in Explore ↗
        </Button>
        {canEdit ? (
          <Menu
            align="start"
            items={menu}
            trigger={
              <Button variant="ghost" size="xs" loading={pending}>
                Add to dashboard ▾
              </Button>
            }
          />
        ) : null}
        <span className="flex-1" />
        {chartable ? (
          <Button variant="link" className="text-xs" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? "Show chart" : "Show table"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
