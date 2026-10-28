import type { CurveMix, CurveSourceMode, OptimizeRequest, OptimizeResult, OptimizeResultRow, PacingRow } from "@/lib/domain/contracts/budget";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { dailyFromMonthly, MONEY_STEP, moneyExact } from "./money";
import type { BudgetChange, SkippedChange } from "./pacing";
export type Strategy = OptimizeRequest["strategy"];
export type Objective = OptimizeRequest["objective"];
export const DEFAULT_MIN_MULT = 0.5;
export const DEFAULT_MAX_MULT = 1.6;
export const STRATEGY_LABELS: Record<Strategy, string> = { marginal: "Marginal returns", roas_heuristic: "ROAS heuristic" };
export const OBJECTIVE_LABELS: Record<Objective, string> = { conversions: "Conversions", conv_value: "Conversion value" };
export const CURVE_SOURCE_LABELS: Record<CurveSourceMode, string> = { auto: "Auto (Google where available)", model: "Our model only" };
export const curveSourceLabel = (source: OptimizeResultRow["curveSource"], calibration?: number): string => (source === "google_simulator" ? "Google simulator" : calibration !== undefined ? "Our model, matched to Google" : "Our model");
export function curveMixLine(mix: CurveMix | undefined): string | null {
    if (!mix)
        return null;
    const n = mix.google + mix.model;
    if (mix.mode === "model")
        return `Our model prices all ${n} budgets (curves fitted on each campaign's last 60 days).`;
    if (!mix.google)
        return mix.available
            ? `Our model prices all ${n} budgets: Google simulated only ${mix.available} of them, too few to put both sources on one scale.`
            : `Our model prices all ${n} budgets: Google has no fresh budget simulation for these campaigns.`;
    if (!mix.model)
        return `Google's budget simulators price all ${n} budgets.`;
    const factor = mix.calibration === null ? "" : ` (exponents ×${mix.calibration.toFixed(2)})`;
    return `Google's budget simulators price ${mix.google} of ${n} budgets. Our model prices the other ${mix.model}, with its curves matched to Google's${factor} so the split doesn't favour either source.`;
}
export interface OptimizerSettings {
    strategy: Strategy;
    objective: Objective;
    total: number;
    minMult: number;
    maxMult: number;
    curveSource?: CurveSourceMode;
}
export function validateSettings(s: OptimizerSettings): string | null {
    if (!Number.isFinite(s.total) || s.total <= 0)
        return "Enter a total budget above zero.";
    if (!Number.isFinite(s.minMult) || s.minMult < 0)
        return "The minimum multiplier can't be negative.";
    if (!Number.isFinite(s.maxMult) || s.maxMult <= 0)
        return "The maximum multiplier must be above zero.";
    if (s.minMult > s.maxMult)
        return "The minimum multiplier is above the maximum.";
    return null;
}
export function optimizerConstraints(rows: readonly PacingRow[], locks: Readonly<Record<string, boolean>>, minMult: number, maxMult: number): OptimizeRequest["constraints"] {
    const out: OptimizeRequest["constraints"] = {};
    for (const r of rows) {
        if (locks[r.unitId])
            out[r.unitId] = { locked: r.monthlyTarget };
        else
            out[r.unitId] = { min: Math.round(r.monthlyTarget * minMult * 100) / 100, max: Math.round(r.monthlyTarget * maxMult * 100) / 100 };
    }
    return out;
}
export function optimizeBody(month: string, s: OptimizerSettings, rows: readonly PacingRow[], locks: Readonly<Record<string, boolean>>) {
    return {
        month,
        period: "monthly" as const,
        total: Math.round(s.total * 100) / 100,
        objective: s.objective,
        strategy: s.strategy,
        constraints: optimizerConstraints(rows, locks, s.minMult, s.maxMult),
        roundTo: MONEY_STEP,
        curveSource: s.curveSource ?? "auto",
    };
}
export interface DiffRow extends OptimizeResultRow {
    type: string;
    shared: boolean;
    paused: boolean;
    campaignId: string | null;
    currentDaily: number;
    recommendedDaily: number;
    liveDaily: number | null;
}
export function diffRows(result: OptimizeResult, rows: readonly PacingRow[], days: number): DiffRow[] {
    const byId = new Map(rows.map((r) => [r.unitId, r]));
    return result.rows.map((r) => {
        const src = byId.get(r.unitId);
        const shared = !!src && (src.type === "Shared" || src.campaignIds.length > 1);
        return {
            ...r,
            type: src?.type ?? "",
            shared,
            paused: !!src?.paused,
            campaignId: src && !shared ? (src.campaignIds[0] ?? null) : null,
            currentDaily: dailyFromMonthly(r.current, days),
            recommendedDaily: dailyFromMonthly(r.recommended, days),
            liveDaily: src?.dailyBudget ?? null,
        };
    });
}
export function optimizerChanges(rows: readonly DiffRow[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const changes: BudgetChange[] = [];
    const skipped: SkippedChange[] = [];
    for (const r of rows) {
        if (r.shared || !r.campaignId)
            skipped.push({ name: r.name, reason: "Shared budget — edit it in Google Ads (Shared library)" });
        else if (r.paused)
            skipped.push({ name: r.name, reason: "Paused" });
        else if (r.recommendedDaily <= 0)
            skipped.push({ name: r.name, reason: "No budget recommended" });
        else if (r.liveDaily !== null && Math.abs(r.recommendedDaily - r.liveDaily) < 0.01)
            skipped.push({ name: r.name, reason: "Already at this budget" });
        else
            changes.push({ unitId: r.unitId, campaignId: r.campaignId, name: r.name, from: r.liveDaily, to: r.recommendedDaily });
    }
    return { changes, skipped };
}
export function recommendedTargets(result: OptimizeResult): Record<string, number> {
    return Object.fromEntries(result.rows.map((r) => [r.unitId, r.recommended]));
}
export interface LiftSummary {
    pct: number;
    budgetDelta: number;
    sameBudget: boolean;
    before: number;
    after: number;
}
export function liftSummary(result: OptimizeResult): LiftSummary {
    const t = result.totals;
    const budgetDelta = t.recommended - t.current;
    return { pct: t.liftPct, budgetDelta, sameBudget: Math.abs(budgetDelta) < 0.5, before: t.expectedCurrent, after: t.expectedRecommended };
}
export function lowConfidenceNames(result: OptimizeResult): string[] {
    return result.rows.filter((r) => r.curveConfidence === "low").map((r) => r.name);
}
export function formatOutcome(objective: Objective, v: number | null | undefined, currency: string): string {
    if (v === null || v === undefined || !Number.isFinite(v))
        return "—";
    return objective === "conv_value" ? formatMetricValue("money", v, { currency }) : formatMetricValue("decimal", v, { decimals: Math.abs(v) >= 100 ? 0 : 1 });
}
export function marginalLabel(objective: Objective, marginalCost: number | null | undefined, currency: string): string {
    if (marginalCost === null || marginalCost === undefined || !Number.isFinite(marginalCost) || marginalCost <= 0)
        return "—";
    if (objective === "conv_value")
        return `${(1 / marginalCost).toFixed(2)}x`;
    return `${marginalCost >= 100 ? moneyExact(marginalCost, currency) : formatMetricValue("money", marginalCost, { currency, decimals: 2 })}/conv`;
}
