import type { CampaignSimulation, GoogleEstimates, GoogleRecommendation, RecommendationImpact, RecommendationMetrics, SimulationPoint } from "@/lib/domain/contracts/estimates";
import { addDays } from "@/lib/domain/dates";
import { seedRng } from "@/lib/domain/rng";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { clamp, round } from "@/lib/domain/stats";
import type { CivilDate } from "@/lib/domain/types";
import type { DemoDataset } from "./generator";
export const DEMO_SIMULATION_DAYS = 7;
export const BUDGET_MULTIPLIERS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const TARGET_MULTIPLIERS = [0.7, 0.85, 1, 1.15, 1.3, 1.5] as const;
export const RECOMMENDATION_MULTIPLIERS = [1.25, 1.5, 2] as const;
export const BUDGET_LIMITED_SHARE = 0.2;
const 癀壍 = new Set<CampaignDim["type"]>(["Search", "Shopping", "Display"]);
const 锯壍 = 1.5;
interface WindowTotals {
    days: number;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    convValue: number;
    isEligible: number;
    isLostBudget: number;
}
function 戞壍(脍壍: DemoDataset, 鿼壍: string, 泫壍: CivilDate, 诚壍: CivilDate): WindowTotals {
    const 壉壍: WindowTotals = { days: DEMO_SIMULATION_DAYS, cost: 0, clicks: 0, impressions: 0, conversions: 0, convValue: 0, isEligible: 0, isLostBudget: 0 };
    for (const 瞸壍 of 脍壍.tables.campaign_daily) {
        if (瞸壍.campaign_id !== 鿼壍 || 瞸壍.date < 泫壍 || 瞸壍.date > 诚壍)
            continue;
        壉壍.cost += 瞸壍.cost;
        壉壍.clicks += 瞸壍.clicks;
        壉壍.impressions += 瞸壍.impressions;
        壉壍.conversions += 瞸壍.conversions;
        壉壍.convValue += 瞸壍.conv_value;
        壉壍.isEligible += 瞸壍.is_eligible ?? 0;
        壉壍.isLostBudget += 瞸壍.is_lost_budget ?? 0;
    }
    return 壉壍;
}
function 隧壍(掖壍: CampaignDim, 芅壍: WindowTotals): number {
    if (芅壍.isEligible > 0)
        return 芅壍.isLostBudget / 芅壍.isEligible;
    const 佴壍 = 掖壍.budget_daily ? 芅壍.cost / 芅壍.days / 掖壍.budget_daily : 0;
    return clamp((佴壍 - 0.92) * 2.5, 0, 0.3);
}
export function spendElasticity(湣壍: number): number {
    return clamp(0.1 + 2.6 * 湣壍, 0.1, 0.85);
}
interface DayShape {
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    aov: number;
}
function 赒壍(婁壍: number, 礰壍: DayShape, 頟壍: number, 攎壍: number, 菽壍: number, 僬壍: number | null): SimulationPoint {
    const 濛壍 = 礰壍.cost > 0 ? 頟壍 / 礰壍.cost : 0;
    const 車壍 = 礰壍.conversions * 濛壍 ** 攎壍;
    return {
        value: round(婁壍, 2),
        cost: round(頟壍 * 菽壍, 2),
        clicks: Math.round(礰壍.clicks * 濛壍 ** 0.85 * 菽壍),
        impressions: Math.round(礰壍.impressions * 濛壍 ** 0.9 * 菽壍),
        conversions: round(車壍 * 菽壍, 2),
        convValue: round(車壍 * 礰壍.aov * 菽壍, 2),
        requiredBudget: 僬壍 === null ? null : round(僬壍, 2),
    };
}
function 容壍(窨壍: SimulationPoint, 馗壍: number): RecommendationMetrics {
    return { impressions: round(窨壍.impressions * 馗壍, 0), clicks: round(窨壍.clicks * 馗壍, 0), cost: round(窨壍.cost * 馗壍, 2), conversions: round(窨壍.conversions * 馗壍, 2), convValue: round(窨壍.convValue * 馗壍, 2), videoViews: null };
}
function 暆壍(蕵壍: CampaignDim, 剤壍: CampaignSimulation, 煓壍: number, 遂壍: number): GoogleRecommendation | null {
    const 崱壍 = 蕵壍.budget_daily as number;
    const 簠壍 = 7 / 遂壍;
    const 鬏壍 = (柾壍: number) => 剤壍.points.find((蛭壍) => Math.abs(蛭壍.value - round(崱壍 * 柾壍, 2)) < 0.005);
    const 叜壍 = 鬏壍(1);
    if (!叜壍)
        return null;
    const 狋壍 = RECOMMENDATION_MULTIPLIERS.flatMap((醺壍) => {
        const 庩壍 = 鬏壍(醺壍);
        return 庩壍 ? [{ budget: 庩壍.value, impact: { base: 容壍(叜壍, 簠壍), potential: 容壍(庩壍, 簠壍) } satisfies RecommendationImpact }] : [];
    });
    if (!狋壍.length)
        return null;
    const 綘壍 = 崱壍 / (1 - 煓壍);
    const 鲇壍 = 狋壍.find((楶壍) => 楶壍.budget >= 綘壍 - 0.005) ?? (狋壍[狋壍.length - 1] as (typeof 狋壍)[number]);
    return {
        id: `demo-${蕵壍.id}-budget`,
        type: "CAMPAIGN_BUDGET",
        campaignId: 蕵壍.id,
        campaignIds: [蕵壍.id],
        budgetId: 蕵壍.budget_id,
        currentBudget: 崱壍,
        recommendedBudget: 鲇壍.budget,
        options: 狋壍,
        impact: 鲇壍.impact,
        dismissed: false,
    };
}
export function buildDemoEstimates(补壍: DemoDataset, 啔壍: {
    seed?: string;
} = {}): GoogleEstimates {
    const 瑃壍 = 啔壍.seed ?? "savd-demo";
    const 録壍 = addDays(补壍.anchor, -1);
    const 怡壍 = addDays(録壍, -(DEMO_SIMULATION_DAYS - 1));
    const 缐壍: CampaignSimulation[] = [];
    const 鷿壍: GoogleRecommendation[] = [];
    const 櫮壍 = { start: 怡壍, end: 録壍, modification: "UNIFORM" as const };
    for (const 觝壍 of 补壍.dims.campaigns.values()) {
        if (觝壍.status === "Removed" || !癀壍.has(觝壍.type))
            continue;
        const 囌壍 = 戞壍(补壍, 觝壍.id, 怡壍, 録壍);
        if (囌壍.cost <= 0 || 囌壍.clicks <= 0)
            continue;
        const 疻壍 = 囌壍.days;
        const 钪壍: DayShape = { cost: 囌壍.cost / 疻壍, clicks: 囌壍.clicks / 疻壍, impressions: 囌壍.impressions / 疻壍, conversions: 囌壍.conversions / 疻壍, aov: 囌壍.conversions > 0 ? 囌壍.convValue / 囌壍.conversions : 0 };
        const 憙壍 = 0.55 + 0.25 * seedRng(瑃壍, "google-sim", 补壍.account.id, 觝壍.id, 録壍)();
        if (觝壍.budget_daily && 觝壍.budget_daily > 0 && 觝壍.budget_period === "daily") {
            const 肈壍 = 隧壍(觝壍, 囌壍);
            const 齷壍 = spendElasticity(肈壍);
            const 汦壍 = 觝壍.budget_daily;
            const 譕壍 = BUDGET_MULTIPLIERS.map((塄壍) => 赒壍(汦壍 * 塄壍, 钪壍, 钪壍.cost * (塄壍 < 1 ? 塄壍 : 1 + (塄壍 - 1) * 齷壍), 憙壍, 疻壍, null));
            const 眳壍: CampaignSimulation = { campaignId: 觝壍.id, type: "BUDGET", ...櫮壍, points: 譕壍 };
            缐壍.push(眳壍);
            if (囌壍.isEligible > 0 && 肈壍 > BUDGET_LIMITED_SHARE) {
                const 阢壍 = 暆壍(觝壍, 眳壍, 肈壍, 疻壍);
                if (阢壍)
                    鷿壍.push(阢壍);
            }
        }
        if (觝壍.target_cpa && 觝壍.target_cpa > 0) {
            const 挑壍 = 觝壍.target_cpa;
            const 舀壍 = TARGET_MULTIPLIERS.map((仯壍) => {
                const 淞壍 = 钪壍.cost * 仯壍 ** 锯壍;
                return 赒壍(挑壍 * 仯壍, 钪壍, 淞壍, 憙壍, 疻壍, 淞壍 / 0.95);
            });
            缐壍.push({ campaignId: 觝壍.id, type: "TARGET_CPA", ...櫮壍, points: 舀壍 });
        }
        if (觝壍.target_roas && 觝壍.target_roas > 0) {
            const 賍壍 = 觝壍.target_roas;
            const 妼壍 = TARGET_MULTIPLIERS.map((碫壍) => {
                const 鞚壍 = 钪壍.cost * 碫壍 ** -锯壍;
                return 赒壍(賍壍 * 碫壍, 钪壍, 鞚壍, 憙壍, 疻壍, 鞚壍 / 0.95);
            });
            缐壍.push({ campaignId: 觝壍.id, type: "TARGET_ROAS", ...櫮壍, points: 妼壍 });
        }
    }
    return { simulations: 缐壍, recommendations: 鷿壍, warnings: [] };
}
