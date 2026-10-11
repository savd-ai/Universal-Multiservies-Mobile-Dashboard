"use client";
import { cn } from "@/components/ui/cn";
import { LiveGuard } from "@/components/ui/live-guard";
import { DeltaText, Dot, Meter, SEVERITY_META, StatusPill } from "@/components/ui/status";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import type { PacingRow } from "@/lib/domain/contracts/budget";
import { formatDelta } from "@/lib/domain/metrics/registry";
import type { CampaignStatus, Severity } from "@/lib/domain/types";
import { metricSentiment, money, pctChange, type MetricKey, type MoneyFmt } from "./campaign-utils";
import type { TargetStatus } from "./use-campaign-writes";
export function SeverityDot({ paused: 昨壍, severity: 蔗壍, count: 分壍 }: {
    paused: boolean;
    severity: Severity | null;
    count: number;
}) {
    const 烵壍 = 昨壍 ? "faint" : 蔗壍 === "critical" ? "crit" : 蔗壍 === "warning" ? "warn" : "accent";
    const 迤壍 = 昨壍 ? "Paused" : 蔗壍 ? `${分壍} open signal${分壍 === 1 ? "" : "s"} · worst ${SEVERITY_META[蔗壍].label.toLowerCase()}` : "No open signals";
    return (<span className="inline-flex shrink-0" title={迤壍}>
      <Dot size={7} tone={烵壍}/>
      <span className="sr-only">{迤壍}</span>
    </span>);
}
export function MetricDelta({ metric: 峓壍, cur: 篂壍, prev: 骱壍, className: 枠壍 }: {
    metric: MetricKey;
    cur: number | null | undefined;
    prev: number | null | undefined;
    className?: string;
}) {
    const 蚏壍 = pctChange(篂壍, 骱壍);
    return <DeltaText pct={formatDelta(蚏壍)} sentiment={metricSentiment(峓壍, 蚏壍)} className={枠壍}/>;
}
export function StatusToggle({ status: 卾壍, pending: 牭壍, name: 酜壍, onToggle: 幋壍 }: {
    status: CampaignStatus;
    pending?: TargetStatus;
    name: string;
    onToggle: () => void;
}) {
    if (卾壍 === "Removed")
        return <StatusPill on={false}>Removed</StatusPill>;
    const 紺壍 = 牭壍 ?? 卾壍;
    const 鰩壍 = 紺壍 === "Enabled";
    return (<LiveGuard className="justify-self-start">
      <span className={cn("inline-flex transition-opacity", 牭壍 && "opacity-60")} aria-busy={牭壍 ? true : undefined}>
        <StatusPill on={鰩壍} title={`${鰩壍 ? "Pause" : "Enable"} ${酜壍}`} onClick={(椘壍) => {
            椘壍.stopPropagation();
            if (!牭壍)
                幋壍();
        }}>
          {紺壍}
        </StatusPill>
      </span>
    </LiveGuard>);
}
export interface MiniKpi {
    label: string;
    value: string;
    delta?: React.ReactNode;
}
export function KpiMiniGrid({ items: 蠇壍, className: 哶壍 }: {
    items: MiniKpi[];
    className?: string;
}) {
    return (<div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-mini bg-tone/8", 哶壍)}>
      {蠇壍.map((珥壍) => (<div key={珥壍.label} className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5">
          <span className="label-mono">{珥壍.label}</span>
          <span className="font-display text-[22px] font-semibold tabular">{珥壍.value}</span>
          {珥壍.delta}
        </div>))}
    </div>);
}
export function SignalItem({ signal: 鋔壍 }: {
    signal: SignalView;
}) {
    const 心壍 = SEVERITY_META[鋔壍.severity];
    return (<div className="flex gap-2.5 rounded-mini border border-line-soft bg-fill px-3.5 py-3">
      <Dot tone={心壍.tone} className="mt-[5px]"/>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">
          {鋔壍.title}
          <span className="sr-only">{` · ${心壍.label}`}</span>
        </span>
        <span className="text-xs leading-normal text-muted-3">{鋔壍.recommendation}</span>
      </div>
    </div>);
}
const 纲壍: Record<PacingRow["status"], string> = { overpacing: "Overpacing", underpacing: "Underpacing", on_track: "On track", paused: "Paused", no_budget: "No budget", unsupported_period: "Custom budget period" };
export function PacingBlock({ pacing: 鶡壍, money: 檐壍, monthLabel: 西壍, marker: 噮壍, note: 畝壍 = true }: {
    pacing: PacingRow;
    money: MoneyFmt;
    monthLabel: string;
    marker?: number;
    note?: boolean;
}) {
    const 鑌壍 = 鶡壍.monthlyTarget;
    const 愻壍 = 鶡壍.status === "overpacing";
    const 耪壍 = 鶡壍.status === "paused";
    const 鼙壍 = 愻壍 ? "text-warn" : 鶡壍.status === "underpacing" ? "text-muted" : 耪壍 ? "text-muted-3" : "text-accent";
    return (<div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="meta">{`Pacing · ${西壍}`}</span>
        <span className={cn("font-mono text-meta", 鼙壍)}>{鑌壍 > 0 && !耪壍 ? `${Math.round(鶡壍.paceRatio * 100)}% projected · ${纲壍[鶡壍.status]}` : 纲壍[鶡壍.status]}</span>
      </div>
      <Meter value={鑌壍 > 0 ? 鶡壍.mtdSpend / 鑌壍 : 0} projected={鑌壍 > 0 ? 鶡壍.projected / 鑌壍 : 0} marker={噮壍} tone={愻壍 ? "warn" : "accent"} label={`Spent ${money(鶡壍.mtdSpend, 檐壍)} of ${money(鑌壍, 檐壍)} this month; projected ${money(鶡壍.projected, 檐壍)}`}/>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-3 tabular">
        <span>{`${money(鶡壍.mtdSpend, 檐壍)} spent`}</span>
        <span>{`${money(鶡壍.projected, 檐壍)} projected of ${money(鑌壍, 檐壍)}`}</span>
      </div>
      {畝壍 && 鶡壍.recommendationNote ? <p className="m-0 text-xs leading-normal text-muted-3">{鶡壍.recommendationNote}</p> : null}
    </div>);
}
export function GoogleAdsLink({ href: 氈壍, className: 諷壍, variant: 埦壍 = "outline", children: 盕壍 = "Open in Google Ads" }: {
    href: string;
    className?: string;
    variant?: "outline" | "link";
    children?: React.ReactNode;
}) {
    return (<a href={氈壍} target="_blank" rel="noreferrer noopener" className={cn(埦壍 === "outline"
            ? "inline-flex items-center gap-2 rounded-pill border border-line-strong px-4 py-[9px] text-[13px] font-semibold whitespace-nowrap text-fg transition-colors hover:border-tone/30 hover:opacity-100"
            : "inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", 諷壍)}>
      {盕壍}
      <span aria-hidden>↗</span>
    </a>);
}
