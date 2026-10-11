import "server-only";
import { SIMULATION_TYPES, type CampaignSimulation, type GoogleRecommendation, type RecommendationImpact, type RecommendationMetrics, type SimulationModification, type SimulationPoint, type SimulationType, } from "@/lib/domain/contracts/estimates";
import { isCivilDate } from "@/lib/domain/dates";
import { at, fromMicros, idFromResourceName, isRecord, text, toNumber, type GoogleAdsRow } from "./json";
const 谍壍: Record<SimulationType, string> = { BUDGET: "budgetPointList", TARGET_CPA: "targetCpaPointList", TARGET_ROAS: "targetRoasPointList" };
const 壼壍: readonly SimulationModification[] = ["UNIFORM", "DEFAULT", "SCALING"];
const 矫壍: RecommendationMetrics = { impressions: null, clicks: null, cost: null, conversions: null, convValue: null, videoViews: null };
const 雚壍 = (揉壍: unknown): number | null => {
    const 芸壍 = toNumber(揉壍);
    return 芸壍 === null ? null : fromMicros(芸壍);
};
const 侧壍 = (準壍: number | null): number | null => (準壍 !== null && 準壍 > 0 ? 準壍 : null);
const 超壍 = (婴壍: Record<string, unknown>, 祣壍: string): number => toNumber(婴壍[祣壍]) ?? 0;
const 顒壍 = (敁壍: string | undefined): 敁壍 is SimulationType => (SIMULATION_TYPES as readonly string[]).includes(敁壍 ?? "");
function 萰壍(償壍: SimulationType, 瀎壍: Record<string, unknown>): {
    value: number;
    relative: boolean;
} | null {
    if (償壍 === "BUDGET") {
        const 軽壍 = 侧壍(雚壍(瀎壍.budgetAmountMicros));
        return 軽壍 === null ? null : { value: 軽壍, relative: false };
    }
    if (償壍 === "TARGET_CPA") {
        const 寬壍 = 侧壍(雚壍(瀎壍.targetCpaMicros));
        if (寬壍 !== null)
            return { value: 寬壍, relative: false };
        const 竛壍 = 侧壍(toNumber(瀎壍.targetCpaScalingModifier));
        return 竛壍 === null ? null : { value: 竛壍, relative: true };
    }
    const 駊壍 = 侧壍(toNumber(瀎壍.targetRoas));
    return 駊壍 === null ? null : { value: 駊壍, relative: false };
}
function 暹壍(薨壍: SimulationType, 劗壍: unknown): (SimulationPoint & {
    relative: boolean;
}) | null {
    if (!isRecord(劗壍))
        return null;
    const 熆壍 = 萰壍(薨壍, 劗壍);
    if (!熆壍)
        return null;
    const 遵壍 = 雚壍(劗壍.costMicros) ?? 0;
    const 嵤壍 = 超壍(劗壍, "clicks");
    const 籓壍 = 超壍(劗壍, "impressions");
    if (遵壍 <= 0 && 嵤壍 <= 0 && 籓壍 <= 0)
        return null;
    return {
        value: 熆壍.value,
        cost: 遵壍,
        clicks: 嵤壍,
        impressions: 籓壍,
        conversions: 超壍(劗壍, "biddableConversions"),
        convValue: 超壍(劗壍, "biddableConversionsValue"),
        requiredBudget: 薨壍 === "BUDGET" ? null : 侧壍(雚壍(劗壍.requiredBudgetAmountMicros)),
        relative: 熆壍.relative,
    };
}
export function toCampaignSimulation(魂壍: GoogleAdsRow): CampaignSimulation | null {
    const 栱壍 = text(魂壍, "campaignSimulation.campaignId");
    const 蜠壍 = text(魂壍, "campaignSimulation.type");
    const 吏壍 = text(魂壍, "campaignSimulation.startDate");
    const 狾壍 = text(魂壍, "campaignSimulation.endDate");
    if (!栱壍 || !顒壍(蜠壍) || !吏壍 || !狾壍 || !isCivilDate(吏壍) || !isCivilDate(狾壍) || 吏壍 > 狾壍)
        return null;
    const 釭壍 = at(魂壍, `campaignSimulation.${谍壍[蜠壍]}.points`);
    const 廜壍 = (Array.isArray(釭壍) ? 釭壍 : []).map((緋壍) => 暹壍(蜠壍, 緋壍)).filter((鲺壍): 鲺壍 is SimulationPoint & {
        relative: boolean;
    } => 鲺壍 !== null);
    if (!廜壍.length)
        return null;
    const 榩壍 = 廜壍.some((袘壍) => 袘壍.relative);
    const 喇壍 = 廜壍
        .filter((瑶壍) => 瑶壍.relative === 榩壍)
        .map(({ relative: _鍥壍, ...恔壍 }) => 恔壍)
        .sort((罃壍, 鸲壍) => 罃壍.value - 鸲壍.value);
    const 次壍 = text(魂壍, "campaignSimulation.modificationMethod");
    const 訐壍 = 壼壍.find((囿壍) => 囿壍 === 次壍) ?? "UNKNOWN";
    return { campaignId: 栱壍, type: 蜠壍, modification: 訐壍, start: 吏壍, end: 狾壍, points: 喇壍, ...(榩壍 ? { relative: true } : {}) };
}
export function mapCampaignSimulations(痮壍: readonly GoogleAdsRow[]): CampaignSimulation[] {
    return 痮壍.map(toCampaignSimulation).filter((铝壍): 铝壍 is CampaignSimulation => 铝壍 !== null);
}
function 懌壍(肻壍: unknown): RecommendationMetrics | null {
    if (!isRecord(肻壍))
        return null;
    const 龪壍 = (沙壍: string) => toNumber(肻壍[沙壍]);
    return { impressions: 龪壍("impressions"), clicks: 龪壍("clicks"), cost: 雚壍(肻壍.costMicros), conversions: 龪壍("conversions"), convValue: 龪壍("conversionsValue"), videoViews: 龪壍("videoViews") };
}
function 讈壍(塷壍: unknown): RecommendationImpact | null {
    if (!isRecord(塷壍))
        return null;
    const 睦壍 = 懌壍(塷壍.baseMetrics);
    const 陕壍 = 懌壍(塷壍.potentialMetrics);
    if (!睦壍 && !陕壍)
        return null;
    return { base: 睦壍 ?? 矫壍, potential: 陕壍 ?? 矫壍 };
}
export function toRecommendation(捄壍: GoogleAdsRow): GoogleRecommendation | null {
    const 舳壍 = text(捄壍, "recommendation.resourceName");
    const 伢壍 = text(捄壍, "recommendation.type");
    if (!舳壍 || !伢壍)
        return null;
    const 渑壍 = at(捄壍, "recommendation.campaigns");
    const 贀壍 = [...new Set((Array.isArray(渑壍) ? 渑壍 : []).map((姯壍) => (typeof 姯壍 === "string" ? idFromResourceName(姯壍) : undefined)).filter((磞壍): 磞壍 is string => !!磞壍))];
    const 韍壍 = idFromResourceName(text(捄壍, "recommendation.campaign"));
    if (韍壍 && !贀壍.includes(韍壍))
        贀壍.push(韍壍);
    const 撼壍 = at(捄壍, "recommendation.campaignBudgetRecommendation");
    const 莫壍 = isRecord(撼壍) ? 撼壍 : {};
    const 傚壍 = (Array.isArray(莫壍.budgetOptions) ? 莫壍.budgetOptions : [])
        .flatMap((澉壍) => {
        if (!isRecord(澉壍))
            return [];
        const 蹸壍 = 侧壍(雚壍(澉壍.budgetAmountMicros));
        return 蹸壍 === null ? [] : [{ budget: 蹸壍, impact: 讈壍(澉壍.impact) }];
    })
        .sort((孧壍, 穖壍) => 孧壍.budget - 穖壍.budget);
    return {
        id: idFromResourceName(舳壍) ?? 舳壍,
        type: 伢壍,
        campaignId: 贀壍.length === 1 ? (贀壍[0] as string) : null,
        campaignIds: 贀壍,
        budgetId: idFromResourceName(text(捄壍, "recommendation.campaignBudget")) ?? null,
        currentBudget: 侧壍(雚壍(莫壍.currentBudgetAmountMicros)),
        recommendedBudget: 侧壍(雚壍(莫壍.recommendedBudgetAmountMicros)),
        options: 傚壍,
        impact: 讈壍(at(捄壍, "recommendation.impact")),
        dismissed: at(捄壍, "recommendation.dismissed") === true,
    };
}
export function mapRecommendations(饅壍: readonly GoogleAdsRow[]): GoogleRecommendation[] {
    return 饅壍.map(toRecommendation).filter((昴壍): 昴壍 is GoogleRecommendation => 昴壍 !== null);
}
