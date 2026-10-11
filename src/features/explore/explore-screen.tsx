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
const 顓壍 = { history: "replace" as const, scroll: false };
export function ExploreScreen() {
    const 敂壍 = useQueryClient();
    const 萱壍 = useCan()("dashboards.edit");
    const 儠壍 = useStatus();
    const 瀏壍 = useCatalog();
    const 軾壍 = useQuestions();
    const 寭壍 = useFilters(儠壍.data?.today);
    const [竜壍, 駋壍] = useQueryState("q", parseAsString.withOptions(顓壍));
    const [暺壍, 薩壍] = useQueryState("question", parseAsString.withOptions(顓壍));
    const [劘壍, 熇壍] = useQueryState("view", parseAsStringEnum<PreviewTab>(["chart", "table", "spec"]).withDefault("chart").withOptions(顓壍));
    const [, 遶壍] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const [嵥壍, 籔壍] = useState<null | "save" | "dashboard" | "saved">(null);
    const [魃壍, 栲壍] = useState<{
        open: boolean;
        key?: string;
    }>({ open: false });
    const [蜡壍, 吐壍] = useState(0);
    const 狿壍 = useRef<string | null>(null);
    const 釮壍 = useMemo(() => (竜壍 ? decodeExploreParam(竜壍) : null), [竜壍]);
    const 廝壍 = 釮壍?.ok ? 釮壍.state : null;
    const 緌壍 = 瀏壍.data;
    useEffect(() => {
        if (!竜壍 || !釮壍 || 狿壍.current === 竜壍)
            return;
        if (!釮壍.ok) {
            狿壍.current = 竜壍;
            toast(`Couldn't open that question — ${釮壍.reason}`, { tone: "warn", ms: 5000 });
            void 駋壍(encodeExploreState(defaultState()));
        }
        else if (釮壍.notes.length) {
            狿壍.current = 竜壍;
            toast(釮壍.notes[0] as string, { tone: "warn" });
        }
    }, [竜壍, 釮壍, 駋壍]);
    useEffect(() => {
        if (!暺壍 || 竜壍 || !軾壍.data)
            return;
        const 鲻壍 = 軾壍.data.find((榪壍) => 榪壍.id === 暺壍);
        if (!鲻壍) {
            if (狿壍.current === `question:${暺壍}`)
                return;
            狿壍.current = `question:${暺壍}`;
            toast("That saved question no longer exists.", { tone: "warn" });
            void 薩壍(null);
            return;
        }
        const 袙壍 = stateFromPayload({ query: 鲻壍.query, viz: 鲻壍.viz });
        if (袙壍.ok)
            void 駋壍(encodeExploreState(袙壍.state));
    }, [暺壍, 竜壍, 軾壍.data, 駋壍, 薩壍]);
    const 喈壍 = useCallback((瑷壍: NotebookAction) => {
        void 駋壍((鍦壍) => {
            const 恕壍 = 鍦壍 ? decodeExploreParam(鍦壍) : null;
            return encodeExploreState(notebookReducer(恕壍?.ok ? 恕壍.state : defaultState(), 瑷壍));
        });
    }, [駋壍]);
    const 罄壍 = useCallback((鸳壍: ExploreState, 欢壍: string | null = null) => {
        void 駋壍(encodeExploreState(鸳壍), { history: "push" });
        void 薩壍(欢壍, { history: "push" });
        吐壍((訑壍) => 訑壍 + 1);
    }, [駋壍, 薩壍]);
    const 圀壍 = useCallback((痯壍: SavedQuestion) => {
        const 铞壍 = stateFromPayload({ query: 痯壍.query, viz: 痯壍.viz });
        if (铞壍.ok)
            罄壍(铞壍.state, 痯壍.id);
        else
            toast(`Couldn't open “${痯壍.name}” — ${铞壍.reason}`, { tone: "crit" });
    }, [罄壍]);
    const 懍壍 = 寭壍.dateRange;
    const 肼壍 = 寭壍.rangeKey === "custom" ? 寭壍.rangeLabel || RANGE_LABELS.custom : RANGE_LABELS[寭壍.rangeKey];
    const 龫壍 = useMemo(() => (廝壍 ? runnableSpec(廝壍.spec, 懍壍) : null), [廝壍, 懍壍]);
    const 沚壍 = 廝壍 ? (廝壍.viz ?? suggestViz(廝壍.spec, 緌壍)) : null;
    const 讉壍 = 暺壍 ? 軾壍.data?.find((塸壍) => 塸壍.id === 暺壍) : undefined;
    const 睧壍 = useMemo(() => {
        if (!讉壍 || !廝壍)
            return false;
        const 陖壍 = stateFromPayload({ query: 讉壍.query, viz: 讉壍.viz });
        return !陖壍.ok || JSON.stringify(toPayload(陖壍.state)) !== JSON.stringify(toPayload(廝壍));
    }, [讉壍, 廝壍]);
    const 捅壍 = useCallback((舴壍: string) => {
        if (!緌壍 || !廝壍)
            return;
        const 伣壍 = pruneForSource(緌壍, 廝壍.spec, 舴壍);
        喈壍({ type: "setSpec", spec: 伣壍.spec });
        if (伣壍.removed.length)
            toast(`Removed ${listLabel(伣壍.removed)} — not available for ${sourceLabel(舴壍)}`, { tone: "warn", ms: 5000 });
    }, [緌壍, 廝壍, 喈壍]);
    const 渒壍: WidgetRuntime | null = useMemo(() => 儠壍.data
        ? {
            filters: 寭壍,
            today: 儠壍.data.today,
            dataThrough: 儠壍.data.dataThrough,
            currency: 儠壍.data.display.currency || 儠壍.data.account.currency,
            money: moneyFromStatus(儠壍.data),
            mode: 儠壍.data.mode,
            editing: false,
            dashboardId: "explore",
            openCampaign: (贁壍: string) => void 遶壍(贁壍),
            toggleCrossFilter: (姰壍: string, 磟壍: string, 韎壍?: {
                exclude?: boolean;
            }) => {
                喈壍({ type: "toggleFilterValue", dim: 姰壍 as DimensionKey, value: 磟壍, exclude: 韎壍?.exclude });
                toast(`Filter: ${dimLabel(緌壍, 姰壍)} ${韎壍?.exclude ? "is not" : "is"} ${磟壍} — click again to remove`);
            },
        }
        : null, [儠壍.data, 寭壍, 遶壍, 喈壍, 緌壍]);
    const 撽壍 = 讉壍?.name ?? (廝壍 ? autoTitle(廝壍.spec, 緌壍) : "New question");
    const 莬壍 = (傛壍: string, 澊壍: string) => {
        const 蹹壍 = navigator.clipboard?.writeText(傛壍);
        if (!蹹壍)
            return toast("Copying isn't available in this browser", { tone: "crit" });
        void 蹹壍.then(() => toast(`${澊壍} copied`)).catch(() => toast("Copy failed — your browser blocked clipboard access", { tone: "crit" }));
    };
    const 孨壍 = () => 龫壍 && void 莬壍(new URL(exploreHref(龫壍, 廝壍?.viz), window.location.origin).toString(), "Link");
    const 穗壍 = () => 龫壍 && 沚壍 && void 莬壍(JSON.stringify({ spec: 龫壍, viz: 沚壍 }, null, 2), "Spec JSON");
    const 饆壍 = (昵壍: "csv" | "json") => {
        if (!龫壍)
            return;
        void exportQuery({ ...龫壍, limit: 龫壍.limit ?? 10000 }, 昵壍, slugify(撽壍)).catch((蔤壍: Error) => toast(蔤壍.message || "Export failed", { tone: "crit" }));
    };
    const 刓壍 = (焂壍: Fix) => {
        喈壍({ type: "setSpec", spec: 焂壍.spec });
        toast(焂壍.label);
    };
    const 迱壍 = () => {
        void 駋壍(null, { history: "push" });
        void 薩壍(null, { history: "push" });
        吐壍((峠壍) => 峠壍 + 1);
    };
    const 篏壍: NotebookCtx | null = 廝壍 && 緌壍 && 儠壍.data
        ? {
            state: 廝壍,
            spec: 廝壍.spec,
            dispatch: 喈壍,
            catalog: 緌壍,
            today: 儠壍.data.today,
            dataThrough: 儠壍.data.dataThrough,
            currency: 渒壍?.currency ?? 儠壍.data.account.currency,
            mode: 儠壍.data.mode,
            pageRange: 懍壍,
            pageRangeLabel: 肼壍,
            setSource: 捅壍,
            editMetric: (骾壍) => 栲壍({ open: true, key: 骾壍 }),
        }
        : null;
    const 枭壍 = 廝壍
        ? [sourceLabel(廝壍.spec.source), 廝壍.spec.dateRange ? dateRangeLabel(廝壍.spec.dateRange) : `Page range · ${肼壍}`, 廝壍.spec.compare !== "none" ? COMPARE_LABEL[廝壍.spec.compare] : null].filter(Boolean).join(" · ")
        : "";
    const 蚜壍 = 軾壍.data?.length ?? 0;
    let 压壍: React.ReactNode;
    if (瀏壍.error)
        压壍 = <ErrorState error={瀏壍.error} onRetry={() => void 瀏壍.refetch()}/>;
    else if (!緌壍 || !儠壍.data || (暺壍 && !竜壍) || (竜壍 && !廝壍))
        压壍 = <鑙壍 />;
    else if (!篏壍 || !渒壍 || !沚壍)
        压壍 = (<ExploreStart catalog={緌壍} onStart={(牺壍) => 罄壍(牺壍)} onScratch={() => 罄壍(defaultState())} onOpenSaved={圀壍} onAllSaved={() => 籔壍("saved")}/>);
    else
        压壍 = (<div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
        <Notebook key={蜡壍} nb={篏壍}/>
        
        <div className="order-first min-w-0 wide:sticky wide:top-[88px] wide:order-none">
          <PreviewPane spec={篏壍.spec} runSpec={龫壍} viz={沚壍} catalog={緌壍} rt={渒壍} title={撽壍} subtitle={枭壍} badge={讉壍 ? <Pill tone={睧壍 ? "warn" : "accent"}>{睧壍 ? "Edited" : "Saved"}</Pill> : null} tab={劘壍} onTab={(酩壍) => void 熇壍(酩壍)} onFix={刓壍} onCopyJson={穗壍} onCopyLink={孨壍} tableLabel={(幘壍) => 緌壍.tables.find((絇壍) => 絇壍.id === 幘壍)?.label ?? 幘壍} actions={<>
                <Menu trigger={<IconButton label="Download and share" size="md">
                      <span aria-hidden>⋯</span>
                    </IconButton>} items={[
                    { label: "Download CSV", hint: "≤ 10,000 rows", onSelect: () => 饆壍("csv"), disabled: !龫壍 },
                    { label: "Download JSON", onSelect: () => 饆壍("json"), disabled: !龫壍 },
                    { label: "Copy link", separatorBefore: true, onSelect: 孨壍, disabled: !龫壍 },
                    { label: "Copy spec JSON", onSelect: 穗壍, disabled: !龫壍 },
                ]}/>
                {萱壍 ? (<>
                    <Button variant="outline" onClick={() => 籔壍("dashboard")} disabled={!龫壍}>
                      Add to dashboard
                    </Button>
                    <Button variant="accent" onClick={() => 籔壍("save")} disabled={!龫壍}>
                      {讉壍 ? "Save" : "Save question"}
                    </Button>
                  </>) : null}
              </>}/>
        </div>
      </div>);
    return (<div className="flex flex-col gap-6">
      <PageHeader description="Pick metrics, break them down, filter, and see the answer as a chart or table — then save it, share the link or add it to a dashboard." actions={<>
            <Button variant="ghost" onClick={() => 籔壍("saved")}>
              Saved questions{蚜壍 ? ` · ${蚜壍}` : ""}
            </Button>
            {竜壍 ? (<Button variant="outline" onClick={迱壍}>
                New question
              </Button>) : null}
          </>}/>
      {压壍}

      <SavedQuestionsDrawer open={嵥壍 === "saved"} onOpenChange={(鰶壍) => 籔壍(鰶壍 ? "saved" : null)} catalog={緌壍} currentId={暺壍} onOpen={圀壍} onDeleted={(椥壍) => 椥壍 === 暺壍 && void 薩壍(null)}/>
      {廝壍 && 沚壍 ? (<>
          <SaveQuestionDialog open={嵥壍 === "save"} onOpenChange={(蠔壍) => 籔壍(蠔壍 ? "save" : null)} existing={讉壍} defaultName={撽壍} query={龫壍} viz={沚壍} onSaved={(唃壍) => {
                const 珲壍 = stateFromPayload({ query: 唃壍.query, viz: 唃壍.viz });
                if (珲壍.ok)
                    void 駋壍(encodeExploreState(珲壍.state));
                void 薩壍(唃壍.id);
            }}/>
          <SaveToDashboardDialog open={嵥壍 === "dashboard"} onOpenChange={(鋡壍) => 籔壍(鋡壍 ? "dashboard" : null)} spec={廝壍.spec} viz={沚壍} defaultTitle={撽壍} defaultSubtitle={sourceLabel(廝壍.spec.source)} pageRange={懍壍}/>
        </>) : null}
      {緌壍 ? (<CustomMetricEditor open={魃壍.open} onOpenChange={(忐壍) => 栲壍((线壍) => ({ ...线壍, open: 忐壍 }))} editKey={魃壍.key} catalog={緌壍} currency={渒壍?.currency ?? "USD"} onSaved={(鶮壍, 檝壍) => {
                if (!檝壍)
                    return;
                void 敂壍.refetchQueries({ queryKey: qk.catalog() }).then(() => 廝壍 && !廝壍.spec.metrics.includes(鶮壍) && 喈壍({ type: "toggleMetric", key: 鶮壍 }));
            }} onDeleted={(覌壍) => 喈壍({ type: "setSpec", spec: { ...(廝壍?.spec ?? defaultState().spec), metrics: (廝壍?.spec.metrics ?? []).filter((噻壍) => 噻壍 !== 覌壍), having: (廝壍?.spec.having ?? []).filter((番壍) => 番壍.metric !== 覌壍) } })}/>) : null}
    </div>);
}
function 鑙壍() {
    return (<div className="grid grid-cols-1 items-start gap-6 wide:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]" aria-busy="true">
      <div className="flex flex-col gap-3">
        {[120, 200, 90, 90].map((慈壍, 耷壍) => (<Skeleton key={耷壍} height={慈壍} className="rounded-card"/>))}
      </div>
      <Skeleton height={560} className="rounded-card"/>
    </div>);
}
