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
    update: (planId: string, fn: (d: PlanDraft) => PlanDraft) => void;
}
const STATUS_TONE: Record<BudgetPlan["status"], "accent" | "muted" | "faint"> = { active: "accent", draft: "muted", archived: "faint" };
const KIND_LABEL: Record<PlanLine["kind"], string> = { campaign: "Campaign", draft_idea: "Draft", plugin_channel: "Other channel" };
export function PlansTab({ rows, currentMonth, currency, store }: {
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    store: PlanDraftStore;
}) {
    const plans = usePlans();
    const create = useCreatePlan();
    const canPlan = useCan()("budget.plan");
    const [planParam, setPlanParam] = useQueryState("plan", parseAsString.withOptions({ history: "replace", scroll: false }));
    const [dialog, setDialog] = useState<"new" | null>(null);
    const list = useMemo(() => [...(plans.data ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [plans.data]);
    const selected = list.find((p) => p.id === planParam) ?? defaultPlan(list) ?? list[0] ?? null;
    const startOptions = monthSeq(currentMonth, 13);
    const onCreate = (v: PlanFormValues) => create.mutate({ name: v.name, months: v.months, objective: v.objective, status: "draft", lines: [] }, {
        onSuccess: (p) => {
            setDialog(null);
            void setPlanParam(p.id);
            toast(`Created “${p.name}” from the current daily budgets`);
        },
        onError: (e) => toast((e as Error).message || "Couldn't create the plan", { tone: "crit" }),
    });
    if (plans.error && !plans.data)
        return <ErrorState error={plans.error} onRetry={() => void plans.refetch()}/>;
    if (!plans.data)
        return <Skeleton height={480} className="rounded-card"/>;
    return (<div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" role="group" aria-label="Budget plans">
        {list.map((p) => {
            const on = selected?.id === p.id;
            const m = currentPlanMonth(p, currentMonth);
            return (<button key={p.id} type="button" aria-pressed={on} onClick={() => void setPlanParam(p.id)} className={cn("flex flex-col gap-2 rounded-card border p-4 text-left transition-colors", on ? "border-accent bg-teal-t" : "border-line bg-card hover:border-tone/25")}>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-title">{p.name}</span>
                <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
              </span>
              <span className="font-mono text-micro tracking-label text-faint uppercase">{`${monthSpan(p.months)} · ${p.lines.length} lines`}</span>
              <span className="text-[13px] text-muted">{`${monthShort(m).split(" ")[0]} ${money(monthTotals(p)[m] ?? 0, currency)}`}</span>
            </button>);
        })}
        {canPlan ? (<DashedCard interactive className="flex min-h-[96px] p-0 text-[13px]">
            <button type="button" className="flex size-full items-center justify-center rounded-mini p-4" onClick={() => setDialog("new")}>
              + New plan
            </button>
          </DashedCard>) : null}
      </div>

      {selected ? (<PlanEditor key={selected.id} plan={selected} rows={rows} currentMonth={currentMonth} currency={currency} store={store} onDeleted={() => void setPlanParam(null)} startOptions={startOptions} readOnly={!canPlan}/>) : !canPlan ? (<EmptyState>No budget plans yet.</EmptyState>) : (<EmptyState action={<Button variant="accent" onClick={() => setDialog("new")}>
              Create a plan
            </Button>}>
          No budget plans yet. Start from the current daily budgets, then let seasonality and the optimizer fill in the months.
        </EmptyState>)}

      <PlanDialog open={dialog === "new"} onOpenChange={(o) => setDialog(o ? "new" : null)} startOptions={startOptions} defaultStart={shiftMonth(currentMonth, 1)} onSubmit={onCreate} pending={create.isPending}/>
    </div>);
}
function PlanEditor({ plan, rows, currentMonth, currency, store, onDeleted, startOptions, readOnly }: {
    plan: BudgetPlan;
    rows: readonly PacingRow[];
    currentMonth: string;
    currency: string;
    store: PlanDraftStore;
    onDeleted: () => void;
    startOptions: string[];
    readOnly?: boolean;
}) {
    const update = useUpdatePlan();
    const suggest = useSuggestPlan();
    const remove = useDeletePlan();
    const write = useWriteAction();
    const draft = store.drafts[plan.id] ?? EMPTY_PLAN_DRAFT;
    const dirty = isPlanDraftDirty(draft);
    const view = useMemo(() => applyPlanDraft(plan, draft), [plan, draft]);
    const months = useMemo(() => [...view.months].sort(), [view.months]);
    const applyMonth = currentPlanMonth(plan, currentMonth);
    const [previewMonth, setPreviewMonth] = useState(applyMonth);
    const shownMonth = months.includes(previewMonth) ? previewMonth : applyMonth;
    const [info, setInfo] = useState<Pick<PlanSuggestResult, "index" | "indexSource" | "warnings"> | null>(null);
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmApply, setConfirmApply] = useState(false);
    const [changeList, setChangeList] = useState<FileExport | null>(null);
    const edit = (fn: (d: PlanDraft) => PlanDraft) => store.update(plan.id, fn);
    const { changes, skipped } = useMemo(() => planChanges(plan, applyMonth, rows), [plan, applyMonth, rows]);
    const factors = new Map((info?.index ?? []).map((i) => [i.month, i.factor]));
    const totals = monthTotals(view);
    const grand = months.reduce((s, m) => s + (totals[m] ?? 0), 0);
    const put = (next: BudgetPlan, message: string, opts: {
        clearDraft?: boolean;
        undo?: BudgetPlan;
    } = {}) => update.mutate({ id: plan.id, body: planBody(next), version: plan.version }, {
        onSuccess: (saved) => {
            if (opts.clearDraft)
                store.update(plan.id, () => EMPTY_PLAN_DRAFT);
            const undo = opts.undo;
            toast(message, undo ? { action: { label: "Undo", onClick: () => update.mutate({ id: saved.id, body: planBody(undo), version: saved.version }, { onSuccess: () => toast("Plan restored") }) } } : {});
        },
        onError: (e) => toast(e instanceof ApiError && e.status === 409 ? "This plan changed elsewhere — reloaded; review your edits and save again" : (e as Error).message || "Couldn't save the plan", { tone: "crit" }),
    });
    const save = () => put(view, `Saved “${plan.name}”`, { clearDraft: true, undo: plan });
    const runSuggest = () => suggest.mutate({ planId: plan.id, body: {} }, {
        onSuccess: (res) => {
            setInfo({ index: res.index, indexSource: res.indexSource, warnings: res.warnings });
            toast(`Seasonal amounts suggested (${res.indexSource === "history" ? "last year's spend" : "retail preset"})`, { action: { label: "Undo", onClick: () => update.mutate({ id: plan.id, body: planBody(plan), version: res.plan.version }, { onSuccess: () => toast("Plan restored") }) } });
        },
        onError: (e) => toast((e as Error).message || "Couldn't suggest amounts", { tone: "crit" }),
    });
    const exportFile = async (format: "csv" | "editor" | "changes") => {
        try {
            const file = await fetchPlanExport(plan.id, format, format === "csv" ? undefined : shownMonth);
            if (format === "changes")
                setChangeList(file);
            else
                saveExport(file);
            if (format !== "changes" && file.warnings.length)
                toast(file.warnings.length === 1 ? (file.warnings[0] as string) : `${file.warnings.length} lines aren't in the export (drafts or shared budgets)`, { tone: "warn", ms: 4200 });
        }
        catch (e) {
            toast((e as Error).message || "Export failed", { tone: "crit" });
        }
    };
    const apply = async () => {
        await write.run({ type: "budget.apply_plan", planId: plan.id, budgets: changes.map((c) => ({ campaignId: c.campaignId, dailyBudget: c.to })) }, { success: `Applied “${plan.name}” for ${monthLabel(applyMonth)} · ${changes.length} daily budget${changes.length === 1 ? "" : "s"}` });
        setConfirmApply(false);
    };
    const onEditSubmit = (v: PlanFormValues) => {
        const next = withMonths({ ...view, name: v.name, objective: v.objective }, v.months, rows);
        put(next, `Saved “${v.name}”`, { clearDraft: true, undo: plan });
        setEditing(false);
    };
    const setStatus = (status: BudgetPlan["status"]) => put({ ...plan, status }, status === "active" ? `“${plan.name}” is the active plan` : status === "archived" ? `Archived “${plan.name}”` : `“${plan.name}” moved to drafts`, { undo: plan });
    const columns: Column<PlanLine>[] = [
        {
            key: "name",
            header: "Line",
            width: "minmax(200px,1.6fr)",
            cell: (l) => (<span className="flex min-w-0 flex-col gap-0.5">
          <MiddleTruncate text={l.name} className="font-medium"/>
          <span className={cn("truncate font-mono text-micro tracking-[0.1em] uppercase", l.kind === "draft_idea" ? "text-accent" : "text-faint")}>
            {[KIND_LABEL[l.kind], l.campaignType, l.origin === "optimizer" ? "optimized" : null].filter(Boolean).join(" · ")}
          </span>
        </span>),
            total: <span className="font-mono text-micro tracking-label text-faint uppercase">Total</span>,
        },
        {
            key: "flighting",
            header: "Flighting",
            width: "150px",
            cell: (l) => readOnly ? (<span className="text-xs text-muted">{FLIGHT_OPTIONS.find((o) => o.value === l.flighting.pattern)?.label ?? l.flighting.pattern}</span>) : (<Select aria-label={`Flighting for ${l.name}`} value={l.flighting.pattern} onChange={(e) => edit((d) => withFlighting(d, plan, l.id, e.target.value as FlightPattern))} className={cn("w-full py-1.5 text-xs", draft.flighting[l.id] && "text-accent")} title={FLIGHT_OPTIONS.find((o) => o.value === l.flighting.pattern)?.hint}>
            {FLIGHT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>
                {o.label}
              </option>))}
          </Select>),
        },
        ...months.map((m): Column<PlanLine> => ({
            key: m,
            header: (<span className="flex flex-col items-end gap-0.5">
            <span>{monthShort(m)}</span>
            {factors.has(m) ? <span className="text-accent normal-case">{`×${(factors.get(m) as number).toFixed(2)}`}</span> : null}
          </span>),
            align: "right",
            width: "112px",
            cell: (l) => readOnly ? (<span className="pr-1.5">{moneyExact(l.monthly[m] ?? 0, currency)}</span>) : (<MoneyInput value={l.monthly[m] ?? 0} step={1} currency={currency} onCommit={(v) => edit((d) => withAmount(d, plan, l.id, m, v))} ariaLabel={`${l.name}, ${monthLabel(m)}`} edited={draft.amounts[l.id]?.[m] !== undefined} className="w-[96px]"/>),
            total: <span className="pr-1.5">{money(totals[m] ?? 0, currency)}</span>,
        })),
        { key: "total", header: "Total", align: "right", width: "104px", cell: (l) => <span className="font-semibold">{money(lineTotal(l, months), currency)}</span>, total: money(grand, currency) },
    ];
    if (!readOnly)
        columns.push({
            key: "remove",
            header: <span className="sr-only">Remove</span>,
            width: "36px",
            cell: (l) => (<IconButton label={`Remove ${l.name} from the plan`} onClick={() => edit((d) => withRemoved(d, l.id))} className="border-transparent text-faint">
          ×
        </IconButton>),
        });
    const blocked = dirty ? "Save or discard your plan edits first" : null;
    const applyBlocked = blocked ?? (!rows.length ? "Loading campaigns…" : !changes.length ? `${monthLabel(applyMonth)} budgets already match` : null);
    return (<div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-2.5">
              <span className="font-display text-xl font-semibold tracking-[-0.02em]">{plan.name}</span>
              <Pill tone={STATUS_TONE[plan.status]}>{plan.status}</Pill>
            </span>
            <span className="meta">{`${monthSpan(plan.months)} · ${plan.months.length} month${plan.months.length === 1 ? "" : "s"} · optimise for ${OBJECTIVE_LABELS[plan.objective].toLowerCase()} · ${plan.lines.length} lines`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {readOnly ? null : (<Button variant="outline" onClick={runSuggest} loading={suggest.isPending} disabled={!!blocked} title={blocked ?? "Seasonal month totals from last year's spend (or a retail preset), split across campaigns by the optimizer"}>
                Suggest seasonal amounts
              </Button>)}
            <Menu trigger={<Button variant="ghost" disabled={!!blocked}>
                  Export ▾
                </Button>} items={[
            { label: "Plan CSV · all months", onSelect: () => void exportFile("csv") },
            { label: `Editor budget CSV · ${monthShort(shownMonth)}`, onSelect: () => void exportFile("editor") },
            { label: `Copy change list · ${monthShort(shownMonth)}`, onSelect: () => void exportFile("changes") },
        ]}/>
            <LiveGuard>
              <Button variant="brand" onClick={() => setConfirmApply(true)} disabled={!!applyBlocked}>
                {`Apply ${monthShort(applyMonth).split(" ")[0]} budgets`}
              </Button>
            </LiveGuard>
            {readOnly ? null : (<Menu trigger={<IconButton label="Plan actions" size="md">
                    ⋯
                  </IconButton>} items={[
                { label: "Edit name & months…", onSelect: () => setEditing(true) },
                plan.status === "active" ? { label: "Move to drafts", onSelect: () => setStatus("draft") } : { label: "Make active plan", onSelect: () => setStatus("active") },
                plan.status === "archived" ? { label: "Unarchive", onSelect: () => setStatus("draft") } : { label: "Archive", onSelect: () => setStatus("archived") },
                { label: "Delete plan…", onSelect: () => setConfirmDelete(true), danger: true, separatorBefore: true },
            ]}/>)}
          </div>
        </div>
        {applyBlocked && !blocked ? <span className="-mt-2 text-xs text-muted-3">{applyBlocked}</span> : null}
        {info ? (<div className="flex flex-col gap-1.5 rounded-mini border border-tone/8 bg-fill px-3.5 py-3 text-xs text-muted-3">
            <span>
              <span className="label-mono mr-2 text-accent">Seasonal index</span>
              {`${info.indexSource === "history" ? "From last year's monthly spend" : "Retail preset (less than 13 months of history)"} · ${info.index.map((i) => `${monthShort(i.month).split(" ")[0]} ×${i.factor.toFixed(2)}`).join(" · ")}`}
            </span>
            {info.warnings.slice(0, 3).map((w) => (<span key={w} className="flex gap-2">
                <span aria-hidden className="text-warn">
                  ▲
                </span>
                {w}
              </span>))}
            {info.warnings.length > 3 ? <span>{`+${info.warnings.length - 3} more extrapolation notes`}</span> : null}
          </div>) : null}
        <DataTable rows={view.lines} columns={columns} rowKey={(l) => l.id} ariaLabel={`${plan.name}: amounts by line and month`} minWidth={560 + months.length * 124} density="compact" rowClassName={(l) => (draft.amounts[l.id] || draft.flighting[l.id] ? "bg-teal/4" : undefined)} empty="No lines — every line was removed."/>
        {draft.removed.length ? (<div className="flex flex-wrap items-center gap-2 text-xs text-muted-3">
            <span>{`Removing ${draft.removed.length} line${draft.removed.length === 1 ? "" : "s"}:`}</span>
            {plan.lines
                .filter((l) => draft.removed.includes(l.id))
                .map((l) => (<Button key={l.id} variant="link" className="text-xs" onClick={() => edit((d) => withRemoved(d, l.id, false))}>
                  {`${l.name} ↻`}
                </Button>))}
          </div>) : null}
      </Card>

      {dirty ? <UnsavedBar summary={`${planDraftCount(draft)} change${planDraftCount(draft) === 1 ? "" : "s"} to “${plan.name}” · plan total ${money(grand, currency)}`} onDiscard={() => store.update(plan.id, () => EMPTY_PLAN_DRAFT)} onSave={save} saving={update.isPending} saveLabel="Save plan"/> : null}

      <FlightingPreview plan={view} month={shownMonth} onMonth={setPreviewMonth} currency={currency}/>

      <PlanDialog open={editing} onOpenChange={setEditing} plan={view} startOptions={startOptions} defaultStart={months[0] ?? startOptions[0] ?? currentMonth} onSubmit={onEditSubmit} pending={update.isPending}/>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete “${plan.name}”?`} description="The plan and its lines are removed from this dashboard. Google Ads isn't affected." confirmLabel="Delete plan" danger onConfirm={() => remove.mutate(plan.id, {
            onSuccess: () => {
                store.update(plan.id, () => EMPTY_PLAN_DRAFT);
                onDeleted();
                toast(`Deleted “${plan.name}”`);
            },
            onError: (e) => toast((e as Error).message || "Couldn't delete the plan", { tone: "crit" }),
        })}/>
      <ChangesDialog open={confirmApply} onOpenChange={setConfirmApply} title={`Apply ${monthLabel(applyMonth)} budgets`} description={`Sets each campaign's daily budget to its ${monthLabel(applyMonth)} plan amount ÷ the days in the month.`} changes={changes} skipped={skipped} currency={currency} confirmLabel={`Apply ${changes.length} budget${changes.length === 1 ? "" : "s"}`} onConfirm={() => void apply()} pending={write.pending}/>
      <CopyTextModal file={changeList} onClose={() => setChangeList(null)} title={`${plan.name} · ${monthLabel(shownMonth)}`}/>
      {write.dialog}
    </div>);
}
