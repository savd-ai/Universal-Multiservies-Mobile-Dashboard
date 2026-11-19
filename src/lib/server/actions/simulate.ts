import "server-only";
import type { SimulateRequest, SimulatedAction, SimulateResponse } from "@/lib/domain/contracts/actions";
import { monthDays } from "@/lib/domain/budget/plans";
import { monthKey } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/metrics/registry";
import type { EntityDims } from "@/lib/domain/schema/facts";
import { round } from "@/lib/domain/stats";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { invalidateQueryCache } from "../query/service";
import { audit, getStore } from "../store";
import { readOnlyAlternatives } from "./alternatives";

// Management actions. Google Ads access is READ-ONLY: in demo mode an action is simulated — a persisted overlay
// that the demo source applies to the campaign dimensions, an audit entry and a revert — and in live mode the
// request is refused with READ_ONLY_LIVE plus alternatives (deep links, change list, Editor CSV).

type BudgetChange = { campaignId: string; dailyBudget: number };

function targetsOf(req: SimulateRequest): string[] {
  switch (req.type) {
    case "campaign.pause":
    case "campaign.enable":
      return [...new Set(req.campaignIds)];
    case "campaign.set_budget":
    case "budget.apply_plan":
      return [...new Set(req.budgets.map((b) => b.campaignId))];
    case "keywords.add_negatives":
      return [...new Set(req.negatives.map((n) => n.campaignId))];
  }
}

async function planBudgets(ctx: RequestContext, planId: string, dims: EntityDims): Promise<{ name: string; budgets: BudgetChange[] }> {
  const plan = await getStore().budgetPlans.get(planId);
  if (!plan || (plan.accountId && plan.accountId !== ctx.accountId)) throw notFound("Budget plan");
  const month = plan.months.find((m) => m >= monthKey(ctx.dataThrough)) ?? plan.months[plan.months.length - 1] ?? monthKey(ctx.dataThrough);
  const budgets = plan.lines
    .filter((l) => l.kind === "campaign" && dims.campaigns.has(l.refId) && (l.monthly[month] ?? 0) > 0)
    .map((l) => ({ campaignId: l.refId, dailyBudget: round((l.monthly[month] ?? 0) / monthDays(month), 2) }));
  return { name: plan.name, budgets };
}

export async function simulateAction(ctx: RequestContext, input: SimulateRequest): Promise<SimulateResponse> {
  const dims = await ctx.source.getDims(ctx.accountId);
  if (ctx.source.mode === "live") {
    throw new AppError("READ_ONLY_LIVE", "This dashboard is read-only for Google Ads", readOnlyAlternatives(ctx.accountId, dims.campaigns, input, ctx.account.currency, dims.adGroups));
  }
  let req = input;
  let planName: string | null = null;
  if (req.type === "budget.apply_plan") {
    const fromPlan = await planBudgets(ctx, req.planId, dims);
    planName = fromPlan.name;
    if (!req.budgets.length) req = { ...req, budgets: fromPlan.budgets };
    if (!req.budgets.length) throw new AppError("VALIDATION_ERROR", "The plan has no campaign budgets for the current month");
  }
  const targets = targetsOf(req);
  const unknown = targets.filter((id) => !dims.campaigns.has(id));
  if (unknown.length) throw new AppError("VALIDATION_ERROR", `Unknown campaign ${unknown.slice(0, 5).join(", ")}`);

  const name = (id: string) => dims.campaigns.get(id)?.name ?? id;
  const money = (v: number) => formatMoney(v, { currency: ctx.account.currency, compact: false });
  let summary: string;
  let before: unknown;
  let after: unknown;
  switch (req.type) {
    case "campaign.pause":
    case "campaign.enable": {
      const status = req.type === "campaign.pause" ? "Paused" : "Enabled";
      before = { statuses: Object.fromEntries(targets.map((id) => [id, dims.campaigns.get(id)?.status ?? null])) };
      after = { statuses: Object.fromEntries(targets.map((id) => [id, status])) };
      summary = targets.length === 1 ? `${status === "Paused" ? "Paused" : "Enabled"} '${name(targets[0] as string)}'` : `${status === "Paused" ? "Paused" : "Enabled"} ${targets.length} campaigns`;
      break;
    }
    case "campaign.set_budget":
    case "budget.apply_plan": {
      const budgets = req.budgets.map((b) => ({ campaignId: b.campaignId, dailyBudget: round(b.dailyBudget, 2) }));
      before = { budgets: budgets.map((b) => ({ campaignId: b.campaignId, dailyBudget: dims.campaigns.get(b.campaignId)?.budget_daily ?? null })) };
      after = { budgets };
      const first = budgets[0] as BudgetChange;
      const prev = dims.campaigns.get(first.campaignId)?.budget_daily;
      summary =
        req.type === "budget.apply_plan"
          ? `Applied plan “${planName ?? req.planId}” (${budgets.length} daily budget${budgets.length === 1 ? "" : "s"})`
          : budgets.length === 1
            ? `Set daily budget of '${name(first.campaignId)}' to ${money(first.dailyBudget)}${prev ? ` (was ${money(prev)})` : ""}`
            : `Set daily budgets of ${budgets.length} campaigns`;
      break;
    }
    case "keywords.add_negatives": {
      before = null;
      after = { negatives: req.negatives };
      const n = req.negatives.length;
      summary = `Added ${n} negative keyword${n === 1 ? "" : "s"} to ${targets.length === 1 ? `'${name(targets[0] as string)}'` : `${targets.length} campaigns`}`;
      break;
    }
  }

  const action = await getStore().simulatedActions.create({ accountId: ctx.accountId, type: req.type, targets, summary, before, after });
  await audit({ actor: "user", action: `simulate.${req.type}`, target: targets.join(",").slice(0, 400), mode: "demo", summary: `${summary} (simulated)`, details: { actionId: action.id, accountId: ctx.accountId } });
  invalidateQueryCache();
  return { action, simulated: true, message: "Simulated in demo mode — Google Ads was not changed." };
}

export async function listActions(ctx: RequestContext): Promise<SimulatedAction[]> {
  const all = await getStore().simulatedActions.list((a) => a.accountId === ctx.accountId);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Revert a simulated action (idempotent): the overlay stops applying and an audit entry is written. */
export async function revertAction(ctx: RequestContext, id: string): Promise<{ action: SimulatedAction; alreadyReverted: boolean }> {
  const store = getStore();
  const existing = await store.simulatedActions.get(id);
  if (!existing || existing.accountId !== ctx.accountId) throw notFound("Simulated action");
  if (existing.revertedAt) return { action: existing, alreadyReverted: true };
  const action = await store.simulatedActions.update(id, { revertedAt: now().toISOString() });
  await audit({ actor: "user", action: "simulate.revert", target: id, mode: "demo", summary: `Reverted: ${existing.summary}`, details: { actionId: id, accountId: ctx.accountId, type: existing.type } });
  invalidateQueryCache();
  return { action, alreadyReverted: false };
}
