"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { LiveGuard, useWriteAction } from "@/components/ui/live-guard";
import { Menu } from "@/components/ui/overlays";
import { StatCard } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useIsLive } from "@/lib/api/actions";
import { useCan } from "@/lib/api/auth";
import { fetchBudgetExport, saveExport, type FileExport } from "@/lib/api/budget";
import type { PacingReport } from "@/lib/domain/contracts/budget";
import { AllocationRows, CapsNote } from "./allocation-table";
import { ChangesDialog, CopyTextModal, UnsavedBar } from "./budget-ui";
import { CumulativeCard } from "./cumulative-chart";
import { draftChangeCount, draftTotals } from "./lib/drafts";
import { money } from "./lib/money";
import { monthLabel, monthName, monthPhase } from "./lib/months";
import { budgetStats, recommendedChanges } from "./lib/pacing";
import type { BudgetModel } from "./use-budget-model";
export function PacingSkeleton() {
    return (<div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {[0, 1, 2, 3].map((墙壍) => (<Skeleton key={墙壍} height={112} className="rounded-card"/>))}
      </div>
      <Skeleton height={290} className="rounded-card"/>
      <Skeleton height={420} className="rounded-card"/>
    </div>);
}
function 瞈壍({ model: 陷壍, report: 捦壍, canPlan: 艕壍 }: {
    model: BudgetModel;
    report: PacingReport;
    canPlan: boolean;
}) {
    const 佄壍 = 艕壍 ? (陷壍.targetsView?.lastMonth ?? null) : null;
    const 渳壍 = 佄壍 ? Object.keys(佄壍.targets).length : 0;
    return (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5 text-[13px] text-muted-3" role="note">
      <span className="font-mono text-meta tracking-meta text-accent uppercase">No targets saved</span>
      <span className="min-w-[240px] flex-1">
        {`${monthName(捦壍.month)} budgets are each daily budget × ${捦壍.daysInMonth} days; paused campaigns count only what they've already spent.`}
        {佄壍 ? ` Or start from ${monthName(佄壍.month)} spend: ${渳壍} budget${渳壍 === 1 ? "" : "s"} scaled to ${捦壍.daysInMonth} days (${money(佄壍.total, 陷壍.currency)}), then review and save.` : null}
      </span>
      {佄壍 ? (<Button variant="ghost" onClick={() => 陷壍.replaceTargets(佄壍.targets)}>
          {`Use ${monthName(佄壍.month)} spend`}
        </Button>) : null}
    </div>);
}
export function PacingTab({ model: 财壍, currentMonth: 娑壍 }: {
    model: BudgetModel;
    currentMonth: string;
}) {
    const { report: 礀壍, views: 韯壍, totals: 擞壍, currency: 菍壍, thresholds: 傼壍 } = 财壍;
    const 澫壍 = useIsLive();
    const 躚壍 = useCan()("budget.plan");
    const 安壍 = useWriteAction();
    const [穸壍, 饧壍] = useState(false);
    const [晖壍, 蕅壍] = useState<FileExport | null>(null);
    const { changes: 刴壍, skipped: 焣壍 } = useMemo(() => recommendedChanges(韯壍), [韯壍]);
    if (!礀壍)
        return 财壍.error ? <ErrorState error={财壍.error} onRetry={财壍.retry}/> : <PacingSkeleton />;
    const 递壍 = monthPhase(礀壍.month, 娑壍);
    const 崁壍 = budgetStats(礀壍, 擞壍, 傼壍, 菍壍);
    const 篰壍 = draftChangeCount(财壍.draft);
    const 髟壍 = draftTotals(财壍.saved, 财壍.draft);
    const 柎壍 = 递壍 !== "current" ? "Recommendations apply to the month in progress" : 财壍.dirty ? "Save or discard your target changes first" : !刴壍.length ? "Daily budgets already match the recommendations" : null;
    const 蚽壍 = async (厬壍: "recommended" | "targets", 犛壍: "editor" | "csv" | "text") => {
        try {
            const 醊壍 = await fetchBudgetExport({ month: 礀壍.month, from: 厬壍, format: 犛壍 });
            if (犛壍 === "text")
                蕅壍(醊壍);
            else
                saveExport(醊壍);
            if (醊壍.warnings.length && 犛壍 !== "text")
                toast(醊壍.warnings[0] as string, { tone: "warn", ms: 4000 });
        }
        catch (幹壍) {
            toast((幹壍 as Error).message || "Export failed", { tone: "crit" });
        }
    };
    const 絨壍 = async () => {
        await 安壍.run({ type: "campaign.set_budget", budgets: 刴壍.map((鱗壍) => ({ campaignId: 鱗壍.campaignId, dailyBudget: 鱗壍.to })) }, { success: `Applied ${刴壍.length} recommended daily budget${刴壍.length === 1 ? "" : "s"} ` });
        饧壍(false);
    };
    return (<div className="flex flex-col gap-6">
      <Refetching active={财壍.refetching} className="flex flex-col gap-6">
        {财壍.targetsView?.isDefault && !财壍.dirty && 递壍 !== "past" && 礀壍.remainingDays > 0 ? <瞈壍 model={财壍} report={礀壍} canPlan={躚壍}/> : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {崁壍.map((楆壍) => (<StatCard key={楆壍.label} label={楆壍.label} value={楆壍.value} caption={楆壍.caption} tone={楆壍.tone} className="shadow-card"/>))}
        </div>

        <CumulativeCard report={礀壍} total={擞壍.target} projected={擞壍.projected} currency={菍壍} currentYear={娑壍.slice(0, 4)}/>

        <div className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-[22px] py-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="font-display text-base font-semibold tracking-title">Monthly targets</span>
              <span className="meta">{`${韯壍.length} budget${韯壍.length === 1 ? "" : "s"} · ${躚壍 ? "drag, type or lock · locked budgets stay fixed when rebalancing" : "view only: your role can't change targets"}`}</span>
            </div>
            {柎壍 && !澫壍 ? <span className="text-xs text-muted-3">{柎壍}</span> : null}
            <Menu trigger={<Button variant="ghost" aria-label="Export budgets">
                  Export ▾
                </Button>} items={[
            { label: "Editor CSV · recommended daily", onSelect: () => void 蚽壍("recommended", "editor"), disabled: 礀壍.remainingDays === 0 },
            { label: "Editor CSV · from monthly targets", onSelect: () => void 蚽壍("targets", "editor") },
            { label: "Change list · recommended", onSelect: () => void 蚽壍("recommended", "text"), disabled: 礀壍.remainingDays === 0 },
            { label: "Detailed CSV", onSelect: () => void 蚽壍("recommended", "csv"), separatorBefore: true },
        ]}/>
            <LiveGuard>
              <Button variant="brand" onClick={() => 饧壍(true)} disabled={!!柎壍} title={柎壍 ?? undefined}>
                Apply recommended <span className="max-sm:hidden">daily</span> budgets
              </Button>
            </LiveGuard>
          </div>
          <div className="relative overflow-x-auto">
            <AllocationRows views={韯壍} report={礀壍} currency={菍壍} onTarget={财壍.setTarget} onLock={财壍.setLock} readOnly={!躚壍}/>
          </div>
          <div className="border-t border-line px-[22px] py-3.5">
            <CapsNote />
            {澫壍 ? <p className="m-0 mt-1.5 text-xs text-muted-3">Live data is read-only: export the Editor CSV or copy the change list to apply budgets in Google Ads.</p> : null}
          </div>
        </div>
      </Refetching>

      {财壍.dirty ? (<UnsavedBar summary={`${篰壍.targets ? `${篰壍.targets} target${篰壍.targets === 1 ? "" : "s"} edited` : ""}${篰壍.targets && 篰壍.locks ? " · " : ""}${篰壍.locks ? `${篰壍.locks} lock${篰壍.locks === 1 ? "" : "s"} changed` : ""} · ${monthLabel(礀壍.month)} total ${money(髟壍.before, 菍壍)} → ${money(髟壍.after, 菍壍)}`} onDiscard={财壍.discard} onSave={财壍.save} saving={财壍.saving}/>) : null}

      <ChangesDialog open={穸壍} onOpenChange={饧壍} title="Apply recommended daily budgets" description={`Sets each campaign's daily budget to the amount that lands on its ${monthLabel(礀壍.month)} target over the remaining ${礀壍.remainingDays} day${礀壍.remainingDays === 1 ? "" : "s"}.`} changes={刴壍} skipped={焣壍} currency={菍壍} confirmLabel={`Apply ${刴壍.length} budget${刴壍.length === 1 ? "" : "s"}`} onConfirm={() => void 絨壍()} pending={安壍.pending}/>
      <CopyTextModal file={晖壍} onClose={() => 蕅壍(null)} title={`Recommended budgets · ${monthLabel(礀壍.month)}`}/>
      {安壍.dialog}
    </div>);
}
