"use client";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useId, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCan } from "@/lib/api/auth";
import { useStatus } from "@/lib/api/hooks";
import { BUDGET_TABS, BudgetTabs, MonthPicker, panelId, tabId, type BudgetTab } from "./budget-ui";
import { ForecastTab } from "./forecast-tab";
import { draftFromValues, isDirty } from "./lib/drafts";
import { isMonthKey, shiftMonth } from "./lib/months";
import { EMPTY_PLAN_DRAFT, isPlanDraftDirty, type PlanDraft } from "./lib/plans";
import { OptimizerTab } from "./optimizer-tab";
import { PacingSkeleton, PacingTab } from "./pacing-tab";
import { PlansTab, type PlanDraftStore } from "./plans-tab";
import { SimulatorsTab } from "./simulators-tab";
import { useBudgetModel, useTargetDrafts } from "./use-budget-model";
function usePlanDrafts(): PlanDraftStore & {
    anyDirty: boolean;
} {
    const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
    const update = useCallback((planId: string, fn: (d: PlanDraft) => PlanDraft) => {
        setDrafts((all) => {
            const next = fn(all[planId] ?? EMPTY_PLAN_DRAFT);
            const copy = { ...all };
            if (isPlanDraftDirty(next))
                copy[planId] = next;
            else
                delete copy[planId];
            return copy;
        });
    }, []);
    return { drafts, update, anyDirty: Object.keys(drafts).length > 0 };
}
export function BudgetScreen() {
    const status = useStatus();
    const canPlan = useCan()("budget.plan");
    const idBase = useId();
    const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(BUDGET_TABS).withDefault("pacing").withOptions({ history: "push", scroll: false }));
    const [monthParam, setMonthParam] = useQueryState("month", parseAsString.withOptions({ history: "replace", scroll: false }));
    const currentMonth = status.data?.dataThrough.slice(0, 7) ?? null;
    const month = isMonthKey(monthParam) ? monthParam : currentMonth;
    const targetDrafts = useTargetDrafts();
    const planDrafts = usePlanDrafts();
    const model = useBudgetModel(month, targetDrafts);
    const anyDirty = targetDrafts.anyDirty || planDrafts.anyDirty;
    useEffect(() => {
        if (!anyDirty)
            return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [anyDirty]);
    const go = (t: BudgetTab) => void setTab(t === "pacing" ? null : t);
    const reset = () => {
        const defaults = model.targetsView?.defaults;
        if (!defaults)
            return;
        const next = draftFromValues(defaults, model.saved, model.draft);
        model.replaceTargets(defaults);
        toast(isDirty(next) ? "Budgets reset" : "Budgets already match daily budget × days");
    };
    const actions = tab === "pacing" ? (<>
        {canPlan ? (<Button variant="ghost" onClick={reset} disabled={!model.targetsView}>
            Reset
          </Button>) : null}
        <Button variant="brand" onClick={() => go("optimizer")}>
          Rebalance for ROAS
        </Button>
      </>) : null;
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={actions}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BudgetTabs value={tab} onChange={go} idBase={idBase}/>
          <span className="flex-1"/>
          {(tab === "pacing" || tab === "optimizer") && month && currentMonth ? <MonthPicker month={month} currentMonth={currentMonth} onChange={(m) => void setMonthParam(m)} min={shiftMonth(currentMonth, -24)} max={shiftMonth(currentMonth, 12)} complete={model.report?.month === currentMonth && model.report.remainingDays === 0}/> : null}
        </div>
      </PageHeader>

      <div role="tabpanel" id={panelId(idBase)} aria-labelledby={tabId(idBase, tab)} className="flex flex-col gap-6">
        {!currentMonth ? (<PacingSkeleton />) : tab === "pacing" ? (<PacingTab model={model} currentMonth={currentMonth}/>) : tab === "optimizer" ? (<OptimizerTab model={model} currentMonth={currentMonth} onEditInPacing={() => go("pacing")}/>) : tab === "forecast" ? (<ForecastTab rows={model.report?.rows ?? []} currentMonth={currentMonth} currency={model.currency} onOpenSimulators={() => go("simulators")}/>) : tab === "simulators" ? (<SimulatorsTab />) : (<PlansTab rows={model.report?.rows ?? []} currentMonth={currentMonth} currency={model.currency} store={planDrafts}/>)}
      </div>
    </div>);
}
