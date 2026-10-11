import { z } from "zod";
import type { CampaignType, CivilDate } from "../types";
export const MONTHLY_CAP_FACTOR = 30.4;
export const DAILY_OVERDELIVERY_FACTOR = 2;
export type PacingStatus = "overpacing" | "underpacing" | "on_track" | "paused" | "no_budget" | "unsupported_period";
export interface PacingRow {
    unitId: string;
    campaignIds: string[];
    name: string;
    type: CampaignType | "Shared";
    dailyBudget: number | null;
    monthlyTarget: number;
    mtdSpend: number;
    avg7: number;
    expectedDaily: number;
    projected: number;
    paceRatio: number;
    status: PacingStatus;
    idealToDate: number;
    utilization: number;
    budgetLimited: boolean;
    recommendedDaily: number | null;
    recommendationNote: string;
    roasMtd: number | null;
    cpaMtd: number | null;
    sliderMin: number;
    sliderMax: number;
    locked?: boolean;
    paused?: boolean;
    capped?: boolean;
}
export interface PacingReport {
    month: string;
    monthLabel: string;
    daysInMonth: number;
    elapsedDays: number;
    remainingDays: number;
    anchor: CivilDate;
    rows: PacingRow[];
    totals: {
        monthlyTarget: number;
        mtdSpend: number;
        projected: number;
        paceRatio: number;
        idealToDate: number;
        overpacingCount: number;
        underpacingCount: number;
    };
    cumulative: {
        date: CivilDate;
        actual: number | null;
        ideal: number;
        projected: number | null;
    }[];
}
export const budgetTargetsSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    targets: z.record(z.string(), z.number().nonnegative()),
    locks: z.record(z.string(), z.boolean()).default({}),
});
export type BudgetTargetsBody = z.infer<typeof budgetTargetsSchema>;
export interface BudgetTargets extends BudgetTargetsBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface ResponseCurve {
    campaignId: string;
    objective: "conversions" | "conv_value";
    a: number;
    b: number;
    bRaw: number;
    r2: number;
    n: number;
    spendRange: [
        number,
        number
    ];
    confidence: "low" | "medium" | "high";
    source?: "model" | "google_simulator";
    calibration?: number;
}
export interface CurveMix {
    mode: CurveSourceMode;
    google: number;
    model: number;
    available: number;
    calibration: number | null;
}
export const CURVE_SOURCES = ["auto", "model"] as const;
export type CurveSourceMode = (typeof CURVE_SOURCES)[number];
export const optimizeRequestSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    period: z.enum(["daily", "monthly"]).default("monthly"),
    total: z.number().positive().optional(),
    objective: z.enum(["conversions", "conv_value"]).default("conv_value"),
    strategy: z.enum(["marginal", "roas_heuristic"]).default("marginal"),
    constraints: z.record(z.string(), z.object({ min: z.number().nonnegative().optional(), max: z.number().nonnegative().optional(), locked: z.number().nonnegative().optional(), exclude: z.boolean().optional() })).default({}),
    roundTo: z.number().positive().default(50),
    curveSource: z.enum(CURVE_SOURCES).default("auto"),
});
export type OptimizeRequest = z.infer<typeof optimizeRequestSchema>;
export interface OptimizeResultRow {
    unitId: string;
    name: string;
    current: number;
    recommended: number;
    delta: number;
    deltaPct: number;
    expected: {
        current: number;
        recommended: number;
    };
    marginalCost: number | null;
    bound: "min" | "max" | "locked" | null;
    curveConfidence: ResponseCurve["confidence"];
    curveSource?: NonNullable<ResponseCurve["source"]>;
    curveCalibration?: number;
}
export interface OptimizeResult {
    objective: OptimizeRequest["objective"];
    strategy: OptimizeRequest["strategy"];
    period: OptimizeRequest["period"];
    rows: OptimizeResultRow[];
    totals: {
        current: number;
        recommended: number;
        expectedCurrent: number;
        expectedRecommended: number;
        liftPct: number;
    };
    warnings: string[];
    curves?: CurveMix;
}
export interface ScenarioPoint {
    pct: number;
    total: number;
    expected: number;
    marginalCost: number | null;
}
export interface ForecastResult {
    metric: "cost" | "conversions" | "conv_value" | "clicks";
    campaignId?: string;
    history: {
        date: CivilDate;
        value: number;
    }[];
    points: {
        date: CivilDate;
        yhat: number;
        lo: number;
        hi: number;
    }[];
    totals: {
        restOfMonth: {
            yhat: number;
            lo: number;
            hi: number;
        };
        next30: {
            yhat: number;
            lo: number;
            hi: number;
        };
    };
    method: "holt_damped_dow";
    backtestMape: number | null;
}
export const planLineSchema = z.object({
    id: z.string().max(64),
    kind: z.enum(["campaign", "draft_idea", "plugin_channel"]),
    refId: z.string().max(64),
    name: z.string().min(1).max(120),
    campaignType: z.string().max(40).optional(),
    monthly: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().nonnegative()),
    flighting: z.object({ pattern: z.enum(["even", "front_loaded", "back_loaded", "dow_weighted"]) }).default({ pattern: "even" }),
    locked: z.boolean().optional(),
    origin: z.enum(["manual", "optimizer", "ai_idea"]).default("manual"),
    notes: z.string().max(400).optional(),
});
export type PlanLine = z.infer<typeof planLineSchema>;
export const budgetPlanBodySchema = z.object({
    name: z.string().min(1).max(80),
    accountId: z.string().max(32).optional(),
    months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).min(1).max(12),
    objective: z.enum(["conversions", "conv_value"]).default("conv_value"),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    lines: z.array(planLineSchema).max(200),
});
export type BudgetPlanBody = z.infer<typeof budgetPlanBodySchema>;
export interface BudgetPlan extends BudgetPlanBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface BudgetTargetsView extends BudgetTargets {
    defaults: Record<string, number>;
    isDefault: boolean;
    lastMonth?: {
        month: string;
        targets: Record<string, number>;
        total: number;
    } | null;
}
export interface CurvesResponse {
    objective: ResponseCurve["objective"];
    window: {
        start: CivilDate;
        end: CivilDate;
    };
    curves: (ResponseCurve & {
        name: string;
    })[];
}
export const scenariosRequestSchema = z.object({
    pcts: z.array(z.number().min(-0.95).max(3)).min(1).max(20).optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    period: z.enum(["daily", "monthly"]).default("monthly"),
    objective: z.enum(["conversions", "conv_value"]).default("conv_value"),
    strategy: z.enum(["marginal", "roas_heuristic"]).default("marginal"),
    constraints: optimizeRequestSchema.shape.constraints,
    roundTo: z.number().positive().default(50),
    curveSource: optimizeRequestSchema.shape.curveSource,
});
export type ScenariosRequest = z.infer<typeof scenariosRequestSchema>;
export interface ScenariosResult {
    objective: OptimizeRequest["objective"];
    strategy: OptimizeRequest["strategy"];
    period: OptimizeRequest["period"];
    baseTotal: number;
    points: ScenarioPoint[];
    warnings: string[];
}
export const draftLineSchema = z.object({
    kind: z.enum(["draft_idea", "plugin_channel"]).default("draft_idea"),
    refId: z.string().max(64),
    name: z.string().min(1).max(120),
    campaignType: z.string().max(40).optional(),
    dailyBudget: z.number().positive().max(10000000),
    notes: z.string().max(400).optional(),
});
export type DraftLineInput = z.infer<typeof draftLineSchema>;
export const planSuggestSchema = z.object({
    totals: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().nonnegative()).optional(),
    strategy: z.enum(["marginal", "roas_heuristic"]).default("marginal"),
    roundTo: z.number().positive().default(50),
});
export type PlanSuggestRequest = z.infer<typeof planSuggestSchema>;
export interface PlanSuggestResult {
    plan: BudgetPlan;
    index: {
        month: string;
        factor: number;
    }[];
    indexSource: "history" | "retail_preset";
    warnings: string[];
}
