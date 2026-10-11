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
const 嬛壍 = ["marginal", "roas_heuristic"] as const satisfies readonly Strategy[];
const 稊壍 = ["conv_value", "conversions"] as const satisfies readonly Objective[];
const 飹壍 = [0, 0.25, 0.5, 0.75, 0.9, 1];
const 旨壍 = [1, 1.1, 1.25, 1.5, 1.6, 2, 3];
const 蓗壍 = { min: "At min", max: "At max", locked: "Locked" } as const;
function 准壍({ label: 炵壍, children: 辤壍 }: {
    label: string;
    children: React.ReactNode;
}) {
    return (<div className="flex flex-col gap-1.5">
      <span className="label-mono">{炵壍}</span>
      {辤壍}
    </div>);
}
export function OptimizerTab({ model: 岓壍, currentMonth: 箂壍, onEditInPacing: 驱壍 }: {
    model: BudgetModel;
    currentMonth: string;
    onEditInPacing: () => void;
}) {
    const { report: 杠壍, currency: 虏壍 } = 岓壍;
    const [匾壍, 爭壍] = useQueryState("strategy", parseAsStringLiteral(嬛壍).withDefault("marginal").withOptions({ history: "replace", scroll: false }));
    const [鄜壍, 帋壍] = useQueryState("objective", parseAsStringLiteral(稊壍).withDefault("conv_value").withOptions({ history: "replace", scroll: false }));
    const [糺壍, 鯩壍] = useQueryState("curves", parseAsStringLiteral(CURVE_SOURCES).withDefault("auto").withOptions({ history: "replace", scroll: false }));
    const [棘壍, 蟇壍] = useState<{
        month: string;
        value: number;
    } | null>(null);
    const [咶壍, 玥壍] = useState(DEFAULT_MIN_MULT);
    const [銔壍, 徃壍] = useState(DEFAULT_MAX_MULT);
    const [繲壍, 鵡壍] = useState(false);
    const [橐壍, 褿壍] = useState(true);
    const 嘮壍 = useCan()("budget.plan");
    const 甝壍 = useWriteAction();
    const 鐌壍 = 杠壍?.month ?? 岓壍.month;
    const 惻壍 = 杠壍?.totals.monthlyTarget ?? 0;
    const 翪壍 = 棘壍 && 棘壍.month === 鐌壍 ? 棘壍.value : 惻壍;
    const 黙壍 = { strategy: 匾壍, objective: 鄜壍, total: 翪壍, minMult: 咶壍, maxMult: 銔壍 };
    const 毈壍 = 杠壍 ? validateSettings(黙壍) : null;
    const 誷壍 = 杠壍?.rows;
    const 垦壍 = 岓壍.locks;
    const 皕壍 = useMemo(() => (誷壍 && !毈壍 ? optimizeBody(鐌壍, { strategy: 匾壍, objective: 鄜壍, total: 翪壍, minMult: 咶壍, maxMult: 銔壍, curveSource: 糺壍 }, 誷壍, 垦壍) : null), [誷壍, 毈壍, 鐌壍, 匾壍, 鄜壍, 翪壍, 咶壍, 銔壍, 糺壍, 垦壍]);
    const 閄壍 = useMemo(() => (誷壍 ? optimizerConstraints(誷壍, 垦壍, 咶壍, 銔壍) : {}), [誷壍, 垦壍, 咶壍, 銔壍]);
    const 扳壍 = useOptimize(皕壍);
    const 腢壍 = 扳壍.data;
    const 乑壍 = 腢壍?.objective ?? 鄜壍;
    const 浀壍 = 杠壍?.daysInMonth ?? 30;
    const 谯壍 = useMemo(() => (腢壍 && 誷壍 ? diffRows(腢壍, 誷壍, 浀壍) : []), [腢壍, 誷壍, 浀壍]);
    const { changes: 夞壍, skipped: 砍壍 } = useMemo(() => optimizerChanges(谯壍), [谯壍]);
    if (!杠壍)
        return 岓壍.error ? <ErrorState error={岓壍.error} onRetry={岓壍.retry}/> : <PacingSkeleton />;
    const 雼壍 = monthPhase(杠壍.month, 箂壍);
    const 揫壍 = 杠壍.rows.filter((苚壍) => 垦壍[苚壍.unitId]).map((俉壍) => 俉壍.name);
    const 溸壍 = draftChangeCount(岓壍.draft).targets;
    const 趧壍 = 腢壍 ? liftSummary(腢壍) : null;
    const 媖壍 = 腢壍 ? curveMixLine(腢壍.curves) : null;
    const 禅壍 = 腢壍 ? lowConfidenceNames(腢壍) : [];
    const 顴壍 = 乑壍 === "conversions" ? "conversions" : "conversion value";
    const 散壍 = 雼壍 !== "current" ? "Switch to the month in progress to apply daily budgets" : !夞壍.length ? "Daily budgets already match" : null;
    const 葒壍 = 匾壍 === "roas_heuristic" || 鄜壍 === "conv_value" ? "Budget shifted toward higher-ROAS campaigns" : "Budget shifted toward campaigns with cheaper conversions";
    const 允壍 = () => {
        if (!腢壍)
            return;
        岓壍.replaceTargets(recommendedTargets(腢壍));
        驱壍();
        toast(葒壍);
    };
    const 瀰壍 = () => {
        if (!腢壍)
            return;
        const 輟壍 = 腢壍.rows.filter((導壍) => Math.abs(導壍.delta) >= 0.5).length;
        岓壍.saveValues(recommendedTargets(腢壍), `Saved ${輟壍} optimized target${輟壍 === 1 ? "" : "s"} for ${monthLabel(杠壍.month)}`);
    };
    const 竽壍 = async () => {
        await 甝壍.run({ type: "campaign.set_budget", budgets: 夞壍.map((駬壍) => ({ campaignId: 駬壍.campaignId, dailyBudget: 駬壍.to })) }, { success: `${葒壍} · ${夞壍.length} daily budget${夞壍.length === 1 ? "" : "s"}` });
        if (橐壍 && 腢壍)
            岓壍.saveValues(recommendedTargets(腢壍), `Saved the optimized targets for ${monthLabel(杠壍.month)}`);
        鵡壍(false);
    };
    const 曛壍 = 乑壍 === "conversions" ? "Expected conv." : "Expected value";
    const 藊壍: Column<DiffRow>[] = [
        {
            key: "name",
            header: "Campaign",
            width: "minmax(200px,1.8fr)",
            sortValue: (効壍) => 効壍.name,
            cell: (熨壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <MiddleTruncate text={熨壍.name} className="font-medium"/>
          <span className="font-mono text-micro leading-snug tracking-[0.1em] text-faint uppercase">{`${熨壍.shared ? "Shared" : 熨壍.type} · ${curveSourceLabel(熨壍.curveSource, 熨壍.curveCalibration)} · ${熨壍.curveConfidence} confidence`}</span>
        </span>),
            total: <span className="font-mono text-micro tracking-label text-faint uppercase">Total</span>,
        },
        {
            key: "before",
            header: "Before",
            align: "right",
            width: "minmax(100px,1fr)",
            sortValue: (邗壍) => 邗壍.current,
            cell: (嶆壍) => (<span className="flex flex-col items-end gap-0.5">
          <span className="text-muted">{money(嶆壍.current, 虏壍)}</span>
          <span className="font-mono text-micro text-faint">{perDay(嶆壍.currentDaily, 虏壍)}</span>
        </span>),
            total: money(腢壍?.totals.current, 虏壍),
        },
        {
            key: "after",
            header: "After",
            align: "right",
            width: "minmax(100px,1fr)",
            sortValue: (籵壍) => 籵壍.recommended,
            cell: (魤壍) => (<span className="flex flex-col items-end gap-0.5">
          <span className="font-semibold">{money(魤壍.recommended, 虏壍)}</span>
          <span className="font-mono text-micro text-faint">{perDay(魤壍.recommendedDaily, 虏壍)}</span>
        </span>),
            total: money(腢壍?.totals.recommended, 虏壍),
        },
        {
            key: "delta",
            header: "Δ",
            align: "right",
            width: "minmax(92px,0.8fr)",
            sortValue: (桓壍) => 桓壍.deltaPct,
            cell: (蝂壍) => (<span className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-meta">{Math.abs(蝂壍.delta) < 0.5 ? "—" : `${蝂壍.delta > 0 ? "▲" : "▼"} ${formatDelta(蝂壍.deltaPct)}`}</span>
          <span className="font-mono text-micro text-faint">{Math.abs(蝂壍.delta) < 0.5 ? "" : `${蝂壍.delta > 0 ? "+" : "−"}${moneyExact(Math.abs(蝂壍.delta), 虏壍)}`}</span>
        </span>),
        },
        {
            key: "expected",
            header: 曛壍,
            align: "right",
            width: "minmax(150px,1.2fr)",
            sortValue: (吱壍) => 吱壍.expected.recommended - 吱壍.expected.current,
            cell: (猠壍) => (<span className="whitespace-nowrap">
          <span className="text-muted">{formatOutcome(乑壍, 猠壍.expected.current, 虏壍)}</span>
          <span className="px-1 text-faint">→</span>
          <span className="font-semibold">{formatOutcome(乑壍, 猠壍.expected.recommended, 虏壍)}</span>
        </span>),
            total: 腢壍 ? `${formatOutcome(乑壍, 腢壍.totals.expectedCurrent, 虏壍)} → ${formatOutcome(乑壍, 腢壍.totals.expectedRecommended, 虏壍)}` : null,
        },
        {
            key: "marginal",
            header: 乑壍 === "conversions" ? "Marginal CPA" : "Marginal ROAS",
            align: "right",
            width: "minmax(104px,0.9fr)",
            sortValue: (鈏壍) => 鈏壍.marginalCost,
            cell: (廾壍) => <span className="text-muted">{marginalLabel(乑壍, 廾壍.marginalCost, 虏壍)}</span>,
        },
        {
            key: "bound",
            header: "Bound",
            align: "right",
            width: "84px",
            cell: (緭壍) => (緭壍.bound ? <Pill tone={緭壍.bound === "locked" ? "accent" : "muted"}>{蓗壍[緭壍.bound]}</Pill> : <span className="text-faint">—</span>),
        },
    ];
    const 鳜壍 = Object.fromEntries(杠壍.rows.map((構壍) => [構壍.unitId, dailyFromMonthly(構壍.monthlyTarget, 浀壍)]));
    const 袺壍 = 腢壍 ? Object.fromEntries(谯壍.map((喩壍) => [喩壍.unitId, 喩壍.recommendedDaily])) : null;
    return (<div className="flex flex-col gap-6">
      {溸壍 ? (<div className="flex flex-wrap items-center gap-3 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5 text-[13px] text-muted-3" role="note">
          <span className="font-mono text-meta tracking-meta text-accent uppercase">Unsaved targets</span>
          <span className="min-w-[200px] flex-1">{`The optimizer starts from saved targets — your ${溸壍} unsaved edit${溸壍 === 1 ? "" : "s"} in Pacing aren't included (locks are).`}</span>
          <Button variant="ghost" onClick={岓壍.discard}>
            Discard edits
          </Button>
          <Button variant="accent" onClick={岓壍.save} loading={岓壍.saving}>
            Save targets
          </Button>
        </div>) : null}

      <Card accent className="flex flex-col gap-5">
        <CardHeader title={鄜壍 === "conv_value" ? "Rebalance for ROAS" : "Rebalance for conversions"} sub={`${monthLabel(杠壍.month)} · ${STRATEGY_LABELS[匾壍]} · ${OBJECTIVE_LABELS[鄜壍]}`}/>
        <div className="grid grid-cols-1 gap-4 wide:grid-cols-[auto_auto_minmax(0,1fr)]">
          <准壍 label="Strategy">
            {<Segmented ariaLabel="Strategy" variant="sans" size="md" value={匾壍} onChange={(璘壍) => void 爭壍(璘壍)} options={[
                { value: "marginal", label: STRATEGY_LABELS.marginal, title: "Every $50 goes where the fitted response curve buys the most" },
                { value: "roas_heuristic", label: STRATEGY_LABELS.roas_heuristic, title: "The prototype's rebalance: weights by ROAS^0.7" },
            ]}/>}
          </准壍>
          <准壍 label="Objective">
            <Segmented ariaLabel="Objective" variant="sans" size="md" value={鄜壍} onChange={(鎇壍) => void 帋壍(鎇壍)} options={(["conversions", "conv_value"] as const).map((恶壍) => ({ value: 恶壍, label: OBJECTIVE_LABELS[恶壍] }))}/>
          </准壍>
          <准壍 label="Curves">
            <Segmented ariaLabel="Curves" variant="sans" size="md" className="self-start" value={糺壍} onChange={(罥壍) => void 鯩壍(罥壍)} options={[
            { value: "auto", label: CURVE_SOURCE_LABELS.auto, title: "Google's budget-simulator curve where it is available, fresh and not PMax; our 60-day model, matched to Google's curves, for the rest" },
            { value: "model", label: CURVE_SOURCE_LABELS.model, title: "Response curves fitted on each campaign's last 60 days" },
        ]}/>
          </准壍>
          <div className="flex flex-wrap items-end gap-4 wide:col-span-3">
            <Field label="Total budget / month" aside={棘壍 && 棘壍.month === 鐌壍 ? (<Button variant="link" className="text-xs" onClick={() => 蟇壍(null)}>
                    Reset
                  </Button>) : null}>
              {(鹔壍) => (<MoneyInput id={鹔壍} value={翪壍} currency={虏壍} onCommit={(歃壍) => 蟇壍({ month: 鐌壍, value: 歃壍 })} ariaLabel="Total monthly budget" className="w-[132px] rounded-mini border-line bg-input px-3 py-2 text-left" edited={!!棘壍 && 棘壍.month === 鐌壍 && Math.abs(棘壍.value - 惻壍) >= 0.5}/>)}
            </Field>
            <Field label="Min per campaign">
              {(訲壍) => (<Select id={訲壍} value={咶壍} onChange={(圡壍) => 玥壍(Number(圡壍.target.value))}>
                  {飹壍.map((瘐壍) => (<option key={瘐壍} value={瘐壍}>{`${瘐壍}× current`}</option>))}
                </Select>)}
            </Field>
            <Field label="Max per campaign">
              {(铿壍) => (<Select id={铿壍} value={銔壍} onChange={(懮壍) => 徃壍(Number(懮壍.target.value))}>
                  {旨壍.map((胝壍) => (<option key={胝壍} value={胝壍}>{`${胝壍}× current`}</option>))}
                </Select>)}
            </Field>
          </div>
        </div>
        <div className="text-xs text-muted-3">{揫壍.length ? `Locked in Pacing (kept fixed): ${揫壍.join(", ")}.` : "No budgets are locked — lock one in Pacing to keep it fixed."}</div>
        {毈壍 ? <div className="text-xs text-crit">{毈壍}</div> : null}

        {扳壍.error && !扳壍.data ? <ErrorState error={扳壍.error} onRetry={() => void 扳壍.refetch()}/> : null}
        {!扳壍.data && !扳壍.error && !毈壍 ? <Skeleton height={360}/> : null}
        {腢壍 && 趧壍 ? (<Refetching active={扳壍.isFetching} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-tone/8 pt-5">
              <div className="flex items-baseline gap-2.5">
                <span className={cn("font-display text-[44px] leading-none font-semibold tracking-[-0.03em]", 趧壍.pct > 0.0005 ? "text-accent" : "text-fg")}>{formatDelta(趧壍.pct)}</span>
                <span className="max-w-[220px] text-[13px] text-muted-3">{`expected ${顴壍} ${趧壍.sameBudget ? "at the same budget" : 趧壍.budgetDelta > 0 ? `with ${money(趧壍.budgetDelta, 虏壍)} more budget` : `with ${money(-趧壍.budgetDelta, 虏壍)} less budget`}`}</span>
              </div>
              <MetaStat label="Budget" value={`${money(腢壍.totals.current, 虏壍)} → ${money(腢壍.totals.recommended, 虏壍)}`}/>
              <MetaStat label={乑壍 === "conversions" ? "Expected conversions" : "Expected value"} value={`${formatOutcome(乑壍, 趧壍.before, 虏壍)} → ${formatOutcome(乑壍, 趧壍.after, 虏壍)}`} tone={趧壍.pct > 0.0005 ? "accent" : undefined}/>
              <MetaStat label="Changes" value={`${腢壍.rows.filter((鿌壍) => Math.abs(鿌壍.delta) >= 0.5).length} of ${腢壍.rows.length}`}/>
            </div>
            <DataTable rows={谯壍} columns={藊壍} rowKey={(治壍) => 治壍.unitId} ariaLabel="Optimizer recommendation: before and after" minWidth={900} initialSort={{ key: "delta", dir: "desc" }}/>
            {媖壍 || 腢壍.warnings.length || 禅壍.length ? (<ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed text-muted-3">
                {媖壍 ? (<li className="flex gap-2">
                    <span aria-hidden className="text-faint">
                      ●
                    </span>
                    {媖壍}
                  </li>) : null}
                {禅壍.length ? (<li className="flex gap-2">
                    <span aria-hidden className="text-warn">
                      ▲
                    </span>
                    {`Low-confidence curves (${禅壍.join(", ")}): little spend variation to learn from — treat their expectations as rough.`}
                  </li>) : null}
                {腢壍.warnings.map((讪壍) => (<li key={讪壍} className="flex gap-2">
                    <span aria-hidden className="text-warn">
                      ▲
                    </span>
                    {讪壍}
                  </li>))}
              </ul>) : null}
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-tone/8 pt-4">
              <span className="mr-auto max-w-[520px] text-xs text-muted-3">Daily budget = monthly ÷ {浀壍} days. Google may spend up to 2× a day&apos;s budget on busy days but never more than 30.4× the daily budget in a month.</span>
              {嘮壍 ? (<>
                  <Button variant="ghost" onClick={允壍}>
                    Edit in Pacing
                  </Button>
                  <Button variant="outline" onClick={瀰壍} loading={岓壍.saving}>
                    Save as targets
                  </Button>
                </>) : null}
              {散壍 ? <span className="text-xs text-muted-3">{散壍}</span> : null}
              <LiveGuard>
                <Button variant="brand" onClick={() => 鵡壍(true)} disabled={!!散壍}>
                  Apply daily budgets
                </Button>
              </LiveGuard>
            </div>
          </Refetching>) : null}
      </Card>

      <ResponseCurvesCard objective={鄜壍} current={鳜壍} recommended={袺壍} currency={虏壍}/>
      <ScenariosCard month={杠壍.month} strategy={匾壍} constraints={閄壍} currency={虏壍} curveSource={糺壍}/>

      <ChangesDialog open={繲壍} onOpenChange={鵡壍} title="Apply the optimized daily budgets" description={`Each campaign's daily budget becomes its optimized ${monthLabel(杠壍.month)} amount ÷ ${浀壍} days.`} changes={夞壍} skipped={砍壍} currency={虏壍} confirmLabel={`Apply ${夞壍.length} budget${夞壍.length === 1 ? "" : "s"}`} onConfirm={() => void 竽壍()} pending={甝壍.pending}>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
          <Checkbox checked={橐壍} onChange={褿壍} ariaLabel="Also save as monthly targets"/>
          Also save the optimized amounts as {monthLabel(杠壍.month)} targets
        </label>
      </ChangesDialog>
      {甝壍.dialog}
    </div>);
}
