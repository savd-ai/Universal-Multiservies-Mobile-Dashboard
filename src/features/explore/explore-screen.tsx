"use client";
import { moneyFromStatus } from "@/lib/money";
import { useQueryClient } from "@tanstack/react-query";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button, IconButton } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { exportQuery } from "@/lib/api/explore";
import { qk, useCatalog, useQuestions, useStatus } from "@/lib/api/hooks";
import type { SavedQuestion } from "@/lib/domain/contracts/dashboard";
import type { DimensionKey } from "@/lib/domain/schema/dimensions";
import { RANGE_LABELS, useFilters } from "@/lib/filters";
import { exploreHref } from "@/features/widgets/question/shared";
import type { WidgetRuntime } from "@/features/widgets/types";
import { decodeExploreParam, encodeExploreState, stateFromPayload, toPayload } from "./codec";
import { listLabel, pruneForSource, type Fix } from "./compat";
import { CustomMetricEditor } from "./custom-metric-editor";
import { autoTitle, COMPARE_LABEL, dateRangeLabel, dimLabel, slugify, sourceLabel } from "./describe";
import { ExploreStart } from "./explore-start";
import { Notebook } from "./notebook";
import type { NotebookCtx } from "./notebook-ctx";
import { defaultState, notebookReducer, runnableSpec, type ExploreState, type NotebookAction } from "./notebook-state";
import { PreviewPane, type PreviewTab } from "./preview-pane";
import { SaveQuestionDialog, SaveToDashboardDialog } from "./save-dialogs";
import { SavedQuestionsDrawer } from "./saved-questions";
import { suggestViz } from "./viz-suggest";
import { useCan } from "@/lib/api/auth";
const qOpts = { history: "replace" as const, scroll: false };
export function ExploreScreen() {
    const qc = useQueryClient();
    const canEdit = useCan()("dashboards.edit");
    const status = useStatus();
    const catalog = useCatalog();
    const questions = useQuestions();
    const filters = useFilters(status.data?.today);
    const [q, setQ] = useQueryState("q", parseAsString.withOptions(qOpts));
    const [questionId, setQuestionId] = useQueryState("question", parseAsString.withOptions(qOpts));
    const [tab, setTab] = useQueryState("view", parseAsStringEnum<PreviewTab>(["chart", "table", "spec"]).withDefault("chart").withOptions(qOpts));
    const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const [dialog, setDialog] = useState<null | "save" | "dashboard" | "saved">(null);
    const [metricEditor, setMetricEditor] = useState<{
        open: boolean;
        key?: string;
    }>({ open: false });
    const [generation, setGeneration] = useState(0);
    const noted = useRef<string | null>(null);
    const decoded = useMemo(() => (q ? decodeExploreParam(q) : null), [q]);
    const state = decoded?.ok ? decoded.state : null;
    const cat = catalog.data;
    useEffect(() => {
        if (!q || !decoded || noted.current === q)
            return;
        if (!decoded.ok) {
            noted.current = q;
            toast(`Couldn't open that question — ${decoded.reason}`, { tone: "warn", ms: 5000 });
            void setQ(encodeExploreState(defaultState()));
        }
        else if (decoded.notes.length) {
            noted.current = q;
            toast(decoded.notes[0] as string, { tone: "warn" });
        }
    }, [q, decoded, setQ]);
    useEffect(() => {
        if (!questionId || q || !questions.data)
            return;
        const found = questions.data.find((x) => x.id === questionId);
        if (!found) {
            if (noted.current === `question:${questionId}`)
                return;
            noted.current = `question:${questionId}`;
            toast("That saved question no longer exists.", { tone: "warn" });
            void setQuestionId(null);
            return;
        }
        const r = stateFromPayload({ query: found.query, viz: found.viz });
        if (r.ok)
            void setQ(encodeExploreState(r.state));
    }, [questionId, q, questions.data, setQ, setQuestionId]);
    const dispatch = useCallback((action: NotebookAction) => {
        void setQ((prev) => {
            const cur = prev ? decodeExploreParam(prev) : null;
            return encodeExploreState(notebookReducer(cur?.ok ? cur.state : defaultState(), action));
        });
    }, [setQ]);
    const load = useCallback((next: ExploreState, savedId: string | null = null) => {
        void setQ(encodeExploreState(next), { history: "push" });
        void setQuestionId(savedId, { history: "push" });
        setGeneration((g) => g + 1);
    }, [setQ, setQuestionId]);
    const openSaved = useCallback((sq: SavedQuestion) => {
        const r = stateFromPayload({ query: sq.query, viz: sq.viz });
        if (r.ok)
            load(r.state, sq.id);
        else
            toast(`Couldn't open “${sq.name}” — ${r.reason}`, { tone: "crit" });
    }, [load]);
    const pageRange = filters.dateRange;
    const pageRangeLabel = filters.rangeKey === "custom" ? filters.rangeLabel || RANGE_LABELS.custom : RANGE_LABELS[filters.rangeKey];
    const runSpec = useMemo(() => (state ? runnableSpec(state.spec, pageRange) : null), [state, pageRange]);
    const viz = state ? (state.viz ?? suggestViz(state.spec, cat)) : null;
    const saved = questionId ? questions.data?.find((x) => x.id === questionId) : undefined;
    const edited = useMemo(() => {
        if (!saved || !state)
            return false;
        const base = stateFromPayload({ query: saved.query, viz: saved.viz });
        return !base.ok || JSON.stringify(toPayload(base.state)) !== JSON.stringify(toPayload(state));
    }, [saved, state]);
    const setSource = useCallback((source: string) => {
        if (!cat || !state)
            return;
        const pruned = pruneForSource(cat, state.spec, source);
        dispatch({ type: "setSpec", spec: pruned.spec });
        if (pruned.removed.length)
            toast(`Removed ${listLabel(pruned.removed)} — not available for ${sourceLabel(source)}`, { tone: "warn", ms: 5000 });
    }, [cat, state, dispatch]);
    const rt: WidgetRuntime | null = useMemo(() => status.data
        ? {
            filters,
            today: status.data.today,
            dataThrough: status.data.dataThrough,
            currency: status.data.display.currency || status.data.account.currency,
            money: moneyFromStatus(status.data),
            mode: status.data.mode,
            editing: false,
            dashboardId: "explore",
            openCampaign: (id: string) => void setCampaign(id),
            toggleCrossFilter: (dim: string, value: string, opts?: {
                exclude?: boolean;
            }) => {
                dispatch({ type: "toggleFilterValue", dim: dim as DimensionKey, value, exclude: opts?.exclude });
                toast(`Filter: ${dimLabel(cat, dim)} ${opts?.exclude ? "is not" : "is"} ${value} — click again to remove`);
            },
        }
        : null, [status.data, filters, setCampaign, dispatch, cat]);
    const title = saved?.name ?? (state ? autoTitle(state.spec, cat) : "New question");
    const copy = (text: string, what: string) => {
        const done = navigator.clipboard?.writeText(text);
        if (!done)
            return toast("Copying isn't available in this browser", { tone: "crit" });
        void done.then(() => toast(`${what} copied`)).catch(() => toast("Copy failed — your browser blocked clipboard access", { tone: "crit" }));
    };
    const copyLink = () => runSpec && void copy(new URL(exploreHref(runSpec, state?.viz), window.location.origin).toString(), "Link");
    const copyJson = () => runSpec && viz && void copy(JSON.stringify({ spec: runSpec, viz }, null, 2), "Spec JSON");
    const doExport = (format: "csv" | "json") => {
        if (!runSpec)
            return;
        void exportQuery({ ...runSpec, limit: runSpec.limit ?? 10000 }, format, slugify(title)).catch((e: Error) => toast(e.message || "Export failed", { tone: "crit" }));
    };
    const applyFix = (fix: Fix) => {
        dispatch({ type: "setSpec", spec: fix.spec });
        toast(fix.label);
    };
    const newQuestion = () => {
        void setQ(null, { history: "push" });
        void setQuestionId(null, { history: "push" });
        setGeneration((g) => g + 1);
    };
    const nb: NotebookCtx | null = state && cat && status.data
        ? {
            state,
            spec: state.spec,
            dispatch,
            catalog: cat,
            today: status.data.today,
            dataThrough: status.data.dataThrough,
            currency: rt?.currency ?? status.data.account.currency,
            mode: status.data.mode,
            pageRange,
            pageRangeLabel,
            setSource,
            editMetric: (key) => setMetricEditor({ open: true, key }),
        }
        : null;
    const subtitle = state
        ? [sourceLabel(state.spec.source), state.spec.dateRange ? dateRangeLabel(state.spec.dateRange) : `Page range · ${pageRangeLabel}`, state.spec.compare !== "none" ? COMPARE_LABEL[state.spec.compare] : null].filter(Boolean).join(" · ")
        : "";
    const count = questions.data?.length ?? 0;
    let body: React.ReactNode;
    if (catalog.error)
        body = <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()}/>;
    else if (!cat || !status.data || (questionId && !q) || (q && !state))
        body = <ExploreSkeleton />;
    else if (!nb || !rt || !viz)
        body = (<ExploreStart catalog={cat} onStart={(s) => load(s)} onScratch={() => load(defaultState())} onOpenSaved={openSaved} onAllSaved={() => setDialog("saved")}/>);
    else
        body = (<div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
        <Notebook key={generation} nb={nb}/>
        
        <div className="order-first min-w-0 wide:sticky wide:top-[88px] wide:order-none">
          <PreviewPane spec={nb.spec} runSpec={runSpec} viz={viz} catalog={cat} rt={rt} title={title} subtitle={subtitle} badge={saved ? <Pill tone={edited ? "warn" : "accent"}>{edited ? "Edited" : "Saved"}</Pill> : null} tab={tab} onTab={(t) => void setTab(t)} onFix={applyFix} onCopyJson={copyJson} onCopyLink={copyLink} tableLabel={(id) => cat.tables.find((t) => t.id === id)?.label ?? id} actions={<>
                <Menu trigger={<IconButton label="Download and share" size="md">
                      <span aria-hidden>⋯</span>
                    </IconButton>} items={[
                    { label: "Download CSV", hint: "≤ 10,000 rows", onSelect: () => doExport("csv"), disabled: !runSpec },
                    { label: "Download JSON", onSelect: () => doExport("json"), disabled: !runSpec },
                    { label: "Copy link", separatorBefore: true, onSelect: copyLink, disabled: !runSpec },
                    { label: "Copy spec JSON", onSelect: copyJson, disabled: !runSpec },
                ]}/>
                {canEdit ? (<>
                    <Button variant="outline" onClick={() => setDialog("dashboard")} disabled={!runSpec}>
                      Add to dashboard
                    </Button>
                    <Button variant="accent" onClick={() => setDialog("save")} disabled={!runSpec}>
                      {saved ? "Save" : "Save question"}
                    </Button>
                  </>) : null}
              </>}/>
        </div>
      </div>);
    return (<div className="flex flex-col gap-6">
      <PageHeader description="Pick metrics, break them down, filter, and see the answer as a chart or table — then save it, share the link or add it to a dashboard." actions={<>
            <Button variant="ghost" onClick={() => setDialog("saved")}>
              Saved questions{count ? ` · ${count}` : ""}
            </Button>
            {q ? (<Button variant="outline" onClick={newQuestion}>
                New question
              </Button>) : null}
          </>}/>
      {body}

      <SavedQuestionsDrawer open={dialog === "saved"} onOpenChange={(o) => setDialog(o ? "saved" : null)} catalog={cat} currentId={questionId} onOpen={openSaved} onDeleted={(id) => id === questionId && void setQuestionId(null)}/>
      {state && viz ? (<>
          <SaveQuestionDialog open={dialog === "save"} onOpenChange={(o) => setDialog(o ? "save" : null)} existing={saved} defaultName={title} query={runSpec} viz={viz} onSaved={(sq) => {
                const r = stateFromPayload({ query: sq.query, viz: sq.viz });
                if (r.ok)
                    void setQ(encodeExploreState(r.state));
                void setQuestionId(sq.id);
            }}/>
          <SaveToDashboardDialog open={dialog === "dashboard"} onOpenChange={(o) => setDialog(o ? "dashboard" : null)} spec={state.spec} viz={viz} defaultTitle={title} defaultSubtitle={sourceLabel(state.spec.source)} pageRange={pageRange}/>
        </>) : null}
      {cat ? (<CustomMetricEditor open={metricEditor.open} onOpenChange={(o) => setMetricEditor((m) => ({ ...m, open: o }))} editKey={metricEditor.key} catalog={cat} currency={rt?.currency ?? "USD"} onSaved={(key, created) => {
                if (!created)
                    return;
                void qc.refetchQueries({ queryKey: qk.catalog() }).then(() => state && !state.spec.metrics.includes(key) && dispatch({ type: "toggleMetric", key }));
            }} onDeleted={(key) => dispatch({ type: "setSpec", spec: { ...(state?.spec ?? defaultState().spec), metrics: (state?.spec.metrics ?? []).filter((m) => m !== key), having: (state?.spec.having ?? []).filter((h) => h.metric !== key) } })}/>) : null}
    </div>);
}
function ExploreSkeleton() {
    return (<div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]" aria-busy="true">
      <div className="flex flex-col gap-3">
        {[120, 200, 90, 90].map((h, i) => (<Skeleton key={i} height={h} className="rounded-card"/>))}
      </div>
      <Skeleton height={560} className="rounded-card"/>
    </div>);
}
