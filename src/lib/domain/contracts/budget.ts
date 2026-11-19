import { z } from "zod";
import type { CampaignType, CivilDate } from "../types";

// Budget planning & pacing. Google Ads budgets are DAILY amounts; monthly views are derived (Google may spend up
// to 2× the daily budget on a given day and caps a calendar month at ~30.4 × daily).

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
  /** every campaign in the unit is paused (expected spend for the remaining days is 0; status "paused", and the
   * default target is what it already spent this month) */
  paused?: boolean;
  /** expected daily spend hits Google's 2× daily limit, or spend would reach the monthly charging limit (30.4 × daily) before month-end */
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
  cumulative: { date: CivilDate; actual: number | null; ideal: number; projected: number | null }[];
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
  spendRange: [number, number];
  confidence: "low" | "medium" | "high";
  /** where the curve comes from: our fit on daily history (default) or Google's budget simulator points */
  source?: "model" | "google_simulator";
  /** our curve with its exponent × this factor, to match Google's simulators when both price one optimization */
  calibration?: number;
}

/** Which curves priced an optimization (see blendCurves in domain/budget/google.ts). */
export interface CurveMix {
  mode: CurveSourceMode;
  /** units priced by Google's simulator curve */
  google: number;
  /** units priced by our model */
  model: number;
  /** Google simulator curves that were available */
  available: number;
  /** factor applied to our model's exponents, or null */
  calibration: number | null;
}

/** Optimizer curves: "auto" uses Google's budget simulator where it can lead (see domain/budget/google.ts), else our model. */
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
  expected: { current: number; recommended: number };
  marginalCost: number | null;
  bound: "min" | "max" | "locked" | null;
  curveConfidence: ResponseCurve["confidence"];
  /** which curve priced this row (absent in older payloads: our model) */
  curveSource?: NonNullable<ResponseCurve["source"]>;
  /** set when our model's curve was matched to Google's simulators */
  curveCalibration?: number;
}

export interface OptimizeResult {
  objective: OptimizeRequest["objective"];
  strategy: OptimizeRequest["strategy"];
  period: OptimizeRequest["period"];
  rows: OptimizeResultRow[];
  totals: { current: number; recommended: number; expectedCurrent: number; expectedRecommended: number; liftPct: number };
  warnings: string[];
  /** which curves priced it (absent in older payloads) */
  curves?: CurveMix;
}

export interface ScenarioPoint {
  /** fraction of the current total: −0.3 = −30 % */
  pct: number;
  total: number;
  expected: number;
  /** extra spend per extra unit of outcome vs the previous (lower) point */
  marginalCost: number | null;
}

export interface ForecastResult {
  metric: "cost" | "conversions" | "conv_value" | "clicks";
  campaignId?: string;
  history: { date: CivilDate; value: number }[];
  points: { date: CivilDate; yhat: number; lo: number; hi: number }[];
  totals: { restOfMonth: { yhat: number; lo: number; hi: number }; next30: { yhat: number; lo: number; hi: number } };
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

// ── API payloads (additive) ────────────────────────────────────────────────────────────────────────────

/** GET /api/budget/targets: stored targets merged over the defaults (daily budget × days in month). */
export interface BudgetTargetsView extends BudgetTargets {
  defaults: Record<string, number>;
  /** nothing stored yet for this month */
  isDefault: boolean;
  /**
   * A starting point while nothing is stored: each active unit's spend in the last complete month before this one,
   * scaled to this month's days (whole currency units). Units that didn't spend then keep their defaults. null when
   * there is no such month with spend (or targets are stored).
   */
  lastMonth?: { month: string; targets: Record<string, number>; total: number } | null;
}

export interface CurvesResponse {
  objective: ResponseCurve["objective"];
  window: { start: CivilDate; end: CivilDate };
  curves: (ResponseCurve & { name: string })[];
}

export const scenariosRequestSchema = z.object({
  /** fractions of the current total (−0.3 = −30 %); default −30 … +50 % */
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

/** POST /api/budget/plans/[id]/lines: add an AI idea (or other draft) as a plan line; monthly = daily × days in month. */
export const draftLineSchema = z.object({
  kind: z.enum(["draft_idea", "plugin_channel"]).default("draft_idea"),
  refId: z.string().max(64),
  name: z.string().min(1).max(120),
  campaignType: z.string().max(40).optional(),
  dailyBudget: z.number().positive().max(10_000_000),
  notes: z.string().max(400).optional(),
});
export type DraftLineInput = z.infer<typeof draftLineSchema>;

export const planSuggestSchema = z.object({
  /** explicit month totals (YYYY-MM → amount); other months follow the seasonal index */
  totals: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().nonnegative()).optional(),
  strategy: z.enum(["marginal", "roas_heuristic"]).default("marginal"),
  roundTo: z.number().positive().default(50),
});
export type PlanSuggestRequest = z.infer<typeof planSuggestSchema>;

export interface PlanSuggestResult {
  plan: BudgetPlan;
  index: { month: string; factor: number }[];
  indexSource: "history" | "retail_preset";
  warnings: string[];
}
