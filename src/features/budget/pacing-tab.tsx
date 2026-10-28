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
        {[0, 1, 2, 3].map((i) => (<Skeleton key={i} height={112} className="rounded-card"/>))}
      </div>
      <Skeleton height={290} className="rounded-card"/>
      <Skeleton height={420} className="rounded-card"/>
    </div>);
}
function DefaultTargetsNote({ model, report, canPlan }: {
    model: BudgetModel;
    report: PacingReport;
    canPlan: boolean;
}) {
    const last = canPlan ? (model.targetsView?.lastMonth ?? null) : null;
    const n = last ? Object.keys(last.targets).length : 0;
    return (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5 text-[13px] text-muted-3" role="note">
      <span className="font-mono text-meta tracking-meta text-accent uppercase">No targets saved</span>
      <span className="min-w-[240px] flex-1">
        {`${monthName(report.month)} budgets are each daily budget × ${report.daysInMonth} days; paused campaigns count only what they've already spent.`}
        {last ? ` Or start from ${monthName(last.month)} spend: ${n} budget${n === 1 ? "" : "s"} scaled to ${report.daysInMonth} days (${money(last.total, model.currency)}), then review and save.` : null}
      </span>
      {last ? (<Button variant="ghost" onClick={() => model.replaceTargets(last.targets)}>
          {`Use ${monthName(last.month)} spend`}
        </Button>) : null}
    </div>);
}
export function PacingTab({ model, currentMonth }: {
    model: BudgetModel;
    currentMonth: string;
}) {
    const { report, views, totals, currency, thresholds } = model;
    const live = useIsLive();
    const canPlan = useCan()("budget.plan");
    const write = useWriteAction();
    const [confirm, setConfirm] = useState(false);
    const [changeList, setChangeList] = useState<FileExport | null>(null);
    const { changes, skipped } = useMemo(() => recommendedChanges(views), [views]);
    if (!report)
        return model.error ? <ErrorState error={model.error} onRetry={model.retry}/> : <PacingSkeleton />;
    const phase = monthPhase(report.month, currentMonth);
    const stats = budgetStats(report, totals, thresholds, currency);
    const counts = draftChangeCount(model.draft);
    const t = draftTotals(model.saved, model.draft);
    const applyBlocked = phase !== "current" ? "Recommendations apply to the month in progress" : model.dirty ? "Save or discard your target changes first" : !changes.length ? "Daily budgets already match the recommendations" : null;
    const exportFile = async (value: "recommended" | "targets", format: "editor" | "csv" | "text") => {
        try {
            const file = await fetchBudgetExport({ month: report.month, from: value, format });
            if (format === "text")
                setChangeList(file);
            else
                saveExport(file);
            if (file.warnings.length && format !== "text")
                toast(file.warnings[0] as string, { tone: "warn", ms: 4000 });
        }
        catch (e) {
            toast((e as Error).message || "Export failed", { tone: "crit" });
        }
    };
    const apply = async () => {
        await write.run({ type: "campaign.set_budget", budgets: changes.map((c) => ({ campaignId: c.campaignId, dailyBudget: c.to })) }, { success: `Applied ${changes.length} recommended daily budget${changes.length === 1 ? "" : "s"} ` });
        setConfirm(false);
    };
    return (<div className="flex flex-col gap-6">
      <Refetching active={model.refetching} className="flex flex-col gap-6">
        {model.targetsView?.isDefault && !model.dirty && phase !== "past" && report.remainingDays > 0 ? <DefaultTargetsNote model={model} report={report} canPlan={canPlan}/> : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {stats.map((s) => (<StatCard key={s.label} label={s.label} value={s.value} caption={s.caption} tone={s.tone} className="shadow-card"/>))}
        </div>

        <CumulativeCard report={report} total={totals.target} projected={totals.projected} currency={currency} currentYear={currentMonth.slice(0, 4)}/>

        <div className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-[22px] py-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="font-display text-base font-semibold tracking-title">Monthly targets</span>
              <span className="meta">{`${views.length} budget${views.length === 1 ? "" : "s"} · ${canPlan ? "drag, type or lock · locked budgets stay fixed when rebalancing" : "view only: your role can't change targets"}`}</span>
            </div>
            {applyBlocked && !live ? <span className="text-xs text-muted-3">{applyBlocked}</span> : null}
            <Menu trigger={<Button variant="ghost" aria-label="Export budgets">
                  Export ▾
                </Button>} items={[
            { label: "Editor CSV · recommended daily", onSelect: () => void exportFile("recommended", "editor"), disabled: report.remainingDays === 0 },
            { label: "Editor CSV · from monthly targets", onSelect: () => void exportFile("targets", "editor") },
            { label: "Change list · recommended", onSelect: () => void exportFile("recommended", "text"), disabled: report.remainingDays === 0 },
            { label: "Detailed CSV", onSelect: () => void exportFile("recommended", "csv"), separatorBefore: true },
        ]}/>
            <LiveGuard>
              <Button variant="brand" onClick={() => setConfirm(true)} disabled={!!applyBlocked} title={applyBlocked ?? undefined}>
                Apply recommended <span className="max-sm:hidden">daily</span> budgets
              </Button>
            </LiveGuard>
          </div>
          <div className="relative overflow-x-auto">
            <AllocationRows views={views} report={report} currency={currency} onTarget={model.setTarget} onLock={model.setLock} readOnly={!canPlan}/>
          </div>
          <div className="border-t border-line px-[22px] py-3.5">
            <CapsNote />
            {live ? <p className="m-0 mt-1.5 text-xs text-muted-3">Live data is read-only: export the Editor CSV or copy the change list to apply budgets in Google Ads.</p> : null}
          </div>
        </div>
      </Refetching>

      {model.dirty ? (<UnsavedBar summary={`${counts.targets ? `${counts.targets} target${counts.targets === 1 ? "" : "s"} edited` : ""}${counts.targets && counts.locks ? " · " : ""}${counts.locks ? `${counts.locks} lock${counts.locks === 1 ? "" : "s"} changed` : ""} · ${monthLabel(report.month)} total ${money(t.before, currency)} → ${money(t.after, currency)}`} onDiscard={model.discard} onSave={model.save} saving={model.saving}/>) : null}

      <ChangesDialog open={confirm} onOpenChange={setConfirm} title="Apply recommended daily budgets" description={`Sets each campaign's daily budget to the amount that lands on its ${monthLabel(report.month)} target over the remaining ${report.remainingDays} day${report.remainingDays === 1 ? "" : "s"}.`} changes={changes} skipped={skipped} currency={currency} confirmLabel={`Apply ${changes.length} budget${changes.length === 1 ? "" : "s"}`} onConfirm={() => void apply()} pending={write.pending}/>
      <CopyTextModal file={changeList} onClose={() => setChangeList(null)} title={`Recommended budgets · ${monthLabel(report.month)}`}/>
      {write.dialog}
    </div>);
}
