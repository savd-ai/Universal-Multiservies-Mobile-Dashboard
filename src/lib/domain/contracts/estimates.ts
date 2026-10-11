import type { BiddingStrategy } from "../schema/facts";
import type { CampaignStatus, CampaignType, CivilDate, Mode } from "../types";
import type { ResponseCurve } from "./budget";
export type EstimateSource = NonNullable<ResponseCurve["source"]>;
export const SIMULATION_TYPES = ["BUDGET", "TARGET_CPA", "TARGET_ROAS"] as const;
export type SimulationType = (typeof SIMULATION_TYPES)[number];
export type SimulationModification = "UNIFORM" | "DEFAULT" | "SCALING" | "UNKNOWN";
export interface SimulationPoint {
    value: number;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    convValue: number;
    requiredBudget: number | null;
}
export type SimulationDayPoint = SimulationPoint;
export interface CampaignSimulation {
    campaignId: string;
    type: SimulationType;
    modification: SimulationModification;
    start: CivilDate;
    end: CivilDate;
    points: SimulationPoint[];
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
export interface RecommendationImpact {
    base: RecommendationMetrics;
    potential: RecommendationMetrics;
}
export interface GoogleRecommendation {
    id: string;
    type: string;
    campaignId: string | null;
    campaignIds: string[];
    budgetId: string | null;
    currentBudget: number | null;
    recommendedBudget: number | null;
    options: {
        budget: number;
        impact: RecommendationImpact | null;
    }[];
    impact: RecommendationImpact | null;
    dismissed: boolean;
}
export interface GoogleEstimates {
    simulations: CampaignSimulation[];
    recommendations: GoogleRecommendation[];
    warnings: string[];
}
export interface BudgetEstimateDecision {
    lead: EstimateSource;
    reason: string;
    objective: ResponseCurve["objective"];
    proposedDaily: number;
    google: SimulationDayPoint | null;
    googleOutcome: number | null;
    model: number | null;
    disagreementPct: number | null;
}
export interface EstimatePolicyRow {
    id: string;
    question: string;
    lead: EstimateSource;
    leadLabel: string;
    why: string;
}
export interface SimulationView extends CampaignSimulation {
    days: number;
    perDay: SimulationDayPoint[];
    stale: boolean;
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
    simulations: SimulationView[];
    note: string | null;
    modelCurve: ResponseCurve | null;
    simulatorCurve: ResponseCurve | null;
    decision: BudgetEstimateDecision | null;
    deepLink: string;
}
export interface RecommendationView extends GoogleRecommendation {
    campaignName: string | null;
    campaignType: CampaignType | null;
    liveBudget: number | null;
    applied: boolean;
    deepLink: string | null;
}
export interface GoogleEstimatesResponse {
    mode: Mode;
    blank: {
        reason: string;
        note: string;
    } | null;
    currency: string;
    dataThrough: CivilDate;
    objective: ResponseCurve["objective"];
    campaigns: EstimateCampaignView[];
    recommendations: RecommendationView[];
    policy: readonly EstimatePolicyRow[];
    warnings: string[];
}
