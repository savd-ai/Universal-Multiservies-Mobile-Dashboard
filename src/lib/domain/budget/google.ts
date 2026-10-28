import type { ResponseCurve } from "../contracts/budget";
import type { BudgetEstimateDecision, CampaignSimulation, EstimatePolicyRow, EstimateSource, SimulationDayPoint, SimulationModification, SimulationType } from "../contracts/estimates";
import { diffDays, formatShort } from "../dates";
import { formatMoney } from "../metrics/registry";
import { clamp, mean, median, ols, round } from "../stats";
import type { CampaignType, CivilDate } from "../types";
import { B_MAX, B_MIN, curveOutcome } from "./curves";
export const STALE_AFTER_DAYS = 14;
export const RANGE_TOLERANCE = 0.05;
export const AGREEMENT_BAND = 0.1;
const SIM_B_MIN = 0.05;
const SIM_B_MAX = 1;
const SIM_METRICS = ["cost", "clicks", "impressions", "conversions", "convValue"] as const;
export const SIMULATION_LABELS: Record<SimulationType, string> = { BUDGET: "Budget", TARGET_CPA: "Target CPA", TARGET_ROAS: "Target ROAS" };
export const outcomeOf = (p: Pick<SimulationDayPoint, "conversions" | "convValue">, objective: ResponseCurve["objective"]): number => (objective === "conversions" ? p.conversions : p.convValue);
export function simulationDays(sim: Pick<CampaignSimulation, "start" | "end">): number {
    const d = diffDays(sim.start, sim.end) + 1;
    return Number.isFinite(d) && d > 0 ? d : 1;
}
export function perDayPoints(sim: Pick<CampaignSimulation, "start" | "end" | "points">): SimulationDayPoint[] {
    const days = simulationDays(sim);
    const seen = new Set<number>();
    const out: SimulationDayPoint[] = [];
    for (const p of [...sim.points].sort((a, b) => a.value - b.value)) {
        if (!Number.isFinite(p.value) || p.value <= 0 || seen.has(p.value))
            continue;
        seen.add(p.value);
        out.push({ value: p.value, cost: p.cost / days, clicks: p.clicks / days, impressions: p.impressions / days, conversions: p.conversions / days, convValue: p.convValue / days, requiredBudget: p.requiredBudget });
    }
    return out;
}
export function simulatedRange(points: readonly SimulationDayPoint[]): [
    number,
    number
] | null {
    const first = points[0];
    const last = points[points.length - 1];
    return first && last ? [first.value, last.value] : null;
}
export function interpolatePoints(points: readonly SimulationDayPoint[], value: number, tolerance = RANGE_TOLERANCE): SimulationDayPoint | null {
    const range = simulatedRange(points);
    if (!range || !Number.isFinite(value) || value <= 0)
        return null;
    if (value < range[0] * (1 - tolerance) - 1e-9 || value > range[1] * (1 + tolerance) + 1e-9)
        return null;
    if (points.length === 1)
        return { ...(points[0] as SimulationDayPoint), value };
    let i = 0;
    while (i < points.length - 2 && value > (points[i + 1] as SimulationDayPoint).value)
        i++;
    const a = points[i] as SimulationDayPoint;
    const b = points[i + 1] as SimulationDayPoint;
    const t = (value - a.value) / (b.value - a.value);
    const lerp = (x: number, y: number) => Math.max(0, x + (y - x) * t);
    const out = { value, requiredBudget: a.requiredBudget !== null && b.requiredBudget !== null ? lerp(a.requiredBudget, b.requiredBudget) : null } as SimulationDayPoint;
    for (const m of SIM_METRICS)
        out[m] = lerp(a[m], b[m]);
    return out;
}
export function interpolateSimulation(sim: CampaignSimulation, value: number, tolerance = RANGE_TOLERANCE): SimulationDayPoint | null {
    return interpolatePoints(perDayPoints(sim), value, tolerance);
}
export function fitSimulationCurve(campaignId: string, objective: ResponseCurve["objective"], sim: CampaignSimulation): ResponseCurve | null {
    const pts = perDayPoints(sim).filter((p) => p.cost > 0 && outcomeOf(p, objective) > 0);
    const n = pts.length;
    if (n < 2)
        return null;
    const costs = pts.map((p) => p.cost);
    const lo = Math.min(...costs);
    const hi = Math.max(...costs);
    const spread = hi / lo;
    if (spread < 1.02)
        return null;
    const lx = pts.map((p) => Math.log(p.cost));
    const ly = pts.map((p) => Math.log(outcomeOf(p, objective)));
    const fit = ols(lx, ly);
    const b = clamp(fit.slope, SIM_B_MIN, SIM_B_MAX);
    const a = Math.exp(mean(ly.map((v, i) => v - b * (lx[i] as number))));
    const r2 = clamp(fit.r2, 0, 1);
    const confidence: ResponseCurve["confidence"] = r2 >= 0.9 && n >= 5 && spread >= 1.25 ? "high" : r2 >= 0.6 && n >= 3 && spread >= 1.1 ? "medium" : "low";
    return { campaignId, objective, a, b, bRaw: round(fit.slope, 4), r2: round(r2, 4), n, spendRange: [round(lo, 2), round(hi, 2)], confidence, source: "google_simulator" };
}
const MODIFICATION_RANK: Record<SimulationModification, number> = { UNIFORM: 0, DEFAULT: 1, SCALING: 2, UNKNOWN: 3 };
export function pickSimulation(sims: readonly CampaignSimulation[], campaignId: string, simulationType: SimulationType): CampaignSimulation | null {
    let best: CampaignSimulation | null = null;
    for (const s of sims) {
        if (s.campaignId !== campaignId || s.type !== simulationType || !s.points.length)
            continue;
        if (!best || s.end > best.end || (s.end === best.end && MODIFICATION_RANK[s.modification] < MODIFICATION_RANK[best.modification]))
            best = s;
    }
    return best;
}
export function absoluteSimulation(sim: CampaignSimulation, current: number | null): CampaignSimulation | null {
    if (!sim.relative)
        return sim;
    if (current === null || !(current > 0))
        return null;
    const { relative: _relative, ...rest } = sim;
    return { ...rest, points: sim.points.map((p) => ({ ...p, value: round(p.value * current, 4) })) };
}
export const isStaleSimulation = (sim: Pick<CampaignSimulation, "end">, dataThrough: CivilDate): boolean => diffDays(sim.end, dataThrough) > STALE_AFTER_DAYS;
export type SimulatorGap = "shared" | "missing" | "stale";
export function budgetSimulatorGap(value: CampaignType | "Shared", simulation: CampaignSimulation | null, dataThrough: CivilDate, shared = false): SimulatorGap | null {
    if (shared || value === "Shared")
        return "shared";
    if (!simulation || simulation.type !== "BUDGET" || simulation.relative || !perDayPoints(simulation).length)
        return "missing";
    if (isStaleSimulation(simulation, dataThrough))
        return "stale";
    return null;
}
export interface BudgetEstimateInput {
    campaign: {
        type: CampaignType | "Shared";
        budget_shared?: boolean;
    };
    simulation: CampaignSimulation | null;
    modelCurve: Pick<ResponseCurve, "a" | "b"> | null;
    proposedDaily: number;
    dataThrough: CivilDate;
    objective: ResponseCurve["objective"];
    currency?: string;
}
export function chooseBudgetEstimate(input: BudgetEstimateInput): BudgetEstimateDecision {
    const { campaign, modelCurve, proposedDaily, dataThrough, objective } = input;
    const simulation = input.simulation?.type === "BUDGET" && !input.simulation.relative ? input.simulation : null;
    const money = (v: number) => formatMoney(v, { currency: input.currency ?? "USD", compact: false, decimals: 0 });
    const valid = Number.isFinite(proposedDaily) && proposedDaily > 0;
    const google = simulation && valid ? interpolateSimulation(simulation, proposedDaily) : null;
    const googleOutcome = google ? outcomeOf(google, objective) : null;
    const model = modelCurve && valid ? curveOutcome(modelCurve, proposedDaily) : null;
    const disagreementPct = model !== null && googleOutcome !== null && googleOutcome > 0 ? round(model / googleOutcome - 1, 4) : null;
    const gap = budgetSimulatorGap(campaign.type, simulation, dataThrough, !!campaign.budget_shared);
    let lead: EstimateSource = "model";
    let reason: string;
    if (!valid)
        reason = "There is no daily budget to evaluate.";
    else if (gap === "shared")
        reason = simulation
            ? "This campaign shares its budget with other campaigns. Google simulated it as if the budget were its own, so those points don't describe the shared budget — plan the shared budget as a whole."
            : "This campaign shares its budget with other campaigns — plan the shared budget as a whole.";
    else if (gap === "missing" || !simulation)
        reason = "Google returned no budget simulation for this campaign, so our model leads.";
    else if (gap === "stale")
        reason = `Google's budget simulation ended ${formatShort(simulation.end)}, more than ${STALE_AFTER_DAYS} days before the latest data, so our model leads.`;
    else if (!google) {
        const [lo, hi] = simulatedRange(perDayPoints(simulation)) as [
            number,
            number
        ];
        reason = `${money(proposedDaily)}/day is outside the budgets Google simulated (${money(lo)}–${money(hi)}/day), so our model leads.`;
    }
    else {
        lead = "google_simulator";
        reason = `Google's budget simulator covers ${money(proposedDaily)}/day (${formatShort(simulation.start)} – ${formatShort(simulation.end)}), so it leads; our model is a second opinion.`;
    }
    if (lead === "model" && valid && model === null && gap !== "shared")
        reason += " Our model has no response curve for it either.";
    return { lead, reason, objective, proposedDaily, google, googleOutcome, model, disagreementPct };
}
export function agreementLine(disagreementPct: number | null, band = AGREEMENT_BAND): string | null {
    if (disagreementPct === null || !Number.isFinite(disagreementPct))
        return null;
    if (Math.abs(disagreementPct) <= band + 1e-9)
        return `Google and our model agree within ${Math.round(band * 100)}%`;
    const pct = Math.round(Math.abs(disagreementPct) * 100);
    return disagreementPct > 0 ? `Our model is ${pct}% more optimistic than Google` : `Our model is ${pct}% more conservative than Google`;
}
export interface SimulatorCurveUnit {
    unitId: string;
    campaignIds: readonly string[];
    type: CampaignType | "Shared";
}
export function simulatorCurves(units: readonly SimulatorCurveUnit[], simulations: readonly CampaignSimulation[], objective: ResponseCurve["objective"], dataThrough: CivilDate): Map<string, ResponseCurve> {
    const out = new Map<string, ResponseCurve>();
    for (const u of units) {
        if (u.type === "Shared" || u.campaignIds.length !== 1)
            continue;
        const sim = pickSimulation(simulations, u.campaignIds[0] as string, "BUDGET");
        if (!sim || budgetSimulatorGap(u.type, sim, dataThrough) !== null)
            continue;
        const curve = fitSimulationCurve(u.unitId, objective, sim);
        if (curve)
            out.set(u.unitId, curve);
    }
    return out;
}
export const CALIBRATION_MIN_UNITS = 2;
export const CALIBRATION_RANGE: readonly [
    number,
    number
] = [0.5, 1.5];
export interface CurveBlend {
    curves: Map<string, ResponseCurve>;
    google: number;
    model: number;
    available: number;
    calibration: number | null;
    basis: number;
}
export function calibrateCurve(curve: ResponseCurve, factor: number): ResponseCurve {
    const [lo, hi] = curve.spendRange;
    if (!(lo > 0 && hi > 0) || !(curve.a > 0) || !Number.isFinite(factor) || factor <= 0)
        return curve;
    const typical = Math.sqrt(lo * hi);
    const b = clamp(curve.b * factor, B_MIN, B_MAX);
    return { ...curve, a: curve.a * typical ** (curve.b - b), b, calibration: round(factor, 4) };
}
export function blendCurves(model: ReadonlyMap<string, ResponseCurve>, google: ReadonlyMap<string, ResponseCurve>): CurveBlend {
    const ratios: number[] = [];
    for (const [unitId, g] of google) {
        const m = model.get(unitId);
        if (m && m.b > 0 && g.b > 0)
            ratios.push(g.b / m.b);
    }
    const basis = ratios.length;
    const modelOnly = [...model.keys()].filter((id) => !google.has(id));
    if (!google.size || (modelOnly.length && basis < CALIBRATION_MIN_UNITS))
        return { curves: new Map(model), google: 0, model: model.size, available: google.size, calibration: null, basis };
    const calibration = modelOnly.length ? round(clamp(median(ratios), CALIBRATION_RANGE[0], CALIBRATION_RANGE[1]), 4) : null;
    const curves = new Map<string, ResponseCurve>(google);
    for (const unitId of modelOnly) {
        const m = model.get(unitId) as ResponseCurve;
        curves.set(unitId, calibration === null ? m : calibrateCurve(m, calibration));
    }
    return { curves, google: google.size, model: modelOnly.length, available: google.size, calibration, basis };
}
export const ESTIMATE_POLICY: readonly EstimatePolicyRow[] = [
    {
        id: "pacing",
        question: "Will we land on budget this month?",
        lead: "model",
        leadLabel: "Our pacing projection",
        why: "It needs this month's actual spend and Google's 2× daily and 30.4× monthly limits; Google's simulators replay a past week and don't project calendar months.",
    },
    {
        id: "trend",
        question: "What will the next 30 days look like?",
        lead: "model",
        leadLabel: "Our damped-Holt forecast",
        why: "Performance Planner isn't available in the Google Ads API, so there is no Google forecast to read.",
    },
    {
        id: "budget_whatif",
        question: "What if one campaign's daily budget changes?",
        lead: "google_simulator",
        leadLabel: "Google's budget simulator, when available, fresh and in range",
        why: "It replays the campaign's recent auctions at other budgets (Performance Max too, when Google returns a simulation); our model only sees the spend the campaign actually had.",
    },
    {
        id: "target_whatif",
        question: "What if a target CPA or target ROAS changes?",
        lead: "google_simulator",
        leadLabel: "Google's target simulator",
        why: "We don't model bid targets.",
    },
    {
        id: "reallocation",
        question: "How should budget move between campaigns?",
        lead: "model",
        leadLabel: "Our optimizer, with Google's simulator curves where available",
        why: "Google's simulators work one campaign at a time; the optimizer compares marginal returns across campaigns, so our model's curves for the rest are matched to Google's curvature first.",
    },
    {
        id: "shared_budget",
        question: "What if a shared budget changes?",
        lead: "model",
        leadLabel: "Our model, for the shared budget as a whole",
        why: "Google simulates each campaign on a shared budget as if the budget were its own; those campaigns compete for one budget, so their simulations don't add up to it.",
    },
];
