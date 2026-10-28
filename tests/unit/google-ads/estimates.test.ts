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
const ACCOUNT = "1234567890";
const rows = (name: string) => flattenStream(fixture(name)).rows;
const SIMS = / FROM campaign_simulation /;
const RECS = / FROM recommendation /;
function live(override?: Handler) {
    const m = mockFetch(googleAdsRouter(override));
    vi.stubGlobal("fetch", m.fetch);
    const byQuery = (re: RegExp) => m.searches().filter((c) => re.test(c.query ?? ""));
    return { source: createLiveGoogleAdsSource(), byQuery, ...m };
}
describe("estimate mappers", () => {
    it("campaign_simulation: micros → currency, int64 strings, sorted points, window totals kept", () => {
        const sims = mapCampaignSimulations(rows("campaign-simulations.json"));
        expect(sims.map((s) => `${s.campaignId}:${s.type}`)).toEqual(["111:BUDGET", "111:TARGET_CPA", "555:TARGET_CPA", "333:TARGET_ROAS"]);
        const budget = sims[0]!;
        expect(budget).toMatchObject({ modification: "UNIFORM", start: "2026-09-20", end: "2026-09-26" });
        expect(budget.relative).toBeUndefined();
        expect(budget.points.map((p) => p.value)).toEqual([210, 420, 630, 840]);
        expect(budget.points[1]).toEqual({ value: 420, cost: 2940, clicks: 2940, impressions: 49000, conversions: 98, convValue: 10290, requiredBudget: null });
        expect(budget.points[2]).toMatchObject({ cost: 3570, conversions: 126.35, convValue: 13100.5 });
    });
    it("target simulations: required budgets, missing optional fields, SCALING modifiers and target ROAS ratios", () => {
        const sims = mapCampaignSimulations(rows("campaign-simulations.json"));
        const cpa = sims.find((s) => s.campaignId === "111" && s.type === "TARGET_CPA")!;
        expect(cpa.points.map((p) => [p.value, p.requiredBudget])).toEqual([
            [22.8, null],
            [28.5, 430],
            [34.2, 520],
        ]);
        const scaled = sims.find((s) => s.campaignId === "555")!;
        expect(scaled).toMatchObject({ modification: "SCALING", relative: true });
        expect(scaled.points.map((p) => p.value)).toEqual([0.8, 1, 1.2]);
        expect(scaled.points[0]).toMatchObject({ convValue: 0, requiredBudget: 120 });
        const roas = sims.find((s) => s.type === "TARGET_ROAS")!;
        expect(roas).toMatchObject({ campaignId: "333", modification: "DEFAULT" });
        expect(roas.points.map((p) => [p.value, p.requiredBudget, p.cost])).toEqual([
            [3.5, 180, 1130],
            [5, 110, 558],
        ]);
    });
    it("skips rows without a campaign, a valid window, a known type or any usable point", () => {
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "CPC_BID", startDate: "2026-09-20", endDate: "2026-09-26", cpcBidPointList: { points: [{ cpcBidMicros: "1000000", clicks: "5" }] } } })).toBeNull();
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", startDate: "2026-09-31", endDate: "2026-10-06", budgetPointList: { points: [{ budgetAmountMicros: "1000000", clicks: "5" }] } } })).toBeNull();
        expect(toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", startDate: "2026-09-20", endDate: "2026-09-26" } })).toBeNull();
        const unknownMethod = toCampaignSimulation({ campaignSimulation: { campaignId: "1", type: "BUDGET", modificationMethod: "SOMETHING_NEW", startDate: "2026-09-20", endDate: "2026-09-26", budgetPointList: { points: [{ budgetAmountMicros: "1000000", clicks: "5" }] } } });
        expect(unknownMethod?.modification).toBe("UNKNOWN");
        expect(unknownMethod?.points[0]).toEqual({ value: 1, cost: 0, clicks: 5, impressions: 0, conversions: 0, convValue: 0, requiredBudget: null });
    });
    it("recommendations: budgets and options in currency, weekly impact, shared budgets, dismissed flag", () => {
        const recs = mapRecommendations(rows("recommendations.json"));
        expect(recs.map((r) => r.id)).toEqual(["9101~111", "9102~shared", "9103~777"]);
        const brand = recs[0]!;
        expect(brand).toMatchObject({ type: "CAMPAIGN_BUDGET", campaignId: "111", campaignIds: ["111"], budgetId: "9001", currentBudget: 420, recommendedBudget: 560, dismissed: false });
        expect(brand.options.map((o) => o.budget)).toEqual([490, 560, 700]);
        expect(brand.impact).toEqual({
            base: { impressions: 49000, clicks: 2940, cost: 2940, conversions: 98, convValue: 10290, videoViews: null },
            potential: { impressions: 63500, clicks: 3800, cost: 3480, conversions: 114.5, convValue: 12010, videoViews: null },
        });
        expect(brand.options[0]!.impact?.base.convValue).toBeNull();
        const shared = recs[1]!;
        expect(shared).toMatchObject({ campaignId: null, campaignIds: ["333", "555"], budgetId: "9003", currentBudget: 150, recommendedBudget: 190, options: [], impact: null, dismissed: false });
        expect(recs[2]).toMatchObject({ campaignId: "777", dismissed: true, recommendedBudget: 40 });
    });
    it("uses recommendation.campaign when the campaigns list is missing", () => {
        const r = toRecommendation({ recommendation: { resourceName: "customers/1/recommendations/5", type: "CAMPAIGN_BUDGET", campaign: "customers/1/campaigns/42" } });
        expect(r).toMatchObject({ id: "5", campaignId: "42", campaignIds: ["42"], budgetId: null, currentBudget: null, recommendedBudget: null, options: [], impact: null });
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
        const { source, byQuery } = live();
        const est = await source.getGoogleEstimates(ACCOUNT);
        expect(est.simulations).toHaveLength(4);
        expect(est.recommendations).toHaveLength(3);
        expect(est.warnings).toEqual([]);
        expect(byQuery(SIMS)).toHaveLength(1);
        expect(byQuery(RECS)).toHaveLength(1);
        expect(byQuery(SIMS)[0]!.customerId).toBe(ACCOUNT);
        est.simulations.length = 0;
        const again = await source.getGoogleEstimates(ACCOUNT);
        expect(again.simulations).toHaveLength(4);
        expect(byQuery(SIMS)).toHaveLength(1);
        expect(byQuery(RECS)).toHaveLength(1);
        await source.invalidate(ACCOUNT);
        await source.getGoogleEstimates(ACCOUNT);
        expect(byQuery(SIMS)).toHaveLength(2);
        expect(byQuery(RECS)).toHaveLength(2);
    });
    it("collapses concurrent reads into one request per query", async () => {
        const { source, byQuery } = live();
        await Promise.all([source.getGoogleEstimates(ACCOUNT), source.getGoogleEstimates(ACCOUNT), source.getGoogleEstimates(ACCOUNT)]);
        expect(byQuery(SIMS)).toHaveLength(1);
        expect(byQuery(RECS)).toHaveLength(1);
    });
    it("keeps the simulations when the recommendations read fails, and retries the failure a minute later", async () => {
        const { source, byQuery } = live((call) => (RECS.test(call.query ?? "") ? fixtureResponse("failure-user-permission-denied.json", 403) : undefined));
        const est = await source.getGoogleEstimates(ACCOUNT);
        expect(est.simulations).toHaveLength(4);
        expect(est.recommendations).toEqual([]);
        expect(est.warnings).toEqual(["Google's budget recommendations could not be loaded (USER_PERMISSION_DENIED)."]);
        await source.getGoogleEstimates(ACCOUNT);
        expect(byQuery(RECS)).toHaveLength(1);
        const now = Date.now();
        vi.spyOn(Date, "now").mockImplementation(() => now + 61000);
        await source.getGoogleEstimates(ACCOUNT);
        expect(byQuery(RECS)).toHaveLength(2);
        expect(byQuery(SIMS)).toHaveLength(2);
    });
    it("reports a failed simulations read as a warning too", async () => {
        const { source } = live((call) => (SIMS.test(call.query ?? "") ? fixtureResponse("failure-user-permission-denied.json", 403) : undefined));
        const est = await source.getGoogleEstimates(ACCOUNT);
        expect(est.simulations).toEqual([]);
        expect(est.recommendations).toHaveLength(3);
        expect(est.warnings).toEqual(["Google's campaign simulations could not be loaded (USER_PERMISSION_DENIED); budget what-ifs use our model."]);
    });
    it("validates the account and only ever calls read-only endpoints", async () => {
        const { source, calls, byQuery } = live();
        await expect(source.getGoogleEstimates("12; DROP")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(source.getGoogleEstimates("5555555555")).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(byQuery(SIMS)).toHaveLength(0);
        await source.getGoogleEstimates(ACCOUNT);
        expect(calls.length).toBeGreaterThan(2);
        for (const c of calls) {
            if (c.url === TOKEN_URL)
                continue;
            expect(() => assertReadOnlyUrl(c.url), c.url).not.toThrow();
        }
        for (const c of [...byQuery(SIMS), ...byQuery(RECS)]) {
            expect(c.method).toBe("POST");
            expect(c.url).toMatch(/\/v25\/customers\/1234567890\/googleAds:searchStream$/);
        }
    });
});
describe("GET /api/budget/google-estimates view · live", () => {
    beforeEach(() => setupLiveEnv());
    afterEach(() => teardownLiveEnv());
    it("joins Google's estimates with live campaigns and applies the source policy", async () => {
        live();
        const ctx = await requestContext();
        expect(ctx.source.mode).toBe("live");
        const view = await getGoogleEstimatesView(ctx, { objective: "conversions" });
        expect(view).toMatchObject({ mode: "live", blank: null, currency: "USD", objective: "conversions" });
        const byId = new Map(view.campaigns.map((c) => [c.campaignId, c]));
        const brand = byId.get("111")!;
        expect(brand.simulations.map((s) => s.type)).toEqual(["BUDGET", "TARGET_CPA"]);
        const budget = brand.simulations[0]!;
        expect(budget).toMatchObject({ days: 7, current: 420, stale: false });
        expect(budget.perDay[1]).toMatchObject({ value: 420, cost: 420, conversions: 14 });
        expect(brand.decision).toMatchObject({ lead: "google_simulator", proposedDaily: 420, googleOutcome: 14 });
        expect(brand.note).toBeNull();
        expect(brand.simulatorCurve).toMatchObject({ source: "google_simulator", objective: "conversions" });
        expect(brand.deepLink).toContain("campaignId=111");
        expect(byId.get("222")).toMatchObject({ type: "PMax", simulations: [], note: "Google returned no budget simulation for this campaign, so our model leads." });
        expect(byId.get("222")?.decision?.lead).toBe("model");
        expect(byId.get("444")?.decision).toBeNull();
        expect(byId.get("444")?.note).toMatch(/^Custom-period budget/);
        const scaled = byId.get("555")!.simulations[0]!;
        expect(scaled).toMatchObject({ type: "TARGET_CPA", current: 35 });
        expect(scaled.perDay.map((p) => p.value)).toEqual([28, 35, 42]);
        expect(scaled.relative).toBeUndefined();
        expect(byId.get("555")?.note).toBe("This campaign shares its budget with other campaigns — plan the shared budget as a whole.");
        expect(byId.get("555")?.decision?.lead).toBe("model");
        expect(byId.get("555")?.modelCurve).toBeNull();
        expect(view.recommendations.map((r) => r.id)).toEqual(["9101~111", "9102~shared"]);
        expect(view.recommendations[0]).toMatchObject({ campaignName: "Search | Brand", liveBudget: 420, applied: false });
        expect(view.recommendations[0]!.deepLink).toContain("ocid=1234567890");
        expect(view.recommendations[1]).toMatchObject({ campaignId: null, campaignName: "Shared budget · Shopping | Feed + Demand Gen | Prospecting", liveBudget: 150, deepLink: null });
        expect(view.warnings).toEqual([]);
        expect(JSON.stringify(view)).not.toMatch(/test-(developer-token|client-secret|refresh-token)/);
    });
});
