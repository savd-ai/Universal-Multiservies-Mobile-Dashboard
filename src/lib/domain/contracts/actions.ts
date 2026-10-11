import { z } from "zod";
import type { ChangeEvent, CampaignDim, SearchTermMatchType, SearchTermStatus } from "../schema/facts";
import type { CampaignStatus, CampaignType, CivilDate, MetricFormat, Mode, Severity } from "../types";
import type { SignalView } from "./anomaly";
import type { PacingRow } from "./budget";
export const SIMULATED_ACTION_TYPES = ["campaign.pause", "campaign.enable", "campaign.set_budget", "budget.apply_plan", "keywords.add_negatives"] as const;
export type SimulatedActionType = (typeof SIMULATED_ACTION_TYPES)[number];
export const simulateRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("campaign.pause"), campaignIds: z.array(z.string().max(64)).min(1).max(200) }),
    z.object({ type: z.literal("campaign.enable"), campaignIds: z.array(z.string().max(64)).min(1).max(200) }),
    z.object({ type: z.literal("campaign.set_budget"), budgets: z.array(z.object({ campaignId: z.string().max(64), dailyBudget: z.number().positive().max(10000000) })).min(1).max(200) }),
    z.object({ type: z.literal("budget.apply_plan"), planId: z.string().max(64), budgets: z.array(z.object({ campaignId: z.string().max(64), dailyBudget: z.number().positive() })).max(200) }),
    z.object({
        type: z.literal("keywords.add_negatives"),
        negatives: z.array(z.object({ text: z.string().min(1).max(80), matchType: z.enum(["Exact", "Phrase", "Broad"]), campaignId: z.string().max(64), adGroupId: z.string().max(64).optional() })).min(1).max(200),
    }),
]);
export type SimulateRequest = z.infer<typeof simulateRequestSchema>;
export interface SimulatedAction {
    id: string;
    accountId: string;
    type: SimulatedActionType;
    targets: string[];
    summary: string;
    before: unknown;
    after: unknown;
    revertedAt?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface ReadOnlyAlternatives {
    deepLinks: {
        label: string;
        url: string;
    }[];
    changeList: string[];
    editorCsv: string;
}
export interface AuditEntry {
    ts: string;
    actor: "user" | "system" | "scheduler";
    action: string;
    target?: string;
    mode?: "live" | "blank";
    summary: string;
    details?: Record<string, unknown>;
    workspace?: string;
    actorId?: string;
    actorEmail?: string;
}
export interface SimulateResponse {
    action: SimulatedAction;
    simulated: true;
    message: string;
}
export interface CampaignMetrics {
    cost: number;
    impressions: number;
    clicks: number;
    ctr: number | null;
    cpc: number | null;
    conversions: number;
    cpa: number | null;
    roas: number | null;
    conv_value: number;
    cvr: number | null;
}
export interface ApiRange {
    start: CivilDate;
    end: CivilDate;
    days: number;
    compare?: {
        start: CivilDate;
        end: CivilDate;
    };
}
export interface CampaignListRow {
    id: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    biddingStrategy: string;
    biddingLabel: string;
    dailyBudget: number | null;
    budgetShared: boolean;
    budgetId?: string;
    simulated?: {
        status?: boolean;
        budget?: boolean;
    };
    metrics: CampaignMetrics;
    prev?: CampaignMetrics;
    spark: number[];
    worstSeverity: Severity | null;
    signalCount: number;
    deepLink: string;
}
export interface CampaignListResponse {
    rows: CampaignListRow[];
    totals: CampaignMetrics & {
        dailyBudget: number;
        count: number;
    };
    prevTotals?: CampaignMetrics;
    range: ApiRange;
    mode: Mode;
    currency: string;
    warnings: string[];
}
export interface CampaignDetail {
    campaign: CampaignDim & {
        biddingLabel: string;
    };
    deepLink: string;
    range: ApiRange;
    kpis: CampaignMetrics;
    prev?: CampaignMetrics;
    daily: {
        date: CivilDate;
        cost: number;
        conversions: number;
        clicks: number;
        impressions: number;
        conv_value: number;
    }[];
    budgetLine: {
        date: CivilDate;
        value: number | null;
    }[];
    signals: SignalView[];
    pacing: PacingRow | null;
    devices: (CampaignMetrics & {
        device: string;
    })[];
    adGroups: (CampaignMetrics & {
        id: string;
        name: string;
        status: CampaignStatus;
    })[];
    keywords: (CampaignMetrics & {
        id: string;
        adGroupId: string;
        adGroupName: string;
        text: string;
        matchType: string;
        status: CampaignStatus;
        qs: number | null;
        qsCtr: string | null;
        qsRelevance: string | null;
        qsLanding: string | null;
        cpcBid: number | null;
        avgQs: number | null;
    })[];
    searchTerms: (CampaignMetrics & {
        term: string;
        status: SearchTermStatus;
        matchType: SearchTermMatchType;
    })[];
    hourDow: {
        dows: string[];
        hours: number[];
        conversions: number[][];
        clicks: number[][];
        cost: number[][];
    };
    changes: ChangeEvent[];
    mode: Mode;
    currency: string;
    warnings: string[];
}
export interface ChangeImpactMetric {
    metric: "cost" | "conversions" | "cpa" | "ctr";
    label: string;
    format: MetricFormat;
    before: number | null;
    after: number | null;
    deltaPct: number | null;
    t: number;
    df: number;
    p: number;
    significant: boolean;
}
export interface ChangeImpactResult {
    event: ChangeEvent;
    before: {
        start: CivilDate;
        end: CivilDate;
        days: number;
    };
    after: {
        start: CivilDate;
        end: CivilDate;
        days: number;
    };
    metrics: ChangeImpactMetric[];
    note?: string;
}
export interface ChangeEventsResponse {
    events: ChangeEvent[];
    range: {
        start: CivilDate;
        end: CivilDate;
    };
    warnings: string[];
}
