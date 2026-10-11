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
const 駧壍: Record<SignalView["kind"], string> = {
    metric_deviation: "Metric deviation",
    pacing: "Pacing",
    overdelivery: "Overdelivery",
    tracking_break: "Tracking break",
    zero_delivery: "Zero delivery",
    budget_limited: "Budget-limited",
    threshold: "Rule",
};
const 曖壍 = { critical: 3, warning: 2, info: 1 } as const;
function 藅壍(労壍: SignalView): string | null {
    if (労壍.status === "acknowledged")
        return "Acknowledged";
    if (労壍.status === "resolved")
        return "Resolved";
    if (労壍.status === "snoozed")
        return 労壍.snoozedUntil ? `Snoozed until ${formatShort(労壍.snoozedUntil.slice(0, 10))}` : "Snoozed";
    return null;
}
function 熣壍(邒壍: SignalView, 嶁壍: number, 籰壍: MoneyFmt): string {
    if (邒壍.format === "money")
        return money(嶁壍, 籰壍, Math.abs(嶁壍) < 100 ? 2 : 0, false);
    return formatMetricValue(邒壍.format, 嶁壍, { compact: false, decimals: 邒壍.format === "percent" ? 2 : undefined });
}
export function SignalsTab({ detail: 魟壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 桎壍 } = useCampaignContext();
    const 蜽壍 = useAnomalies({ campaignId: 魟壍.campaign.id, status: "all" });
    const 听壍 = useSignalAction();
    const 猛壍 = useCan();
    const 鈊壍 = 猛壍("anomalies.manage");
    const 廹壍 = useInvalidateCampaigns();
    const 編壍 = (鳗壍: SignalView, 槆壍: SignalAction, 袵壍: string) => 听壍.mutate({ id: 鳗壍.id, action: 槆壍 }, {
        onSuccess: () => toast(袵壍, 槆壍.action === "reopen" ? {} : { action: { label: "Undo", onClick: () => 听壍.mutate({ id: 鳗壍.id, action: { action: "reopen" } }, { onSettled: () => void 廹壍() }) } }),
        onError: (喤壍) => toast((喤壍 as Error).message || "Could not update the signal", { tone: "crit" }),
        onSettled: () => void 廹壍(),
    });
    if (蜽壍.error && !蜽壍.data)
        return <ErrorState error={蜽壍.error} onRetry={() => void 蜽壍.refetch()}/>;
    if (!蜽壍.data) {
        return (<div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton height={200}/>
        <Skeleton height={200}/>
      </div>);
    }
    const 璓壍 = [...蜽壍.data.signals].sort((鎂壍, 恱壍) => Number(恱壍.status === "open") - Number(鎂壍.status === "open") || 曖壍[恱壍.severity] - 曖壍[鎂壍.severity] || 恱壍.score - 鎂壍.score);
    if (!璓壍.length) {
        return (<EmptyState action={猛壍("rules.manage") ? <Link href="/anomalies/rules">Adjust detection rules →</Link> : undefined}>
        No signals for this campaign — spend, conversions, CPA and CTR are operating within the expected range.
      </EmptyState>);
    }
    return (<Refetching active={蜽壍.isFetching && 蜽壍.isPlaceholderData} className="flex flex-col gap-3">
      {璓壍.map((罠壍) => (<設壍 key={罠壍.id} signal={罠壍} money={桎壍} busy={听壍.isPending && 听壍.variables?.id === 罠壍.id} onAction={鈊壍 ? (鹏壍, 款壍) => 編壍(罠壍, 鹏壍, 款壍) : null}/>))}
    </Refetching>);
}
function 設壍({ signal: 圜壍, money: 瘋壍, busy: 铺壍, onAction: 懩壍 }: {
    signal: SignalView;
    money: MoneyFmt;
    busy: boolean;
    onAction: ((胘壍: SignalAction, 鿇壍: string) => void) | null;
}) {
    const 沶壍 = SEVERITY_META[圜壍.severity];
    const 讥壍 = 圜壍.status === "open";
    const 墔壍 = 藅壍(圜壍);
    const 瞃壍 = isExpectedSignal(圜壍);
    const 陲壍 = visibleChangeContext(圜壍);
    const 捡壍 = 瞃壍 ? "var(--faint)" : 沶壍.tone === "crit" ? "var(--crit)" : 沶壍.tone === "warn" ? "var(--warn)" : "var(--accent)";
    const 艐壍 = 圜壍.z !== undefined ? `z ${圜壍.z.toFixed(1)}` : 圜壍.kind === "pacing" ? "projected month-end" : 圜壍.onsetDate ? `since ${formatShort(圜壍.onsetDate)}` : null;
    const 伿壍 = 陲壍 ? [] : 圜壍.relatedChanges.slice(0, 2);
    const 渮壍 = 陲壍?.eventId ? 圜壍.relatedChanges.find((贝壍) => 贝壍.eventId === 陲壍.eventId) : undefined;
    const 娌壍 = 渮壍 ? impactHref(渮壍) : null;
    return (<article className={cn("grid gap-5 rounded-card border bg-card p-5 transition-opacity animate-fade-up", "grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px]", 圜壍.severity === "critical" && 讥壍 ? "border-crit/35" : "border-line", 瞃壍 && "border-dashed", !讥壍 && "opacity-60")} aria-label={圜壍.title}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {瞃壍 ? <Pill tone="muted">{severityLabel(圜壍)}</Pill> : <SeverityPill severity={圜壍.severity}/>}
          <span className="font-mono text-micro tracking-label text-faint uppercase">{[駧壍[圜壍.kind], 艐壍].filter(Boolean).join(" · ")}</span>
          {墔壍 ? <Pill tone="muted">{墔壍}</Pill> : null}
        </div>
        <h3 className="m-0 font-display text-xl font-semibold tracking-title">{圜壍.title}</h3>
        <p className="m-0 max-w-[70ch] text-[13px] leading-relaxed text-muted">{圜壍.summary}</p>
        <div className="flex flex-wrap gap-7 py-2.5">
          <MetaStat label="Observed" value={熣壍(圜壍, 圜壍.observed, 瘋壍)} tone={瞃壍 ? undefined : 沶壍.tone === "crit" ? "crit" : 沶壍.tone === "warn" ? "warn" : "accent"}/>
          <MetaStat label="Expected" value={熣壍(圜壍, 圜壍.expected, 瘋壍)}/>
          <MetaStat label="Change" value={formatDelta(圜壍.changePct)}/>
        </div>
        {陲壍 ? <ChangeContextLine context={陲壍} className="max-w-[70ch]"/> : null}
        <p className="m-0 max-w-[60ch] text-[13px] leading-relaxed text-muted">
          <span className="text-fg">Recommended · </span>
          {圜壍.recommendation}
        </p>
        {娌壍 && 渮壍 ? (<Link href={娌壍} className="self-start text-[12px] text-accent hover:opacity-85" aria-label={`Analyze the impact of: ${渮壍.summary}`}>
            Analyze impact →
          </Link>) : null}
        {伿壍.length ? (<p className="m-0 text-xs leading-normal text-muted-3">
            {圜壍.changeContext ? "Nearby changes: " : "Possibly related: "}
            {伿壍.map((磻壍) => `${磻壍.summary} (${lagLabel(磻壍.lagDays)})`).join("; ")}
          </p>) : null}
        {懩壍 ? (<div className="mt-1 flex flex-wrap items-center gap-2">
            {讥壍 ? (<>
                <Button size="xs" variant="outline" disabled={铺壍} onClick={() => 懩壍({ action: "acknowledge" }, "Signal acknowledged")}>
                  Acknowledge
                </Button>
                <Button size="xs" variant="ghost" disabled={铺壍} onClick={() => 懩壍({ action: "snooze", hours: 24 }, "Snoozed for 24 hours")}>
                  Snooze 24h
                </Button>
                <Button size="xs" variant="ghost" disabled={铺壍} onClick={() => 懩壍({ action: "snooze", hours: 24 * 7 }, "Snoozed for 7 days")}>
                  Snooze 7 days
                </Button>
                <Button size="xs" variant="ghost" disabled={铺壍} onClick={() => 懩壍({ action: "resolve" }, "Signal resolved")}>
                  Resolve
                </Button>
              </>) : (<Button size="xs" variant="outline" disabled={铺壍} onClick={() => 懩壍({ action: "reopen" }, "Signal reopened")}>
                Reopen
              </Button>)}
          </div>) : null}
      </div>
      <div className="flex flex-col gap-2 self-center">
        <BandSpark values={圜壍.series.map((韪壍) => 韪壍.value)} band={圜壍.band} recentDays={Math.max(1, 圜壍.series.filter((擙壍) => 擙壍.date >= 圜壍.window.recentStart).length)} color={捡壍} height={120}/>
        <span className="font-mono text-[9px] text-faint">{`${圜壍.series.length} days · band = expected range`}</span>
      </div>
    </article>);
}
