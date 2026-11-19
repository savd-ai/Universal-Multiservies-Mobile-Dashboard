import type { BiddingStrategy } from "../schema/facts";
import type { CampaignStatus, CampaignType, CivilDate, Mode } from "../types";
import type { ResponseCurve } from "./budget";

// Google's own estimates, read through the read-only API next to our model: campaign simulations (what a past
// window would have delivered with another budget / target CPA / target ROAS) and CAMPAIGN_BUDGET recommendations.
// Performance Planner is not in the API and Keyword Planner forecasts are a separate RPC, so neither appears here.
// Money is in account-currency units.

/** Which estimate a number comes from. */
export type EstimateSource = NonNullable<ResponseCurve["source"]>;

/** The campaign_simulation types the dashboard reads (Google also has CPC_BID and TARGET_IMPRESSION_SHARE). */
export const SIMULATION_TYPES = ["BUDGET", "TARGET_CPA", "TARGET_ROAS"] as const;
export type SimulationType = (typeof SIMULATION_TYPES)[number];

/** UNIFORM / DEFAULT: the setting itself was simulated; SCALING: every target was scaled by the point's modifier. */
export type SimulationModification = "UNIFORM" | "DEFAULT" | "SCALING" | "UNKNOWN";

export interface SimulationPoint {
  /** the simulated setting: daily budget or target CPA (account currency), target ROAS (ratio); a multiplier of the current setting when the simulation is `relative` */
  value: number;
  /** projected totals over the simulation window */
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  convValue: number;
  /** daily budget needed to reach the point (target simulations); null for budget simulations */
  requiredBudget: number | null;
}

/** A simulation point divided by the window's days (value and requiredBudget are already per day). */
export type SimulationDayPoint = SimulationPoint;

export interface CampaignSimulation {
  campaignId: string;
  type: SimulationType;
  modification: SimulationModification;
  /** first and last day of the past window the simulation replays */
  start: CivilDate;
  end: CivilDate;
  /** sorted by value, ascending */
  points: SimulationPoint[];
  /** point values are multipliers of the current setting (SCALING target CPA simulations) */
  relative?: boolean;
}

export interface RecommendationMetrics {
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
  convValue: number | null;
  videoViews: number | null;
}

/** Google's weekly estimate before (base) and after (potential) applying a recommendation. */
export interface RecommendationImpact {
  base: RecommendationMetrics;
  potential: RecommendationMetrics;
}

export interface GoogleRecommendation {
  /** last part of the recommendation's resource name */
  id: string;
  /** e.g. CAMPAIGN_BUDGET */
  type: string;
  /** the one campaign it targets; null for a shared budget or when Google names none */
  campaignId: string | null;
  campaignIds: string[];
  budgetId: string | null;
  /** daily budgets */
  currentBudget: number | null;
  recommendedBudget: number | null;
  /** sorted by budget, ascending */
  options: { budget: number; impact: RecommendationImpact | null }[];
  impact: RecommendationImpact | null;
  dismissed: boolean;
}

export interface GoogleEstimates {
  simulations: CampaignSimulation[];
  recommendations: GoogleRecommendation[];
  /** user-facing notes when one of the reads failed (the other still counts) */
  warnings: string[];
}

// ── Source policy ─────────────────────────────────────────────────────────────────────────────────────

/** Which estimate leads for a single-campaign budget what-if, and how the two compare. */
export interface BudgetEstimateDecision {
  lead: EstimateSource;
  /** one sentence: why this source leads */
  reason: string;
  objective: ResponseCurve["objective"];
  proposedDaily: number;
  /** Google's per-day estimate at the proposed budget (interpolated), null without a usable simulation */
  google: SimulationDayPoint | null;
  /** Google's conversions or value per day, matching `objective` */
  googleOutcome: number | null;
  /** our model's conversions or value per day at the proposed budget, null without a curve */
  model: number | null;
  /** model ÷ Google − 1; null when either estimate is missing */
  disagreementPct: number | null;
}

/** One planning question and the estimate that answers it. */
export interface EstimatePolicyRow {
  id: string;
  question: string;
  lead: EstimateSource;
  leadLabel: string;
  why: string;
}

// ── GET /api/budget/google-estimates ──────────────────────────────────────────────────────────────────

export interface SimulationView extends CampaignSimulation {
  days: number;
  /** points ÷ days */
  perDay: SimulationDayPoint[];
  /** ended more than STALE_AFTER_DAYS before the latest data */
  stale: boolean;
  /** the campaign's current setting on the scale of `value` (daily budget, target CPA or target ROAS) */
  current: number | null;
}

export interface EstimateCampaignView {
  campaignId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  biddingStrategy: BiddingStrategy;
  dailyBudget: number | null;
  sharedBudget: boolean;
  targetCpa: number | null;
  targetRoas: number | null;
  /** one per type, in SIMULATION_TYPES order */
  simulations: SimulationView[];
  /** why our model leads (or why there's no budget comparison), in one sentence; null when Google's simulator leads */
  note: string | null;
  /** our response curve (last 60 days) for the objective; null for shared budgets or without history */
  modelCurve: ResponseCurve | null;
  /** Google's budget simulation fitted as a response curve (what the optimizer uses when curves are on Auto) */
  simulatorCurve: ResponseCurve | null;
  /** the policy decision at the current daily budget; null without a daily budget */
  decision: BudgetEstimateDecision | null;
  deepLink: string;
}

export interface RecommendationView extends GoogleRecommendation {
  campaignName: string | null;
  campaignType: CampaignType | null;
  /** the campaign's daily budget now (Google's snapshot can be older) */
  liveBudget: number | null;
  /** the daily budget already meets the recommendation */
  applied: boolean;
  deepLink: string | null;
}

export interface GoogleEstimatesResponse {
  mode: Mode;
  /** demo mode: why, and what the numbers are */
  demo: { reason: string; note: string } | null;
  currency: string;
  dataThrough: CivilDate;
  objective: ResponseCurve["objective"];
  campaigns: EstimateCampaignView[];
  /** active (not dismissed) budget recommendations, biggest weekly conversion gain first */
  recommendations: RecommendationView[];
  policy: readonly EstimatePolicyRow[];
  warnings: string[];
}
