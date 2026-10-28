"use client";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, InlineEmpty, Refetching, Skeleton } from "@/components/ui/feedback";
import { CodeBlock } from "@/components/ui/surfaces";
import { Dot, Pill } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { useQueryResult, type Catalog } from "@/lib/api/hooks";
import type { VizSettings } from "@/lib/domain/contracts/dashboard";
import { formatRange } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta } from "@/lib/domain/metrics/registry";
import type { QueryResult, QueryRow, QuerySpecInput } from "@/lib/domain/query/spec";
import type { MetricDirection } from "@/lib/domain/types";
import { BarViz, DonutViz, FunnelViz, HeatmapViz, LineViz, ScatterViz, StackedBarViz, TreemapViz } from "@/features/widgets/question/viz-charts";
import { KpiStripViz, NumberViz } from "@/features/widgets/question/viz-kpi";
import { TableViz } from "@/features/widgets/question/viz-table";
import { TrendMultiplesViz } from "@/features/widgets/question/viz-trend";
import { fmt, metricMeta, rowId, rowLabel, type VizProps } from "@/features/widgets/question/shared";
import type { WidgetRuntime } from "@/features/widgets/types";
import type { ExploreVizType } from "./codec";
import { fixSuggestions, type Fix } from "./compat";
import type { ExploreSpec } from "./notebook-state";
import { vizFit, VIZ_META } from "./viz-suggest";
export type PreviewTab = "chart" | "table" | "spec";
function AreaViz(props: VizProps) {
    return <LineViz {...props} area/>;
}
const VIZ: Record<ExploreVizType, React.ComponentType<VizProps>> = {
    table: TableViz,
    line: LineViz,
    area: AreaViz,
    bar: BarViz,
    "stacked-bar": StackedBarViz,
    donut: DonutViz,
    number: NumberViz,
    "kpi-strip": KpiStripViz,
    heatmap: HeatmapViz,
    funnel: FunnelViz,
    scatter: ScatterViz,
    treemap: TreemapViz,
    "trend-multiples": TrendMultiplesViz,
};
const SHORT_VIZ = new Set(["number", "kpi-strip"]);
interface PreviewPaneProps {
    spec: ExploreSpec;
    runSpec: QuerySpecInput | null;
    viz: VizSettings;
    catalog: Catalog;
    rt: WidgetRuntime;
    title: string;
    subtitle: React.ReactNode;
    badge?: React.ReactNode;
    tab: PreviewTab;
    onTab: (t: PreviewTab) => void;
    actions: React.ReactNode;
    onFix: (fix: Fix) => void;
    onCopyJson: () => void;
    onCopyLink: () => void;
    tableLabel: (id: string) => string;
}
export function PreviewPane(props: PreviewPaneProps) {
    const { spec, runSpec, viz, catalog, rt, title, tab, onTab } = props;
    const q = useQueryResult(runSpec);
    const err = q.error as ApiError | null;
    const engineError = !q.data && err instanceof ApiError && (err.code === "QUERY_UNSUPPORTED" || err.code === "VALIDATION_ERROR") ? err : null;
    const Viz = VIZ[viz.type as ExploreVizType] ?? TableViz;
    const fit = vizFit(viz.type as ExploreVizType, spec);
    let body: React.ReactNode;
    if (!runSpec)
        body = <InlineEmpty>Pick at least one metric in step 02 to see a result.</InlineEmpty>;
    else if (engineError && tab !== "spec")
        body = <QueryProblem error={engineError} fixes={fixSuggestions(catalog, spec)} onFix={props.onFix}/>;
    else if (tab === "chart")
        body = (<div className="flex flex-col gap-3">
        {!fit.ok ? <p className="m-0 text-xs text-warn">{`▲ ${VIZ_META[viz.type as ExploreVizType]?.label ?? viz.type}: ${fit.hint} Pick another in the Visualization step.`}</p> : null}
        <div className={cn("flex min-w-0 flex-col", SHORT_VIZ.has(viz.type) ? "min-h-[180px] justify-center" : "h-[420px]")}>
          <Viz spec={runSpec} viz={viz} rt={rt} catalog={catalog} title={title} widgetId="explore"/>
        </div>
      </div>);
    else if (tab === "table")
        body = <ResultTable q={q} catalog={catalog} rt={rt} comparing={runSpec.compare !== undefined && runSpec.compare !== "none"} title={title}/>;
    else
        body = (<div className="flex flex-col gap-3">
        <CodeBlock className="max-h-[420px]">{JSON.stringify({ spec: runSpec, viz }, null, 2)}</CodeBlock>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" onClick={props.onCopyJson}>
            Copy JSON
          </Button>
          <Button variant="outline" size="xs" onClick={props.onCopyLink}>
            Copy link
          </Button>
          <span className="text-xs text-muted-3">
            Runs as-is with <span className="font-mono">POST /api/query</span>; the link opens this notebook.
          </span>
        </div>
      </div>);
    return (<section className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-[22px] shadow-card" aria-label="Preview">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 min-w-0 font-display text-lg leading-tight font-semibold tracking-title">{title}</h2>
            {props.badge}
          </div>
          <div className="meta">{props.subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
      </div>
      <Tabs value={tab} onChange={onTab} tabs={[
            { value: "chart", label: "Chart" },
            { value: "table", label: q.data ? `Table · ${q.data.meta.rowCount.toLocaleString("en-US")}` : "Table" },
            { value: "spec", label: "Spec" },
        ]}/>
      <div role="tabpanel" aria-label={`${tab} view`} className="min-w-0">
        {body}
      </div>
      {runSpec && !engineError ? <QueryMeta q={q} tableLabel={props.tableLabel}/> : null}
    </section>);
}
function QueryProblem({ error, fixes, onFix }: {
    error: ApiError;
    fixes: Fix[];
    onFix: (f: Fix) => void;
}) {
    const unsupported = error.code === "QUERY_UNSUPPORTED";
    return (<div role="alert" className="flex flex-col gap-3.5 rounded-mini border border-warn/35 bg-warn-t/40 p-4">
      <div className="flex items-start gap-3">
        <Dot tone="warn" className="mt-1.5"/>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[15px] font-semibold">{unsupported ? "This question can't be answered as asked" : "This question isn't valid"}</span>
          <span className="text-[13px] leading-relaxed text-muted">{error.message}</span>
        </div>
      </div>
      {fixes.length ? (<div className="flex flex-wrap items-center gap-2 pl-5">
          <span className="label-mono mr-1">Try</span>
          {fixes.map((f) => (<Button key={f.label} variant="outline" size="xs" onClick={() => onFix(f)}>
              {f.label}
            </Button>))}
        </div>) : (<span className="pl-5 text-xs text-muted-3">Change the breakdowns or metrics — options that can&apos;t be combined are greyed out in the notebook.</span>)}
    </div>);
}
function QueryMeta({ q, tableLabel }: {
    q: ReturnType<typeof useQueryResult>;
    tableLabel: (id: string) => string;
}) {
    if (!q.data)
        return q.isLoading ? <Skeleton height={14} className="w-2/3"/> : null;
    const m = q.data.meta;
    return (<div className="flex flex-col gap-2 border-t border-line pt-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-micro tracking-label text-faint uppercase">
        <span title={m.table}>{tableLabel(m.table)}</span>
        <span aria-hidden>·</span>
        <span>{`${m.rowCount.toLocaleString("en-US")} row${m.rowCount === 1 ? "" : "s"}`}</span>
        <span aria-hidden>·</span>
        <span>{`${m.tookMs} ms`}</span>
        <span aria-hidden>·</span>
        <span>{formatRange(m.range)}</span>
        {m.compareRange ? <span>{`vs ${formatRange(m.compareRange)}`}</span> : null}
        <span className="flex-1"/>
        {m.sources.map((s) => (<span key={s.id} className="inline-flex items-center gap-1.5 normal-case" title={s.reason}>
            <Pill tone={s.mode === "live" ? "accent" : "muted"}>{s.mode === "live" ? "live" : "demo"}</Pill>
            <span className="tracking-normal text-muted-3">{s.label}</span>
          </span>))}
        {q.isFetching ? <span className="animate-shimmer">Updating…</span> : null}
      </div>
      {m.truncated ? <p className="m-0 text-xs text-muted-3">Showing the first {m.rowCount.toLocaleString("en-US")} rows — raise the row limit (max 10,000) or download CSV for more.</p> : null}
      {m.warnings.map((w) => (<p key={w} className="m-0 text-xs text-warn">
          ▲ {w}
        </p>))}
    </div>);
}
const DELTA = { good: "text-accent", bad: "text-crit", null: "text-faint" } as const;
const TIME_KEYS = new Set(["date", "week", "month", "quarter", "year", "hour", "dow"]);
type Row = {
    r: QueryRow;
    i: number;
};
function ResultTable({ q, catalog, rt, comparing, title }: {
    q: ReturnType<typeof useQueryResult>;
    catalog: Catalog;
    rt: WidgetRuntime;
    comparing: boolean;
    title: string;
}) {
    const data: QueryResult | undefined = q.data;
    const rows = useMemo<Row[]>(() => (data?.rows ?? []).map((r, i) => ({ r, i })), [data]);
    const columns = useMemo<Column<Row>[]>(() => {
        if (!data)
            return [];
        return data.columns.map((c, ci): Column<Row> => {
            if (c.kind === "dimension") {
                return {
                    key: c.key,
                    header: c.label,
                    width: "minmax(150px,2fr)",
                    sortValue: ({ r }) => (c.key === "dow" ? ((r.dow_id as number | undefined) ?? null) : r[c.key]),
                    cell: ({ r }) => {
                        const label = rowLabel(r, c.key);
                        if (c.key === "campaign")
                            return (<button type="button" onClick={() => rt.openCampaign(rowId(r, "campaign"))} className="max-w-full truncate text-left font-medium text-fg hover:text-accent" title={label}>
                  {label}
                </button>);
                        return (<span className={cn("block truncate", TIME_KEYS.has(c.key) ? "text-muted" : "font-medium")} title={label}>
                {label}
              </span>);
                    },
                    total: ci === 0 && data.totals ? <span className="font-mono text-micro tracking-label text-faint uppercase">{`Total · ${data.rows.length}`}</span> : undefined,
                };
            }
            const meta = metricMeta(catalog, c.key);
            return {
                key: c.key,
                header: meta.short && /^[A-Z%]{2,5}$/.test(meta.short) ? meta.short : meta.label,
                width: "minmax(92px,1fr)",
                align: "right",
                sortValue: ({ r }) => (typeof r[c.key] === "number" ? (r[c.key] as number) : null),
                cell: ({ r }) => {
                    const pct = r[`${c.key}__pct`] as number | null | undefined;
                    const s = deltaSentiment(meta.direction as MetricDirection, pct ?? null);
                    return (<span className="flex flex-col items-end leading-tight">
              <span>{fmt(catalog, c.key, r[c.key] as number | null, rt.money, { compact: false })}</span>
              {comparing && pct !== undefined ? <span className={cn("font-mono text-[10px]", DELTA[s ?? "null"])}>{formatDelta(pct)}</span> : null}
            </span>);
                },
                total: data.totals ? fmt(catalog, c.key, data.totals[c.key] ?? null, rt.money, { compact: false }) : undefined,
            };
        });
    }, [data, catalog, rt, comparing]);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!data)
        return <Skeleton height={320} className="w-full"/>;
    return (<Refetching active={q.isFetching && q.isPlaceholderData}>
      <DataTable rows={rows} columns={columns} rowKey={(x) => String(x.i)} ariaLabel={`${title} — result rows`} density={comparing ? "comfortable" : "compact"} minWidth={Math.max(420, columns.length * 110)} maxHeight={420} empty="No rows match — loosen the filters or conditions."/>
    </Refetching>);
}
