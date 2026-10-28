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
export function SeverityDot({ paused, severity, count }: {
    paused: boolean;
    severity: Severity | null;
    count: number;
}) {
    const tone = paused ? "faint" : severity === "critical" ? "crit" : severity === "warning" ? "warn" : "accent";
    const label = paused ? "Paused" : severity ? `${count} open signal${count === 1 ? "" : "s"} · worst ${SEVERITY_META[severity].label.toLowerCase()}` : "No open signals";
    return (<span className="inline-flex shrink-0" title={label}>
      <Dot size={7} tone={tone}/>
      <span className="sr-only">{label}</span>
    </span>);
}
export function MetricDelta({ metric, cur, prev, className }: {
    metric: MetricKey;
    cur: number | null | undefined;
    prev: number | null | undefined;
    className?: string;
}) {
    const pct = pctChange(cur, prev);
    return <DeltaText pct={formatDelta(pct)} sentiment={metricSentiment(metric, pct)} className={className}/>;
}
export function StatusToggle({ status, pending, name, onToggle }: {
    status: CampaignStatus;
    pending?: TargetStatus;
    name: string;
    onToggle: () => void;
}) {
    if (status === "Removed")
        return <StatusPill on={false}>Removed</StatusPill>;
    const shown = pending ?? status;
    const on = shown === "Enabled";
    return (<LiveGuard className="justify-self-start">
      <span className={cn("inline-flex transition-opacity", pending && "opacity-60")} aria-busy={pending ? true : undefined}>
        <StatusPill on={on} title={`${on ? "Pause" : "Enable"} ${name}`} onClick={(e) => {
            e.stopPropagation();
            if (!pending)
                onToggle();
        }}>
          {shown}
        </StatusPill>
      </span>
    </LiveGuard>);
}
export interface MiniKpi {
    label: string;
    value: string;
    delta?: React.ReactNode;
}
export function KpiMiniGrid({ items, className }: {
    items: MiniKpi[];
    className?: string;
}) {
    return (<div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-mini bg-tone/8", className)}>
      {items.map((k) => (<div key={k.label} className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5">
          <span className="label-mono">{k.label}</span>
          <span className="font-display text-[22px] font-semibold tabular">{k.value}</span>
          {k.delta}
        </div>))}
    </div>);
}
export function SignalItem({ signal }: {
    signal: SignalView;
}) {
    const meta = SEVERITY_META[signal.severity];
    return (<div className="flex gap-2.5 rounded-mini border border-line-soft bg-fill px-3.5 py-3">
      <Dot tone={meta.tone} className="mt-[5px]"/>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">
          {signal.title}
          <span className="sr-only">{` · ${meta.label}`}</span>
        </span>
        <span className="text-xs leading-normal text-muted-3">{signal.recommendation}</span>
      </div>
    </div>);
}
const PACING_LABEL: Record<PacingRow["status"], string> = { overpacing: "Overpacing", underpacing: "Underpacing", on_track: "On track", paused: "Paused", no_budget: "No budget", unsupported_period: "Custom budget period" };
export function PacingBlock({ pacing, money: m, monthLabel, marker, note = true }: {
    pacing: PacingRow;
    money: MoneyFmt;
    monthLabel: string;
    marker?: number;
    note?: boolean;
}) {
    const target = pacing.monthlyTarget;
    const over = pacing.status === "overpacing";
    const paused = pacing.status === "paused";
    const tone = over ? "text-warn" : pacing.status === "underpacing" ? "text-muted" : paused ? "text-muted-3" : "text-accent";
    return (<div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="meta">{`Pacing · ${monthLabel}`}</span>
        <span className={cn("font-mono text-meta", tone)}>{target > 0 && !paused ? `${Math.round(pacing.paceRatio * 100)}% projected · ${PACING_LABEL[pacing.status]}` : PACING_LABEL[pacing.status]}</span>
      </div>
      <Meter value={target > 0 ? pacing.mtdSpend / target : 0} projected={target > 0 ? pacing.projected / target : 0} marker={marker} tone={over ? "warn" : "accent"} label={`Spent ${money(pacing.mtdSpend, m)} of ${money(target, m)} this month; projected ${money(pacing.projected, m)}`}/>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-3 tabular">
        <span>{`${money(pacing.mtdSpend, m)} spent`}</span>
        <span>{`${money(pacing.projected, m)} projected of ${money(target, m)}`}</span>
      </div>
      {note && pacing.recommendationNote ? <p className="m-0 text-xs leading-normal text-muted-3">{pacing.recommendationNote}</p> : null}
    </div>);
}
export function GoogleAdsLink({ href, className, variant = "outline", children = "Open in Google Ads" }: {
    href: string;
    className?: string;
    variant?: "outline" | "link";
    children?: React.ReactNode;
}) {
    return (<a href={href} target="_blank" rel="noreferrer noopener" className={cn(variant === "outline"
            ? "inline-flex items-center gap-2 rounded-pill border border-line-strong px-4 py-[9px] text-[13px] font-semibold whitespace-nowrap text-fg transition-colors hover:border-tone/30 hover:opacity-100"
            : "inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", className)}>
      {children}
      <span aria-hidden>↗</span>
    </a>);
}
