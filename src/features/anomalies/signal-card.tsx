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
const MUTED_COLOR = "var(--faint)";
export function ChangeContextLine({ context, className }: {
    context: SignalChangeContext;
    className?: string;
}) {
    return (<div role="group" aria-label="Change history" className={cn("flex flex-wrap items-baseline gap-x-2.5 gap-y-1", className)}>
      <Pill tone={changeContextTone(context)} className="self-center">
        {changeContextLabel(context)}
      </Pill>
      
      <span className="min-w-[min(100%,16rem)] flex-1 text-[13px] leading-[1.5] text-muted">{context.note}</span>
    </div>);
}
export function RelatedChangeItem({ change: c, primary }: {
    change: SignalRelatedChange;
    primary?: boolean;
}) {
    const href = impactHref(c);
    const meta = changeMeta(c);
    const date = isCivilDate(c.ts.slice(0, 10)) ? formatShort(c.ts.slice(0, 10)) : c.ts;
    return (<li className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Pill tone={relevanceTone(c.relevance)} className="self-center">{`${c.relevance} relevance`}</Pill>
        <span className={cn("min-w-0 flex-1", primary ? "font-medium text-fg" : "text-muted")}>{c.summary}</span>
        <span className="font-mono text-micro whitespace-nowrap text-faint">{`${date} · ${lagLabel(c.lagDays)}`}</span>
      </div>
      {meta || href ? (<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-0.5">
          {meta ? <span className="font-mono text-micro tracking-label text-faint uppercase">{meta}</span> : null}
          {href ? (<Link href={href} className="text-[12px] whitespace-nowrap text-accent hover:opacity-85" aria-label={`Analyze the impact of: ${c.summary}`}>
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
    fmt: (format: MetricFormat, v: number | null | undefined) => string;
    notePending?: boolean;
    canManage?: boolean;
    onAction: (action: SignalAction) => void;
    onAddNote: (text: string) => Promise<unknown>;
    onOpen: (target: NonNullable<ReturnType<typeof openTarget>>) => void;
}
function StatusNote({ s, timeZone }: {
    s: SignalView;
    timeZone: string;
}) {
    if (s.status === "open")
        return null;
    const text = s.status === "snoozed" ? (s.snoozedUntil ? `Snoozed until ${formatDateTime(s.snoozedUntil, timeZone)}` : "Snoozed") : s.status === "acknowledged" ? "Acknowledged" : "Resolved";
    return <Pill tone="muted">{text}</Pill>;
}
export function SignalCard({ signal: s, focused, recentDays, now, timeZone, fmt, notePending, canManage = true, onAction, onAddNote, onOpen }: SignalCardProps) {
    const titleId = useId();
    const meta = SEVERITY_META[s.severity];
    const expected = isExpectedSignal(s);
    const tone = expected ? "muted" : meta.tone;
    const color = expected ? MUTED_COLOR : SEVERITY_COLOR[s.severity];
    const open = s.status === "open";
    const target = openTarget(s);
    const context = visibleChangeContext(s);
    const [composing, setComposing] = useState(false);
    const [note, setNote] = useState("");
    const [allChanges, setAllChanges] = useState(false);
    const values = s.series.map((p) => p.value);
    const windowDays = isCivilDate(s.window.recentStart) && isCivilDate(s.window.recentEnd) ? diffDays(s.window.recentStart, s.window.recentEnd) + 1 : recentDays;
    const highlight = s.kind === "pacing" ? recentDays : Math.min(windowDays, values.length || windowDays);
    const evidence = s.evidence.filter((e) => e.label !== "Observed" && e.label !== "Expected");
    const related = context?.eventId ? [...s.relatedChanges].sort((a, b) => Number(b.eventId === context.eventId) - Number(a.eventId === context.eventId)) : s.relatedChanges;
    const changes = allChanges ? related : related.slice(0, 2);
    const chartLabel = `${metricLabel(s.metric)} over the last ${values.length} days${s.band ? `; expected range ${fmt(s.format, s.band.lo)} to ${fmt(s.format, s.band.hi)}` : ""}`;
    const saveNote = async () => {
        const text = note.trim();
        if (!text)
            return;
        try {
            await onAddNote(text);
            setNote("");
            setComposing(false);
        }
        catch {
        }
    };
    return (<article id={cardDomId(s.id)} tabIndex={-1} aria-labelledby={titleId} data-expected={expected || undefined} className={cn("grid animate-fade-up grid-cols-1 gap-5 rounded-card border bg-card p-5 outline-none sm:grid-cols-[minmax(0,1fr)_220px]", s.severity === "critical" && open ? "border-crit/35" : "border-line", expected && "border-dashed", focused && "ring-2 ring-accent-line/70 ring-offset-2 ring-offset-page")}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Dot tone={tone} halo/>
          <Pill tone={tone}>{severityLabel(s)}</Pill>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{`${typeLabel(s)} · ${zLabel(s)}`}</span>
          <StatusNote s={s} timeZone={timeZone}/>
        </div>
        <h3 id={titleId} className="m-0 font-display text-[20px] font-semibold tracking-title">
          {s.title}
        </h3>
        <div className="text-[13px] text-muted">{s.entity.name}</div>
        <div className="flex gap-7 py-2.5">
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-micro tracking-label text-faint uppercase">Observed</span>
            <span className="font-display text-[18px] font-semibold tabular" style={{ color }}>
              {fmt(s.format, s.observed)}
            </span>
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-micro tracking-label text-faint uppercase">Expected</span>
            <span className="font-display text-[18px] font-semibold tabular">{fmt(s.format, s.expected)}</span>
          </div>
        </div>
        {context ? <ChangeContextLine context={context} className="max-w-[70ch]"/> : null}
        <p className="m-0 max-w-[60ch] text-[13px] leading-[1.6] text-muted">
          <span className="text-fg">Recommended · </span>
          {s.recommendation}
        </p>

        {evidence.length ? (<ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Evidence">
            {evidence.map((e) => (<li key={`${e.label}:${e.value}`} className="inline-flex items-baseline gap-1.5 rounded-pill border border-line px-2.5 py-1 text-[11px]">
                <span className="font-mono text-micro tracking-label text-faint uppercase">{e.label}</span>
                <span className="text-muted tabular">{e.value}</span>
              </li>))}
          </ul>) : null}

        {s.relatedChanges.length ? (<div className="flex flex-col gap-1.5">
            <span className="label-mono">Related changes</span>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {changes.map((c) => (<RelatedChangeItem key={c.eventId} change={c} primary={c.eventId === context?.eventId}/>))}
            </ul>
            {s.relatedChanges.length > 2 ? (<ActionLink onClick={() => setAllChanges((v) => !v)} className="self-start">
                {allChanges ? "Show fewer" : `Show all ${s.relatedChanges.length} changes`}
              </ActionLink>) : null}
          </div>) : null}

        {s.notes.length ? (<ul className="m-0 flex list-none flex-col gap-1.5 border-l-2 border-teal/30 py-0.5 pr-0 pl-3" aria-label="Notes">
            {s.notes.map((n) => (<li key={`${n.at}:${n.text}`} className="text-xs leading-relaxed text-muted">
                {n.text}
                <span className="ml-2 font-mono text-micro text-faint" title={formatDateTime(n.at, timeZone)}>
                  {relativeTime(n.at, now) || formatDateTime(n.at, timeZone)}
                </span>
              </li>))}
          </ul>) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {canManage ? (<>
              {open ? (<ActionLink tone="accent" onClick={() => onAction({ action: "acknowledge" })}>
                  Acknowledge
                </ActionLink>) : (<ActionLink tone="accent" onClick={() => onAction({ action: "reopen" })}>
                  Reopen
                </ActionLink>)}
              {s.status !== "resolved" ? (<Menu align="start" trigger={<ActionLink aria-label={`Snooze ${s.title}`}>{s.status === "snoozed" ? "Snooze again ▾" : "Snooze ▾"}</ActionLink>} items={SNOOZE_HOURS.map((h) => ({ label: hoursLabel(h), onSelect: () => onAction({ action: "snooze", hours: h }) }))}/>) : null}
              {s.status !== "resolved" ? <ActionLink onClick={() => onAction({ action: "resolve" })}>Resolve</ActionLink> : null}
              <ActionLink onClick={() => setComposing((v) => !v)} aria-expanded={composing}>
                Add note
              </ActionLink>
            </>) : null}
          {target ? <ActionLink onClick={() => onOpen(target)}>{target.kind === "budget" ? "Open budget planner →" : "Open campaign →"}</ActionLink> : null}
        </div>

        {composing && canManage ? (<div className="flex flex-col gap-2">
            <Textarea autoFocus value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    void saveNote();
                if (e.key === "Escape")
                    setComposing(false);
            }} placeholder="What did you check or change? (⌘↵ to save)" aria-label={`Note for ${s.title}`} className="min-h-16"/>
            <div className="flex gap-2">
              <Button variant="accent" size="xs" onClick={() => void saveNote()} loading={notePending} disabled={!note.trim()}>
                Save note
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setComposing(false)}>
                Cancel
              </Button>
            </div>
          </div>) : null}
      </div>

      <div className="relative mb-5 self-center sm:mb-0" role="img" aria-label={chartLabel}>
        
        <div className={cn(expected && "opacity-70")}>
          <BandSpark values={values} band={s.band} recentDays={highlight} color={color} height={120}/>
        </div>
        <span className="absolute -bottom-[18px] left-0 font-mono text-[9px] text-faint">{`${values.length} days${s.band ? " · band = expected range" : ""}`}</span>
      </div>
    </article>);
}
