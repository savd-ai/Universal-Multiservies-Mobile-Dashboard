"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { ErrorState, InlineEmpty, Refetching, SkeletonLines } from "@/components/ui/feedback";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Sparkline } from "@/components/ui/spark";
import { Dot, Meter, SEVERITY_META } from "@/components/ui/status";
import { MetaStat } from "@/components/ui/surfaces";
import { useAnomalies, usePacing } from "@/lib/api/analytics";
import { useCatalog, useQueryResult } from "@/lib/api/hooks";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { QueryRow } from "@/lib/domain/query/spec";
import { displayMoney, type MoneyLike } from "@/lib/money";
import { resolveWidgetSpec } from "../resolve-spec";
import type { WidgetProps } from "../types";
import { useWidgetHints, useWidgetSubtitle } from "../widget-frame";
const money = (v: number | null | undefined, m: MoneyLike, decimals?: number) => displayMoney(v, m, decimals);
export function PacingWidget({ rt }: WidgetProps) {
    const q = usePacing();
    const r = q.data;
    useWidgetSubtitle(r ? `${r.monthLabel.split(" ")[0]} · month to date` : null);
    if (q.error && !r)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!r)
        return <SkeletonLines lines={5}/>;
    const tot = r.totals;
    const pr = tot.monthlyTarget > 0 ? tot.projected / tot.monthlyTarget : 0;
    const over = pr > 1.05;
    const tone = (x: number) => (x > 1.05 ? "text-warn" : x < 0.9 ? "text-muted" : "text-accent");
    const worst = [...r.rows].filter((x) => x.monthlyTarget > 0 && (x.status === "overpacing" || x.status === "underpacing" || x.status === "on_track")).sort((a, b) => b.paceRatio - a.paceRatio).slice(0, 3);
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex flex-col gap-[18px]">
      <div className="flex items-baseline gap-2.5">
        <span className={cn("font-display text-[52px] leading-none font-semibold tracking-[-0.03em] tabular", over ? "text-warn" : "text-accent")}>{`${(pr * 100).toFixed(0)}%`}</span>
        <span className="text-[13px] text-muted-3">projected of budget</span>
      </div>
      <Meter value={tot.monthlyTarget ? tot.mtdSpend / tot.monthlyTarget : 0} projected={tot.monthlyTarget ? tot.projected / tot.monthlyTarget : 0} marker={r.daysInMonth ? r.elapsedDays / r.daysInMonth : undefined} tone={over ? "warn" : "accent"} label={`Spent ${money(tot.mtdSpend, rt.money)} of ${money(tot.monthlyTarget, rt.money)}; ${r.elapsedDays} of ${r.daysInMonth} days elapsed`}/>
      <div className="grid grid-cols-3 gap-3">
        <MetaStat label="MTD" value={money(tot.mtdSpend, rt.money)}/>
        <MetaStat label="Projected" value={money(tot.projected, rt.money)} tone={over ? "warn" : undefined}/>
        <MetaStat label="Budget" value={money(tot.monthlyTarget, rt.money)}/>
      </div>
      <div className="flex flex-col border-t border-tone/8">
        {worst.map((w) => (<button key={w.unitId} type="button" onClick={() => w.campaignIds[0] && rt.openCampaign(w.campaignIds[0])} className="flex items-center gap-2.5 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <MiddleTruncate text={w.name} className="flex-1 text-muted"/>
            <span className={cn("font-mono text-meta", tone(w.paceRatio))}>{`${(w.paceRatio * 100).toFixed(0)}%`}</span>
          </button>))}
      </div>
    </Refetching>);
}
export function signalTitle(s: SignalView): string {
    return s.title;
}
export function AnomalyFeedWidget({ config, rt }: WidgetProps<{
    limit?: number;
}>) {
    const router = useRouter();
    const q = useAnomalies({ status: "open" });
    const limit = config.limit ?? 4;
    const list = useMemo(() => {
        const types = rt.filters.types;
        return (q.data?.signals ?? []).filter((s) => s.status === "open" && (!types.length || !s.entity.type || types.includes(s.entity.type as never)));
    }, [q.data, rt.filters.types]);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={6}/>;
    if (!list.length)
        return <div className="p-5 text-center text-[13px] text-muted-3">No active signals at this sensitivity.</div>;
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pb-1">
      {list.slice(0, limit).map((s) => {
            const meta = SEVERITY_META[s.severity];
            const expected = s.changeContext?.verdict === "expected";
            const tone = expected ? "muted" : meta.tone;
            return (<button key={s.id} type="button" onClick={() => (s.scope === "campaign" ? rt.openCampaign(s.entity.id) : router.push(`/anomalies?focus=${encodeURIComponent(s.id)}`))} className="flex gap-3 rounded-mini border border-line-soft bg-fill px-3.5 py-3 text-left transition-colors hover:border-tone/18">
            <Dot tone={tone} halo className="mt-[5px]"/>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="flex-1 text-sm font-semibold">{signalTitle(s)}</span>
                <span className="font-mono text-micro tracking-[0.1em] uppercase" style={{ color: `var(--${tone === "accent" ? "accent" : tone})` }}>
                  {expected ? "Expected" : meta.label}
                </span>
              </span>
              <MiddleTruncate text={s.entity.name} className="text-xs text-muted-3"/>
            </span>
          </button>);
        })}
    </Refetching>);
}
const CAMP_GRID = "minmax(200px,2.4fr) repeat(4,minmax(70px,1fr)) 100px";
const SEV_RANK = { critical: 3, warning: 2, info: 1 } as const;
export function CampaignPerformanceWidget({ config, rt, instance }: WidgetProps<{
    limit?: number;
}>) {
    const catalog = useCatalog();
    const limit = config.limit ?? 6;
    const base = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas"], dimensions: ["campaign", "campaign_type", "campaign_status"], sort: [{ key: "cost", dir: "desc" }] }, rt.filters, catalog.data, instance.filterOptOut), [rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(base.ignored);
    const q = useQueryResult(catalog.data ? { ...base.spec, limit, totals: true } : null);
    const topIds = (q.data?.rows ?? []).map((r) => String(r.campaign_id ?? r.campaign));
    const spark = useQueryResult(topIds.length ? { ...base.spec, metrics: ["cost"], dimensions: ["campaign", "date"], sort: [{ key: "date", dir: "asc" }], filters: [...(base.spec.filters ?? []), { dim: "campaign", op: "in", value: topIds }], fillGaps: false } : null);
    const signals = useAnomalies({ status: "open" });
    const sparkBy = useMemo(() => {
        const m = new Map<string, number[]>();
        for (const r of spark.data?.rows ?? []) {
            const id = String(r.campaign_id ?? r.campaign);
            if (!m.has(id))
                m.set(id, []);
            m.get(id)?.push(typeof r.cost === "number" ? r.cost : 0);
        }
        return m;
    }, [spark.data]);
    const sevBy = useMemo(() => {
        const m = new Map<string, "critical" | "warning" | "info">();
        for (const s of signals.data?.signals ?? []) {
            if (s.status !== "open" || s.scope !== "campaign")
                continue;
            const cur = m.get(s.entity.id);
            if (!cur || SEV_RANK[s.severity] > SEV_RANK[cur])
                m.set(s.entity.id, s.severity);
        }
        return m;
    }, [signals.data]);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <SkeletonLines lines={7}/>;
    if (!q.data.rows.length)
        return <InlineEmpty>No campaigns match these filters.</InlineEmpty>;
    const avgCpa = q.data.totals?.cpa ?? null;
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1">
      <div className="flex min-w-[620px] flex-col tabular" role="table" aria-label="Campaign performance">
        <div role="row" className="grid gap-3 border-b border-line px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: CAMP_GRID }}>
          <span role="columnheader">Campaign</span>
          <span role="columnheader" className="text-right">Spend</span>
          <span role="columnheader" className="text-right">Conv.</span>
          <span role="columnheader" className="text-right">CPA</span>
          <span role="columnheader" className="text-right">ROAS</span>
          <span role="columnheader" className="text-right">Trend</span>
        </div>
        {q.data.rows.map((r: QueryRow) => {
            const id = String(r.campaign_id ?? r.campaign);
            const paused = String(r.campaign_status ?? "").toLowerCase() === "paused";
            const sev = sevBy.get(id);
            const cpa = typeof r.cpa === "number" ? r.cpa : null;
            return (<button key={id} type="button" role="row" onClick={() => rt.openCampaign(id)} className={cn("grid items-center gap-3 border-b border-line-soft px-1 py-3 text-left text-[13px] hover:bg-fill", paused && "opacity-55")} style={{ gridTemplateColumns: CAMP_GRID }}>
              <span role="cell" className="flex min-w-0 items-center gap-2.5">
                <Dot size={7} tone={paused ? "faint" : sev === "critical" ? "crit" : sev === "warning" ? "warn" : "accent"}/>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <MiddleTruncate text={String(r.campaign)} className="font-medium"/>
                  <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">{String(r.campaign_type ?? "")}</span>
                </span>
              </span>
              <span role="cell" className="text-right">{money(r.cost as number, rt.money)}</span>
              <span role="cell" className="text-right">{formatMetricValue("decimal", r.conversions as number)}</span>
              <span role="cell" className={cn("text-right", cpa !== null && avgCpa !== null && cpa > avgCpa * 1.4 ? "text-warn" : "text-fg")}>{money(cpa, rt.money, 2)}</span>
              <span role="cell" className="text-right">{formatMetricValue("ratio", r.roas as number)}</span>
              <span role="cell">
                <Sparkline values={sparkBy.get(id) ?? []} height={26}/>
              </span>
            </button>);
        })}
      </div>
    </Refetching>);
}
