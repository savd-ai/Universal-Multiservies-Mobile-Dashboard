"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Textarea } from "@/components/ui/inputs";
import { Menu } from "@/components/ui/overlays";
import { BandSpark } from "@/components/ui/spark";
import { Dot, Pill, SEVERITY_META } from "@/components/ui/status";
import type { SignalAction, SignalChangeContext, SignalRelatedChange, SignalView } from "@/lib/domain/contracts/anomaly";
import { diffDays, formatShort, isCivilDate } from "@/lib/domain/dates";
import type { MetricFormat } from "@/lib/domain/types";
import { formatDateTime, hoursLabel, relativeTime } from "./helpers/time";
import { changeContextLabel, changeContextTone, changeMeta, impactHref, isExpectedSignal, lagLabel, metricLabel, openTarget, relevanceTone, severityLabel, SNOOZE_HOURS, typeLabel, visibleChangeContext, zLabel, } from "./helpers/signals";
import { ActionLink, cardDomId } from "./shared";
export const SEVERITY_COLOR = { critical: "var(--crit)", warning: "var(--warn)", info: "var(--accent)" } as const;
const 竔壍 = "var(--faint)";
export function ChangeContextLine({ context: 駃壍, className: 暲壍 }: {
    context: SignalChangeContext;
    className?: string;
}) {
    return (<div role="group" aria-label="Change history" className={cn("flex flex-wrap items-baseline gap-x-2.5 gap-y-1", 暲壍)}>
      <Pill tone={changeContextTone(駃壍)} className="self-center">
        {changeContextLabel(駃壍)}
      </Pill>
      
      <span className="min-w-[min(100%,16rem)] flex-1 text-[13px] leading-[1.5] text-muted">{駃壍.note}</span>
    </div>);
}
export function RelatedChangeItem({ change: 薡壍, primary: 劐壍 }: {
    change: SignalRelatedChange;
    primary?: boolean;
}) {
    const 煿壍 = impactHref(薡壍);
    const 遮壍 = changeMeta(薡壍);
    const 嵝壍 = isCivilDate(薡壍.ts.slice(0, 10)) ? formatShort(薡壍.ts.slice(0, 10)) : 薡壍.ts;
    return (<li className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Pill tone={relevanceTone(薡壍.relevance)} className="self-center">{`${薡壍.relevance} relevance`}</Pill>
        <span className={cn("min-w-0 flex-1", 劐壍 ? "font-medium text-fg" : "text-muted")}>{薡壍.summary}</span>
        <span className="font-mono text-micro whitespace-nowrap text-faint">{`${嵝壍} · ${lagLabel(薡壍.lagDays)}`}</span>
      </div>
      {遮壍 || 煿壍 ? (<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-0.5">
          {遮壍 ? <span className="font-mono text-micro tracking-label text-faint uppercase">{遮壍}</span> : null}
          {煿壍 ? (<Link href={煿壍} className="text-[12px] whitespace-nowrap text-accent hover:opacity-85" aria-label={`Analyze the impact of: ${薡壍.summary}`}>
              Analyze impact →
            </Link>) : null}
        </div>) : null}
    </li>);
}
interface SignalCardProps {
    signal: SignalView;
    focused?: boolean;
    recentDays: number;
    now: number | null;
    timeZone: string;
    fmt: (籌壍: MetricFormat, 鬻壍: number | null | undefined) => string;
    notePending?: boolean;
    canManage?: boolean;
    onAction: (株壍: SignalAction) => void;
    onAddNote: (蜙壍: string) => Promise<unknown>;
    onOpen: (合壍: NonNullable<ReturnType<typeof openTarget>>) => void;
}
function 狷壍({ s: 釦壍, timeZone: 廕壍 }: {
    s: SignalView;
    timeZone: string;
}) {
    if (釦壍.status === "open")
        return null;
    const 緄壍 = 釦壍.status === "snoozed" ? (釦壍.snoozedUntil ? `Snoozed until ${formatDateTime(釦壍.snoozedUntil, 廕壍)}` : "Snoozed") : 釦壍.status === "acknowledged" ? "Acknowledged" : "Resolved";
    return <Pill tone="muted">{緄壍}</Pill>;
}
export function SignalCard({ signal: 鲳壍, focused: 榢壍, recentDays: 袑壍, now: 喀壍, timeZone: 瑯壍, fmt: 鍞壍, notePending: 恍壍, canManage: 缼壍 = true, onAction: 鸫壍, onAddNote: 欚壍, onOpen: 訉壍 }: SignalCardProps) {
    const 囸壍 = useId();
    const 痧壍 = SEVERITY_META[鲳壍.severity];
    const 铖壍 = isExpectedSignal(鲳壍);
    const 懅壍 = 铖壍 ? "muted" : 痧壍.tone;
    const 肴壍 = 铖壍 ? 竔壍 : SEVERITY_COLOR[鲳壍.severity];
    const 龣壍 = 鲳壍.status === "open";
    const 沒壍 = openTarget(鲳壍);
    const 讁壍 = visibleChangeContext(鲳壍);
    const [塰壍, 睟壍] = useState(false);
    const [陎壍, 挽壍] = useState("");
    const [般壍, 伛壍] = useState(false);
    const 渊壍 = 鲳壍.series.map((賹壍) => 賹壍.value);
    const 姨壍 = isCivilDate(鲳壍.window.recentStart) && isCivilDate(鲳壍.window.recentEnd) ? diffDays(鲳壍.window.recentStart, 鲳壍.window.recentEnd) + 1 : 袑壍;
    const 磗壍 = 鲳壍.kind === "pacing" ? 袑壍 : Math.min(姨壍, 渊壍.length || 姨壍);
    const 韆壍 = 鲳壍.evidence.filter((撵壍) => 撵壍.label !== "Observed" && 撵壍.label !== "Expected");
    const 莤壍 = 讁壍?.eventId ? [...鲳壍.relatedChanges].sort((傓壍, 澂壍) => Number(澂壍.eventId === 讁壍.eventId) - Number(傓壍.eventId === 讁壍.eventId)) : 鲳壍.relatedChanges;
    const 蹱壍 = 般壍 ? 莤壍 : 莤壍.slice(0, 2);
    const 孠壍 = `${metricLabel(鲳壍.metric)} over the last ${渊壍.length} days${鲳壍.band ? `; expected range ${鍞壍(鲳壍.format, 鲳壍.band.lo)} to ${鍞壍(鲳壍.format, 鲳壍.band.hi)}` : ""}`;
    const 穏壍 = async () => {
        const 餾壍 = 陎壍.trim();
        if (!餾壍)
            return;
        try {
            await 欚壍(餾壍);
            挽壍("");
            睟壍(false);
        }
        catch {
        }
    };
    return (<article id={cardDomId(鲳壍.id)} tabIndex={-1} aria-labelledby={囸壍} data-expected={铖壍 || undefined} className={cn("grid animate-fade-up grid-cols-1 gap-5 rounded-card border bg-card p-5 outline-none sm:grid-cols-[minmax(0,1fr)_220px]", 鲳壍.severity === "critical" && 龣壍 ? "border-crit/35" : "border-line", 铖壍 && "border-dashed", 榢壍 && "ring-2 ring-accent-line/70 ring-offset-2 ring-offset-page")}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Dot tone={懅壍} halo/>
          <Pill tone={懅壍}>{severityLabel(鲳壍)}</Pill>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{`${typeLabel(鲳壍)} · ${zLabel(鲳壍)}`}</span>
          <狷壍 s={鲳壍} timeZone={瑯壍}/>
        </div>
        <h3 id={囸壍} className="m-0 font-display text-[20px] font-semibold tracking-title">
          {鲳壍.title}
        </h3>
        <div className="text-[13px] text-muted">{鲳壍.entity.name}</div>
        <div className="flex gap-7 py-2.5">
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-micro tracking-label text-faint uppercase">Observed</span>
            <span className="font-display text-[18px] font-semibold tabular" style={{ color: 肴壍 }}>
              {鍞壍(鲳壍.format, 鲳壍.observed)}
            </span>
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-micro tracking-label text-faint uppercase">Expected</span>
            <span className="font-display text-[18px] font-semibold tabular">{鍞壍(鲳壍.format, 鲳壍.expected)}</span>
          </div>
        </div>
        {讁壍 ? <ChangeContextLine context={讁壍} className="max-w-[70ch]"/> : null}
        <p className="m-0 max-w-[60ch] text-[13px] leading-[1.6] text-muted">
          <span className="text-fg">Recommended · </span>
          {鲳壍.recommendation}
        </p>

        {韆壍.length ? (<ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Evidence">
            {韆壍.map((昭壍) => (<li key={`${昭壍.label}:${昭壍.value}`} className="inline-flex items-baseline gap-1.5 rounded-pill border border-line px-2.5 py-1 text-[11px]">
                <span className="font-mono text-micro tracking-label text-faint uppercase">{昭壍.label}</span>
                <span className="text-muted tabular">{昭壍.value}</span>
              </li>))}
          </ul>) : null}

        {鲳壍.relatedChanges.length ? (<div className="flex flex-col gap-1.5">
            <span className="label-mono">Related changes</span>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {蹱壍.map((蔜壍) => (<RelatedChangeItem key={蔜壍.eventId} change={蔜壍} primary={蔜壍.eventId === 讁壍?.eventId}/>))}
            </ul>
            {鲳壍.relatedChanges.length > 2 ? (<ActionLink onClick={() => 伛壍((刋壍) => !刋壍)} className="self-start">
                {般壍 ? "Show fewer" : `Show all ${鲳壍.relatedChanges.length} changes`}
              </ActionLink>) : null}
          </div>) : null}

        {鲳壍.notes.length ? (<ul className="m-0 flex list-none flex-col gap-1.5 border-l-2 border-teal/30 py-0.5 pr-0 pl-3" aria-label="Notes">
            {鲳壍.notes.map((烺壍) => (<li key={`${烺壍.at}:${烺壍.text}`} className="text-xs leading-relaxed text-muted">
                {烺壍.text}
                <span className="ml-2 font-mono text-micro text-faint" title={formatDateTime(烺壍.at, 瑯壍)}>
                  {relativeTime(烺壍.at, 喀壍) || formatDateTime(烺壍.at, 瑯壍)}
                </span>
              </li>))}
          </ul>) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {缼壍 ? (<>
              {龣壍 ? (<ActionLink tone="accent" onClick={() => 鸫壍({ action: "acknowledge" })}>
                  Acknowledge
                </ActionLink>) : (<ActionLink tone="accent" onClick={() => 鸫壍({ action: "reopen" })}>
                  Reopen
                </ActionLink>)}
              {鲳壍.status !== "resolved" ? (<Menu align="start" trigger={<ActionLink aria-label={`Snooze ${鲳壍.title}`}>{鲳壍.status === "snoozed" ? "Snooze again ▾" : "Snooze ▾"}</ActionLink>} items={SNOOZE_HOURS.map((迩壍) => ({ label: hoursLabel(迩壍), onSelect: () => 鸫壍({ action: "snooze", hours: 迩壍 }) }))}/>) : null}
              {鲳壍.status !== "resolved" ? <ActionLink onClick={() => 鸫壍({ action: "resolve" })}>Resolve</ActionLink> : null}
              <ActionLink onClick={() => 睟壍((峘壍) => !峘壍)} aria-expanded={塰壍}>
                Add note
              </ActionLink>
            </>) : null}
          {沒壍 ? <ActionLink onClick={() => 訉壍(沒壍)}>{沒壍.kind === "budget" ? "Open budget planner →" : "Open campaign →"}</ActionLink> : null}
        </div>

        {塰壍 && 缼壍 ? (<div className="flex flex-col gap-2">
            <Textarea autoFocus value={陎壍} maxLength={1000} onChange={(篇壍) => 挽壍(篇壍.target.value)} onKeyDown={(骶壍) => {
                if (骶壍.key === "Enter" && (骶壍.metaKey || 骶壍.ctrlKey))
                    void 穏壍();
                if (骶壍.key === "Escape")
                    睟壍(false);
            }} placeholder="What did you check or change? (⌘↵ to save)" aria-label={`Note for ${鲳壍.title}`} className="min-h-16"/>
            <div className="flex gap-2">
              <Button variant="accent" size="xs" onClick={() => void 穏壍()} loading={恍壍} disabled={!陎壍.trim()}>
                Save note
              </Button>
              <Button variant="ghost" size="xs" onClick={() => 睟壍(false)}>
                Cancel
              </Button>
            </div>
          </div>) : null}
      </div>

      <div className="relative mb-5 self-center sm:mb-0" role="img" aria-label={孠壍}>
        
        <div className={cn(铖壍 && "opacity-70")}>
          <BandSpark values={渊壍} band={鲳壍.band} recentDays={磗壍} color={肴壍} height={120}/>
        </div>
        <span className="absolute -bottom-[18px] left-0 font-mono text-[9px] text-faint">{`${渊壍.length} days${鲳壍.band ? " · band = expected range" : ""}`}</span>
      </div>
    </article>);
}
