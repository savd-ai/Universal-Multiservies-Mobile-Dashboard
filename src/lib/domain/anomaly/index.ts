import type { AnomalySettings, Signal, ThresholdRule } from "../contracts/anomaly";
import type { PacingReport } from "../contracts/budget";
import { addDays, enumerate } from "../dates";
import type { MetricRegistry } from "../metrics/registry";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "../schema/facts";
import type { CivilDate, Mode } from "../types";
import { correlateChanges } from "./correlate";
import { detectBudgetLimited, detectPacing, detectRobust, detectSeasonal, detectThreshold, detectTrackingBreak, detectZeroDelivery, detectZscore, evaluateRule, ruleEntities, type DetectorContext, } from "./detectors";
import { absorbSymptoms, mergeSignals, sortSignals } from "./merge";
import { buildCampaignSeries, combineSeries, dateAt, type EntitySeries } from "./series";
export const DETECTION_LOOKBACK_DAYS = 100;
export const CHANGE_HISTORY_DAYS = 45;
export interface DetectionInput {
    accountId: string;
    accountName: string;
    mode: Mode;
    currency: string;
    dataThrough: CivilDate;
    now: string;
    settings: AnomalySettings;
    campaigns: readonly CampaignDim[];
    rows: readonly CampaignDailyRow[];
    changeEvents?: readonly ChangeEvent[];
    changeHistoryAvailable?: boolean;
    changeHistoryFrom?: CivilDate;
    pacing?: PacingReport | null;
    registry?: MetricRegistry;
    conversionLag?: boolean;
}
export interface DetectionResult {
    signals: Signal[];
    warnings: string[];
}
export function isMonitorable(c: CampaignDim | undefined, settings: AnomalySettings, dataThrough: CivilDate): boolean {
    if (!c)
        return false;
    if (c.status !== "Enabled")
        return false;
    if (settings.excludeCampaignIds.includes(c.id))
        return false;
    if (c.end && c.end < dataThrough)
        return false;
    return true;
}
interface Prepared {
    ctx: DetectorContext;
    all: Map<string, EntitySeries>;
    monitorable: EntitySeries[];
    account: EntitySeries;
    dates: CivilDate[];
}
function prepare(input: DetectionInput): Prepared {
    const start = addDays(input.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1));
    const all = buildCampaignSeries(input.rows, input.campaigns, start, input.dataThrough);
    const monitorable = [...all.values()].filter((s) => isMonitorable(s.campaign, input.settings, input.dataThrough));
    const dates = enumerate(start, input.dataThrough);
    const account = combineSeries(input.accountId, input.accountName, [...all.values()], dates);
    const ctx: DetectorContext = {
        accountId: input.accountId,
        accountName: input.accountName,
        mode: input.mode,
        currency: input.currency,
        dataThrough: input.dataThrough,
        now: input.now,
        settings: input.settings,
        conversionLag: input.conversionLag ?? false,
        registry: input.registry,
    };
    return { ctx, all, monitorable, account, dates };
}
export function detectSignals(input: DetectionInput): DetectionResult {
    const { ctx, all, monitorable, account, dates } = prepare(input);
    const warnings: string[] = [];
    const raw: Signal[] = [];
    if (!dates.length)
        return { signals: [], warnings };
    detectZscore(ctx, monitorable, raw);
    detectRobust(ctx, monitorable, raw);
    detectSeasonal(ctx, monitorable, raw);
    detectThreshold(ctx, monitorable, account, raw, warnings);
    detectPacing(ctx, input.pacing, all, dates, new Set(monitorable.map((s) => s.id)), raw);
    detectTrackingBreak(ctx, monitorable, raw);
    if (!raw.some((s) => s.kind === "tracking_break"))
        detectTrackingBreak(ctx, [account], raw);
    detectZeroDelivery(ctx, monitorable, raw);
    detectBudgetLimited(ctx, monitorable, [...all.values()], raw);
    const unitCampaigns = new Map((input.pacing?.rows ?? []).filter((r) => r.unitId.startsWith("budget:")).map((r) => [r.unitId, r.campaignIds] as const));
    const merged = absorbSymptoms(mergeSignals(raw), ctx.accountId);
    const correlated = correlateChanges(merged, input.changeEvents ?? [], {
        settings: input.settings.changeHistory,
        available: input.changeHistoryAvailable ?? input.changeEvents !== undefined,
        from: input.changeHistoryFrom,
        currency: input.currency,
        unitCampaigns,
    });
    return { signals: sortSignals(correlated), warnings };
}
export function previewThresholdRule(input: DetectionInput, rule: ThresholdRule, days = 30): {
    date: CivilDate;
    hits: {
        entityId: string;
        entityName: string;
        observed: number;
    }[];
}[] {
    const { monitorable, account } = prepare(input);
    if (!input.registry)
        return [];
    const entities = ruleEntities(rule, monitorable, account);
    const out: {
        date: CivilDate;
        hits: {
            entityId: string;
            entityName: string;
            observed: number;
        }[];
    }[] = [];
    const last = account.days.length - 1;
    for (let end = Math.max(0, last - days + 1); end <= last; end++) {
        const hits: {
            entityId: string;
            entityName: string;
            observed: number;
        }[] = [];
        for (const s of entities) {
            const hit = evaluateRule(rule, s, input.registry, end);
            if (hit)
                hits.push({ entityId: s === account ? input.accountId : s.id, entityName: s.name, observed: hit.observed });
        }
        out.push({ date: dateAt(account, end), hits });
    }
    return out;
}
export { AUTO_RESOLVE_AFTER, applySignalAction, joinSignals, planEvaluation, resolvedView } from "./lifecycle";
