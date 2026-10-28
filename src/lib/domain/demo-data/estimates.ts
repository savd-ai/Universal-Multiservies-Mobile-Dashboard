import type { CampaignSimulation, GoogleEstimates, GoogleRecommendation, RecommendationImpact, RecommendationMetrics, SimulationPoint } from "@/lib/domain/contracts/estimates";
import { addDays } from "@/lib/domain/dates";
import { seedRng } from "@/lib/domain/rng";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { clamp, round } from "@/lib/domain/stats";
import type { CivilDate } from "@/lib/domain/types";
import type { DemoDataset } from "./generator";
export const DEMO_SIMULATION_DAYS = 7;
export const BUDGET_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const TARGET_MULTIPLIERS = [0.7, 0.85, 1, 1.15, 1.3, 1.5] as const;
export const RECOMMENDATION_MULTIPLIERS = [1.25, 1.5, 2] as const;
export const BUDGET_LIMITED_SHARE = 0.2;
const SIMULATED_TYPES = new Set<CampaignDim["type"]>(["Search", "Shopping", "Display"]);
const TARGET_SPEND_EXPONENT = 1.5;
interface WindowTotals {
    days: number;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    convValue: number;
    isEligible: number;
    isLostBudget: number;
}
function windowTotals(ds: DemoDataset, campaignId: string, start: CivilDate, end: CivilDate): WindowTotals {
    const w: WindowTotals = { days: DEMO_SIMULATION_DAYS, cost: 0, clicks: 0, impressions: 0, conversions: 0, convValue: 0, isEligible: 0, isLostBudget: 0 };
    for (const r of ds.tables.campaign_daily) {
        if (r.campaign_id !== campaignId || r.date < start || r.date > end)
            continue;
        w.cost += r.cost;
        w.clicks += r.clicks;
        w.impressions += r.impressions;
        w.conversions += r.conversions;
        w.convValue += r.conv_value;
        w.isEligible += r.is_eligible ?? 0;
        w.isLostBudget += r.is_lost_budget ?? 0;
    }
    return w;
}
function lostToBudget(c: CampaignDim, w: WindowTotals): number {
    if (w.isEligible > 0)
        return w.isLostBudget / w.isEligible;
    const utilisation = c.budget_daily ? w.cost / w.days / c.budget_daily : 0;
    return clamp((utilisation - 0.92) * 2.5, 0, 0.3);
}
export function spendElasticity(lostShare: number): number {
    return clamp(0.1 + 2.6 * lostShare, 0.1, 0.85);
}
interface DayShape {
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    aov: number;
}
function pointAt(value: number, base: DayShape, cost: number, b: number, days: number, requiredBudget: number | null): SimulationPoint {
    const ratio = base.cost > 0 ? cost / base.cost : 0;
    const conversions = base.conversions * ratio ** b;
    return {
        value: round(value, 2),
        cost: round(cost * days, 2),
        clicks: Math.round(base.clicks * ratio ** 0.85 * days),
        impressions: Math.round(base.impressions * ratio ** 0.9 * days),
        conversions: round(conversions * days, 2),
        convValue: round(conversions * base.aov * days, 2),
        requiredBudget: requiredBudget === null ? null : round(requiredBudget, 2),
    };
}
function metricsOf(p: SimulationPoint, weekly: number): RecommendationMetrics {
    return { impressions: round(p.impressions * weekly, 0), clicks: round(p.clicks * weekly, 0), cost: round(p.cost * weekly, 2), conversions: round(p.conversions * weekly, 2), convValue: round(p.convValue * weekly, 2), videoViews: null };
}
function budgetRecommendation(c: CampaignDim, sim: CampaignSimulation, lostShare: number, days: number): GoogleRecommendation | null {
    const current = c.budget_daily as number;
    const weekly = 7 / days;
    const at = (m: number) => sim.points.find((p) => Math.abs(p.value - round(current * m, 2)) < 0.005);
    const base = at(1);
    if (!base)
        return null;
    const options = RECOMMENDATION_MULTIPLIERS.flatMap((m) => {
        const p = at(m);
        return p ? [{ budget: p.value, impact: { base: metricsOf(base, weekly), potential: metricsOf(p, weekly) } satisfies RecommendationImpact }] : [];
    });
    if (!options.length)
        return null;
    const wanted = current / (1 - lostShare);
    const pick = options.find((o) => o.budget >= wanted - 0.005) ?? (options[options.length - 1] as (typeof options)[number]);
    return {
        id: `demo-${c.id}-budget`,
        type: "CAMPAIGN_BUDGET",
        campaignId: c.id,
        campaignIds: [c.id],
        budgetId: c.budget_id,
        currentBudget: current,
        recommendedBudget: pick.budget,
        options,
        impact: pick.impact,
        dismissed: false,
    };
}
export function buildDemoEstimates(ds: DemoDataset, opts: {
    seed?: string;
} = {}): GoogleEstimates {
    const seed = opts.seed ?? "savd-demo";
    const end = addDays(ds.anchor, -1);
    const start = addDays(end, -(DEMO_SIMULATION_DAYS - 1));
    const simulations: CampaignSimulation[] = [];
    const recommendations: GoogleRecommendation[] = [];
    const window = { start, end, modification: "UNIFORM" as const };
    for (const c of ds.dims.campaigns.values()) {
        if (c.status === "Removed" || !SIMULATED_TYPES.has(c.type))
            continue;
        const w = windowTotals(ds, c.id, start, end);
        if (w.cost <= 0 || w.clicks <= 0)
            continue;
        const days = w.days;
        const base: DayShape = { cost: w.cost / days, clicks: w.clicks / days, impressions: w.impressions / days, conversions: w.conversions / days, aov: w.conversions > 0 ? w.convValue / w.conversions : 0 };
        const b = 0.55 + 0.25 * seedRng(seed, "google-sim", ds.account.id, c.id, end)();
        if (c.budget_daily && c.budget_daily > 0 && c.budget_period === "daily") {
            const lostShare = lostToBudget(c, w);
            const e = spendElasticity(lostShare);
            const budget = c.budget_daily;
            const points = BUDGET_MULTIPLIERS.map((m) => pointAt(budget * m, base, base.cost * (m < 1 ? m : 1 + (m - 1) * e), b, days, null));
            const sim: CampaignSimulation = { campaignId: c.id, type: "BUDGET", ...window, points };
            simulations.push(sim);
            if (w.isEligible > 0 && lostShare > BUDGET_LIMITED_SHARE) {
                const rec = budgetRecommendation(c, sim, lostShare, days);
                if (rec)
                    recommendations.push(rec);
            }
        }
        if (c.target_cpa && c.target_cpa > 0) {
            const target = c.target_cpa;
            const points = TARGET_MULTIPLIERS.map((t) => {
                const cost = base.cost * t ** TARGET_SPEND_EXPONENT;
                return pointAt(target * t, base, cost, b, days, cost / 0.95);
            });
            simulations.push({ campaignId: c.id, type: "TARGET_CPA", ...window, points });
        }
        if (c.target_roas && c.target_roas > 0) {
            const target = c.target_roas;
            const points = TARGET_MULTIPLIERS.map((t) => {
                const cost = base.cost * t ** -TARGET_SPEND_EXPONENT;
                return pointAt(target * t, base, cost, b, days, cost / 0.95);
            });
            simulations.push({ campaignId: c.id, type: "TARGET_ROAS", ...window, points });
        }
    }
    return { simulations, recommendations, warnings: [] };
}
