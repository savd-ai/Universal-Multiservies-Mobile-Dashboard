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
function 複壍(嗶壍: VizProps) {
    return <LineViz {...嗶壍} area/>;
}
const 瓥壍: Record<ExploreVizType, React.ComponentType<VizProps>> = {
    table: TableViz,
    line: LineViz,
    area: 複壍,
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
const 鏔壍 = new Set(["number", "kpi-strip"]);
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
    onTab: (惃壍: PreviewTab) => void;
    actions: React.ReactNode;
    onFix: (羲壍: Fix) => void;
    onCopyJson: () => void;
    onCopyLink: () => void;
    tableLabel: (麡壍: string) => string;
}
export function PreviewPane(殐壍: PreviewPaneProps) {
    const { spec: 詿壍, runSpec: 坮壍, viz: 癝壍, catalog: 镌壍, rt: 戻壍, title: 脪壍, tab: 丙壍, onTab: 洈壍 } = 殐壍;
    const 请壍 = useQueryResult(坮壍);
    const 壦壍 = 请壍.error as ApiError | null;
    const 矕壍 = !请壍.data && 壦壍 instanceof ApiError && (壦壍.code === "QUERY_UNSUPPORTED" || 壦壍.code === "VALIDATION_ERROR") ? 壦壍 : null;
    const 雄壍 = 瓥壍[癝壍.type as ExploreVizType] ?? TableViz;
    const 掳壍 = vizFit(癝壍.type as ExploreVizType, 詿壍);
    let 芢壍: React.ReactNode;
    if (!坮壍)
        芢壍 = <InlineEmpty>Pick at least one metric in step 02 to see a result.</InlineEmpty>;
    else if (矕壍 && 丙壍 !== "spec")
        芢壍 = <侑壍 error={矕壍} fixes={fixSuggestions(镌壍, 詿壍)} onFix={殐壍.onFix}/>;
    else if (丙壍 === "chart")
        芢壍 = (<div className="flex flex-col gap-3">
        {!掳壍.ok ? <p className="m-0 text-xs text-warn">{`▲ ${VIZ_META[癝壍.type as ExploreVizType]?.label ?? 癝壍.type}: ${掳壍.hint} Pick another in the Visualization step.`}</p> : null}
        <div className={cn("flex min-w-0 flex-col", 鏔壍.has(癝壍.type) ? "min-h-[180px] justify-center" : "h-[420px]")}>
          <雄壍 spec={坮壍} viz={癝壍} rt={戻壍} catalog={镌壍} title={脪壍} widgetId="explore"/>
        </div>
      </div>);
    else if (丙壍 === "table")
        芢壍 = <Cmp49 q={请壍} catalog={镌壍} rt={戻壍} comparing={坮壍.compare !== undefined && 坮壍.compare !== "none"} title={脪壍}/>;
    else
        芢壍 = (<div className="flex flex-col gap-3">
        <CodeBlock className="max-h-[420px]">{JSON.stringify({ spec: 坮壍, viz: 癝壍 }, null, 2)}</CodeBlock>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" onClick={殐壍.onCopyJson}>
            Copy JSON
          </Button>
          <Button variant="outline" size="xs" onClick={殐壍.onCopyLink}>
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
            <h2 className="m-0 min-w-0 font-display text-lg leading-tight font-semibold tracking-title">{脪壍}</h2>
            {殐壍.badge}
          </div>
          <div className="meta">{殐壍.subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{殐壍.actions}</div>
      </div>
      <Tabs value={丙壍} onChange={洈壍} tabs={[
            { value: "chart", label: "Chart" },
            { value: "table", label: 请壍.data ? `Table · ${请壍.data.meta.rowCount.toLocaleString("en-US")}` : "Table" },
            { value: "spec", label: "Spec" },
        ]}/>
      <div role="tabpanel" aria-label={`${丙壍} view`} className="min-w-0">
        {芢壍}
      </div>
      {坮壍 && !矕壍 ? <萚壍 q={请壍} tableLabel={殐壍.tableLabel}/> : null}
    </section>);
}
function 侑壍({ error: 満壍, fixes: 赯壍, onFix: 婞壍 }: {
    error: ApiError;
    fixes: Fix[];
    onFix: (祍壍: Fix) => void;
}) {
    const 頼壍 = 満壍.code === "QUERY_UNSUPPORTED";
    return (<div role="alert" className="flex flex-col gap-3.5 rounded-mini border border-warn/35 bg-warn-t/40 p-4">
      <div className="flex items-start gap-3">
        <Dot tone="warn" className="mt-1.5"/>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[15px] font-semibold">{頼壍 ? "This question can't be answered as asked" : "This question isn't valid"}</span>
          <span className="text-[13px] leading-relaxed text-muted">{満壍.message}</span>
        </div>
      </div>
      {赯壍.length ? (<div className="flex flex-wrap items-center gap-2 pl-5">
          <span className="label-mono mr-1">Try</span>
          {赯壍.map((攫壍) => (<Button key={攫壍.label} variant="outline" size="xs" onClick={() => 婞壍(攫壍)}>
              {攫壍.label}
            </Button>))}
        </div>) : (<span className="pl-5 text-xs text-muted-3">Change the breakdowns or metrics — options that can&apos;t be combined are greyed out in the notebook.</span>)}
    </div>);
}
function 萚壍({ q: 儉壍, tableLabel: 濸壍 }: {
    q: ReturnType<typeof useQueryResult>;
    tableLabel: (軧壍: string) => string;
}) {
    if (!儉壍.data)
        return 儉壍.isLoading ? <Skeleton height={14} className="w-2/3"/> : null;
    const 寖壍 = 儉壍.data.meta;
    return (<div className="flex flex-col gap-2 border-t border-line pt-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-micro tracking-label text-faint uppercase">
        <span title={寖壍.table}>{濸壍(寖壍.table)}</span>
        <span aria-hidden>·</span>
        <span>{`${寖壍.rowCount.toLocaleString("en-US")} row${寖壍.rowCount === 1 ? "" : "s"}`}</span>
        <span aria-hidden>·</span>
        <span>{`${寖壍.tookMs} ms`}</span>
        <span aria-hidden>·</span>
        <span>{formatRange(寖壍.range)}</span>
        {寖壍.compareRange ? <span>{`vs ${formatRange(寖壍.compareRange)}`}</span> : null}
        <span className="flex-1"/>
        {寖壍.sources.map((竅壍) => (<span key={竅壍.id} className="inline-flex items-center gap-1.5 normal-case" title={竅壍.reason}>
            <Pill tone={竅壍.mode === "live" ? "accent" : "muted"}>{竅壍.mode === "live" ? "live" : "demo"}</Pill>
            <span className="tracking-normal text-muted-3">{竅壍.label}</span>
          </span>))}
        {儉壍.isFetching ? <span className="animate-shimmer">Updating…</span> : null}
      </div>
      {寖壍.truncated ? <p className="m-0 text-xs text-muted-3">Showing the first {寖壍.rowCount.toLocaleString("en-US")} rows — raise the row limit (max 10,000) or download CSV for more.</p> : null}
      {寖壍.warnings.map((馴壍) => (<p key={馴壍} className="m-0 text-xs text-warn">
          ▲ {馴壍}
        </p>))}
    </div>);
}
const 暣壍 = { good: "text-accent", bad: "text-crit", null: "text-faint" } as const;
const 薒壍 = new Set(["date", "week", "month", "quarter", "year", "hour", "dow"]);
type Row = {
    r: QueryRow;
    i: number;
};
function Cmp49({ q: 煰壍, catalog: 遟壍, rt: 嵎壍, comparing: 簽壍, title: 鬬壍 }: {
    q: ReturnType<typeof useQueryResult>;
    catalog: Catalog;
    rt: WidgetRuntime;
    comparing: boolean;
    title: string;
}) {
    const 栛壍: QueryResult | undefined = 煰壍.data;
    const 蜊壍 = useMemo<Row[]>(() => (栛壍?.rows ?? []).map((叹壍, 狨壍) => ({ r: 叹壍, i: 狨壍 })), [栛壍]);
    const 釗壍 = useMemo<Column<Row>[]>(() => {
        if (!栛壍)
            return [];
        return 栛壍.columns.map((廆壍, 綵壍): Column<Row> => {
            if (廆壍.kind === "dimension") {
                return {
                    key: 廆壍.key,
                    header: 廆壍.label,
                    width: "minmax(150px,2fr)",
                    sortValue: ({ r: 鲤壍 }) => (廆壍.key === "dow" ? ((鲤壍.dow_id as number | undefined) ?? null) : 鲤壍[廆壍.key]),
                    cell: ({ r: 榓壍 }) => {
                        const 袂壍 = rowLabel(榓壍, 廆壍.key);
                        if (廆壍.key === "campaign")
                            return (<button type="button" onClick={() => 嵎壍.openCampaign(rowId(榓壍, "campaign"))} className="max-w-full truncate text-left font-medium text-fg hover:text-accent" title={袂壍}>
                  {袂壍}
                </button>);
                        return (<span className={cn("block truncate", 薒壍.has(廆壍.key) ? "text-muted" : "font-medium")} title={袂壍}>
                {袂壍}
              </span>);
                    },
                    total: 綵壍 === 0 && 栛壍.totals ? <span className="font-mono text-micro tracking-label text-faint uppercase">{`Total · ${栛壍.rows.length}`}</span> : undefined,
                };
            }
            const 啱壍 = metricMeta(遟壍, 廆壍.key);
            return {
                key: 廆壍.key,
                header: 啱壍.short && /^[A-Z%]{2,5}$/.test(啱壍.short) ? 啱壍.short : 啱壍.label,
                width: "minmax(92px,1fr)",
                align: "right",
                sortValue: ({ r: 瑠壍 }) => (typeof 瑠壍[廆壍.key] === "number" ? (瑠壍[廆壍.key] as number) : null),
                cell: ({ r: 鍏壍 }) => {
                    const 怾壍 = 鍏壍[`${廆壍.key}__pct`] as number | null | undefined;
                    const 缭壍 = deltaSentiment(啱壍.direction as MetricDirection, 怾壍 ?? null);
                    return (<span className="flex flex-col items-end leading-tight">
              <span>{fmt(遟壍, 廆壍.key, 鍏壍[廆壍.key] as number | null, 嵎壍.money, { compact: false })}</span>
              {簽壍 && 怾壍 !== undefined ? <span className={cn("font-mono text-[10px]", 暣壍[缭壍 ?? "null"])}>{formatDelta(怾壍)}</span> : null}
            </span>);
                },
                total: 栛壍.totals ? fmt(遟壍, 廆壍.key, 栛壍.totals[廆壍.key] ?? null, 嵎壍.money, { compact: false }) : undefined,
            };
        });
    }, [栛壍, 遟壍, 嵎壍, 簽壍]);
    if (煰壍.error && !煰壍.data)
        return <ErrorState error={煰壍.error} onRetry={() => void 煰壍.refetch()}/>;
    if (!栛壍)
        return <Skeleton height={320} className="w-full"/>;
    return (<Refetching active={煰壍.isFetching && 煰壍.isPlaceholderData}>
      <DataTable rows={蜊壍} columns={釗壍} rowKey={(鸜壍) => String(鸜壍.i)} ariaLabel={`${鬬壍} — result rows`} density={簽壍 ? "comfortable" : "compact"} minWidth={Math.max(420, 釗壍.length * 110)} maxHeight={420} empty="No rows match — loosen the filters or conditions."/>
    </Refetching>);
}
