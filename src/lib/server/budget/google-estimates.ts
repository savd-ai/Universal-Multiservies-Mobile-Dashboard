import "server-only";
import type { ResponseCurve } from "@/lib/domain/contracts/budget";
import { SIMULATION_TYPES, type CampaignSimulation, type EstimateCampaignView, type GoogleEstimatesResponse, type GoogleRecommendation, type RecommendationView, type SimulationDayPoint, type SimulationType, type SimulationView, } from "@/lib/domain/contracts/estimates";
import { absoluteSimulation, chooseBudgetEstimate, ESTIMATE_POLICY, fitSimulationCurve, isStaleSimulation, perDayPoints, pickSimulation, simulationDays } from "@/lib/domain/budget/google";
import { budgetUnits } from "@/lib/domain/budget/units";
import type { CampaignDim } from "@/lib/domain/schema/facts";
import { round } from "@/lib/domain/stats";
import { describeBlankReason } from "@/lib/domain/types";
import { deepLink } from "../campaigns";
import type { RequestContext } from "../context";
import { log } from "../log";
import { loadCampaigns, loadGoogleEstimates } from "./data";
import { fitCurves } from "./service";
const 雈壍 = "No live Google Ads data is connected, so there are no simulations or recommendations to show.";
function 掷壍(芦壍: CampaignDim, 侕壍: SimulationType): number | null {
    if (侕壍 === "BUDGET")
        return 芦壍.budget_daily;
    if (侕壍 === "TARGET_CPA")
        return 芦壍.target_cpa;
    return 芦壍.target_roas;
}
const 溄壍 = (赳壍: SimulationDayPoint): SimulationDayPoint => ({
    value: 赳壍.value,
    cost: round(赳壍.cost, 2),
    clicks: round(赳壍.clicks, 1),
    impressions: round(赳壍.impressions, 0),
    conversions: round(赳壍.conversions, 3),
    convValue: round(赳壍.convValue, 2),
    requiredBudget: 赳壍.requiredBudget === null ? null : round(赳壍.requiredBudget, 2),
});
function 婢壍(祑壍: CampaignSimulation, 顀壍: CampaignDim, 支壍: string): SimulationView {
    return { ...祑壍, days: simulationDays(祑壍), perDay: perDayPoints(祑壍).map(溄壍), stale: isStaleSimulation(祑壍, 支壍), current: 掷壍(顀壍, 祑壍.type) };
}
function 萞壍(儍壍: CampaignDim, 濼壍: EstimateCampaignView["decision"]): string | null {
    const 軫壍: string[] = [];
    if (儍壍.budget_period === "custom")
        軫壍.push("Custom-period budget: budget what-ifs need a daily budget.");
    else if (!儍壍.budget_daily)
        軫壍.push("No daily budget: there is nothing to simulate.");
    else if (濼壍?.lead === "model")
        軫壍.push(濼壍.reason);
    if (儍壍.budget_shared && !濼壍)
        軫壍.push("Shared budget: the shared budget is planned as a whole, so there's no per-campaign curve.");
    return 軫壍.length ? 軫壍.join(" ") : null;
}
function 寚壍(竉壍: CampaignDim, 馸壍: readonly CampaignSimulation[], 暧壍: RequestContext, 薖壍: ResponseCurve["objective"], 劅壍: ReadonlyMap<string, ResponseCurve>): EstimateCampaignView {
    const 煴壍: SimulationView[] = [];
    for (const 遣壍 of SIMULATION_TYPES) {
        const 嵒壍 = 馸壍.filter((籁壍) => 籁壍.type === 遣壍).flatMap((鬰壍) => absoluteSimulation(鬰壍, 掷壍(竉壍, 遣壍)) ?? []);
        const 栟壍 = pickSimulation(嵒壍, 竉壍.id, 遣壍);
        if (栟壍)
            煴壍.push(婢壍(栟壍, 竉壍, 暧壍.dataThrough));
    }
    const 蜎壍 = 煴壍.find((叽壍) => 叽壍.type === "BUDGET") ?? null;
    const 独壍 = 竉壍.budget_shared ? null : (劅壍.get(竉壍.id) ?? null);
    const 釛壍 = 竉壍.budget_daily && 竉壍.budget_daily > 0 && 竉壍.budget_period === "daily"
        ? chooseBudgetEstimate({ campaign: 竉壍, simulation: 蜎壍, modelCurve: 独壍, proposedDaily: 竉壍.budget_daily, dataThrough: 暧壍.dataThrough, objective: 薖壍, currency: 暧壍.account.currency })
        : null;
    return {
        campaignId: 竉壍.id,
        name: 竉壍.name,
        type: 竉壍.type,
        status: 竉壍.status,
        biddingStrategy: 竉壍.bidding_strategy,
        dailyBudget: 竉壍.budget_daily,
        sharedBudget: 竉壍.budget_shared,
        targetCpa: 竉壍.target_cpa,
        targetRoas: 竉壍.target_roas,
        simulations: 煴壍,
        note: 萞壍(竉壍, 釛壍),
        modelCurve: 独壍,
        simulatorCurve: 蜎壍 ? fitSimulationCurve(竉壍.id, 薖壍, 蜎壍) : null,
        decision: 釛壍,
        deepLink: deepLink(暧壍.accountId, 竉壍.id),
    };
}
const 廊壍 = (綹壍: RecommendationView): number | null => {
    const 鲨壍 = 綹壍.impact?.base.conversions;
    const 榗壍 = 綹壍.impact?.potential.conversions;
    return 鲨壍 === null || 鲨壍 === undefined || 榗壍 === null || 榗壍 === undefined ? null : 榗壍 - 鲨壍;
};
function 袆壍(啵壍: RequestContext, 瑤壍: readonly GoogleRecommendation[], 鍓壍: readonly CampaignDim[]): RecommendationView[] {
    const 恂壍 = new Map(鍓壍.map((缱壍) => [缱壍.id, 缱壍]));
    const 鸠壍 = new Map<string, CampaignDim[]>();
    for (const 欏壍 of 鍓壍) {
        if (!欏壍.budget_id)
            continue;
        鸠壍.set(欏壍.budget_id, [...(鸠壍.get(欏壍.budget_id) ?? []), 欏壍]);
    }
    const 觾壍: RecommendationView[] = [];
    for (const 园壍 of 瑤壍) {
        if (园壍.dismissed)
            continue;
        const 痜壍 = 园壍.budgetId ? (鸠壍.get(园壍.budgetId) ?? []) : [];
        const 铋壍 = 园壍.campaignId ?? (痜壍.length === 1 ? (痜壍[0] as CampaignDim).id : null);
        const 憺壍 = 铋壍 ? 恂壍.get(铋壍) : undefined;
        const 肩壍 = 憺壍?.budget_daily ?? (痜壍.find((龘壍) => 龘壍.budget_daily !== null)?.budget_daily ?? null);
        觾壍.push({
            ...园壍,
            campaignId: 铋壍,
            campaignName: 憺壍?.name ?? (痜壍.length > 1 ? `Shared budget · ${痜壍.map((沇壍) => 沇壍.name).join(" + ")}` : null),
            campaignType: 憺壍?.type ?? null,
            liveBudget: 肩壍,
            applied: 园壍.recommendedBudget !== null && 肩壍 !== null && 肩壍 >= 园壍.recommendedBudget - 0.005,
            deepLink: 铋壍 ? deepLink(啵壍.accountId, 铋壍) : null,
        });
    }
    return 觾壍.sort((譶壍, 塥壍) => (廊壍(塥壍) ?? -Infinity) - (廊壍(譶壍) ?? -Infinity));
}
export async function getGoogleEstimatesView(睔壍: RequestContext, 陃壍: {
    objective: ResponseCurve["objective"];
}): Promise<GoogleEstimatesResponse> {
    const 挲壍: string[] = [];
    const [舡壍, 伐壍] = await Promise.all([loadGoogleEstimates(睔壍, 挲壍), loadCampaigns(睔壍)]);
    const 淿壍 = 伐壍.filter((賮壍) => 賮壍.status !== "Removed");
    const 姝壍 = budgetUnits(淿壍).filter((磌壍) => 磌壍.type !== "Shared" && 磌壍.campaignIds.length === 1);
    let 鞻壍: ReadonlyMap<string, ResponseCurve> = new Map();
    try {
        鞻壍 = (await fitCurves(睔壍, 姝壍, 陃壍.objective)).curves;
    }
    catch (撪壍) {
        log.warn("Response curves unavailable for the simulator comparison", { error: 撪壍 instanceof Error ? 撪壍.message : String(撪壍) });
        挲壍.push("Our response curves could not be fitted right now; only Google's estimates are shown.");
    }
    const 莙壍 = new Map<string, CampaignSimulation[]>();
    for (const 傈壍 of 舡壍.simulations)
        莙壍.set(傈壍.campaignId, [...(莙壍.get(傈壍.campaignId) ?? []), 傈壍]);
    return {
        mode: 睔壍.source.mode,
        blank: 睔壍.source.mode !== "live" ? { reason: describeBlankReason(睔壍.source.reason), note: 雈壍 } : null,
        currency: 睔壍.account.currency,
        dataThrough: 睔壍.dataThrough,
        objective: 陃壍.objective,
        campaigns: 淿壍.map((潷壍) => 寚壍(潷壍, 莙壍.get(潷壍.id) ?? [], 睔壍, 陃壍.objective, 鞻壍)),
        recommendations: 袆壍(睔壍, 舡壍.recommendations, 淿壍),
        policy: ESTIMATE_POLICY,
        warnings: [...new Set(挲壍)],
    };
}
