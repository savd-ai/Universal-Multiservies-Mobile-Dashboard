import { z } from "zod";
import { CAMPAIGN_TYPES, type CivilDate, type Mode, type Severity } from "../types";
export const SIGNAL_KINDS = ["metric_deviation", "pacing", "overdelivery", "tracking_break", "zero_delivery", "budget_limited", "threshold"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export const DETECTOR_IDS = ["zscore", "robust", "seasonal", "threshold", "pacing", "tracking_break", "zero_delivery", "budget_limited"] as const;
export type DetectorId = (typeof DETECTOR_IDS)[number];
export const MONITORED_METRICS = ["spend", "conversions", "cpa", "ctr", "cpc", "cvr", "roas"] as const;
export type MonitoredMetric = (typeof MONITORED_METRICS)[number];
export const CHANGE_CATEGORIES = ["bidding", "bid_target", "budget", "landing", "creative", "status", "keywords", "negatives", "targeting", "other"] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];
export const CHANGE_ACTIONS = ["raised", "lowered", "switched", "paused", "enabled", "removed", "added", "updated"] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];
export interface SignalRelatedChange {
    eventId: string;
    ts: string;
    summary: string;
    relevance: "high" | "medium" | "low";
    lagDays: number;
    category?: ChangeCategory;
    clientLabel?: string;
    automated?: boolean;
    campaignId?: string;
    effect?: string;
}
export const CHANGE_VERDICTS = ["expected", "learning", "likely_cause", "possible_cause", "no_recent_changes", "none"] as const;
export type ChangeVerdict = (typeof CHANGE_VERDICTS)[number];
export interface SignalChangeContext {
    verdict: ChangeVerdict;
    eventId?: string;
    note: string;
    lagDays?: number;
    learning?: {
        day: number;
        days: number;
    };
    severityBefore?: Severity;
}
export interface Signal {
    id: string;
    accountId: string;
    mode: Mode;
    scope: "account" | "campaign" | "platform";
    entity: {
        id: string;
        name: string;
        type?: string;
    };
    kind: SignalKind;
    detectors: DetectorId[];
    ruleId?: string;
    metric?: string;
    direction?: "up" | "down";
    polarity: "bad" | "good";
    severity: Severity;
    score: number;
    observed: number;
    expected: number;
    changePct: number;
    z?: number;
    band?: {
        lo: number;
        hi: number;
    };
    window: {
        recentStart: CivilDate;
        recentEnd: CivilDate;
        baselineStart?: CivilDate;
        baselineEnd?: CivilDate;
    };
    onsetDate?: CivilDate;
    series: {
        date: CivilDate;
        value: number | null;
    }[];
    title: string;
    summary: string;
    recommendation: string;
    evidence: {
        label: string;
        value: string;
    }[];
    relatedChanges: SignalRelatedChange[];
    changeContext?: SignalChangeContext;
    cpaDrivers?: {
        cpc: number;
        cvr: number;
    };
    format: "money" | "number" | "decimal" | "percent" | "ratio";
    dataAsOf: CivilDate;
    detectedAt: string;
}
export type SignalStatus = "open" | "acknowledged" | "snoozed" | "resolved";
export interface SignalState {
    id: string;
    scopeKey: string;
    status: SignalStatus;
    snoozedUntil?: string;
    firstSeenAt: string;
    lastSeenAt: string;
    lastSeverity: Severity;
    resolvedAt?: string;
    notes: {
        at: string;
        text: string;
    }[];
    history: {
        at: string;
        from: SignalStatus;
        to: SignalStatus;
        by: "user" | "system";
    }[];
    lastAlerted?: {
        at: string;
        severity: Severity;
    };
    missedEvaluations?: number;
    snapshot?: Omit<Signal, "series">;
    supersededBy?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface SignalView extends Signal {
    status: SignalStatus;
    snoozedUntil?: string;
    notes: {
        at: string;
        text: string;
    }[];
    firstSeenAt?: string;
    statusChangedAt?: string;
    history?: {
        at: string;
        from: SignalStatus;
        to: SignalStatus;
        by: "user" | "system";
    }[];
}
export const thresholdRuleSchema = z.object({
    id: z.string().max(64).optional(),
    name: z.string().min(1).max(80),
    enabled: z.boolean().default(true),
    scope: z.object({
        level: z.enum(["account", "campaign"]).default("campaign"),
        campaignIds: z.array(z.string().max(64)).max(200).optional(),
        campaignTypes: z.array(z.enum(CAMPAIGN_TYPES)).optional(),
    }),
    metric: z.string().min(1).max(64),
    op: z.enum(["gt", "gte", "lt", "lte", "change_pct_gt", "change_pct_lt"]),
    value: z.number(),
    window: z.object({ kind: z.enum(["last_n_days", "consecutive_days"]), days: z.number().int().min(1).max(30) }),
    severity: z.enum(["critical", "warning", "info"]),
});
export type ThresholdRule = z.infer<typeof thresholdRuleSchema> & {
    id: string;
};
export const anomalySettingsSchema = z.object({
    zscore: z
        .object({
        enabled: z.boolean().default(true),
        threshold: z.number().min(1).max(8).default(2.5),
        baselineDays: z.union([z.literal(7), z.literal(14), z.literal(28)]).default(14),
        recentDays: z.number().int().min(1).max(7).default(3),
        metrics: z.record(z.enum(MONITORED_METRICS), z.boolean()).default({ spend: true, conversions: true, cpa: true, ctr: true, cpc: false, cvr: false, roas: false }),
    })
        .default({ enabled: true, threshold: 2.5, baselineDays: 14, recentDays: 3, metrics: { spend: true, conversions: true, cpa: true, ctr: true, cpc: false, cvr: false, roas: false } }),
    robust: z.object({ enabled: z.boolean().default(false), threshold: z.number().min(1).max(10).default(3.5), baselineDays: z.number().int().min(7).max(56).default(28) }).default({ enabled: false, threshold: 3.5, baselineDays: 28 }),
    seasonal: z.object({ enabled: z.boolean().default(false), weeks: z.number().int().min(2).max(8).default(4), threshold: z.number().min(1).max(10).default(3) }).default({ enabled: false, weeks: 4, threshold: 3 }),
    pacing: z
        .object({
        enabled: z.boolean().default(true),
        over: z.number().default(1.05),
        overCritical: z.number().default(1.2),
        under: z.number().default(0.9),
        dailyOver: z.number().min(1).max(3).optional(),
        dailyOverCritical: z.number().min(1).max(3).optional(),
    })
        .default({ enabled: true, over: 1.05, overCritical: 1.2, under: 0.9 }),
    trackingBreak: z.object({ enabled: z.boolean().default(true), minBaselineConvPerDay: z.number().default(2), minClicksPerDay: z.number().default(30) }).default({ enabled: true, minBaselineConvPerDay: 2, minClicksPerDay: 30 }),
    zeroDelivery: z.object({ enabled: z.boolean().default(true), minBaselineImpr: z.number().default(100) }).default({ enabled: true, minBaselineImpr: 100 }),
    budgetLimited: z.object({ enabled: z.boolean().default(true), minLostIsBudget: z.number().default(0.2), roasVsAccount: z.number().default(1.1) }).default({ enabled: true, minLostIsBudget: 0.2, roasVsAccount: 1.1 }),
    minVolume: z.object({ clicksPerDay: z.number().default(5), imprPerDay: z.number().default(50), convPerDay: z.number().default(0.5) }).default({ clicksPerDay: 5, imprPerDay: 50, convPerDay: 0.5 }),
    changeHistory: z
        .object({
        enabled: z.boolean().default(true),
        lookbackDays: z.number().int().min(1).max(14).default(3),
        learningDays: z.number().int().min(0).max(21).default(7),
        downgradeExpected: z.boolean().default(true),
        capDuringLearning: z.boolean().default(true),
    })
        .default({ enabled: true, lookbackDays: 3, learningDays: 7, downgradeExpected: true, capDuringLearning: true }),
    excludeCampaignIds: z.array(z.string()).default([]),
    thresholdRules: z.array(thresholdRuleSchema.extend({ id: z.string() })).default([]),
});
export type AnomalySettings = z.infer<typeof anomalySettingsSchema>;
export function defaultAnomalySettings(): AnomalySettings {
    return anomalySettingsSchema.parse({});
}
export const signalActionSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("acknowledge"), note: z.string().max(500).optional() }),
    z.object({ action: z.literal("snooze"), hours: z.number().int().min(1).max(24 * 30), note: z.string().max(500).optional() }),
    z.object({ action: z.literal("resolve"), note: z.string().max(500).optional() }),
    z.object({ action: z.literal("reopen") }),
]);
export type SignalAction = z.infer<typeof signalActionSchema>;
export interface AnomalyFeedResponse {
    signals: SignalView[];
    counts: {
        all: number;
        critical: number;
        warning: number;
        info: number;
        open: number;
    };
    settings: AnomalySettings;
    dataThrough: CivilDate;
    mode: Mode;
    preview: boolean;
    warnings: string[];
    generatedAt: string;
}
export interface RulePreviewResult {
    ruleId: string;
    days: {
        date: CivilDate;
        hits: {
            entityId: string;
            entityName: string;
            observed: number;
            severity: Severity;
        }[];
    }[];
    totalHits: number;
}
