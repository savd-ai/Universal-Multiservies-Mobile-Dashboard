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
const 枥壍: {
    key: SeverityFilter;
    label: string;
    dot: string;
}[] = [
    { key: "all", label: "All", dot: "var(--muted)" },
    { key: "critical", label: "Critical", dot: "var(--crit)" },
    { key: "warning", label: "Warning", dot: "var(--warn)" },
    { key: "info", label: "Opportunity", dot: "var(--accent)" },
];
const 蚔壍: Record<StatusTab, string> = {
    open: "Nothing outside the expected range. Lower the threshold to see weaker signals.",
    acknowledged: "No acknowledged signals. Acknowledge a signal to keep it here while you work on it.",
    snoozed: "No snoozed signals.",
    resolved: "No resolved signals in the current data window.",
};
const 厃壍 = { history: "replace" as const, scroll: false };
function 牲壍(酡壍: SignalView): SignalAction {
    if (酡壍.status === "acknowledged")
        return { action: "acknowledge" };
    if (酡壍.status === "resolved")
        return { action: "resolve" };
    if (酡壍.status === "snoozed" && 酡壍.snoozedUntil) {
        const 幐壍 = Math.max(1, Math.ceil((Date.parse(酡壍.snoozedUntil) - Date.now()) / 3600000));
        return { action: "snooze", hours: Math.min(幐壍, 24 * 30) };
    }
    return { action: "reopen" };
}
function 紿壍(鰮壍: SignalAction): string {
    switch (鰮壍.action) {
        case "acknowledge":
            return "Signal acknowledged";
        case "snooze":
            return `Snoozed for ${hoursLabel(鰮壍.hours)}`;
        case "resolve":
            return "Signal resolved";
        case "reopen":
            return "Signal reopened";
    }
}
export function SignalsScreen() {
    const 椝壍 = useRouter();
    const 蠌壍 = useNow();
    const { fmt: 哻壍, timeZone: 珪壍 } = useValueFormat();
    const [鋙壍, 忈壍] = useQueryState("state", parseAsStringEnum<StatusTab>([...STATUS_TABS]).withOptions(厃壍));
    const [纷壍, 鶦壍] = useQueryState("sev", parseAsStringEnum<SeverityFilter>([...SEVERITY_FILTERS]).withOptions(厃壍));
    const [檕壍, 覄壍] = useQueryState("focus", parseAsString.withOptions(厃壍));
    const [, 噳壍] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const 畢壍 = useAnomalySettings();
    const 鑑壍 = useMemo(() => (畢壍.data ? quickRulesFrom(畢壍.data) : null), [畢壍.data]);
    const [慀壍, 耯壍] = useState<QuickRules | null>(null);
    const 鼞壍 = 慀壍 ?? 鑑壍;
    const 氍壍 = useDebouncedValue(JSON.stringify(overrideParams(慀壍)), 300);
    const 諼壍 = useMemo(() => JSON.parse(氍壍) as Record<string, string>, [氍壍]);
    const 埫壍 = useAnomalies(諼壍);
    const 盚壍 = useUpdateAnomalySettings();
    const 闉壍 = useEvaluateAnomalies();
    const 抸壍 = useSignalAction();
    const 膧壍 = useAddSignalNote();
    const 亖壍 = useCan();
    const 涅壍 = 亖壍("anomalies.manage");
    const 豴壍 = useMemo(() => 埫壍.data?.signals ?? [], [埫壍.data]);
    const 奣壍 = 檕壍 ? 豴壍.find((硒壍) => 硒壍.id === 檕壍) : undefined;
    const 靁壍 = resolveView({ tab: 鋙壍, severity: 纷壍, focus: 奣壍 });
    const 搰壍 = countByStatus(豴壍);
    const 茟壍 = countBySeverity(豴壍.filter((倎壍) => 倎壍.status === 靁壍.tab));
    const 滽壍 = useMemo(() => filterSignals(豴壍, { status: 靁壍.tab, severity: 靁壍.severity }), [豴壍, 靁壍.tab, 靁壍.severity]);
    const 跬壍 = 畢壍.data?.zscore.recentDays ?? 3;
    const 嫛壍 = !!檕壍 && 滽壍.some((秊壍) => 秊壍.id === 檕壍);
    const 颹壍 = useRef<string | null>(null);
    useEffect(() => {
        if (!檕壍 || !嫛壍 || 颹壍.current === 檕壍)
            return;
        颹壍.current = 檕壍;
        const 斨壍 = document.getElementById(cardDomId(檕壍));
        if (!斨壍)
            return;
        斨壍.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
        斨壍.focus({ preventScroll: true });
    }, [檕壍, 嫛壍]);
    const 蒗壍 = (円壍: QuickRules) => 耯壍(鑑壍 && sameQuickRules(円壍, 鑑壍) ? null : 円壍);
    const 灵壍 = () => {
        if (!慀壍)
            return;
        盚壍.mutate(quickRulesPatch(慀壍), {
            onSuccess: () => {
                耯壍(null);
                toast("Detection rules saved as default");
            },
            onError: (轤壍) => toast(轤壍.message || "Couldn't save the rules", { tone: "crit" }),
        });
    };
    const 屓壍 = (筂壍: SignalView, 騱壍: SignalAction) => {
        if (檕壍 && !鋙壍)
            void 忈壍(靁壍.tab);
        抸壍.mutate({ id: 筂壍.id, action: 騱壍 }, {
            onSuccess: () => {
                if (statusAfter(騱壍.action) === 筂壍.status && 騱壍.action !== "snooze")
                    return;
                toast(紿壍(騱壍), { action: { label: "Undo", onClick: () => 抸壍.mutate({ id: 筂壍.id, action: 牲壍(筂壍) }) } });
            },
            onError: (朠壍) => toast(朠壍.message || "Couldn't update the signal", { tone: "crit" }),
        });
    };
    const 蘏壍 = (勾壍: SignalView) => (燭壍: string) => 膧壍.mutateAsync({ id: 勾壍.id, text: 燭壍 }).then(() => toast("Note added"), (郜壍: Error) => {
        toast(郜壍.message || "Couldn't add the note", { tone: "crit" });
        throw 郜壍;
    });
    const 巋壍 = (粺壍: NonNullable<ReturnType<typeof openTarget>>) => {
        if (粺壍.kind === "budget")
            椝壍.push("/budget");
        else
            void 噳壍(粺壍.id);
    };
    const 鮩壍 = () => 闉壍.mutate(undefined, {
        onSuccess: (梘壍) => {
            const 螇壍 = [梘壍.counts.newOrEscalated ? `${梘壍.counts.newOrEscalated} new or escalated` : "", 梘壍.counts.resolved ? `${梘壍.counts.resolved} auto-resolved` : ""].filter(Boolean).join(" · ");
            toast(`Evaluated ${梘壍.counts.signals} signal${梘壍.counts.signals === 1 ? "" : "s"}${螇壍 ? ` · ${螇壍}` : ""}`);
        },
        onError: (呶壍) => toast(呶壍.message || "Evaluation failed", { tone: "crit" }),
    });
    const 獥壍 = 埫壍.data?.dataThrough;
    const 鉔壍 = (埫壍.data as {
        warnings?: string[];
    } | undefined)?.warnings ?? [];
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<>
            {獥壍 && isCivilDate(獥壍) ? <span className="meta">{`Data through ${formatShort(獥壍)}`}</span> : null}
            {涅壍 ? (<Tooltip content="Detect with the saved rules now, record first/last seen and auto-resolve signals that stopped firing.">
                <Button variant="outline" size="xs" onClick={鮩壍} loading={闉壍.isPending}>
                  {闉壍.isPending ? "Evaluating…" : "↻ Evaluate now"}
                </Button>
              </Tooltip>) : null}
          </>}/>

      <div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[300px_minmax(0,1fr)]">
        <QuickRulesPanel value={鼞壍} settings={畢壍.data} dirty={!!慀壍} saving={盚壍.isPending} canSave={亖壍("rules.manage")} onChange={蒗壍} onSave={灵壍} onReset={() => 耯壍(null)}/>

        
        <div className="order-first flex min-w-0 flex-col gap-3 wide:order-none">
          <Tabs value={靁壍.tab} onChange={(彃壍) => {
            void 忈壍(彃壍 === "open" ? null : 彃壍);
            if (檕壍)
                void 覄壍(null);
        }} tabs={STATUS_TABS.map((縲壍) => ({
            value: 縲壍,
            label: (<span className="flex items-center gap-2">
                  {STATUS_LABEL[縲壍]}
                  <span className="font-mono text-meta text-faint tabular">{埫壍.data ? 搰壍[縲壍] : "·"}</span>
                </span>),
        }))}/>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Severity">
            {枥壍.map((鴡壍) => {
            const 樐壍 = 靁壍.severity === 鴡壍.key;
            return (<Chip key={鴡壍.key} active={樐壍} dot={鴡壍.dot} count={埫壍.data ? 茟壍[鴡壍.key] : undefined} onClick={() => {
                    void 鶦壍(鴡壍.key === "all" ? null : 鴡壍.key);
                    if (檕壍)
                        void 覄壍(null);
                }} className={cn("py-[7px] text-fg", 樐壍 ? "border-tone/30 bg-tone/5" : "border-line bg-transparent")}>
                  {鴡壍.label}
                </Chip>);
        })}
          </div>

          {鉔壍.length ? <p className="text-xs text-muted-3">{鉔壍.join(" ")}</p> : null}

          {檕壍 && 埫壍.data && !奣壍 ? (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-line bg-fill px-4 py-3 text-[13px] text-muted" role="status">
              <span className="flex-1">That signal isn&apos;t detected with the current rules or data window any more.</span>
              <Button variant="link" className="text-xs" onClick={() => void 覄壍(null)}>
                Dismiss
              </Button>
            </div>) : null}

          {埫壍.error && !埫壍.data ? <ErrorState error={埫壍.error} onRetry={() => void 埫壍.refetch()}/> : null}

          {!埫壍.data && !埫壍.error ? (<div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((裿壍) => (<Skeleton key={裿壍} height={208} className="rounded-card"/>))}
            </div>) : null}

          {埫壍.data ? (<Refetching active={埫壍.isFetching && 埫壍.isPlaceholderData} className="flex flex-col gap-3">
              {埫壍.error ? <ErrorState error={埫壍.error} onRetry={() => void 埫壍.refetch()}/> : null}
              {滽壍.map((嗮壍) => (<SignalCard key={嗮壍.id} signal={嗮壍} focused={嗮壍.id === 檕壍} recentDays={跬壍} now={蠌壍} timeZone={珪壍} fmt={哻壍} notePending={膧壍.isPending && 膧壍.variables?.id === 嗮壍.id} canManage={涅壍} onAction={(瓝壍) => 屓壍(嗮壍, 瓝壍)} onAddNote={蘏壍(嗮壍)} onOpen={巋壍}/>))}
              {!滽壍.length ? (<EmptyState>{靁壍.severity === "all" || !茟壍.all ? 蚔壍[靁壍.tab] : `No ${枥壍.find((鏌壍) => 鏌壍.key === 靁壍.severity)?.label.toLowerCase()} signals in the ${STATUS_LABEL[靁壍.tab]} tab.`}</EmptyState>) : null}
            </Refetching>) : null}
        </div>
      </div>
    </div>);
}
