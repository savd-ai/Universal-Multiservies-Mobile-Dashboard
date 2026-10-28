"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { BandSpark } from "@/components/ui/spark";
import { Pill, SEVERITY_META, SeverityPill } from "@/components/ui/status";
import { MetaStat } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useAnomalies, useSignalAction } from "@/lib/api/analytics";
import { useCan } from "@/lib/api/auth";
import { useInvalidateCampaigns } from "@/lib/api/campaigns";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import type { SignalAction, SignalView } from "@/lib/domain/contracts/anomaly";
import { formatShort } from "@/lib/domain/dates";
import { formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import { impactHref, isExpectedSignal, lagLabel, severityLabel, visibleChangeContext } from "@/features/anomalies/helpers/signals";
import { ChangeContextLine } from "@/features/anomalies/signal-card";
import { money, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext } from "./use-campaign-context";
const KIND_LABEL: Record<SignalView["kind"], string> = {
    metric_deviation: "Metric deviation",
    pacing: "Pacing",
    overdelivery: "Overdelivery",
    tracking_break: "Tracking break",
    zero_delivery: "Zero delivery",
    budget_limited: "Budget-limited",
    threshold: "Rule",
};
const RANK = { critical: 3, warning: 2, info: 1 } as const;
function statusLabel(s: SignalView): string | null {
    if (s.status === "acknowledged")
        return "Acknowledged";
    if (s.status === "resolved")
        return "Resolved";
    if (s.status === "snoozed")
        return s.snoozedUntil ? `Snoozed until ${formatShort(s.snoozedUntil.slice(0, 10))}` : "Snoozed";
    return null;
}
function signalValue(s: SignalView, v: number, m: MoneyFmt): string {
    if (s.format === "money")
        return money(v, m, Math.abs(v) < 100 ? 2 : 0, false);
    return formatMetricValue(s.format, v, { compact: false, decimals: s.format === "percent" ? 2 : undefined });
}
export function SignalsTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m } = useCampaignContext();
    const q = useAnomalies({ campaignId: d.campaign.id, status: "all" });
    const act = useSignalAction();
    const can = useCan();
    const canManage = can("anomalies.manage");
    const refresh = useInvalidateCampaigns();
    const run = (s: SignalView, action: SignalAction, message: string) => act.mutate({ id: s.id, action }, {
        onSuccess: () => toast(message, action.action === "reopen" ? {} : { action: { label: "Undo", onClick: () => act.mutate({ id: s.id, action: { action: "reopen" } }, { onSettled: () => void refresh() }) } }),
        onError: (e) => toast((e as Error).message || "Could not update the signal", { tone: "crit" }),
        onSettled: () => void refresh(),
    });
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data) {
        return (<div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton height={200}/>
        <Skeleton height={200}/>
      </div>);
    }
    const list = [...q.data.signals].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || RANK[b.severity] - RANK[a.severity] || b.score - a.score);
    if (!list.length) {
        return (<EmptyState action={can("rules.manage") ? <Link href="/anomalies/rules">Adjust detection rules →</Link> : undefined}>
        No signals for this campaign — spend, conversions, CPA and CTR are operating within the expected range.
      </EmptyState>);
    }
    return (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex flex-col gap-3">
      {list.map((s) => (<SignalCard key={s.id} signal={s} money={m} busy={act.isPending && act.variables?.id === s.id} onAction={canManage ? (a, msg) => run(s, a, msg) : null}/>))}
    </Refetching>);
}
function SignalCard({ signal: s, money: m, busy, onAction }: {
    signal: SignalView;
    money: MoneyFmt;
    busy: boolean;
    onAction: ((a: SignalAction, message: string) => void) | null;
}) {
    const meta = SEVERITY_META[s.severity];
    const open = s.status === "open";
    const state = statusLabel(s);
    const expected = isExpectedSignal(s);
    const context = visibleChangeContext(s);
    const color = expected ? "var(--faint)" : meta.tone === "crit" ? "var(--crit)" : meta.tone === "warn" ? "var(--warn)" : "var(--accent)";
    const detailLabel = s.z !== undefined ? `z ${s.z.toFixed(1)}` : s.kind === "pacing" ? "projected month-end" : s.onsetDate ? `since ${formatShort(s.onsetDate)}` : null;
    const nearby = context ? [] : s.relatedChanges.slice(0, 2);
    const primary = context?.eventId ? s.relatedChanges.find((c) => c.eventId === context.eventId) : undefined;
    const impact = primary ? impactHref(primary) : null;
    return (<article className={cn("grid gap-5 rounded-card border bg-card p-5 transition-opacity animate-fade-up", "grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px]", s.severity === "critical" && open ? "border-crit/35" : "border-line", expected && "border-dashed", !open && "opacity-60")} aria-label={s.title}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {expected ? <Pill tone="muted">{severityLabel(s)}</Pill> : <SeverityPill severity={s.severity}/>}
          <span className="font-mono text-micro tracking-label text-faint uppercase">{[KIND_LABEL[s.kind], detailLabel].filter(Boolean).join(" · ")}</span>
          {state ? <Pill tone="muted">{state}</Pill> : null}
        </div>
        <h3 className="m-0 font-display text-xl font-semibold tracking-title">{s.title}</h3>
        <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-muted">{s.summary}</p>
        <div className="flex flex-wrap gap-7 py-2.5">
          <MetaStat label="Observed" value={signalValue(s, s.observed, m)} tone={expected ? undefined : meta.tone === "crit" ? "crit" : meta.tone === "warn" ? "warn" : "accent"}/>
          <MetaStat label="Expected" value={signalValue(s, s.expected, m)}/>
          <MetaStat label="Change" value={formatDelta(s.changePct)}/>
        </div>
        {context ? <ChangeContextLine context={context} className="max-w-[70ch]"/> : null}
        <p className="m-0 max-w-[60ch] text-[13px] leading-relaxed text-muted">
          <span className="text-fg">Recommended · </span>
          {s.recommendation}
        </p>
        {impact && primary ? (<Link href={impact} className="self-start text-[12px] text-accent hover:opacity-85" aria-label={`Analyze the impact of: ${primary.summary}`}>
            Analyze impact →
          </Link>) : null}
        {nearby.length ? (<p className="m-0 text-xs leading-normal text-muted-3">
            {s.changeContext ? "Nearby changes: " : "Possibly related: "}
            {nearby.map((c) => `${c.summary} (${lagLabel(c.lagDays)})`).join("; ")}
          </p>) : null}
        {onAction ? (<div className="mt-1 flex flex-wrap items-center gap-2">
            {open ? (<>
                <Button size="xs" variant="outline" disabled={busy} onClick={() => onAction({ action: "acknowledge" }, "Signal acknowledged")}>
                  Acknowledge
                </Button>
                <Button size="xs" variant="ghost" disabled={busy} onClick={() => onAction({ action: "snooze", hours: 24 }, "Snoozed for 24 hours")}>
                  Snooze 24h
                </Button>
                <Button size="xs" variant="ghost" disabled={busy} onClick={() => onAction({ action: "snooze", hours: 24 * 7 }, "Snoozed for 7 days")}>
                  Snooze 7 days
                </Button>
                <Button size="xs" variant="ghost" disabled={busy} onClick={() => onAction({ action: "resolve" }, "Signal resolved")}>
                  Resolve
                </Button>
              </>) : (<Button size="xs" variant="outline" disabled={busy} onClick={() => onAction({ action: "reopen" }, "Signal reopened")}>
                Reopen
              </Button>)}
          </div>) : null}
      </div>
      <div className="flex flex-col gap-2 self-center">
        <BandSpark values={s.series.map((p) => p.value)} band={s.band} recentDays={Math.max(1, s.series.filter((p) => p.date >= s.window.recentStart).length)} color={color} height={120}/>
        <span className="font-mono text-[9px] text-faint">{`${s.series.length} days · band = expected range`}</span>
      </div>
    </article>);
}
