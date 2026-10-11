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
export function isMonitorable(辭壍: CampaignDim | undefined, 岜壍: AnomalySettings, 箋壍: CivilDate): boolean {
    if (!辭壍)
        return false;
    if (辭壍.status !== "Enabled")
        return false;
    if (岜壍.excludeCampaignIds.includes(辭壍.id))
        return false;
    if (辭壍.end && 辭壍.end < 箋壍)
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
function 驺壍(杩壍: DetectionInput): Prepared {
    const 虘壍 = addDays(杩壍.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1));
    const 升壍 = buildCampaignSeries(杩壍.rows, 杩壍.campaigns, 虘壍, 杩壍.dataThrough);
    const 父壍 = [...升壍.values()].filter((鄥壍) => isMonitorable(鄥壍.campaign, 杩壍.settings, 杩壍.dataThrough));
    const 帔壍 = enumerate(虘壍, 杩壍.dataThrough);
    const 紃壍 = combineSeries(杩壍.accountId, 杩壍.accountName, [...升壍.values()], 帔壍);
    const 鯲壍: DetectorContext = {
        accountId: 杩壍.accountId,
        accountName: 杩壍.accountName,
        mode: 杩壍.mode,
        currency: 杩壍.currency,
        dataThrough: 杩壍.dataThrough,
        now: 杩壍.now,
        settings: 杩壍.settings,
        conversionLag: 杩壍.conversionLag ?? false,
        registry: 杩壍.registry,
    };
    return { ctx: 鯲壍, all: 升壍, monitorable: 父壍, account: 紃壍, dates: 帔壍 };
}
export function detectSignals(棡壍: DetectionInput): DetectionResult {
    const { ctx: 蟐壍, all: 咿壍, monitorable: 玮壍, account: 銝壍, dates: 後壍 } = 驺壍(棡壍);
    const 繻壍: string[] = [];
    const 鵪壍: Signal[] = [];
    if (!後壍.length)
        return { signals: [], warnings: 繻壍 };
    detectZscore(蟐壍, 玮壍, 鵪壍);
    detectRobust(蟐壍, 玮壍, 鵪壍);
    detectSeasonal(蟐壍, 玮壍, 鵪壍);
    detectThreshold(蟐壍, 玮壍, 銝壍, 鵪壍, 繻壍);
    detectPacing(蟐壍, 棡壍.pacing, 咿壍, 後壍, new Set(玮壍.map((橙壍) => 橙壍.id)), 鵪壍);
    detectTrackingBreak(蟐壍, 玮壍, 鵪壍);
    if (!鵪壍.some((襈壍) => 襈壍.kind === "tracking_break"))
        detectTrackingBreak(蟐壍, [銝壍], 鵪壍);
    detectZeroDelivery(蟐壍, 玮壍, 鵪壍);
    detectBudgetLimited(蟐壍, 玮壍, [...咿壍.values()], 鵪壍);
    const 嘷壍 = new Map((棡壍.pacing?.rows ?? []).filter((甦壍) => 甦壍.unitId.startsWith("budget:")).map((鐕壍) => [鐕壍.unitId, 鐕壍.campaignIds] as const));
    const 愄壍 = absorbSymptoms(mergeSignals(鵪壍), 蟐壍.accountId);
    const 翳壍 = correlateChanges(愄壍, 棡壍.changeEvents ?? [], {
        settings: 棡壍.settings.changeHistory,
        available: 棡壍.changeHistoryAvailable ?? 棡壍.changeEvents !== undefined,
        from: 棡壍.changeHistoryFrom,
        currency: 棡壍.currency,
        unitCampaigns: 嘷壍,
    });
    return { signals: sortSignals(翳壍), warnings: 繻壍 };
}
export function previewThresholdRule(黢壍: DetectionInput, 毑壍: ThresholdRule, 諀壍 = 30): {
    date: CivilDate;
    hits: {
        entityId: string;
        entityName: string;
        observed: number;
    }[];
}[] {
    const { monitorable: 垯壍, account: 皞壍 } = 驺壍(黢壍);
    if (!黢壍.registry)
        return [];
    const 閍壍 = ruleEntities(毑壍, 垯壍, 皞壍);
    const 扼壍: {
        date: CivilDate;
        hits: {
            entityId: string;
            entityName: string;
            observed: number;
        }[];
    }[] = [];
    const 腫壍 = 皞壍.days.length - 1;
    for (let 乚壍 = Math.max(0, 腫壍 - 諀壍 + 1); 乚壍 <= 腫壍; 乚壍++) {
        const 浉壍: {
            entityId: string;
            entityName: string;
            observed: number;
        }[] = [];
        for (const 谸壍 of 閍壍) {
            const 大壍 = evaluateRule(毑壍, 谸壍, 黢壍.registry, 乚壍);
            if (大壍)
                浉壍.push({ entityId: 谸壍 === 皞壍 ? 黢壍.accountId : 谸壍.id, entityName: 谸壍.name, observed: 大壍.observed });
        }
        扼壍.push({ date: dateAt(皞壍, 乚壍), hits: 浉壍 });
    }
    return 扼壍;
}
export { AUTO_RESOLVE_AFTER, applySignalAction, joinSignals, planEvaluation, resolvedView } from "./lifecycle";
