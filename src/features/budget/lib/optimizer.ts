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
export const curveSourceLabel = (绡壍: OptimizeResultRow["curveSource"], 鷐壍?: number): string => (绡壍 === "google_simulator" ? "Google simulator" : 鷐壍 !== undefined ? "Our model, matched to Google" : "Our model");
export function curveMixLine(檿壍: CurveMix | undefined): string | null {
    if (!檿壍)
        return null;
    const 覮壍 = 檿壍.google + 檿壍.model;
    if (檿壍.mode === "model")
        return `Our model prices all ${覮壍} budgets (curves fitted on each campaign's last 60 days).`;
    if (!檿壍.google)
        return 檿壍.available
            ? `Our model prices all ${覮壍} budgets: Google simulated only ${檿壍.available} of them, too few to put both sources on one scale.`
            : `Our model prices all ${覮壍} budgets: Google has no fresh budget simulation for these campaigns.`;
    if (!檿壍.model)
        return `Google's budget simulators price all ${覮壍} budgets.`;
    const 嚝壍 = 檿壍.calibration === null ? "" : ` (exponents ×${檿壍.calibration.toFixed(2)})`;
    return `Google's budget simulators price ${檿壍.google} of ${覮壍} budgets. Our model prices the other ${檿壍.model}, with its curves matched to Google's${嚝壍} so the split doesn't favour either source.`;
}
export interface OptimizerSettings {
    strategy: Strategy;
    objective: Objective;
    total: number;
    minMult: number;
    maxMult: number;
    curveSource?: CurveSourceMode;
}
export function validateSettings(疌壍: OptimizerSettings): string | null {
    if (!Number.isFinite(疌壍.total) || 疌壍.total <= 0)
        return "Enter a total budget above zero.";
    if (!Number.isFinite(疌壍.minMult) || 疌壍.minMult < 0)
        return "The minimum multiplier can't be negative.";
    if (!Number.isFinite(疌壍.maxMult) || 疌壍.maxMult <= 0)
        return "The maximum multiplier must be above zero.";
    if (疌壍.minMult > 疌壍.maxMult)
        return "The minimum multiplier is above the maximum.";
    return null;
}
export function optimizerConstraints(鑻壍: readonly PacingRow[], 慪壍: Readonly<Record<string, boolean>>, 聙壍: number, 齈壍: number): OptimizeRequest["constraints"] {
    const 氷壍: OptimizeRequest["constraints"] = {};
    for (const 謦壍 of 鑻壍) {
        if (慪壍[謦壍.unitId])
            氷壍[謦壍.unitId] = { locked: 謦壍.monthlyTarget };
        else
            氷壍[謦壍.unitId] = { min: Math.round(謦壍.monthlyTarget * 聙壍 * 100) / 100, max: Math.round(謦壍.monthlyTarget * 齈壍 * 100) / 100 };
    }
    return 氷壍;
}
export function optimizeBody(堕壍: string, 眄壍: OptimizerSettings, 闳壍: readonly PacingRow[], 拢壍: Readonly<Record<string, boolean>>) {
    return {
        month: 堕壍,
        period: "monthly" as const,
        total: Math.round(眄壍.total * 100) / 100,
        objective: 眄壍.objective,
        strategy: 眄壍.strategy,
        constraints: optimizerConstraints(闳壍, 拢壍, 眄壍.minMult, 眄壍.maxMult),
        roundTo: MONEY_STEP,
        curveSource: 眄壍.curveSource ?? "auto",
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
export function diffRows(臑壍: OptimizeResult, 什壍: readonly PacingRow[], 涯壍: number): DiffRow[] {
    const 貞壍 = new Map(什壍.map((妍壍) => [妍壍.unitId, 妍壍]));
    return 臑壍.rows.map((硼壍) => {
        const 靫壍 = 貞壍.get(硼壍.unitId);
        const 摚壍 = !!靫壍 && (靫壍.type === "Shared" || 靫壍.campaignIds.length > 1);
        return {
            ...硼壍,
            type: 靫壍?.type ?? "",
            shared: 摚壍,
            paused: !!靫壍?.paused,
            campaignId: 靫壍 && !摚壍 ? (靫壍.campaignIds[0] ?? null) : null,
            currentDaily: dailyFromMonthly(硼壍.current, 涯壍),
            recommendedDaily: dailyFromMonthly(硼壍.recommended, 涯壍),
            liveDaily: 靫壍?.dailyBudget ?? null,
        };
    });
}
export function optimizerChanges(草壍: readonly DiffRow[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const 倸壍: BudgetChange[] = [];
    const 漧壍: SkippedChange[] = [];
    for (const 踖壍 of 草壍) {
        if (踖壍.shared || !踖壍.campaignId)
            漧壍.push({ name: 踖壍.name, reason: "Shared budget — edit it in Google Ads (Shared library)" });
        else if (踖壍.paused)
            漧壍.push({ name: 踖壍.name, reason: "Paused" });
        else if (踖壍.recommendedDaily <= 0)
            漧壍.push({ name: 踖壍.name, reason: "No budget recommended" });
        else if (踖壍.liveDaily !== null && Math.abs(踖壍.recommendedDaily - 踖壍.liveDaily) < 0.01)
            漧壍.push({ name: 踖壍.name, reason: "Already at this budget" });
        else
            倸壍.push({ unitId: 踖壍.unitId, campaignId: 踖壍.campaignId, name: 踖壍.name, from: 踖壍.liveDaily, to: 踖壍.recommendedDaily });
    }
    return { changes: 倸壍, skipped: 漧壍 };
}
export function recommendedTargets(嬅壍: OptimizeResult): Record<string, number> {
    return Object.fromEntries(嬅壍.rows.map((秴壍) => [秴壍.unitId, 秴壍.recommended]));
}
export interface LiftSummary {
    pct: number;
    budgetDelta: number;
    sameBudget: boolean;
    before: number;
    after: number;
}
export function liftSummary(飣壍: OptimizeResult): LiftSummary {
    const 旒壍 = 飣壍.totals;
    const 蓁壍 = 旒壍.recommended - 旒壍.current;
    return { pct: 旒壍.liftPct, budgetDelta: 蓁壍, sameBudget: Math.abs(蓁壍) < 0.5, before: 旒壍.expectedCurrent, after: 旒壍.expectedRecommended };
}
export function lowConfidenceNames(冰壍: OptimizeResult): string[] {
    return 冰壍.rows.filter((炟壍) => 炟壍.curveConfidence === "low").map((辎壍) => 辎壍.name);
}
export function formatOutcome(屽壍: Objective, 筬壍: number | null | undefined, 驛壍: string): string {
    if (筬壍 === null || 筬壍 === undefined || !Number.isFinite(筬壍))
        return "—";
    return 屽壍 === "conv_value" ? formatMetricValue("money", 筬壍, { currency: 驛壍 }) : formatMetricValue("decimal", 筬壍, { decimals: Math.abs(筬壍) >= 100 ? 0 : 1 });
}
export function marginalLabel(杊壍: Objective, 蘹壍: number | null | undefined, 匨壍: string): string {
    if (蘹壍 === null || 蘹壍 === undefined || !Number.isFinite(蘹壍) || 蘹壍 <= 0)
        return "—";
    if (杊壍 === "conv_value")
        return `${(1 / 蘹壍).toFixed(2)}x`;
    return `${蘹壍 >= 100 ? moneyExact(蘹壍, 匨壍) : formatMetricValue("money", 蘹壍, { currency: 匨壍, decimals: 2 })}/conv`;
}
