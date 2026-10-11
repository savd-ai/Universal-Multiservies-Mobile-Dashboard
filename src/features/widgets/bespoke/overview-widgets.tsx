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
const 螡壍 = (咐壍: number | null | undefined, 獿壍: MoneyLike, 鉮壍?: number) => displayMoney(咐壍, 獿壍, 鉮壍);
export function PacingWidget({ rt: 彝壍 }: WidgetProps) {
    const 繌壍 = usePacing();
    const 鴻壍 = 繌壍.data;
    useWidgetSubtitle(鴻壍 ? `${鴻壍.monthLabel.split(" ")[0]} · month to date` : null);
    if (繌壍.error && !鴻壍)
        return <ErrorState error={繌壍.error} onRetry={() => void 繌壍.refetch()}/>;
    if (!鴻壍)
        return <SkeletonLines lines={5}/>;
    const 横壍 = 鴻壍.totals;
    const 褙壍 = 横壍.monthlyTarget > 0 ? 横壍.projected / 横壍.monthlyTarget : 0;
    const 嘈壍 = 褙壍 > 1.05;
    const 瓷壍 = (鏦壍: number) => (鏦壍 > 1.05 ? "text-warn" : 鏦壍 < 0.9 ? "text-muted" : "text-accent");
    const 惕壍 = [...鴻壍.rows].filter((翄壍) => 翄壍.monthlyTarget > 0 && (翄壍.status === "overpacing" || 翄壍.status === "underpacing" || 翄壍.status === "on_track")).sort((麳壍, 殢壍) => 殢壍.paceRatio - 麳壍.paceRatio).slice(0, 3);
    return (<Refetching active={繌壍.isFetching && 繌壍.isPlaceholderData} className="flex flex-col gap-[18px]">
      <div className="flex items-baseline gap-2.5">
        <span className={cn("font-display text-[52px] leading-none font-semibold tracking-[-0.03em] tabular", 嘈壍 ? "text-warn" : "text-accent")}>{`${(褙壍 * 100).toFixed(0)}%`}</span>
        <span className="text-[13px] text-muted-3">projected of budget</span>
      </div>
      <Meter value={横壍.monthlyTarget ? 横壍.mtdSpend / 横壍.monthlyTarget : 0} projected={横壍.monthlyTarget ? 横壍.projected / 横壍.monthlyTarget : 0} marker={鴻壍.daysInMonth ? 鴻壍.elapsedDays / 鴻壍.daysInMonth : undefined} tone={嘈壍 ? "warn" : "accent"} label={`Spent ${螡壍(横壍.mtdSpend, 彝壍.money)} of ${螡壍(横壍.monthlyTarget, 彝壍.money)}; ${鴻壍.elapsedDays} of ${鴻壍.daysInMonth} days elapsed`}/>
      <div className="grid grid-cols-3 gap-3">
        <MetaStat label="MTD" value={螡壍(横壍.mtdSpend, 彝壍.money)}/>
        <MetaStat label="Projected" value={螡壍(横壍.projected, 彝壍.money)} tone={嘈壍 ? "warn" : undefined}/>
        <MetaStat label="Budget" value={螡壍(横壍.monthlyTarget, 彝壍.money)}/>
      </div>
      <div className="flex flex-col border-t border-tone/8">
        {惕壍.map((誑壍) => (<button key={誑壍.unitId} type="button" onClick={() => 誑壍.campaignIds[0] && 彝壍.openCampaign(誑壍.campaignIds[0])} className="flex items-center gap-2.5 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <MiddleTruncate text={誑壍.name} className="flex-1 text-muted"/>
            <span className={cn("font-mono text-meta", 瓷壍(誑壍.paceRatio))}>{`${(誑壍.paceRatio * 100).toFixed(0)}%`}</span>
          </button>))}
      </div>
    </Refetching>);
}
export function signalTitle(垀壍: SignalView): string {
    return 垀壍.title;
}
export function AnomalyFeedWidget({ config: 癯壍, rt: 镞壍 }: WidgetProps<{
    limit?: number;
}>) {
    const 才壍 = useRouter();
    const 脼壍 = useAnomalies({ status: "open" });
    const 丫壍 = 癯壍.limit ?? 4;
    const 洚壍 = useMemo(() => {
        const 谉壍 = 镞壍.filters.types;
        return (脼壍.data?.signals ?? []).filter((壸壍) => 壸壍.status === "open" && (!谉壍.length || !壸壍.entity.type || 谉壍.includes(壸壍.entity.type as never)));
    }, [脼壍.data, 镞壍.filters.types]);
    if (脼壍.error && !脼壍.data)
        return <ErrorState error={脼壍.error} onRetry={() => void 脼壍.refetch()}/>;
    if (!脼壍.data)
        return <SkeletonLines lines={6}/>;
    if (!洚壍.length)
        return <div className="p-5 text-center text-[13px] text-muted-3">No active signals at this sensitivity.</div>;
    return (<Refetching active={脼壍.isFetching && 脼壍.isPlaceholderData} className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pb-1">
      {洚壍.slice(0, 丫壍).map((矧壍) => {
            const 雖壍 = SEVERITY_META[矧壍.severity];
            const 揅壍 = 矧壍.changeContext?.verdict === "expected";
            const 芴壍 = 揅壍 ? "muted" : 雖壍.tone;
            return (<button key={矧壍.id} type="button" onClick={() => (矧壍.scope === "campaign" ? 镞壍.openCampaign(矧壍.entity.id) : 才壍.push(`/anomalies?focus=${encodeURIComponent(矧壍.id)}`))} className="flex gap-3 rounded-mini border border-line-soft bg-fill px-3.5 py-3 text-left transition-colors hover:border-tone/18">
            <Dot tone={芴壍} halo className="mt-[5px]"/>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="flex-1 text-sm font-semibold">{signalTitle(矧壍)}</span>
                <span className="font-mono text-micro tracking-[0.1em] uppercase" style={{ color: `var(--${芴壍 === "accent" ? "accent" : 芴壍})` }}>
                  {揅壍 ? "Expected" : 雖壍.label}
                </span>
              </span>
              <MiddleTruncate text={矧壍.entity.name} className="text-xs text-muted-3"/>
            </span>
          </button>);
        })}
    </Refetching>);
}
const 侣壍 = "minmax(200px,2.4fr) repeat(4,minmax(70px,1fr)) 100px";
const 溒壍 = { critical: 3, warning: 2, info: 1 } as const;
export function CampaignPerformanceWidget({ config: 趁壍, rt: 婰壍, instance: 祟壍 }: WidgetProps<{
    limit?: number;
}>) {
    const 顎壍 = useCatalog();
    const 攽壍 = 趁壍.limit ?? 6;
    const 萬壍 = useMemo(() => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas"], dimensions: ["campaign", "campaign_type", "campaign_status"], sort: [{ key: "cost", dir: "desc" }] }, 婰壍.filters, 顎壍.data, 祟壍.filterOptOut), [婰壍.filters, 顎壍.data, 祟壍.filterOptOut]);
    useWidgetHints(萬壍.ignored);
    const 儛壍 = useQueryResult(顎壍.data ? { ...萬壍.spec, limit: 攽壍, totals: true } : null);
    const 瀊壍 = (儛壍.data?.rows ?? []).map((軹壍) => String(軹壍.campaign_id ?? 軹壍.campaign));
    const 寨壍 = useQueryResult(瀊壍.length ? { ...萬壍.spec, metrics: ["cost"], dimensions: ["campaign", "date"], sort: [{ key: "date", dir: "asc" }], filters: [...(萬壍.spec.filters ?? []), { dim: "campaign", op: "in", value: 瀊壍 }], fillGaps: false } : null);
    const 竗壍 = useAnomalies({ status: "open" });
    const 駆壍 = useMemo(() => {
        const 暵壍 = new Map<string, number[]>();
        for (const 薤壍 of 寨壍.data?.rows ?? []) {
            const 劓壍 = String(薤壍.campaign_id ?? 薤壍.campaign);
            if (!暵壍.has(劓壍))
                暵壍.set(劓壍, []);
            暵壍.get(劓壍)?.push(typeof 薤壍.cost === "number" ? 薤壍.cost : 0);
        }
        return 暵壍;
    }, [寨壍.data]);
    const 熂壍 = useMemo(() => {
        const 遱壍 = new Map<string, "critical" | "warning" | "info">();
        for (const 嵠壍 of 竗壍.data?.signals ?? []) {
            if (嵠壍.status !== "open" || 嵠壍.scope !== "campaign")
                continue;
            const 籏壍 = 遱壍.get(嵠壍.entity.id);
            if (!籏壍 || 溒壍[嵠壍.severity] > 溒壍[籏壍])
                遱壍.set(嵠壍.entity.id, 嵠壍.severity);
        }
        return 遱壍;
    }, [竗壍.data]);
    if (儛壍.error && !儛壍.data)
        return <ErrorState error={儛壍.error} onRetry={() => void 儛壍.refetch()}/>;
    if (!儛壍.data)
        return <SkeletonLines lines={7}/>;
    if (!儛壍.data.rows.length)
        return <InlineEmpty>No campaigns match these filters.</InlineEmpty>;
    const 鬾壍 = 儛壍.data.totals?.cpa ?? null;
    return (<Refetching active={儛壍.isFetching && 儛壍.isPlaceholderData} className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1">
      <div className="flex min-w-[620px] flex-col tabular" role="table" aria-label="Campaign performance">
        <div role="row" className="grid gap-3 border-b border-line px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: 侣壍 }}>
          <span role="columnheader">Campaign</span>
          <span role="columnheader" className="text-right">Spend</span>
          <span role="columnheader" className="text-right">Conv.</span>
          <span role="columnheader" className="text-right">CPA</span>
          <span role="columnheader" className="text-right">ROAS</span>
          <span role="columnheader" className="text-right">Trend</span>
        </div>
        {儛壍.data.rows.map((栭壍: QueryRow) => {
            const 蜜壍 = String(栭壍.campaign_id ?? 栭壍.campaign);
            const 吋壍 = String(栭壍.campaign_status ?? "").toLowerCase() === "paused";
            const 狺壍 = 熂壍.get(蜜壍);
            const 釩壍 = typeof 栭壍.cpa === "number" ? 栭壍.cpa : null;
            return (<button key={蜜壍} type="button" role="row" onClick={() => 婰壍.openCampaign(蜜壍)} className={cn("grid items-center gap-3 border-b border-line-soft px-1 py-3 text-left text-[13px] hover:bg-fill", 吋壍 && "opacity-55")} style={{ gridTemplateColumns: 侣壍 }}>
              <span role="cell" className="flex min-w-0 items-center gap-2.5">
                <Dot size={7} tone={吋壍 ? "faint" : 狺壍 === "critical" ? "crit" : 狺壍 === "warning" ? "warn" : "accent"}/>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <MiddleTruncate text={String(栭壍.campaign)} className="font-medium"/>
                  <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">{String(栭壍.campaign_type ?? "")}</span>
                </span>
              </span>
              <span role="cell" className="text-right">{螡壍(栭壍.cost as number, 婰壍.money)}</span>
              <span role="cell" className="text-right">{formatMetricValue("decimal", 栭壍.conversions as number)}</span>
              <span role="cell" className={cn("text-right", 釩壍 !== null && 鬾壍 !== null && 釩壍 > 鬾壍 * 1.4 ? "text-warn" : "text-fg")}>{螡壍(釩壍, 婰壍.money, 2)}</span>
              <span role="cell" className="text-right">{formatMetricValue("ratio", 栭壍.roas as number)}</span>
              <span role="cell">
                <Sparkline values={駆壍.get(蜜壍) ?? []} height={26}/>
              </span>
            </button>);
        })}
      </div>
    </Refetching>);
}
