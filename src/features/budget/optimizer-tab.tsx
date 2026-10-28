"use client";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/inputs";
import { LiveGuard, useWriteAction } from "@/components/ui/live-guard";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MetaStat } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCan } from "@/lib/api/auth";
import { useOptimize } from "@/lib/api/budget";
import { CURVE_SOURCES } from "@/lib/domain/contracts/budget";
import { formatDelta } from "@/lib/domain/metrics/registry";
import { ChangesDialog, MoneyInput } from "./budget-ui";
import { PacingSkeleton } from "./pacing-tab";
import { ResponseCurvesCard } from "./response-curves";
import { ScenariosCard } from "./scenarios-card";
import { draftChangeCount } from "./lib/drafts";
import { dailyFromMonthly, money, moneyExact, perDay } from "./lib/money";
import { monthLabel, monthPhase } from "./lib/months";
import { CURVE_SOURCE_LABELS, curveMixLine, curveSourceLabel, DEFAULT_MAX_MULT, DEFAULT_MIN_MULT, diffRows, formatOutcome, liftSummary, lowConfidenceNames, marginalLabel, OBJECTIVE_LABELS, optimizeBody, optimizerChanges, optimizerConstraints, recommendedTargets, STRATEGY_LABELS, validateSettings, type DiffRow, type Objective, type Strategy, } from "./lib/optimizer";
import type { BudgetModel } from "./use-budget-model";
const STRATEGIES = ["marginal", "roas_heuristic"] as const satisfies readonly Strategy[];
const OBJECTIVES = ["conv_value", "conversions"] as const satisfies readonly Objective[];
const MIN_OPTIONS = [0, 0.25, 0.5, 0.75, 0.9, 1];
const MAX_OPTIONS = [1, 1.1, 1.25, 1.5, 1.6, 2, 3];
const BOUND_LABEL = { min: "At min", max: "At max", locked: "Locked" } as const;
function Labelled({ label, children }: {
    label: string;
    children: React.ReactNode;
}) {
    return (<div className="flex flex-col gap-1.5">
      <span className="label-mono">{label}</span>
      {children}
    </div>);
}
export function OptimizerTab({ model, currentMonth, onEditInPacing }: {
    model: BudgetModel;
    currentMonth: string;
    onEditInPacing: () => void;
}) {
    const { report, currency } = model;
    const [strategy, setStrategy] = useQueryState("strategy", parseAsStringLiteral(STRATEGIES).withDefault("marginal").withOptions({ history: "replace", scroll: false }));
    const [objective, setObjective] = useQueryState("objective", parseAsStringLiteral(OBJECTIVES).withDefault("conv_value").withOptions({ history: "replace", scroll: false }));
    const [curveSource, setCurveSource] = useQueryState("curves", parseAsStringLiteral(CURVE_SOURCES).withDefault("auto").withOptions({ history: "replace", scroll: false }));
    const [totalOverride, setTotalOverride] = useState<{
        month: string;
        value: number;
    } | null>(null);
    const [minMult, setMinMult] = useState(DEFAULT_MIN_MULT);
    const [maxMult, setMaxMult] = useState(DEFAULT_MAX_MULT);
    const [confirm, setConfirm] = useState(false);
    const [alsoSave, setAlsoSave] = useState(true);
    const canPlan = useCan()("budget.plan");
    const write = useWriteAction();
    const month = report?.month ?? model.month;
    const savedTotal = report?.totals.monthlyTarget ?? 0;
    const total = totalOverride && totalOverride.month === month ? totalOverride.value : savedTotal;
    const settings = { strategy, objective, total, minMult, maxMult };
    const invalid = report ? validateSettings(settings) : null;
    const rows = report?.rows;
    const locks = model.locks;
    const body = useMemo(() => (rows && !invalid ? optimizeBody(month, { strategy, objective, total, minMult, maxMult, curveSource }, rows, locks) : null), [rows, invalid, month, strategy, objective, total, minMult, maxMult, curveSource, locks]);
    const constraints = useMemo(() => (rows ? optimizerConstraints(rows, locks, minMult, maxMult) : {}), [rows, locks, minMult, maxMult]);
    const q = useOptimize(body);
    const result = q.data;
    const obj = result?.objective ?? objective;
    const days = report?.daysInMonth ?? 30;
    const diff = useMemo(() => (result && rows ? diffRows(result, rows, days) : []), [result, rows, days]);
    const { changes, skipped } = useMemo(() => optimizerChanges(diff), [diff]);
    if (!report)
        return model.error ? <ErrorState error={model.error} onRetry={model.retry}/> : <PacingSkeleton />;
    const phase = monthPhase(report.month, currentMonth);
    const lockedNames = report.rows.filter((r) => locks[r.unitId]).map((r) => r.name);
    const pendingEdits = draftChangeCount(model.draft).targets;
    const lift = result ? liftSummary(result) : null;
    const mixLine = result ? curveMixLine(result.curves) : null;
    const low = result ? lowConfidenceNames(result) : [];
    const unit = obj === "conversions" ? "conversions" : "conversion value";
    const applyBlocked = phase !== "current" ? "Switch to the month in progress to apply daily budgets" : !changes.length ? "Daily budgets already match" : null;
    const shiftCopy = strategy === "roas_heuristic" || objective === "conv_value" ? "Budget shifted toward higher-ROAS campaigns" : "Budget shifted toward campaigns with cheaper conversions";
    const editInPacing = () => {
        if (!result)
            return;
        model.replaceTargets(recommendedTargets(result));
        onEditInPacing();
        toast(shiftCopy);
    };
    const saveAsTargets = () => {
        if (!result)
            return;
        const n = result.rows.filter((r) => Math.abs(r.delta) >= 0.5).length;
        model.saveValues(recommendedTargets(result), `Saved ${n} optimized target${n === 1 ? "" : "s"} for ${monthLabel(report.month)}`);
    };
    const apply = async () => {
        await write.run({ type: "campaign.set_budget", budgets: changes.map((c) => ({ campaignId: c.campaignId, dailyBudget: c.to })) }, { success: `${shiftCopy} · ${changes.length} daily budget${changes.length === 1 ? "" : "s"}` });
        if (alsoSave && result)
            model.saveValues(recommendedTargets(result), `Saved the optimized targets for ${monthLabel(report.month)}`);
        setConfirm(false);
    };
    const outcomeHeader = obj === "conversions" ? "Expected conv." : "Expected value";
    const columns: Column<DiffRow>[] = [
        {
            key: "name",
            header: "Campaign",
            width: "minmax(200px,1.8fr)",
            sortValue: (r) => r.name,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-0.5">
          <MiddleTruncate text={r.name} className="font-medium"/>
          <span className="font-mono text-micro leading-snug tracking-[0.1em] text-faint uppercase">{`${r.shared ? "Shared" : r.type} · ${curveSourceLabel(r.curveSource, r.curveCalibration)} · ${r.curveConfidence} confidence`}</span>
        </span>),
            total: <span className="font-mono text-micro tracking-label text-faint uppercase">Total</span>,
        },
        {
            key: "before",
            header: "Before",
            align: "right",
            width: "minmax(100px,1fr)",
            sortValue: (r) => r.current,
            cell: (r) => (<span className="flex flex-col items-end gap-0.5">
          <span className="text-muted">{money(r.current, currency)}</span>
          <span className="font-mono text-micro text-faint">{perDay(r.currentDaily, currency)}</span>
        </span>),
            total: money(result?.totals.current, currency),
        },
        {
            key: "after",
            header: "After",
            align: "right",
            width: "minmax(100px,1fr)",
            sortValue: (r) => r.recommended,
            cell: (r) => (<span className="flex flex-col items-end gap-0.5">
          <span className="font-semibold">{money(r.recommended, currency)}</span>
          <span className="font-mono text-micro text-faint">{perDay(r.recommendedDaily, currency)}</span>
        </span>),
            total: money(result?.totals.recommended, currency),
        },
        {
            key: "delta",
            header: "Δ",
            align: "right",
            width: "minmax(92px,0.8fr)",
            sortValue: (r) => r.deltaPct,
            cell: (r) => (<span className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-meta">{Math.abs(r.delta) < 0.5 ? "—" : `${r.delta > 0 ? "▲" : "▼"} ${formatDelta(r.deltaPct)}`}</span>
          <span className="font-mono text-micro text-faint">{Math.abs(r.delta) < 0.5 ? "" : `${r.delta > 0 ? "+" : "−"}${moneyExact(Math.abs(r.delta), currency)}`}</span>
        </span>),
        },
        {
            key: "expected",
            header: outcomeHeader,
            align: "right",
            width: "minmax(150px,1.2fr)",
            sortValue: (r) => r.expected.recommended - r.expected.current,
            cell: (r) => (<span className="whitespace-nowrap">
          <span className="text-muted">{formatOutcome(obj, r.expected.current, currency)}</span>
          <span className="px-1 text-faint">→</span>
          <span className="font-semibold">{formatOutcome(obj, r.expected.recommended, currency)}</span>
        </span>),
            total: result ? `${formatOutcome(obj, result.totals.expectedCurrent, currency)} → ${formatOutcome(obj, result.totals.expectedRecommended, currency)}` : null,
        },
        {
            key: "marginal",
            header: obj === "conversions" ? "Marginal CPA" : "Marginal ROAS",
            align: "right",
            width: "minmax(104px,0.9fr)",
            sortValue: (r) => r.marginalCost,
            cell: (r) => <span className="text-muted">{marginalLabel(obj, r.marginalCost, currency)}</span>,
        },
        {
            key: "bound",
            header: "Bound",
            align: "right",
            width: "84px",
            cell: (r) => (r.bound ? <Pill tone={r.bound === "locked" ? "accent" : "muted"}>{BOUND_LABEL[r.bound]}</Pill> : <span className="text-faint">—</span>),
        },
    ];
    const current = Object.fromEntries(report.rows.map((r) => [r.unitId, dailyFromMonthly(r.monthlyTarget, days)]));
    const recommendedDaily = result ? Object.fromEntries(diff.map((r) => [r.unitId, r.recommendedDaily])) : null;
    return (<div className="flex flex-col gap-6">
      {pendingEdits ? (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5 text-[13px] text-muted-3" role="note">
          <span className="font-mono text-meta tracking-meta text-accent uppercase">Unsaved targets</span>
          <span className="min-w-[200px] flex-1">{`The optimizer starts from saved targets — your ${pendingEdits} unsaved edit${pendingEdits === 1 ? "" : "s"} in Pacing aren't included (locks are).`}</span>
          <Button variant="ghost" onClick={model.discard}>
            Discard edits
          </Button>
          <Button variant="accent" onClick={model.save} loading={model.saving}>
            Save targets
          </Button>
        </div>) : null}

      <Card accent className="flex flex-col gap-5">
        <CardHeader title={objective === "conv_value" ? "Rebalance for ROAS" : "Rebalance for conversions"} sub={`${monthLabel(report.month)} · ${STRATEGY_LABELS[strategy]} · ${OBJECTIVE_LABELS[objective]}`}/>
        <div className="grid grid-cols-1 gap-4 wide:grid-cols-[auto_auto_minmax(0,1fr)]">
          <Labelled label="Strategy">
            {<Segmented ariaLabel="Strategy" variant="sans" size="md" value={strategy} onChange={(v) => void setStrategy(v)} options={[
                { value: "marginal", label: STRATEGY_LABELS.marginal, title: "Every $50 goes where the fitted response curve buys the most" },
                { value: "roas_heuristic", label: STRATEGY_LABELS.roas_heuristic, title: "The prototype's rebalance: weights by ROAS^0.7" },
            ]}/>}
          </Labelled>
          <Labelled label="Objective">
            <Segmented ariaLabel="Objective" variant="sans" size="md" value={objective} onChange={(v) => void setObjective(v)} options={(["conversions", "conv_value"] as const).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}/>
          </Labelled>
          <Labelled label="Curves">
            <Segmented ariaLabel="Curves" variant="sans" size="md" className="self-start" value={curveSource} onChange={(v) => void setCurveSource(v)} options={[
            { value: "auto", label: CURVE_SOURCE_LABELS.auto, title: "Google's budget-simulator curve where it is available, fresh and not PMax; our 60-day model, matched to Google's curves, for the rest" },
            { value: "model", label: CURVE_SOURCE_LABELS.model, title: "Response curves fitted on each campaign's last 60 days" },
        ]}/>
          </Labelled>
          <div className="flex flex-wrap items-end gap-4 wide:col-span-3">
            <Field label="Total budget / month" aside={totalOverride && totalOverride.month === month ? (<Button variant="link" className="text-xs" onClick={() => setTotalOverride(null)}>
                    Reset
                  </Button>) : null}>
              {(id) => (<MoneyInput id={id} value={total} currency={currency} onCommit={(v) => setTotalOverride({ month, value: v })} ariaLabel="Total monthly budget" className="w-[132px] rounded-mini border-line bg-input px-3 py-2 text-left" edited={!!totalOverride && totalOverride.month === month && Math.abs(totalOverride.value - savedTotal) >= 0.5}/>)}
            </Field>
            <Field label="Min per campaign">
              {(id) => (<Select id={id} value={minMult} onChange={(e) => setMinMult(Number(e.target.value))}>
                  {MIN_OPTIONS.map((m) => (<option key={m} value={m}>{`${m}× current`}</option>))}
                </Select>)}
            </Field>
            <Field label="Max per campaign">
              {(id) => (<Select id={id} value={maxMult} onChange={(e) => setMaxMult(Number(e.target.value))}>
                  {MAX_OPTIONS.map((m) => (<option key={m} value={m}>{`${m}× current`}</option>))}
                </Select>)}
            </Field>
          </div>
        </div>
        <div className="text-xs text-muted-3">{lockedNames.length ? `Locked in Pacing (kept fixed): ${lockedNames.join(", ")}.` : "No budgets are locked — lock one in Pacing to keep it fixed."}</div>
        {invalid ? <div className="text-xs text-crit">{invalid}</div> : null}

        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
        {!q.data && !q.error && !invalid ? <Skeleton height={360}/> : null}
        {result && lift ? (<Refetching active={q.isFetching} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-tone/8 pt-5">
              <div className="flex items-baseline gap-2.5">
                <span className={cn("font-display text-[44px] leading-none font-semibold tracking-[-0.03em]", lift.pct > 0.0005 ? "text-accent" : "text-fg")}>{formatDelta(lift.pct)}</span>
                <span className="max-w-[220px] text-[13px] text-muted-3">{`expected ${unit} ${lift.sameBudget ? "at the same budget" : lift.budgetDelta > 0 ? `with ${money(lift.budgetDelta, currency)} more budget` : `with ${money(-lift.budgetDelta, currency)} less budget`}`}</span>
              </div>
              <MetaStat label="Budget" value={`${money(result.totals.current, currency)} → ${money(result.totals.recommended, currency)}`}/>
              <MetaStat label={obj === "conversions" ? "Expected conversions" : "Expected value"} value={`${formatOutcome(obj, lift.before, currency)} → ${formatOutcome(obj, lift.after, currency)}`} tone={lift.pct > 0.0005 ? "accent" : undefined}/>
              <MetaStat label="Changes" value={`${result.rows.filter((r) => Math.abs(r.delta) >= 0.5).length} of ${result.rows.length}`}/>
            </div>
            <DataTable rows={diff} columns={columns} rowKey={(r) => r.unitId} ariaLabel="Optimizer recommendation: before and after" minWidth={900} initialSort={{ key: "delta", dir: "desc" }}/>
            {mixLine || result.warnings.length || low.length ? (<ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed text-muted-3">
                {mixLine ? (<li className="flex gap-2">
                    <span aria-hidden className="text-faint">
                      ●
                    </span>
                    {mixLine}
                  </li>) : null}
                {low.length ? (<li className="flex gap-2">
                    <span aria-hidden className="text-warn">
                      ▲
                    </span>
                    {`Low-confidence curves (${low.join(", ")}): little spend variation to learn from — treat their expectations as rough.`}
                  </li>) : null}
                {result.warnings.map((w) => (<li key={w} className="flex gap-2">
                    <span aria-hidden className="text-warn">
                      ▲
                    </span>
                    {w}
                  </li>))}
              </ul>) : null}
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-tone/8 pt-4">
              <span className="mr-auto max-w-[520px] text-xs text-muted-3">Daily budget = monthly ÷ {days} days. Google may spend up to 2× a day&apos;s budget on busy days but never more than 30.4× the daily budget in a month.</span>
              {canPlan ? (<>
                  <Button variant="ghost" onClick={editInPacing}>
                    Edit in Pacing
                  </Button>
                  <Button variant="outline" onClick={saveAsTargets} loading={model.saving}>
                    Save as targets
                  </Button>
                </>) : null}
              {applyBlocked ? <span className="text-xs text-muted-3">{applyBlocked}</span> : null}
              <LiveGuard>
                <Button variant="brand" onClick={() => setConfirm(true)} disabled={!!applyBlocked}>
                  Apply daily budgets
                </Button>
              </LiveGuard>
            </div>
          </Refetching>) : null}
      </Card>

      <ResponseCurvesCard objective={objective} current={current} recommended={recommendedDaily} currency={currency}/>
      <ScenariosCard month={report.month} strategy={strategy} constraints={constraints} currency={currency} curveSource={curveSource}/>

      <ChangesDialog open={confirm} onOpenChange={setConfirm} title="Apply the optimized daily budgets" description={`Each campaign's daily budget becomes its optimized ${monthLabel(report.month)} amount ÷ ${days} days.`} changes={changes} skipped={skipped} currency={currency} confirmLabel={`Apply ${changes.length} budget${changes.length === 1 ? "" : "s"}`} onConfirm={() => void apply()} pending={write.pending}>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <Checkbox checked={alsoSave} onChange={setAlsoSave} ariaLabel="Also save as monthly targets"/>
          Also save the optimized amounts as {monthLabel(report.month)} targets
        </label>
      </ChangesDialog>
      {write.dialog}
    </div>);
}
