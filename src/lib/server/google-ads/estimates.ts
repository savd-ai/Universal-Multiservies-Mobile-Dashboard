import "server-only";
import { SIMULATION_TYPES, type CampaignSimulation, type GoogleRecommendation, type RecommendationImpact, type RecommendationMetrics, type SimulationModification, type SimulationPoint, type SimulationType, } from "@/lib/domain/contracts/estimates";
import { isCivilDate } from "@/lib/domain/dates";
import { at, fromMicros, idFromResourceName, isRecord, text, toNumber, type GoogleAdsRow } from "./json";
const POINT_LISTS: Record<SimulationType, string> = { BUDGET: "budgetPointList", TARGET_CPA: "targetCpaPointList", TARGET_ROAS: "targetRoasPointList" };
const MODIFICATIONS: readonly SimulationModification[] = ["UNIFORM", "DEFAULT", "SCALING"];
const EMPTY_METRICS: RecommendationMetrics = { impressions: null, clicks: null, cost: null, conversions: null, convValue: null, videoViews: null };
const micros = (v: unknown): number | null => {
    const n = toNumber(v);
    return n === null ? null : fromMicros(n);
};
const positive = (v: number | null): number | null => (v !== null && v > 0 ? v : null);
const count = (p: Record<string, unknown>, key: string): number => toNumber(p[key]) ?? 0;
const isSimulationType = (v: string | undefined): v is SimulationType => (SIMULATION_TYPES as readonly string[]).includes(v ?? "");
function simulatedSetting(simulationType: SimulationType, p: Record<string, unknown>): {
    value: number;
    relative: boolean;
} | null {
    if (simulationType === "BUDGET") {
        const v = positive(micros(p.budgetAmountMicros));
        return v === null ? null : { value: v, relative: false };
    }
    if (simulationType === "TARGET_CPA") {
        const v = positive(micros(p.targetCpaMicros));
        if (v !== null)
            return { value: v, relative: false };
        const m = positive(toNumber(p.targetCpaScalingModifier));
        return m === null ? null : { value: m, relative: true };
    }
    const roas = positive(toNumber(p.targetRoas));
    return roas === null ? null : { value: roas, relative: false };
}
function toPoint(simulationType: SimulationType, raw: unknown): (SimulationPoint & {
    relative: boolean;
}) | null {
    if (!isRecord(raw))
        return null;
    const setting = simulatedSetting(simulationType, raw);
    if (!setting)
        return null;
    const cost = micros(raw.costMicros) ?? 0;
    const clicks = count(raw, "clicks");
    const impressions = count(raw, "impressions");
    if (cost <= 0 && clicks <= 0 && impressions <= 0)
        return null;
    return {
        value: setting.value,
        cost,
        clicks,
        impressions,
        conversions: count(raw, "biddableConversions"),
        convValue: count(raw, "biddableConversionsValue"),
        requiredBudget: simulationType === "BUDGET" ? null : positive(micros(raw.requiredBudgetAmountMicros)),
        relative: setting.relative,
    };
}
export function toCampaignSimulation(row: GoogleAdsRow): CampaignSimulation | null {
    const campaignId = text(row, "campaignSimulation.campaignId");
    const text2 = text(row, "campaignSimulation.type");
    const start = text(row, "campaignSimulation.startDate");
    const end = text(row, "campaignSimulation.endDate");
    if (!campaignId || !isSimulationType(text2) || !start || !end || !isCivilDate(start) || !isCivilDate(end) || start > end)
        return null;
    const list = at(row, `campaignSimulation.${POINT_LISTS[text2]}.points`);
    const points = (Array.isArray(list) ? list : []).map((p) => toPoint(text2, p)).filter((p): p is SimulationPoint & {
        relative: boolean;
    } => p !== null);
    if (!points.length)
        return null;
    const relative = points.some((p) => p.relative);
    const kept = points
        .filter((p) => p.relative === relative)
        .map(({ relative: _relative, ...p }) => p)
        .sort((a, b) => a.value - b.value);
    const method = text(row, "campaignSimulation.modificationMethod");
    const modification = MODIFICATIONS.find((m) => m === method) ?? "UNKNOWN";
    return { campaignId, type: text2, modification, start, end, points: kept, ...(relative ? { relative: true } : {}) };
}
export function mapCampaignSimulations(rows: readonly GoogleAdsRow[]): CampaignSimulation[] {
    return rows.map(toCampaignSimulation).filter((s): s is CampaignSimulation => s !== null);
}
function toMetrics(raw: unknown): RecommendationMetrics | null {
    if (!isRecord(raw))
        return null;
    const n = (key: string) => toNumber(raw[key]);
    return { impressions: n("impressions"), clicks: n("clicks"), cost: micros(raw.costMicros), conversions: n("conversions"), convValue: n("conversionsValue"), videoViews: n("videoViews") };
}
function toImpact(raw: unknown): RecommendationImpact | null {
    if (!isRecord(raw))
        return null;
    const base = toMetrics(raw.baseMetrics);
    const potential = toMetrics(raw.potentialMetrics);
    if (!base && !potential)
        return null;
    return { base: base ?? EMPTY_METRICS, potential: potential ?? EMPTY_METRICS };
}
export function toRecommendation(row: GoogleAdsRow): GoogleRecommendation | null {
    const resourceName = text(row, "recommendation.resourceName");
    const text2 = text(row, "recommendation.type");
    if (!resourceName || !text2)
        return null;
    const listed = at(row, "recommendation.campaigns");
    const campaignIds = [...new Set((Array.isArray(listed) ? listed : []).map((n) => (typeof n === "string" ? idFromResourceName(n) : undefined)).filter((id): id is string => !!id))];
    const single = idFromResourceName(text(row, "recommendation.campaign"));
    if (single && !campaignIds.includes(single))
        campaignIds.push(single);
    const rawBudget = at(row, "recommendation.campaignBudgetRecommendation");
    const budget = isRecord(rawBudget) ? rawBudget : {};
    const options = (Array.isArray(budget.budgetOptions) ? budget.budgetOptions : [])
        .flatMap((o) => {
        if (!isRecord(o))
            return [];
        const amount = positive(micros(o.budgetAmountMicros));
        return amount === null ? [] : [{ budget: amount, impact: toImpact(o.impact) }];
    })
        .sort((a, b) => a.budget - b.budget);
    return {
        id: idFromResourceName(resourceName) ?? resourceName,
        type: text2,
        campaignId: campaignIds.length === 1 ? (campaignIds[0] as string) : null,
        campaignIds,
        budgetId: idFromResourceName(text(row, "recommendation.campaignBudget")) ?? null,
        currentBudget: positive(micros(budget.currentBudgetAmountMicros)),
        recommendedBudget: positive(micros(budget.recommendedBudgetAmountMicros)),
        options,
        impact: toImpact(at(row, "recommendation.impact")),
        dismissed: at(row, "recommendation.dismissed") === true,
    };
}
export function mapRecommendations(rows: readonly GoogleAdsRow[]): GoogleRecommendation[] {
    return rows.map(toRecommendation).filter((r): r is GoogleRecommendation => r !== null);
}
