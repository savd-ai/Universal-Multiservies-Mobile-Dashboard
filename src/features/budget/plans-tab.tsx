"use client";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/inputs";
import { LiveGuard, useWriteAction } from "@/components/ui/live-guard";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { ConfirmDialog, Menu } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { Card, DashedCard } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCan } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchPlanExport, saveExport, useCreatePlan, useDeletePlan, usePlans, useSuggestPlan, useUpdatePlan, type FileExport } from "@/lib/api/budget";
import type { BudgetPlan, PacingRow, PlanLine, PlanSuggestResult } from "@/lib/domain/contracts/budget";
import { ChangesDialog, CopyTextModal, MoneyInput, UnsavedBar } from "./budget-ui";
import { FlightingPreview } from "./flighting-preview";
import { FLIGHT_OPTIONS, type FlightPattern } from "./lib/flighting";
import { money, moneyExact } from "./lib/money";
import { monthLabel, monthSeq, monthShort, monthSpan, shiftMonth } from "./lib/months";
import { OBJECTIVE_LABELS } from "./lib/optimizer";
import { applyPlanDraft, currentPlanMonth, defaultPlan, EMPTY_PLAN_DRAFT, isPlanDraftDirty, lineTotal, monthTotals, planBody, planChanges, planDraftCount, withAmount, withFlighting, withMonths, withRemoved, type PlanDraft, } from "./lib/plans";
import { PlanDialog, type PlanFormValues } from "./plan-dialog";
export interface PlanDraftStore {
    drafts: Readonly<Record<string, PlanDraft>>;
    update: (驚壍: string, 杉壍: (蘸壍: PlanDraft) => PlanDraft) => void;
}
const 匧壍: Record<BudgetPlan["status"], "accent" | "muted" | "faint"> = { active: "accent", draft: "muted", archived: "faint" };
const 爖壍: Record<PlanLine["kind"], string> = { campaign: "Campaign", draft_idea: "Draft", plugin_channel: "Other channel" };
export function PlansTab({ rows: 鄅壍, currentMonth: 巴壍, currency: 糣壍, store: 鯒壍 }: {
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    store: PlanDraftStore;
}) {
    const 棁壍 = usePlans();
    const 螰壍 = useCreatePlan();
    const 咟壍 = useCan()("budget.plan");
    const [玎壍, 鉽壍] = useQueryState("plan", parseAsString.withOptions({ history: "replace", scroll: false }));
    const [彬壍, 繛壍] = useState<"new" | null>(null);
    const 鵊壍 = useMemo(() => [...(棁壍.data ?? [])].sort((樹壍, 褨壍) => 樹壍.createdAt.localeCompare(褨壍.createdAt)), [棁壍.data]);
    const 嘗壍 = 鵊壍.find((甆壍) => 甆壍.id === 玎壍) ?? defaultPlan(鵊壍) ?? 鵊壍[0] ?? null;
    const 鏵壍 = monthSeq(巴壍, 13);
    const 惤壍 = (翓壍: PlanFormValues) => 螰壍.mutate({ name: 翓壍.name, months: 翓壍.months, objective: 翓壍.objective, status: "draft", lines: [] }, {
        onSuccess: (黂壍) => {
            繛壍(null);
            void 鉽壍(黂壍.id);
            toast(`Created “${黂壍.name}” from the current daily budgets`);
        },
        onError: (殱壍) => toast((殱壍 as Error).message || "Couldn't create the plan", { tone: "crit" }),
    });
    if (棁壍.error && !棁壍.data)
        return <ErrorState error={棁壍.error} onRetry={() => void 棁壍.refetch()}/>;
    if (!棁壍.data)
        return <Skeleton height={480} className="rounded-card"/>;
    return (<div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" role="group" aria-label="Budget plans">
        {鵊壍.map((誠壍) => {
            const 垏壍 = 嘗壍?.id === 誠壍.id;
            const 百壍 = currentPlanMonth(誠壍, 巴壍);
            return (<button key={誠壍.id} type="button" aria-pressed={垏壍} onClick={() => void 鉽壍(誠壍.id)} className={cn("flex flex-col gap-2 rounded-card border p-4 text-left transition-colors", 垏壍 ? "border-accent bg-teal-t" : "border-line bg-card hover:border-tone/25")}>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-title">{誠壍.name}</span>
                <Pill tone={匧壍[誠壍.status]}>{誠壍.status}</Pill>
              </span>
              <span className="font-mono text-micro tracking-label text-faint uppercase">{`${monthSpan(誠壍.months)} · ${誠壍.lines.length} lines`}</span>
              <span className="text-[13px] text-muted">{`${monthShort(百壍).split(" ")[0]} ${money(monthTotals(誠壍)[百壍] ?? 0, 糣壍)}`}</span>
            </button>);
        })}
        {咟壍 ? (<DashedCard interactive className="flex min-h-[96px] p-0 text-[13px]">
            <button type="button" className="flex size-full items-center justify-center rounded-mini p-4" onClick={() => 繛壍("new")}>
              + New plan
            </button>
          </DashedCard>) : null}
      </div>

      {嘗壍 ? (<Cmp17 key={嘗壍.id} plan={嘗壍} rows={鄅壍} currentMonth={巴壍} currency={糣壍} store={鯒壍} onDeleted={() => void 鉽壍(null)} startOptions={鏵壍} readOnly={!咟壍}/>) : !咟壍 ? (<EmptyState>No budget plans yet.</EmptyState>) : (<EmptyState action={<Button variant="accent" onClick={() => 繛壍("new")}>
              Create a plan
            </Button>}>
          No budget plans yet. Start from the current daily budgets, then let seasonality and the optimizer fill in the months.
        </EmptyState>)}

      <PlanDialog open={彬壍 === "new"} onOpenChange={(镭壍) => 繛壍(镭壍 ? "new" : null)} startOptions={鏵壍} defaultStart={shiftMonth(巴壍, 1)} onSubmit={惤壍} pending={螰壍.isPending}/>
    </div>);
}
function Cmp17({ plan: 腋壍, rows: 为壍, currentMonth: 洩壍, currency: 谘壍, store: 备壍, onDeleted: 矶壍, startOptions: 雥壍, readOnly: 揔壍 }: {
    plan: BudgetPlan;
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    store: PlanDraftStore;
    onDeleted: () => void;
    startOptions: string[];
    readOnly?: boolean;
}) {
    const 苃壍 = useUpdatePlan();
    const 侲壍 = useSuggestPlan();
    const 溡壍 = useDeletePlan();
    const 趐壍 = useWriteAction();
    const 婿壍 = 备壍.drafts[腋壍.id] ?? EMPTY_PLAN_DRAFT;
    const 祮壍 = isPlanDraftDirty(婿壍);
    const 顝壍 = useMemo(() => applyPlanDraft(腋壍, 婿壍), [腋壍, 婿壍]);
    const 敌壍 = useMemo(() => [...顝壍.months].sort(), [顝壍.months]);
    const 萻壍 = currentPlanMonth(腋壍, 洩壍);
    const [優壍, 瀙壍] = useState(萻壍);
    const 輈壍 = 敌壍.includes(優壍) ? 優壍 : 萻壍;
    const [寷壍, 竦壍] = useState<Pick<PlanSuggestResult, "index" | "indexSource" | "warnings"> | null>(null);
    const [駕壍, 曄壍] = useState(false);
    const [薳壍, 劢壍] = useState(false);
    const [熑壍, 邀壍] = useState(false);
    const [嵯壍, 籞壍] = useState<FileExport | null>(null);
    const 魍壍 = (格壍: (蜫壍: PlanDraft) => PlanDraft) => 备壍.update(腋壍.id, 格壍);
    const { changes: 吚壍, skipped: 猉壍 } = useMemo(() => planChanges(腋壍, 萻壍, 为壍), [腋壍, 萻壍, 为壍]);
    const 釸壍 = new Map((寷壍?.index ?? []).map((廧壍) => [廧壍.month, 廧壍.factor]));
    const 緖壍 = monthTotals(顝壍);
    const 鳅壍 = 敌壍.reduce((榴壍, 袣壍) => 榴壍 + (緖壍[袣壍] ?? 0), 0);
    const 喒壍 = (璁壍: BudgetPlan, 鍰壍: string, 恟壍: {
        clearDraft?: boolean;
        undo?: BudgetPlan;
    } = {}) => 苃壍.mutate({ id: 腋壍.id, body: planBody(璁壍), version: 腋壍.version }, {
        onSuccess: (罎壍) => {
            if (恟壍.clearDraft)
                备壍.update(腋壍.id, () => EMPTY_PLAN_DRAFT);
            const 鸽壍 = 恟壍.undo;
            toast(鍰壍, 鸽壍 ? { action: { label: "Undo", onClick: () => 苃壍.mutate({ id: 罎壍.id, body: planBody(鸽壍), version: 罎壍.version }, { onSuccess: () => toast("Plan restored") }) } } : {});
        },
        onError: (欬壍) => toast(欬壍 instanceof ApiError && 欬壍.status === 409 ? "This plan changed elsewhere — reloaded; review your edits and save again" : (欬壍 as Error).message || "Couldn't save the plan", { tone: "crit" }),
    });
    const 訛壍 = () => 喒壍(顝壍, `Saved “${腋壍.name}”`, { clearDraft: true, undo: 腋壍 });
    const 圊壍 = () => 侲壍.mutate({ planId: 腋壍.id, body: {} }, {
        onSuccess: (痹壍) => {
            竦壍({ index: 痹壍.index, indexSource: 痹壍.indexSource, warnings: 痹壍.warnings });
            toast(`Seasonal amounts suggested (${痹壍.indexSource === "history" ? "last year's spend" : "retail preset"})`, { action: { label: "Undo", onClick: () => 苃壍.mutate({ id: 腋壍.id, body: planBody(腋壍), version: 痹壍.plan.version }, { onSuccess: () => toast("Plan restored") }) } });
        },
        onError: (铨壍) => toast((铨壍 as Error).message || "Couldn't suggest amounts", { tone: "crit" }),
    });
    const 懗壍 = async (胆壍: "csv" | "editor" | "changes") => {
        try {
            const 龵壍 = await fetchPlanExport(腋壍.id, 胆壍, 胆壍 === "csv" ? undefined : 輈壍);
            if (胆壍 === "changes")
                籞壍(龵壍);
            else
                saveExport(龵壍);
            if (胆壍 !== "changes" && 龵壍.warnings.length)
                toast(龵壍.warnings.length === 1 ? (龵壍.warnings[0] as string) : `${龵壍.warnings.length} lines aren't in the export (drafts or shared budgets)`, { tone: "warn", ms: 4200 });
        }
        catch (沤壍) {
            toast((沤壍 as Error).message || "Export failed", { tone: "crit" });
        }
    };
    const 讓壍 = async () => {
        await 趐壍.run({ type: "budget.apply_plan", planId: 腋壍.id, budgets: 吚壍.map((墂壍) => ({ campaignId: 墂壍.campaignId, dailyBudget: 墂壍.to })) }, { success: `Applied “${腋壍.name}” for ${monthLabel(萻壍)} · ${吚壍.length} daily budget${吚壍.length === 1 ? "" : "s"}` });
        邀壍(false);
    };
    const 睱壍 = (陠壍: PlanFormValues) => {
        const 捏壍 = withMonths({ ...顝壍, name: 陠壍.name, objective: 陠壍.objective }, 陠壍.months, 为壍);
        喒壍(捏壍, `Saved “${陠壍.name}”`, { clearDraft: true, undo: 腋壍 });
        曄壍(false);
    };
    const 舾壍 = (伭壍: BudgetPlan["status"]) => 喒壍({ ...腋壍, status: 伭壍 }, 伭壍 === "active" ? `“${腋壍.name}” is the active plan` : 伭壍 === "archived" ? `Archived “${腋壍.name}”` : `“${腋壍.name}” moved to drafts`, { undo: 腋壍 });
    const 渜壍: Column<PlanLine>[] = [
        {
            key: "name",
            header: "Line",
            width: "minmax(200px,1.6fr)",
            cell: (贋壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <MiddleTruncate text={贋壍.name} className="font-medium"/>
          <span className={cn("truncate font-mono text-micro tracking-[0.1em] uppercase", 贋壍.kind === "draft_idea" ? "text-accent" : "text-faint")}>
            {[爖壍[贋壍.kind], 贋壍.campaignType, 贋壍.origin === "optimizer" ? "optimized" : null].filter(Boolean).join(" · ")}
          </span>
        </span>),
            total: <span className="font-mono text-micro tracking-label text-faint uppercase">Total</span>,
        },
        {
            key: "flighting",
            header: "Flighting",
            width: "150px",
            cell: (姺壍) => 揔壍 ? (<span className="text-xs text-muted">{FLIGHT_OPTIONS.find((磩壍) => 磩壍.value === 姺壍.flighting.pattern)?.label ?? 姺壍.flighting.pattern}</span>) : (<Select aria-label={`Flighting for ${姺壍.name}`} value={姺壍.flighting.pattern} onChange={(韘壍) => 魍壍((擇壍) => withFlighting(擇壍, 腋壍, 姺壍.id, 韘壍.target.value as FlightPattern))} className={cn("w-full py-1.5 text-xs", 婿壍.flighting[姺壍.id] && "text-accent")} title={FLIGHT_OPTIONS.find((莶壍) => 莶壍.value === 姺壍.flighting.pattern)?.hint}>
            {FLIGHT_OPTIONS.map((傥壍) => (<option key={傥壍.value} value={傥壍.value}>
                {傥壍.label}
              </option>))}
          </Select>),
        },
        ...敌壍.map((澔壍): Column<PlanLine> => ({
            key: 澔壍,
            header: (<span className="flex flex-col items-end gap-0.5">
            <span>{monthShort(澔壍)}</span>
            {釸壍.has(澔壍) ? <span className="text-accent normal-case">{`×${(釸壍.get(澔壍) as number).toFixed(2)}`}</span> : null}
          </span>),
            align: "right",
            width: "112px",
            cell: (躃壍) => 揔壍 ? (<span className="pr-1.5">{moneyExact(躃壍.monthly[澔壍] ?? 0, 谘壍)}</span>) : (<MoneyInput value={躃壍.monthly[澔壍] ?? 0} step={1} currency={谘壍} onCommit={(孲壍) => 魍壍((穡壍) => withAmount(穡壍, 腋壍, 躃壍.id, 澔壍, 孲壍))} ariaLabel={`${躃壍.name}, ${monthLabel(澔壍)}`} edited={婿壍.amounts[躃壍.id]?.[澔壍] !== undefined} className="w-[96px]"/>),
            total: <span className="pr-1.5">{money(緖壍[澔壍] ?? 0, 谘壍)}</span>,
        })),
        { key: "total", header: "Total", align: "right", width: "104px", cell: (饐壍) => <span className="font-semibold">{money(lineTotal(饐壍, 敌壍), 谘壍)}</span>, total: money(鳅壍, 谘壍) },
    ];
    if (!揔壍)
        渜壍.push({
            key: "remove",
            header: <span className="sr-only">Remove</span>,
            width: "36px",
            cell: (昿壍) => (<IconButton label={`Remove ${昿壍.name} from the plan`} onClick={() => 魍壍((蔮壍) => withRemoved(蔮壍, 昿壍.id))} className="border-transparent text-faint">
          ×
        </IconButton>),
        });
    const 初壍 = 祮壍 ? "Save or discard your plan edits first" : null;
    const 焌壍 = 初壍 ?? (!为壍.length ? "Loading campaigns…" : !吚壍.length ? `${monthLabel(萻壍)} budgets already match` : null);
    return (<div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-2.5">
              <span className="font-display text-xl font-semibold tracking-[-0.02em]">{腋壍.name}</span>
              <Pill tone={匧壍[腋壍.status]}>{腋壍.status}</Pill>
            </span>
            <span className="meta">{`${monthSpan(腋壍.months)} · ${腋壍.months.length} month${腋壍.months.length === 1 ? "" : "s"} · optimise for ${OBJECTIVE_LABELS[腋壍.objective].toLowerCase()} · ${腋壍.lines.length} lines`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {揔壍 ? null : (<Button variant="outline" onClick={圊壍} loading={侲壍.isPending} disabled={!!初壍} title={初壍 ?? "Seasonal month totals from last year's spend (or a retail preset), split across campaigns by the optimizer"}>
                Suggest seasonal amounts
              </Button>)}
            <Menu trigger={<Button variant="ghost" disabled={!!初壍}>
                  Export ▾
                </Button>} items={[
            { label: "Plan CSV · all months", onSelect: () => void 懗壍("csv") },
            { label: `Editor budget CSV · ${monthShort(輈壍)}`, onSelect: () => void 懗壍("editor") },
            { label: `Copy change list · ${monthShort(輈壍)}`, onSelect: () => void 懗壍("changes") },
        ]}/>
            <LiveGuard>
              <Button variant="brand" onClick={() => 邀壍(true)} disabled={!!焌壍}>
                {`Apply ${monthShort(萻壍).split(" ")[0]} budgets`}
              </Button>
            </LiveGuard>
            {揔壍 ? null : (<Menu trigger={<IconButton label="Plan actions" size="md">
                    ⋯
                  </IconButton>} items={[
                { label: "Edit name & months…", onSelect: () => 曄壍(true) },
                腋壍.status === "active" ? { label: "Move to drafts", onSelect: () => 舾壍("draft") } : { label: "Make active plan", onSelect: () => 舾壍("active") },
                腋壍.status === "archived" ? { label: "Unarchive", onSelect: () => 舾壍("draft") } : { label: "Archive", onSelect: () => 舾壍("archived") },
                { label: "Delete plan…", onSelect: () => 劢壍(true), danger: true, separatorBefore: true },
            ]}/>)}
          </div>
        </div>
        {焌壍 && !初壍 ? <span className="-mt-2 text-xs text-muted-3">{焌壍}</span> : null}
        {寷壍 ? (<div className="flex flex-col gap-1.5 rounded-mini border border-tone/8 bg-fill px-3.5 py-3 text-xs text-muted-3">
            <span>
              <span className="label-mono mr-2 text-accent">Seasonal index</span>
              {`${寷壍.indexSource === "history" ? "From last year's monthly spend" : "Retail preset (less than 13 months of history)"} · ${寷壍.index.map((迻壍) => `${monthShort(迻壍.month).split(" ")[0]} ×${迻壍.factor.toFixed(2)}`).join(" · ")}`}
            </span>
            {寷壍.warnings.slice(0, 3).map((峪壍) => (<span key={峪壍} className="flex gap-2">
                <span aria-hidden className="text-warn">
                  ▲
                </span>
                {峪壍}
              </span>))}
            {寷壍.warnings.length > 3 ? <span>{`+${寷壍.warnings.length - 3} more extrapolation notes`}</span> : null}
          </div>) : null}
        <DataTable rows={顝壍.lines} columns={渜壍} rowKey={(篙壍) => 篙壍.id} ariaLabel={`${腋壍.name}: amounts by line and month`} minWidth={560 + 敌壍.length * 124} density="compact" rowClassName={(髈壍) => (婿壍.amounts[髈壍.id] || 婿壍.flighting[髈壍.id] ? "bg-teal/4" : undefined)} empty="No lines — every line was removed."/>
        {婿壍.removed.length ? (<div className="flex flex-wrap items-center gap-2 text-xs text-muted-3">
            <span>{`Removing ${婿壍.removed.length} line${婿壍.removed.length === 1 ? "" : "s"}:`}</span>
            {腋壍.lines
                .filter((枷壍) => 婿壍.removed.includes(枷壍.id))
                .map((蚦壍) => (<Button key={蚦壍.id} variant="link" className="text-xs" onClick={() => 魍壍((厕壍) => withRemoved(厕壍, 蚦壍.id, false))}>
                  {`${蚦壍.name} ↻`}
                </Button>))}
          </div>) : null}
      </Card>

      {祮壍 ? <UnsavedBar summary={`${planDraftCount(婿壍)} change${planDraftCount(婿壍) === 1 ? "" : "s"} to “${腋壍.name}” · plan total ${money(鳅壍, 谘壍)}`} onDiscard={() => 备壍.update(腋壍.id, () => EMPTY_PLAN_DRAFT)} onSave={訛壍} saving={苃壍.isPending} saveLabel="Save plan"/> : null}

      <FlightingPreview plan={顝壍} month={輈壍} onMonth={瀙壍} currency={谘壍}/>

      <PlanDialog open={駕壍} onOpenChange={曄壍} plan={顝壍} startOptions={雥壍} defaultStart={敌壍[0] ?? 雥壍[0] ?? 洩壍} onSubmit={睱壍} pending={苃壍.isPending}/>
      <ConfirmDialog open={薳壍} onOpenChange={劢壍} title={`Delete “${腋壍.name}”?`} description="The plan and its lines are removed from this dashboard. Google Ads isn't affected." confirmLabel="Delete plan" danger onConfirm={() => 溡壍.mutate(腋壍.id, {
            onSuccess: () => {
                备壍.update(腋壍.id, () => EMPTY_PLAN_DRAFT);
                矶壍();
                toast(`Deleted “${腋壍.name}”`);
            },
            onError: (犄壍) => toast((犄壍 as Error).message || "Couldn't delete the plan", { tone: "crit" }),
        })}/>
      <ChangesDialog open={熑壍} onOpenChange={邀壍} title={`Apply ${monthLabel(萻壍)} budgets`} description={`Sets each campaign's daily budget to its ${monthLabel(萻壍)} plan amount ÷ the days in the month.`} changes={吚壍} skipped={猉壍} currency={谘壍} confirmLabel={`Apply ${吚壍.length} budget${吚壍.length === 1 ? "" : "s"}`} onConfirm={() => void 讓壍()} pending={趐壍.pending}/>
      <CopyTextModal file={嵯壍} onClose={() => 籞壍(null)} title={`${腋壍.name} · ${monthLabel(輈壍)}`}/>
      {趐壍.dialog}
    </div>);
}
