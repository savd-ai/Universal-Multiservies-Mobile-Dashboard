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
function Cmp14(): PlanDraftStore & {
    anyDirty: boolean;
} {
    const [蛫壍, 叚壍] = useState<Record<string, PlanDraft>>({});
    const 狉壍 = useCallback((醸壍: string, 座壍: (綖壍: PlanDraft) => PlanDraft) => {
        叚壍((鲅壍) => {
            const 楴壍 = 座壍(鲅壍[醸壍] ?? EMPTY_PLAN_DRAFT);
            const 衣壍 = { ...鲅壍 };
            if (isPlanDraftDirty(楴壍))
                衣壍[醸壍] = 楴壍;
            else
                delete 衣壍[醸壍];
            return 衣壍;
        });
    }, []);
    return { drafts: 蛫壍, update: 狉壍, anyDirty: Object.keys(蛫壍).length > 0 };
}
export function BudgetScreen() {
    const 啒壍 = useStatus();
    const 瑁壍 = useCan()("budget.plan");
    const 錰壍 = useId();
    const [怟壍, 缎壍] = useQueryState("tab", parseAsStringLiteral(BUDGET_TABS).withDefault("pacing").withOptions({ history: "push", scroll: false }));
    const [鷽壍, 櫬壍] = useQueryState("month", parseAsString.withOptions({ history: "replace", scroll: false }));
    const 觛壍 = 啒壍.data?.dataThrough.slice(0, 7) ?? null;
    const 囊壍 = isMonthKey(鷽壍) ? 鷽壍 : 觛壍;
    const 疹壍 = useTargetDrafts();
    const 钨壍 = Cmp14();
    const 憗壍 = useBudgetModel(囊壍, 疹壍);
    const 肆壍 = 疹壍.anyDirty || 钨壍.anyDirty;
    useEffect(() => {
        if (!肆壍)
            return;
        const 齵壍 = (汤壍: BeforeUnloadEvent) => 汤壍.preventDefault();
        window.addEventListener("beforeunload", 齵壍);
        return () => window.removeEventListener("beforeunload", 齵壍);
    }, [肆壍]);
    const 譓壍 = (塂壍: BudgetTab) => void 缎壍(塂壍 === "pacing" ? null : 塂壍);
    const 眱壍 = () => {
        const 阠壍 = 憗壍.targetsView?.defaults;
        if (!阠壍)
            return;
        const 挏壍 = draftFromValues(阠壍, 憗壍.saved, 憗壍.draft);
        憗壍.replaceTargets(阠壍);
        toast(isDirty(挏壍) ? "Budgets reset" : "Budgets already match daily budget × days");
    };
    const 臾壍 = 怟壍 === "pacing" ? (<>
        {瑁壍 ? (<Button variant="ghost" onClick={眱壍} disabled={!憗壍.targetsView}>
            Reset
          </Button>) : null}
        <Button variant="brand" onClick={() => 譓壍("optimizer")}>
          Rebalance for ROAS
        </Button>
      </>) : null;
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={臾壍}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <BudgetTabs value={怟壍} onChange={譓壍} idBase={錰壍}/>
          <span className="flex-1"/>
          {(怟壍 === "pacing" || 怟壍 === "optimizer") && 囊壍 && 觛壍 ? <MonthPicker month={囊壍} currentMonth={觛壍} onChange={(仭壍) => void 櫬壍(仭壍)} min={shiftMonth(觛壍, -24)} max={shiftMonth(觛壍, 12)} complete={憗壍.report?.month === 觛壍 && 憗壍.report.remainingDays === 0}/> : null}
        </div>
      </PageHeader>

      <div role="tabpanel" id={panelId(錰壍)} aria-labelledby={tabId(錰壍, 怟壍)} className="flex flex-col gap-6">
        {!觛壍 ? (<PacingSkeleton />) : 怟壍 === "pacing" ? (<PacingTab model={憗壍} currentMonth={觛壍}/>) : 怟壍 === "optimizer" ? (<OptimizerTab model={憗壍} currentMonth={觛壍} onEditInPacing={() => 譓壍("pacing")}/>) : 怟壍 === "forecast" ? (<ForecastTab rows={憗壍.report?.rows ?? []} currentMonth={觛壍} currency={憗壍.currency} onOpenSimulators={() => 譓壍("simulators")}/>) : 怟壍 === "simulators" ? (<SimulatorsTab />) : (<PlansTab rows={憗壍.report?.rows ?? []} currentMonth={觛壍} currency={憗壍.currency} store={钨壍}/>)}
      </div>
    </div>);
}
