import "server-only";
import type { ResponseCurve } from "@/lib/domain/contracts/budget";
import {
  SIMULATION_TYPES,
  type CampaignSimulation,
  type EstimateCampaignView,
  type GoogleEstimatesResponse,
  type GoogleRecommendation,
  type RecommendationView,
  type SimulationDayPoint,
  type SimulationType,
  type SimulationView,
} from "@/lib/domain/contracts/estimates";
import { absoluteSimulation, chooseBudgetEstimate, ESTIMATE_POLICY, fitSimulationCurve, isStaleSimulation, perDayPoints, pickSimulation, simulationDays } from "@/lib/domain/budget/google";
import { budgetUnits } from "@/lib/domain/budget/units";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { round } from "@/lib/domain/stats";
import { describeDemoReason } from "@/lib/domain/types";
import { deepLink } from "../campaigns";
import type { RequestContext } from "../context";
import { log } from "../log";
import { loadCampaigns, loadGoogleEstimates } from "./data";
import { fitCurves } from "./service";

// GET /api/budget/google-estimates: Google's campaign simulations and budget recommendations joined with the
// campaigns (names, types, current settings), our model's curve for the same campaign and the source policy's
// decision at the current daily budget. Every read degrades to a warning, so the tab shows whatever it can.

const DEMO_NOTE = "Demo data: these simulations and recommendations are generated from the demo account to behave like Google's. Connect Google Ads to read the real ones.";

function currentSetting(c: CampaignDim, type: SimulationType): number | null {
  if (type === "BUDGET") return c.budget_daily;
  if (type === "TARGET_CPA") return c.target_cpa;
  return c.target_roas;
}

const dayPoint = (p: SimulationDayPoint): SimulationDayPoint => ({
  value: p.value,
  cost: round(p.cost, 2),
  clicks: round(p.clicks, 1),
  impressions: round(p.impressions, 0),
  conversions: round(p.conversions, 3),
  convValue: round(p.convValue, 2),
  requiredBudget: p.requiredBudget === null ? null : round(p.requiredBudget, 2),
});

function simulationView(sim: CampaignSimulation, c: CampaignDim, dataThrough: string): SimulationView {
  return { ...sim, days: simulationDays(sim), perDay: perDayPoints(sim).map(dayPoint), stale: isStaleSimulation(sim, dataThrough), current: currentSetting(c, sim.type) };
}

/** Why our model leads, or why no budget comparison is possible (null when Google's simulator leads). */
function campaignNote(c: CampaignDim, decision: EstimateCampaignView["decision"]): string | null {
  const parts: string[] = [];
  if (c.budget_period === "custom") parts.push("Custom-period budget: budget what-ifs need a daily budget.");
  else if (!c.budget_daily) parts.push("No daily budget: there is nothing to simulate.");
  else if (decision?.lead === "model") parts.push(decision.reason);
  // the decision already explains shared budgets; without one (custom period, no daily budget) say it here
  if (c.budget_shared && !decision) parts.push("Shared budget: the shared budget is planned as a whole, so there's no per-campaign curve.");
  return parts.length ? parts.join(" ") : null;
}

function campaignView(c: CampaignDim, sims: readonly CampaignSimulation[], ctx: RequestContext, objective: ResponseCurve["objective"], modelCurves: ReadonlyMap<string, ResponseCurve>): EstimateCampaignView {
  const views: SimulationView[] = [];
  for (const type of SIMULATION_TYPES) {
    // SCALING target-CPA simulations become absolute targets; without a current target they can't be placed
    const absolute = sims.filter((s) => s.type === type).flatMap((s) => absoluteSimulation(s, currentSetting(c, type)) ?? []);
    const picked = pickSimulation(absolute, c.id, type);
    if (picked) views.push(simulationView(picked, c, ctx.dataThrough));
  }
  const budgetSim = views.find((v) => v.type === "BUDGET") ?? null;
  const modelCurve = c.budget_shared ? null : (modelCurves.get(c.id) ?? null);
  const decision =
    c.budget_daily && c.budget_daily > 0 && c.budget_period === "daily"
      ? chooseBudgetEstimate({ campaign: c, simulation: budgetSim, modelCurve, proposedDaily: c.budget_daily, dataThrough: ctx.dataThrough, objective, currency: ctx.account.currency })
      : null;
  return {
    campaignId: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    biddingStrategy: c.bidding_strategy,
    dailyBudget: c.budget_daily,
    sharedBudget: c.budget_shared,
    targetCpa: c.target_cpa,
    targetRoas: c.target_roas,
    simulations: views,
    note: campaignNote(c, decision),
    modelCurve,
    simulatorCurve: budgetSim ? fitSimulationCurve(c.id, objective, budgetSim) : null,
    decision,
    deepLink: deepLink(ctx.accountId, c.id),
  };
}

const weeklyGain = (r: RecommendationView): number | null => {
  const base = r.impact?.base.conversions;
  const potential = r.impact?.potential.conversions;
  return base === null || base === undefined || potential === null || potential === undefined ? null : potential - base;
};

function recommendationViews(ctx: RequestContext, recs: readonly GoogleRecommendation[], campaigns: readonly CampaignDim[]): RecommendationView[] {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const byBudget = new Map<string, CampaignDim[]>();
  for (const c of campaigns) {
    if (!c.budget_id) continue;
    byBudget.set(c.budget_id, [...(byBudget.get(c.budget_id) ?? []), c]);
  }
  const out: RecommendationView[] = [];
  for (const r of recs) {
    if (r.dismissed) continue;
    const owners = r.budgetId ? (byBudget.get(r.budgetId) ?? []) : [];
    // a budget used by exactly one campaign can be attributed to it when Google lists no campaign
    const campaignId = r.campaignId ?? (owners.length === 1 ? (owners[0] as CampaignDim).id : null);
    const c = campaignId ? byId.get(campaignId) : undefined;
    const liveBudget = c?.budget_daily ?? (owners.find((o) => o.budget_daily !== null)?.budget_daily ?? null);
    out.push({
      ...r,
      campaignId,
      campaignName: c?.name ?? (owners.length > 1 ? `Shared budget · ${owners.map((o) => o.name).join(" + ")}` : null),
      campaignType: c?.type ?? null,
      liveBudget,
      applied: r.recommendedBudget !== null && liveBudget !== null && liveBudget >= r.recommendedBudget - 0.005,
      deepLink: campaignId ? deepLink(ctx.accountId, campaignId) : null,
    });
  }
  return out.sort((a, b) => (weeklyGain(b) ?? -Infinity) - (weeklyGain(a) ?? -Infinity));
}

export async function getGoogleEstimatesView(ctx: RequestContext, q: { objective: ResponseCurve["objective"] }): Promise<GoogleEstimatesResponse> {
  const warnings: string[] = [];
  const [estimates, allCampaigns] = await Promise.all([loadGoogleEstimates(ctx, warnings), loadCampaigns(ctx)]);
  const campaigns = allCampaigns.filter((c) => c.status !== "Removed");
  const singles = budgetUnits(campaigns).filter((u) => u.type !== "Shared" && u.campaignIds.length === 1);
  let modelCurves: ReadonlyMap<string, ResponseCurve> = new Map();
  try {
    modelCurves = (await fitCurves(ctx, singles, q.objective)).curves;
  } catch (err) {
    log.warn("Response curves unavailable for the simulator comparison", { error: err instanceof Error ? err.message : String(err) });
    warnings.push("Our response curves could not be fitted right now; only Google's estimates are shown.");
  }
  const simsByCampaign = new Map<string, CampaignSimulation[]>();
  for (const s of estimates.simulations) simsByCampaign.set(s.campaignId, [...(simsByCampaign.get(s.campaignId) ?? []), s]);

  return {
    mode: ctx.source.mode,
    demo: ctx.source.mode === "demo" ? { reason: describeDemoReason(ctx.source.reason), note: DEMO_NOTE } : null,
    currency: ctx.account.currency,
    dataThrough: ctx.dataThrough,
    objective: q.objective,
    campaigns: campaigns.map((c) => campaignView(c, simsByCampaign.get(c.id) ?? [], ctx, q.objective, modelCurves)),
    recommendations: recommendationViews(ctx, estimates.recommendations, campaigns),
    policy: ESTIMATE_POLICY,
    warnings: [...new Set(warnings)],
  };
}
