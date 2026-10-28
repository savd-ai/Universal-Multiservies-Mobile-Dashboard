"use client";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/controls";
import { EmptyState, ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/overlays";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useAnomalies, useSignalAction } from "@/lib/api/analytics";
import { useCan } from "@/lib/api/auth";
import { useAddSignalNote, useAnomalySettings, useEvaluateAnomalies, useUpdateAnomalySettings } from "@/lib/api/anomalies-ui";
import type { SignalAction, SignalView } from "@/lib/domain/contracts/anomaly";
import { formatShort, isCivilDate } from "@/lib/domain/dates";
import { countBySeverity, countByStatus, filterSignals, openTarget, overrideParams, quickRulesFrom, quickRulesPatch, resolveView, sameQuickRules, SEVERITY_FILTERS, STATUS_LABEL, STATUS_TABS, statusAfter, type QuickRules, type SeverityFilter, type StatusTab, } from "./helpers/signals";
import { hoursLabel } from "./helpers/time";
import { QuickRulesPanel } from "./quick-rules-panel";
import { SignalCard } from "./signal-card";
import { cardDomId, useDebouncedValue, useNow, useValueFormat } from "./shared";
const SEV_CHIPS: {
    key: SeverityFilter;
    label: string;
    dot: string;
}[] = [
    { key: "all", label: "All", dot: "var(--muted)" },
    { key: "critical", label: "Critical", dot: "var(--crit)" },
    { key: "warning", label: "Warning", dot: "var(--warn)" },
    { key: "info", label: "Opportunity", dot: "var(--accent)" },
];
const EMPTY_COPY: Record<StatusTab, string> = {
    open: "Nothing outside the expected range. Lower the threshold to see weaker signals.",
    acknowledged: "No acknowledged signals. Acknowledge a signal to keep it here while you work on it.",
    snoozed: "No snoozed signals.",
    resolved: "No resolved signals in the current data window.",
};
const urlOpts = { history: "replace" as const, scroll: false };
function undoFor(prev: SignalView): SignalAction {
    if (prev.status === "acknowledged")
        return { action: "acknowledge" };
    if (prev.status === "resolved")
        return { action: "resolve" };
    if (prev.status === "snoozed" && prev.snoozedUntil) {
        const hours = Math.max(1, Math.ceil((Date.parse(prev.snoozedUntil) - Date.now()) / 3600000));
        return { action: "snooze", hours: Math.min(hours, 24 * 30) };
    }
    return { action: "reopen" };
}
function actionToast(a: SignalAction): string {
    switch (a.action) {
        case "acknowledge":
            return "Signal acknowledged";
        case "snooze":
            return `Snoozed for ${hoursLabel(a.hours)}`;
        case "resolve":
            return "Signal resolved";
        case "reopen":
            return "Signal reopened";
    }
}
export function SignalsScreen() {
    const router = useRouter();
    const now = useNow();
    const { fmt, timeZone } = useValueFormat();
    const [tabParam, setTabParam] = useQueryState("state", parseAsStringEnum<StatusTab>([...STATUS_TABS]).withOptions(urlOpts));
    const [sevParam, setSevParam] = useQueryState("sev", parseAsStringEnum<SeverityFilter>([...SEVERITY_FILTERS]).withOptions(urlOpts));
    const [focus, setFocus] = useQueryState("focus", parseAsString.withOptions(urlOpts));
    const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const settings = useAnomalySettings();
    const saved = useMemo(() => (settings.data ? quickRulesFrom(settings.data) : null), [settings.data]);
    const [draft, setDraft] = useState<QuickRules | null>(null);
    const rules = draft ?? saved;
    const paramsKey = useDebouncedValue(JSON.stringify(overrideParams(draft)), 300);
    const params = useMemo(() => JSON.parse(paramsKey) as Record<string, string>, [paramsKey]);
    const feed = useAnomalies(params);
    const save = useUpdateAnomalySettings();
    const evaluate = useEvaluateAnomalies();
    const action = useSignalAction();
    const addNote = useAddSignalNote();
    const can = useCan();
    const canManage = can("anomalies.manage");
    const all = useMemo(() => feed.data?.signals ?? [], [feed.data]);
    const focused = focus ? all.find((s) => s.id === focus) : undefined;
    const view = resolveView({ tab: tabParam, severity: sevParam, focus: focused });
    const statusCounts = countByStatus(all);
    const sevCounts = countBySeverity(all.filter((s) => s.status === view.tab));
    const list = useMemo(() => filterSignals(all, { status: view.tab, severity: view.severity }), [all, view.tab, view.severity]);
    const recentDays = settings.data?.zscore.recentDays ?? 3;
    const focusVisible = !!focus && list.some((s) => s.id === focus);
    const scrolledFor = useRef<string | null>(null);
    useEffect(() => {
        if (!focus || !focusVisible || scrolledFor.current === focus)
            return;
        scrolledFor.current = focus;
        const el = document.getElementById(cardDomId(focus));
        if (!el)
            return;
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
        el.focus({ preventScroll: true });
    }, [focus, focusVisible]);
    const changeRules = (next: QuickRules) => setDraft(saved && sameQuickRules(next, saved) ? null : next);
    const saveRules = () => {
        if (!draft)
            return;
        save.mutate(quickRulesPatch(draft), {
            onSuccess: () => {
                setDraft(null);
                toast("Detection rules saved as default");
            },
            onError: (e) => toast(e.message || "Couldn't save the rules", { tone: "crit" }),
        });
    };
    const runAction = (s: SignalView, a: SignalAction) => {
        if (focus && !tabParam)
            void setTabParam(view.tab);
        action.mutate({ id: s.id, action: a }, {
            onSuccess: () => {
                if (statusAfter(a.action) === s.status && a.action !== "snooze")
                    return;
                toast(actionToast(a), { action: { label: "Undo", onClick: () => action.mutate({ id: s.id, action: undoFor(s) }) } });
            },
            onError: (e) => toast(e.message || "Couldn't update the signal", { tone: "crit" }),
        });
    };
    const noteFor = (s: SignalView) => (text: string) => addNote.mutateAsync({ id: s.id, text }).then(() => toast("Note added"), (e: Error) => {
        toast(e.message || "Couldn't add the note", { tone: "crit" });
        throw e;
    });
    const openTargetFor = (target: NonNullable<ReturnType<typeof openTarget>>) => {
        if (target.kind === "budget")
            router.push("/budget");
        else
            void setCampaign(target.id);
    };
    const runEvaluate = () => evaluate.mutate(undefined, {
        onSuccess: (r) => {
            const extra = [r.counts.newOrEscalated ? `${r.counts.newOrEscalated} new or escalated` : "", r.counts.resolved ? `${r.counts.resolved} auto-resolved` : ""].filter(Boolean).join(" · ");
            toast(`Evaluated ${r.counts.signals} signal${r.counts.signals === 1 ? "" : "s"}${extra ? ` · ${extra}` : ""}`);
        },
        onError: (e) => toast(e.message || "Evaluation failed", { tone: "crit" }),
    });
    const dataThrough = feed.data?.dataThrough;
    const warnings = (feed.data as {
        warnings?: string[];
    } | undefined)?.warnings ?? [];
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<>
            {dataThrough && isCivilDate(dataThrough) ? <span className="meta">{`Data through ${formatShort(dataThrough)}`}</span> : null}
            {canManage ? (<Tooltip content="Detect with the saved rules now, record first/last seen and auto-resolve signals that stopped firing.">
                <Button variant="outline" size="xs" onClick={runEvaluate} loading={evaluate.isPending}>
                  {evaluate.isPending ? "Evaluating…" : "↻ Evaluate now"}
                </Button>
              </Tooltip>) : null}
          </>}/>

      <div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[300px_minmax(0,1fr)]">
        <QuickRulesPanel value={rules} settings={settings.data} dirty={!!draft} saving={save.isPending} canSave={can("rules.manage")} onChange={changeRules} onSave={saveRules} onReset={() => setDraft(null)}/>

        
        <div className="order-first flex min-w-0 flex-col gap-3 wide:order-none">
          <Tabs value={view.tab} onChange={(t) => {
            void setTabParam(t === "open" ? null : t);
            if (focus)
                void setFocus(null);
        }} tabs={STATUS_TABS.map((t) => ({
            value: t,
            label: (<span className="flex items-center gap-2">
                  {STATUS_LABEL[t]}
                  <span className="font-mono text-meta text-faint tabular">{feed.data ? statusCounts[t] : "·"}</span>
                </span>),
        }))}/>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Severity">
            {SEV_CHIPS.map((c) => {
            const on = view.severity === c.key;
            return (<Chip key={c.key} active={on} dot={c.dot} count={feed.data ? sevCounts[c.key] : undefined} onClick={() => {
                    void setSevParam(c.key === "all" ? null : c.key);
                    if (focus)
                        void setFocus(null);
                }} className={cn("py-[7px] text-fg", on ? "border-tone/30 bg-tone/5" : "border-line bg-transparent")}>
                  {c.label}
                </Chip>);
        })}
          </div>

          {warnings.length ? <p className="text-xs text-muted-3">{warnings.join(" ")}</p> : null}

          {focus && feed.data && !focused ? (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-line bg-fill px-4 py-3 text-[13px] text-muted" role="status">
              <span className="flex-1">That signal isn&apos;t detected with the current rules or data window any more.</span>
              <Button variant="link" className="text-xs" onClick={() => void setFocus(null)}>
                Dismiss
              </Button>
            </div>) : null}

          {feed.error && !feed.data ? <ErrorState error={feed.error} onRetry={() => void feed.refetch()}/> : null}

          {!feed.data && !feed.error ? (<div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => (<Skeleton key={i} height={208} className="rounded-card"/>))}
            </div>) : null}

          {feed.data ? (<Refetching active={feed.isFetching && feed.isPlaceholderData} className="flex flex-col gap-3">
              {feed.error ? <ErrorState error={feed.error} onRetry={() => void feed.refetch()}/> : null}
              {list.map((s) => (<SignalCard key={s.id} signal={s} focused={s.id === focus} recentDays={recentDays} now={now} timeZone={timeZone} fmt={fmt} notePending={addNote.isPending && addNote.variables?.id === s.id} canManage={canManage} onAction={(a) => runAction(s, a)} onAddNote={noteFor(s)} onOpen={openTargetFor}/>))}
              {!list.length ? (<EmptyState>{view.severity === "all" || !sevCounts.all ? EMPTY_COPY[view.tab] : `No ${SEV_CHIPS.find((c) => c.key === view.severity)?.label.toLowerCase()} signals in the ${STATUS_LABEL[view.tab]} tab.`}</EmptyState>) : null}
            </Refetching>) : null}
        </div>
      </div>
    </div>);
}
