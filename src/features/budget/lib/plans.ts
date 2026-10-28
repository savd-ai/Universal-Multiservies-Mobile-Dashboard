import type { BudgetPlan, BudgetPlanBody, PacingRow, PlanLine } from "@/lib/domain/contracts/budget";
import type { FlightPattern } from "./flighting";
import { dailyFromMonthly } from "./money";
import { monthDays } from "./months";
import type { BudgetChange, SkippedChange } from "./pacing";
export interface PlanDraft {
    amounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
    flighting: Readonly<Record<string, FlightPattern>>;
    removed: readonly string[];
}
export const EMPTY_PLAN_DRAFT: PlanDraft = { amounts: {}, flighting: {}, removed: [] };
const EPS = 0.005;
export function planDraftCount(d: PlanDraft | null | undefined): number {
    if (!d)
        return 0;
    const amounts = Object.values(d.amounts).reduce((s, m) => s + Object.keys(m).length, 0);
    return amounts + Object.keys(d.flighting).length + d.removed.length;
}
export const isPlanDraftDirty = (d: PlanDraft | null | undefined) => planDraftCount(d) > 0;
export function withAmount(d: PlanDraft, plan: BudgetPlan, lineId: string, month: string, value: number): PlanDraft {
    const saved = plan.lines.find((l) => l.id === lineId)?.monthly[month] ?? 0;
    const line = { ...(d.amounts[lineId] ?? {}) };
    if (Math.abs(value - saved) < EPS)
        delete line[month];
    else
        line[month] = value;
    const amounts = { ...d.amounts };
    if (Object.keys(line).length)
        amounts[lineId] = line;
    else
        delete amounts[lineId];
    return { ...d, amounts };
}
export function withFlighting(d: PlanDraft, plan: BudgetPlan, lineId: string, pattern: FlightPattern): PlanDraft {
    const saved = plan.lines.find((l) => l.id === lineId)?.flighting.pattern ?? "even";
    const flighting = { ...d.flighting };
    if (pattern === saved)
        delete flighting[lineId];
    else
        flighting[lineId] = pattern;
    return { ...d, flighting };
}
export function withRemoved(d: PlanDraft, lineId: string, removed = true): PlanDraft {
    const value = new Set(d.removed);
    if (removed)
        value.add(lineId);
    else
        value.delete(lineId);
    return { ...d, removed: [...value] };
}
export function applyPlanDraft(plan: BudgetPlan, d: PlanDraft | null | undefined): BudgetPlan {
    if (!d || !isPlanDraftDirty(d))
        return plan;
    const removed = new Set(d.removed);
    const lines = plan.lines
        .filter((l) => !removed.has(l.id))
        .map((l) => {
        const amounts = d.amounts[l.id];
        const pattern = d.flighting[l.id];
        if (!amounts && !pattern)
            return l;
        return { ...l, monthly: { ...l.monthly, ...(amounts ?? {}) }, flighting: pattern ? { pattern } : l.flighting, origin: amounts ? ("manual" as const) : l.origin };
    });
    return { ...plan, lines };
}
export function planBody(plan: BudgetPlan): BudgetPlanBody {
    return { name: plan.name, accountId: plan.accountId, months: plan.months, objective: plan.objective, status: plan.status, lines: plan.lines };
}
export function lineTotal(line: Pick<PlanLine, "monthly">, months: readonly string[]): number {
    return Math.round(months.reduce((s, m) => s + (line.monthly[m] ?? 0), 0) * 100) / 100;
}
export function monthTotals(plan: Pick<BudgetPlan, "lines" | "months">): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of plan.months)
        out[m] = Math.round(plan.lines.reduce((s, l) => s + (l.monthly[m] ?? 0), 0) * 100) / 100;
    return out;
}
export function defaultPlan(plans: readonly BudgetPlan[]): BudgetPlan | null {
    const live = plans.filter((p) => p.status !== "archived");
    const rank = (p: BudgetPlan) => (p.status === "active" ? 0 : 1);
    return [...live].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
export function currentPlanMonth(plan: Pick<BudgetPlan, "months">, currentMonth: string): string {
    const sorted = [...plan.months].sort();
    return sorted.find((m) => m >= currentMonth) ?? sorted[sorted.length - 1] ?? currentMonth;
}
export function withMonths(plan: BudgetPlan, months: readonly string[], rows: readonly Pick<PacingRow, "unitId" | "dailyBudget">[]): BudgetPlan {
    const sorted = [...new Set(months)].sort();
    const daily = new Map(rows.map((r) => [r.unitId, r.dailyBudget ?? 0]));
    const lines = plan.lines.map((l) => {
        const monthly: Record<string, number> = {};
        const known = plan.months.filter((m) => (l.monthly[m] ?? 0) > 0);
        const avgDaily = known.length ? known.reduce((s, m) => s + (l.monthly[m] ?? 0) / monthDays(m), 0) / known.length : 0;
        for (const m of sorted) {
            const existing = l.monthly[m];
            if (existing !== undefined && plan.months.includes(m))
                monthly[m] = existing;
            else {
                const perDay = l.kind === "campaign" ? (daily.get(l.refId) ?? avgDaily) : avgDaily;
                monthly[m] = Math.round(perDay * monthDays(m) * 100) / 100;
            }
        }
        return { ...l, monthly };
    });
    return { ...plan, months: sorted, lines };
}
export function planChanges(plan: Pick<BudgetPlan, "lines">, month: string, rows: readonly PacingRow[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const units = new Map(rows.map((r) => [r.unitId, r]));
    const changes: BudgetChange[] = [];
    const skipped: SkippedChange[] = [];
    const days = monthDays(month);
    for (const l of plan.lines) {
        if (l.kind !== "campaign") {
            skipped.push({ name: l.name, reason: l.kind === "draft_idea" ? "Draft — create the campaign first" : "Other channel" });
            continue;
        }
        const u = units.get(l.refId);
        const amount = l.monthly[month] ?? 0;
        if (!u || u.type === "Shared" || u.campaignIds.length !== 1)
            skipped.push({ name: l.name, reason: u ? "Shared budget — edit it in Google Ads (Shared library)" : "Campaign not found" });
        else if (u.paused)
            skipped.push({ name: l.name, reason: "Paused" });
        else if (amount <= 0)
            skipped.push({ name: l.name, reason: "No amount this month" });
        else {
            const to = dailyFromMonthly(amount, days);
            if (u.dailyBudget !== null && Math.abs(to - u.dailyBudget) < 0.01)
                skipped.push({ name: l.name, reason: "Already at this budget" });
            else
                changes.push({ unitId: u.unitId, campaignId: u.campaignIds[0] as string, name: l.name, from: u.dailyBudget, to });
        }
    }
    return { changes, skipped };
}
