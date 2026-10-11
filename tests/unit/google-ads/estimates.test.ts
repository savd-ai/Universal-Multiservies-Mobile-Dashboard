import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGoogleEstimatesView } from "@/lib/server/budget/google-estimates";
import { requestContext } from "@/lib/server/context";
import { assertReadOnlyUrl, flattenStream } from "@/lib/server/google-ads/client";
import { mapCampaignSimulations, mapRecommendations, toCampaignSimulation, toRecommendation } from "@/lib/server/google-ads/estimates";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { campaignSimulationsQuery, recommendationsQuery } from "@/lib/server/google-ads/queries";
import { createLiveGoogleAdsSource } from "@/lib/server/google-ads/source";
import { fixture, fixtureResponse, googleAdsRouter, mockFetch, setupLiveEnv, teardownLiveEnv, type Handler } from "./helpers";
(globalThis as {
    __savdRealResolver?: boolean;
}).__savdRealResolver = true;
const 炖壍 = "1234567890";
const 辅壍 = (屴壍: string) => flattenStream(fixture(屴壍)).rows;
const 筣壍 = / FROM campaign_simulation /;
const 驒壍 = / FROM recommendation /;
function 杁壍(蘰壍?: Handler) {
    const 匟壍 = mockFetch(googleAdsRouter(蘰壍));
    vi.stubGlobal("fetch", 匟壍.fetch);
    const 爎壍 = (都壍: RegExp) => 匟壍.searches().filter((巬壍) => 都壍.test(巬壍.query ?? ""));
    return { source: createLiveGoogleAdsSource(), byQuery: 爎壍, ...匟壍 };
}
describe("estimate mappers", () => {
    it("campaign_simulation: micros → currency, int64 strings, sorted points, window totals kept", () => {
        const 糛壍 = mapCampaignSimulations(辅壍("campaign-simulations.json"));
        expect(糛壍.map((鯊壍) => `${鯊壍.campaignId}:${鯊壍.type}`)).toEqual(["111:BUDGET", "111:TARGET_CPA", "555:TARGET_CPA", "333:TARGET_ROAS"]);
        const 梹壍 = 糛壍[0]!;
        expect(梹壍).toMatchObject({ modification: "UNIFORM", start: "2026-09-20", end: "2026-09-26" });
        expect(梹壍.relative).toBeUndefined();
        expect(梹壍.points.map((螨壍) => 螨壍.value)).toEqual([210, 420, 630, 840]);
        expect(梹壍.points[1]).toEqual({ value: 420, cost: 2940, clicks: 2940, impressions: 49000, conversions: 98, convValue: 10290, requiredBudget: null });
        expect(梹壍.points[2]).toMatchObject({ cost: 3570, conversions: 126.35, convValue: 13100.5 });
    });
    it("target simulations: required budgets, missing optional fields, SCALING modifiers and target ROAS ratios", () => {
        const 咗壍 = mapCampaignSimulations(辅壍("campaign-simulations.json"));
        const 玆壍 = 咗壍.find((鉵壍) => 鉵壍.campaignId === "111" && 鉵壍.type === "TARGET_CPA")!;
        expect(玆壍.points.map((彤壍) => [彤壍.value, 彤壍.requiredBudget])).toEqual([
            [22.8, null],
            [28.5, 430],
            [34.2, 520],
        ]);
        const 繓壍 = 咗壍.find((鵂壍) => 鵂壍.campaignId === "555")!;
        expect(繓壍).toMatchObject({ modification: "SCALING", relative: true });
        expect(繓壍.points.map((樱壍) => 樱壍.value)).toEqual([0.8, 1, 1.2]);
        expect(繓壍.points[0]).toMatchObject({ convValue: 0, requiredBudget: 120 });
        const 褠壍 = 咗壍.find((嘏壍) => 嘏壍.type === "TARGET_ROAS")!;
        expect(褠壍).toMatchObject({ campaignId: "333", modification: "DEFAULT" });
        expect(褠壍.points.map((瓾壍) => [瓾壍.value, 瓾壍.requiredBudget, 瓾壍.cost])).toEqual([
            [3.5, 180, 1130],
            [5, 110, 558],
        ]);
    });
    it("skips rows without a campaign, a valid window, a known type or any usable point", () => {
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "CPC_BID", startDate: "2026-09-20", endDate: "2026-09-26", cpcBidPointList: { points: [{ cpcBidMicros: "1000000", clicks: "5" }] } } })).toBeNull();
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", startDate: "2026-09-31", endDate: "2026-10-06", budgetPointList: { points: [{ budgetAmountMicros: "1000000", clicks: "5" }] } } })).toBeNull();
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", startDate: "2026-09-20", endDate: "2026-09-26" } })).toBeNull();
        const 鏭壍 = toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", modificationMethod: "SOMETHING_NEW", startDate: "2026-09-20", endDate: "2026-09-26", budgetPointList: { points: [{ budgetAmountMicros: "1000000", clicks: "5" }] } } });
        expect(鏭壍?.modification).toBe("UNKNOWN");
        expect(鏭壍?.points[0]).toEqual({ value: 1, cost: 0, clicks: 5, impressions: 0, conversions: 0, convValue: 0, requiredBudget: null });
    });
    it("recommendations: budgets and options in currency, weekly impact, shared budgets, dismissed flag", () => {
        const 惜壍 = mapRecommendations(辅壍("recommendations.json"));
        expect(惜壍.map((翋壍) => 翋壍.id)).toEqual(["9101~111", "9102~shared", "9103~777"]);
        const 麺壍 = 惜壍[0]!;
        expect(麺壍).toMatchObject({ type: "CAMPAIGN_BUDGET", campaignId: "111", campaignIds: ["111"], budgetId: "9001", currentBudget: 420, recommendedBudget: 560, dismissed: false });
        expect(麺壍.options.map((殩壍) => 殩壍.budget)).toEqual([490, 560, 700]);
        expect(麺壍.impact).toEqual({
            base: { impressions: 49000, clicks: 2940, cost: 2940, conversions: 98, convValue: 10290, videoViews: null },
            potential: { impressions: 63500, clicks: 3800, cost: 3480, conversions: 114.5, convValue: 12010, videoViews: null },
        });
        expect(麺壍.options[0]!.impact?.base.convValue).toBeNull();
        const 誘壍 = 惜壍[1]!;
        expect(誘壍).toMatchObject({ campaignId: null, campaignIds: ["333", "555"], budgetId: "9003", currentBudget: 150, recommendedBudget: 190, options: [], impact: null, dismissed: false });
        expect(惜壍[2]).toMatchObject({ campaignId: "777", dismissed: true, recommendedBudget: 40 });
    });
    it("uses recommendation.campaign when the campaigns list is missing", () => {
        const 垇壍 = toRecommendation({ recommendation: { resourceName: "customers/1/recommendations/5", type: "CAMPAIGN_BUDGET", campaign: "customers/1/campaigns/42" } });
        expect(垇壍).toMatchObject({ id: "5", campaignId: "42", campaignIds: ["42"], budgetId: null, currentBudget: null, recommendedBudget: null, options: [], impact: null });
        expect(toRecommendation({ recommendation: { type: "CAMPAIGN_BUDGET" } })).toBeNull();
    });
});
describe("queries", () => {
    it("reads only the simulation types the dashboard uses, and only budget recommendations", () => {
        expect(campaignSimulationsQuery()).toBe("SELECT campaign_simulation.campaign_id, campaign_simulation.type, campaign_simulation.modification_method, campaign_simulation.start_date, campaign_simulation.end_date, " +
            "campaign_simulation.budget_point_list.points, campaign_simulation.target_cpa_point_list.points, campaign_simulation.target_roas_point_list.points " +
            "FROM campaign_simulation WHERE campaign_simulation.type IN ('BUDGET', 'TARGET_CPA', 'TARGET_ROAS') PARAMETERS omit_unselected_resource_names = true");
        expect(recommendationsQuery()).toBe("SELECT recommendation.resource_name, recommendation.type, recommendation.campaign, recommendation.campaigns, recommendation.campaign_budget, recommendation.dismissed, " +
            "recommendation.impact, recommendation.campaign_budget_recommendation FROM recommendation WHERE recommendation.type = 'CAMPAIGN_BUDGET' PARAMETERS omit_unselected_resource_names = true");
    });
});
describe("live source · getGoogleEstimates", () => {
    beforeEach(() => setupLiveEnv());
    afterEach(() => {
        vi.restoreAllMocks();
        teardownLiveEnv();
    });
    it("runs the two reads separately and caches them per account", async () => {
        const { source: 癶壍, byQuery: 镥壍 } = 杁壍();
        const 扔壍 = await 癶壍.getGoogleEstimates(炖壍);
        expect(扔壍.simulations).toHaveLength(4);
        expect(扔壍.recommendations).toHaveLength(3);
        expect(扔壍.warnings).toEqual([]);
        expect(镥壍(筣壍)).toHaveLength(1);
        expect(镥壍(驒壍)).toHaveLength(1);
        expect(镥壍(筣壍)[0]!.customerId).toBe(炖壍);
        扔壍.simulations.length = 0;
        const 腃壍 = await 癶壍.getGoogleEstimates(炖壍);
        expect(腃壍.simulations).toHaveLength(4);
        expect(镥壍(筣壍)).toHaveLength(1);
        expect(镥壍(驒壍)).toHaveLength(1);
        await 癶壍.invalidate(炖壍);
        await 癶壍.getGoogleEstimates(炖壍);
        expect(镥壍(筣壍)).toHaveLength(2);
        expect(镥壍(驒壍)).toHaveLength(2);
    });
    it("collapses concurrent reads into one request per query", async () => {
        const { source: 串壍, byQuery: 洡壍 } = 杁壍();
        await Promise.all([串壍.getGoogleEstimates(炖壍), 串壍.getGoogleEstimates(炖壍), 串壍.getGoogleEstimates(炖壍)]);
        expect(洡壍(筣壍)).toHaveLength(1);
        expect(洡壍(驒壍)).toHaveLength(1);
    });
    it("keeps the simulations when the recommendations read fails, and retries the failure a minute later", async () => {
        const { source: 谐壍, byQuery: 壿壍 } = 杁壍((矮壍) => (驒壍.test(矮壍.query ?? "") ? fixtureResponse("failure-user-permission-denied.json", 403) : undefined));
        const 雝壍 = await 谐壍.getGoogleEstimates(炖壍);
        expect(雝壍.simulations).toHaveLength(4);
        expect(雝壍.recommendations).toEqual([]);
        expect(雝壍.warnings).toEqual(["Google's budget recommendations could not be loaded (USER_PERMISSION_DENIED)."]);
        await 谐壍.getGoogleEstimates(炖壍);
        expect(壿壍(驒壍)).toHaveLength(1);
        const 揌壍 = Date.now();
        vi.spyOn(Date, "now").mockImplementation(() => 揌壍 + 61000);
        await 谐壍.getGoogleEstimates(炖壍);
        expect(壿壍(驒壍)).toHaveLength(2);
        expect(壿壍(筣壍)).toHaveLength(2);
    });
    it("reports a failed simulations read as a warning too", async () => {
        const { source: 芻壍 } = 杁壍((侪壍) => (筣壍.test(侪壍.query ?? "") ? fixtureResponse("failure-user-permission-denied.json", 403) : undefined));
        const 溙壍 = await 芻壍.getGoogleEstimates(炖壍);
        expect(溙壍.simulations).toEqual([]);
        expect(溙壍.recommendations).toHaveLength(3);
        expect(溙壍.warnings).toEqual(["Google's campaign simulations could not be loaded (USER_PERMISSION_DENIED); budget what-ifs use our model."]);
    });
    it("validates the account and only ever calls read-only endpoints", async () => {
        const { source: 趈壍, calls: 婷壍, byQuery: 祦壍 } = 杁壍();
        await expect(趈壍.getGoogleEstimates("12; DROP")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(趈壍.getGoogleEstimates("5555555555")).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(祦壍(筣壍)).toHaveLength(0);
        await 趈壍.getGoogleEstimates(炖壍);
        expect(婷壍.length).toBeGreaterThan(2);
        for (const 顕壍 of 婷壍) {
            if (顕壍.url === TOKEN_URL)
                continue;
            expect(() => assertReadOnlyUrl(顕壍.url), 顕壍.url).not.toThrow();
        }
        for (const 敄壍 of [...祦壍(筣壍), ...祦壍(驒壍)]) {
            expect(敄壍.method).toBe("POST");
            expect(敄壍.url).toMatch(/\/v25\/customers\/1234567890\/googleAds:searchStream$/);
        }
    });
});
describe("GET /api/budget/google-estimates view · live", () => {
    beforeEach(() => setupLiveEnv());
    afterEach(() => teardownLiveEnv());
    it("joins Google's estimates with live campaigns and applies the source policy", async () => {
        杁壍();
        const 萳壍 = await requestContext();
        expect(萳壍.source.mode).toBe("live");
        const 儢壍 = await getGoogleEstimatesView(萳壍, { objective: "conversions" });
        expect(儢壍).toMatchObject({ mode: "live", blank: null, currency: "USD", objective: "conversions" });
        const 瀑壍 = new Map(儢壍.campaigns.map((輀壍) => [輀壍.campaignId, 輀壍]));
        const 寯壍 = 瀑壍.get("111")!;
        expect(寯壍.simulations.map((竞壍) => 竞壍.type)).toEqual(["BUDGET", "TARGET_CPA"]);
        const 駍壍 = 寯壍.simulations[0]!;
        expect(駍壍).toMatchObject({ days: 7, current: 420, stale: false });
        expect(駍壍.perDay[1]).toMatchObject({ value: 420, cost: 420, conversions: 14 });
        expect(寯壍.decision).toMatchObject({ lead: "google_simulator", proposedDaily: 420, googleOutcome: 14 });
        expect(寯壍.note).toBeNull();
        expect(寯壍.simulatorCurve).toMatchObject({ source: "google_simulator", objective: "conversions" });
        expect(寯壍.deepLink).toContain("campaignId=111");
        expect(瀑壍.get("222")).toMatchObject({ type: "PMax", simulations: [], note: "Google returned no budget simulation for this campaign, so our model leads." });
        expect(瀑壍.get("222")?.decision?.lead).toBe("model");
        expect(瀑壍.get("444")?.decision).toBeNull();
        expect(瀑壍.get("444")?.note).toMatch(/^Custom-period budget/);
        const 暼壍 = 瀑壍.get("555")!.simulations[0]!;
        expect(暼壍).toMatchObject({ type: "TARGET_CPA", current: 35 });
        expect(暼壍.perDay.map((薫壍) => 薫壍.value)).toEqual([28, 35, 42]);
        expect(暼壍.relative).toBeUndefined();
        expect(瀑壍.get("555")?.note).toBe("This campaign shares its budget with other campaigns — plan the shared budget as a whole.");
        expect(瀑壍.get("555")?.decision?.lead).toBe("model");
        expect(瀑壍.get("555")?.modelCurve).toBeNull();
        expect(儢壍.recommendations.map((劚壍) => 劚壍.id)).toEqual(["9101~111", "9102~shared"]);
        expect(儢壍.recommendations[0]).toMatchObject({ campaignName: "Search | Brand", liveBudget: 420, applied: false });
        expect(儢壍.recommendations[0]!.deepLink).toContain("ocid=1234567890");
        expect(儢壍.recommendations[1]).toMatchObject({ campaignId: null, campaignName: "Shared budget · Shopping | Feed + Demand Gen | Prospecting", liveBudget: 150, deepLink: null });
        expect(儢壍.warnings).toEqual([]);
        expect(JSON.stringify(儢壍)).not.toMatch(/test-(developer-token|client-secret|refresh-token)/);
    });
});
