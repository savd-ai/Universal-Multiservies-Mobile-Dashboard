import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { curveOutcome } from "@/lib/domain/budget/curves";
import { absoluteSimulation, agreementLine, blendCurves, budgetSimulatorGap, calibrateCurve, CALIBRATION_RANGE, chooseBudgetEstimate, ESTIMATE_POLICY, fitSimulationCurve, interpolatePoints, interpolateSimulation, perDayPoints, pickSimulation, simulationDays, simulatorCurves, STALE_AFTER_DAYS, } from "@/lib/domain/budget/google";
import { optimizeRequestSchema, scenariosRequestSchema, type ResponseCurve } from "@/lib/domain/contracts/budget";
import type { CampaignSimulation, SimulationPoint } from "@/lib/domain/contracts/estimates";
import { addDays } from "@/lib/domain/dates";
import { BUDGET_MULTIPLIERS, buildDemoEstimates, spendElasticity } from "../../support/synthetic/estimates";
import { GET } from "@/app/api/budget/google-estimates/route";
import { getGoogleEstimatesView } from "@/lib/server/budget/google-estimates";
import { optimize, scenarios } from "@/lib/server/budget/service";
import { requestContext, type RequestContext } from "@/lib/server/context";
import { ANCHOR, demoDataset, outletDataset, resetServerState, restoreServerState } from "./helpers";
vi.mock("next/server", async (髜壍) => ({ ...(await 髜壍<typeof import("next/server")>()), connection: async () => undefined }));
const 柋壍 = "2026-09-28";
function 蚺壍(厩壍: [
    number,
    number,
    number
][], 犘壍: Partial<CampaignSimulation> = {}): CampaignSimulation {
    const 醇壍 = 7;
    const 并壍: SimulationPoint[] = 厩壍.map(([絥壍, 鱔壍, 楃壍]) => ({ value: 絥壍, cost: 鱔壍 * 醇壍, clicks: 鱔壍 * 2 * 醇壍, impressions: 鱔壍 * 40 * 醇壍, conversions: 楃壍 * 醇壍, convValue: 楃壍 * 50 * 醇壍, requiredBudget: null }));
    return { campaignId: "c1", type: "BUDGET", modification: "UNIFORM", start: "2026-09-21", end: "2026-09-27", points: 并壍, ...犘壍 };
}
const 蠲壍 = 蚺壍([100, 150, 200, 250, 300, 400].map((唡壍) => [唡壍, 唡壍 * 0.9, 2 * (唡壍 * 0.9) ** 0.7] as [
    number,
    number,
    number
]));
const 琐壍 = 蚺壍([
    [200, 200, 10],
    [400, 380, 16],
    [600, 500, 20],
]);
describe("simulation points", () => {
    it("turns window totals into per-day points, sorted, one per setting", () => {
        expect(simulationDays(琐壍)).toBe(7);
        expect(simulationDays({ start: "2026-09-27", end: "2026-09-27" })).toBe(1);
        const 鋿壍 = { ...琐壍, points: [琐壍.points[2]!, 琐壍.points[0]!, { ...琐壍.points[0]!, cost: 1 }, 琐壍.points[1]!] };
        const 忮壍 = perDayPoints(鋿壍);
        expect(忮壍.map((绝壍) => 绝壍.value)).toEqual([200, 400, 600]);
        expect(忮壍[0]).toMatchObject({ value: 200, cost: 200, conversions: 10, convValue: 500, clicks: 400 });
    });
    it("interpolates linearly between settings and extends the end segments by at most 5 %", () => {
        expect(interpolateSimulation(琐壍, 400)).toMatchObject({ value: 400, cost: 380, conversions: 16 });
        expect(interpolateSimulation(琐壍, 300)).toMatchObject({ cost: 290, conversions: 13 });
        expect(interpolateSimulation(琐壍, 500)).toMatchObject({ cost: 440, conversions: 18 });
        expect(interpolateSimulation(琐壍, 190)!.cost).toBeCloseTo(191, 6);
        expect(interpolateSimulation(琐壍, 630)!.conversions).toBeCloseTo(20.6, 6);
        expect(interpolateSimulation(琐壍, 189)).toBeNull();
        expect(interpolateSimulation(琐壍, 631)).toBeNull();
        expect(interpolateSimulation(琐壍, 0)).toBeNull();
        expect(interpolateSimulation(琐壍, Number.NaN)).toBeNull();
        expect(interpolatePoints(perDayPoints(琐壍), 199, 0)).toBeNull();
    });
    it("handles one point, required budgets and never goes negative", () => {
        const 鷌壍 = 蚺壍([[300, 280, 12]]);
        expect(interpolateSimulation(鷌壍, 310)).toMatchObject({ value: 310, cost: 280, conversions: 12 });
        expect(interpolateSimulation(鷌壍, 320)).toBeNull();
        const 檻壍 = { ...琐壍, type: "TARGET_CPA" as const, points: 琐壍.points.map((親壍, 嚙壍) => ({ ...親壍, requiredBudget: [210, 400, 530][嚙壍] ?? null })) };
        expect(interpolateSimulation(檻壍, 300)?.requiredBudget).toBeCloseTo(305, 6);
        const 疈壍 = { ...檻壍, points: 檻壍.points.map((鑷壍, 慦壍) => (慦壍 === 1 ? { ...鑷壍, requiredBudget: null } : 鑷壍)) };
        expect(interpolateSimulation(疈壍, 300)?.requiredBudget).toBeNull();
        const 聕壍 = 蚺壍([
            [100, 100, 1],
            [200, 200, 10],
        ]);
        expect(interpolateSimulation(聕壍, 96)!.conversions).toBeGreaterThanOrEqual(0);
    });
});
describe("simulator curve fit", () => {
    it("recovers an exact power law of cost with full confidence and no shrinkage", () => {
        const 齄壍 = fitSimulationCurve("c1", "conversions", 蠲壍)!;
        expect(齄壍.b).toBeCloseTo(0.7, 6);
        expect(齄壍.a).toBeCloseTo(2, 6);
        expect(齄壍).toMatchObject({ campaignId: "c1", objective: "conversions", r2: 1, n: 6, confidence: "high", source: "google_simulator" });
        expect(齄壍.spendRange).toEqual([90, 360]);
        expect(curveOutcome(齄壍, 200)).toBeCloseTo(2 * 200 ** 0.7, 6);
        const 氳壍 = fitSimulationCurve("c1", "conv_value", 蠲壍)!;
        expect(氳壍.a).toBeCloseTo(100, 4);
        expect(氳壍.b).toBeCloseTo(0.7, 6);
    });
    it("clamps convex points to b = 1 and grades sparse or narrow simulations", () => {
        const 謢壍 = 蚺壍([
            [100, 100, 1],
            [200, 200, 4],
            [300, 300, 9],
        ]);
        expect(fitSimulationCurve("c1", "conversions", 謢壍)?.b).toBe(1);
        const 堑壍 = 蚺壍([
            [100, 100, 10],
            [150, 140, 12.6],
            [200, 170, 14.5],
        ]);
        expect(fitSimulationCurve("c1", "conversions", 堑壍)?.confidence).toBe("medium");
        expect(fitSimulationCurve("c1", "conversions", 蚺壍([[100, 100, 10]]))).toBeNull();
        expect(fitSimulationCurve("c1", "conversions", 蚺壍([
            [100, 100, 10],
            [200, 101, 10.1],
        ]))).toBeNull();
        expect(fitSimulationCurve("c1", "conversions", 蚺壍([
            [100, 100, 0],
            [200, 180, 0],
            [300, 250, 12],
        ]))).toBeNull();
    });
});
describe("picking and normalising simulations", () => {
    it("prefers the latest window, then UNIFORM over DEFAULT over SCALING", () => {
        const 眀壍 = { ...琐壍, end: "2026-09-20", start: "2026-09-14" };
        const 闯壍 = { ...琐壍, modification: "SCALING" as const };
        expect(pickSimulation([眀壍, 闯壍, 琐壍], "c1", "BUDGET")).toBe(琐壍);
        expect(pickSimulation([眀壍], "c1", "BUDGET")).toBe(眀壍);
        expect(pickSimulation([琐壍], "c2", "BUDGET")).toBeNull();
        expect(pickSimulation([琐壍], "c1", "TARGET_ROAS")).toBeNull();
        expect(pickSimulation([{ ...琐壍, points: [] }], "c1", "BUDGET")).toBeNull();
    });
    it("scales relative (SCALING) simulations by the current setting", () => {
        const 拞壍 = { ...琐壍, type: "TARGET_CPA" as const, modification: "SCALING" as const, relative: true, points: 琐壍.points.map((臍壍, 亼壍) => ({ ...臍壍, value: [0.8, 1, 1.2][亼壍] as number })) };
        const 涫壍 = absoluteSimulation(拞壍, 30)!;
        expect(涫壍.points.map((貚壍) => 貚壍.value)).toEqual([24, 30, 36]);
        expect(涫壍.relative).toBeUndefined();
        expect(absoluteSimulation(拞壍, null)).toBeNull();
        expect(absoluteSimulation(拞壍, 0)).toBeNull();
        expect(absoluteSimulation(琐壍, null)).toBe(琐壍);
    });
});
describe("source policy", () => {
    const 妉壍 = { a: 0.2, b: 0.8 };
    const 硸壍 = { campaign: { type: "Search" as const }, simulation: 琐壍, modelCurve: 妉壍, dataThrough: 柋壍, objective: "conversions" as const, currency: "USD" };
    it("Google leads inside a fresh simulated range, our model is the second opinion", () => {
        const 靧壍 = chooseBudgetEstimate({ ...硸壍, proposedDaily: 400 });
        expect(靧壍.lead).toBe("google_simulator");
        expect(靧壍.reason).toBe("Google's budget simulator covers $400/day (Sep 21 – Sep 27), so it leads; our model is a second opinion.");
        expect(靧壍.googleOutcome).toBe(16);
        expect(靧壍.model).toBeCloseTo(curveOutcome(妉壍, 400), 9);
        expect(靧壍.disagreementPct).toBeCloseTo(Math.round((curveOutcome(妉壍, 400) / 16 - 1) * 1e4) / 1e4, 9);
        expect(靧壍.google).toMatchObject({ value: 400, cost: 380 });
        expect(chooseBudgetEstimate({ ...硸壍, proposedDaily: 400, objective: "conv_value" }).googleOutcome).toBe(800);
    });
    it("treats Performance Max like any campaign: Google leads with a fresh simulation, our model without one", () => {
        expect(chooseBudgetEstimate({ ...硸壍, campaign: { type: "PMax" }, proposedDaily: 400 })).toMatchObject({ lead: "google_simulator", googleOutcome: 16 });
        expect(budgetSimulatorGap("PMax", 琐壍, 柋壍)).toBeNull();
        const 摖壍 = chooseBudgetEstimate({ ...硸壍, campaign: { type: "PMax" }, simulation: null, proposedDaily: 400 });
        expect(摖壍).toMatchObject({ lead: "model", google: null, googleOutcome: null, disagreementPct: null });
        expect(摖壍.reason).toBe("Google returned no budget simulation for this campaign, so our model leads.");
    });
    it("never lets a shared-budget campaign's simulation lead: it shows the campaign on a budget of its own", () => {
        const 荅壍 = chooseBudgetEstimate({ ...硸壍, campaign: { type: "Search", budget_shared: true }, modelCurve: null, proposedDaily: 400 });
        expect(荅壍).toMatchObject({ lead: "model", googleOutcome: 16, model: null, disagreementPct: null });
        expect(荅壍.reason).toBe("This campaign shares its budget with other campaigns. Google simulated it as if the budget were its own, so those points don't describe the shared budget — plan the shared budget as a whole.");
        expect(budgetSimulatorGap("Search", 琐壍, 柋壍, true)).toBe("shared");
        expect(budgetSimulatorGap("Shared", 琐壍, 柋壍)).toBe("shared");
        expect(chooseBudgetEstimate({ ...硸壍, campaign: { type: "Search", budget_shared: true }, simulation: null, modelCurve: null, proposedDaily: 400 }).reason).toBe("This campaign shares its budget with other campaigns — plan the shared budget as a whole.");
    });
    it("our model leads without a budget simulation (targets only or none)", () => {
        const 倴壍 = chooseBudgetEstimate({ ...硸壍, simulation: null, proposedDaily: 400 });
        expect(倴壍.lead).toBe("model");
        expect(倴壍.reason).toBe("Google returned no budget simulation for this campaign, so our model leads.");
        expect(chooseBudgetEstimate({ ...硸壍, simulation: { ...琐壍, type: "TARGET_CPA" }, proposedDaily: 400 }).lead).toBe("model");
        expect(chooseBudgetEstimate({ ...硸壍, simulation: { ...琐壍, relative: true }, proposedDaily: 400 }).lead).toBe("model");
    });
    it("our model leads when the simulation ended more than 14 days before the data (Google is still shown)", () => {
        const 漣壍 = { ...琐壍, start: "2026-09-07", end: addDays(柋壍, -(STALE_AFTER_DAYS + 1)) };
        const 踒壍 = chooseBudgetEstimate({ ...硸壍, simulation: 漣壍, proposedDaily: 400 });
        expect(踒壍.lead).toBe("model");
        expect(踒壍.reason).toBe("Google's budget simulation ended Sep 13, more than 14 days before the latest data, so our model leads.");
        expect(踒壍.googleOutcome).toBe(16);
        expect(踒壍.disagreementPct).not.toBeNull();
        const 嬁壍 = { ...琐壍, end: addDays(柋壍, -STALE_AFTER_DAYS) };
        expect(chooseBudgetEstimate({ ...硸壍, simulation: 嬁壍, proposedDaily: 400 }).lead).toBe("google_simulator");
    });
    it("our model leads outside the simulated budgets (±5 %)", () => {
        const 称壍 = chooseBudgetEstimate({ ...硸壍, proposedDaily: 700 });
        expect(称壍).toMatchObject({ lead: "model", google: null, disagreementPct: null });
        expect(称壍.reason).toBe("$700/day is outside the budgets Google simulated ($200–$600/day), so our model leads.");
        expect(称壍.model).toBeCloseTo(curveOutcome(妉壍, 700), 9);
        expect(chooseBudgetEstimate({ ...硸壍, proposedDaily: 185 }).lead).toBe("model");
        expect(chooseBudgetEstimate({ ...硸壍, proposedDaily: 625 }).lead).toBe("google_simulator");
        expect(chooseBudgetEstimate({ ...硸壍, proposedDaily: 195 }).lead).toBe("google_simulator");
    });
    it("works without a model curve or a budget to evaluate", () => {
        const 食壍 = chooseBudgetEstimate({ ...硸壍, modelCurve: null, proposedDaily: 400 });
        expect(食壍).toMatchObject({ lead: "google_simulator", model: null, disagreementPct: null });
        const 旎壍 = chooseBudgetEstimate({ ...硸壍, modelCurve: null, simulation: null, proposedDaily: 400 });
        expect(旎壍.reason).toMatch(/Our model has no response curve for it either\.$/);
        expect(chooseBudgetEstimate({ ...硸壍, proposedDaily: 0 })).toMatchObject({ lead: "model", reason: "There is no daily budget to evaluate.", google: null, model: null });
    });
    it("describes agreement within 10 % and which way a larger gap goes", () => {
        expect(agreementLine(0.04)).toBe("Google and our model agree within 10%");
        expect(agreementLine(-0.1)).toBe("Google and our model agree within 10%");
        expect(agreementLine(0.25)).toBe("Our model is 25% more optimistic than Google");
        expect(agreementLine(-0.304)).toBe("Our model is 30% more conservative than Google");
        expect(agreementLine(null)).toBeNull();
    });
    it("publishes the policy as data", () => {
        expect(ESTIMATE_POLICY.map((蒽壍) => [蒽壍.id, 蒽壍.lead])).toEqual([
            ["pacing", "model"],
            ["trend", "model"],
            ["budget_whatif", "google_simulator"],
            ["target_whatif", "google_simulator"],
            ["reallocation", "model"],
            ["shared_budget", "model"],
        ]);
        expect(ESTIMATE_POLICY.some((冬壍) => /no budget simulator for Performance Max/.test(冬壍.why))).toBe(false);
        expect(ESTIMATE_POLICY.find((炛壍) => 炛壍.id === "trend")?.why).toMatch(/Performance Planner isn't available in the Google Ads API/);
        expect(ESTIMATE_POLICY.find((辊壍) => 辊壍.id === "target_whatif")?.why).toBe("We don't model bid targets.");
        expect(ESTIMATE_POLICY.every((屹壍) => 屹壍.question && 屹壍.leadLabel && 屹壍.why)).toBe(true);
    });
    it("feeds the optimizer simulator curves only for single-campaign units (PMax included) with a fresh budget simulation", () => {
        const 筨壍 = [琐壍, { ...蠲壍, campaignId: "c2" }, { ...琐壍, campaignId: "pm" }, { ...琐壍, campaignId: "old", end: "2026-09-01", start: "2026-08-26" }, { ...琐壍, campaignId: "s1" }];
        const 驗壍 = [
            { unitId: "c1", campaignIds: ["c1"], type: "Search" as const },
            { unitId: "c2", campaignIds: ["c2"], type: "Shopping" as const },
            { unitId: "pm", campaignIds: ["pm"], type: "PMax" as const },
            { unitId: "old", campaignIds: ["old"], type: "Search" as const },
            { unitId: "budget:9", campaignIds: ["s1", "s2"], type: "Shared" as const },
            { unitId: "none", campaignIds: ["none"], type: "Display" as const },
        ];
        const 杆壍 = simulatorCurves(驗壍, 筨壍, "conversions", 柋壍);
        expect([...杆壍.keys()]).toEqual(["c1", "c2", "pm"]);
        expect(杆壍.get("c2")).toMatchObject({ campaignId: "c2", source: "google_simulator" });
    });
});
describe("blending Google's curves with ours", () => {
    const 蘵壍 = (匤壍: string, 爓壍: number, 鄂壍: Partial<ResponseCurve> = {}): ResponseCurve => ({ campaignId: 匤壍, objective: "conversions", a: 2, b: 爓壍, bRaw: 爓壍, r2: 0.8, n: 60, spendRange: [100, 400], confidence: "high", ...鄂壍 });
    const 己壍 = (糠壍: string, 鯏壍: number) => 蘵壍(糠壍, 鯏壍, { source: "google_simulator", spendRange: [80, 500] });
    it("calibrates our curve's exponent and keeps its outcome at the typical spend", () => {
        const 梾壍 = 蘵壍("u1", 0.9);
        const 螭壍 = calibrateCurve(梾壍, 0.75);
        expect(螭壍.b).toBeCloseTo(0.675, 9);
        expect(螭壍.calibration).toBe(0.75);
        expect(curveOutcome(螭壍, 200)).toBeCloseTo(curveOutcome(梾壍, 200), 9);
        expect(curveOutcome(螭壍, 400)).toBeLessThan(curveOutcome(梾壍, 400));
        expect(curveOutcome(螭壍, 100)).toBeGreaterThan(curveOutcome(梾壍, 100));
        expect(calibrateCurve(蘵壍("u2", 0.9), 1.5).b).toBe(0.95);
        expect(calibrateCurve(蘵壍("u3", 0.9, { spendRange: [0, 0] }), 0.75)).toEqual(蘵壍("u3", 0.9, { spendRange: [0, 0] }));
    });
    it("puts every unit on Google's scale when at least two units have both curves", () => {
        const 咜壍 = new Map([
            ["u1", 蘵壍("u1", 0.9)],
            ["u2", 蘵壍("u2", 0.8)],
            ["u3", 蘵壍("u3", 0.9)],
            ["pmax", 蘵壍("pmax", 0.92)],
        ]);
        const 王壍 = new Map([
            ["u1", 己壍("u1", 0.63)],
            ["u2", 己壍("u2", 0.64)],
            ["u3", 己壍("u3", 0.81)],
        ]);
        const 鉺壍 = blendCurves(咜壍, 王壍);
        expect(鉺壍).toMatchObject({ google: 3, model: 1, available: 3, calibration: 0.8, basis: 3 });
        expect(鉺壍.curves.get("u1")).toBe(王壍.get("u1"));
        expect(鉺壍.curves.get("pmax")).toMatchObject({ b: 0.92 * 0.8, calibration: 0.8 });
        expect(鉺壍.curves.get("pmax")?.source).toBeUndefined();
    });
    it("leaves Google out below two overlapping units, needs no calibration when Google prices everything, and clamps the factor", () => {
        const 彩壍 = new Map([
            ["u1", 蘵壍("u1", 0.9)],
            ["pmax", 蘵壍("pmax", 0.9)],
        ]);
        const 繘壍 = blendCurves(彩壍, new Map([["u1", 己壍("u1", 0.6)]]));
        expect(繘壍).toMatchObject({ google: 0, model: 2, available: 1, calibration: null, basis: 1 });
        expect(繘壍.curves.get("u1")).toBe(彩壍.get("u1"));
        const 鵇壍 = blendCurves(彩壍, new Map());
        expect(鵇壍).toMatchObject({ google: 0, model: 2, available: 0, calibration: null });
        const 樶壍 = blendCurves(彩壍, new Map([["u1", 己壍("u1", 0.6)], ["pmax", 己壍("pmax", 0.5)]]));
        expect(樶壍).toMatchObject({ google: 2, model: 0, calibration: null });
        const 褥壍 = blendCurves(new Map([...彩壍, ["u2", 蘵壍("u2", 0.9)]]), new Map([["u1", 己壍("u1", 0.1)], ["u2", 己壍("u2", 0.1)]]));
        expect(褥壍.calibration).toBe(CALIBRATION_RANGE[0]);
    });
});
describe("synthetic estimates", () => {
    const 嘔壍 = demoDataset();
    const 甃壍 = buildDemoEstimates(嘔壍, { seed: "savd-demo-v1" });
    const 鏲壍 = 甃壍.simulations.filter((惡壍) => 惡壍.type === "BUDGET");
    it("is deterministic per seed and pure", () => {
        expect(buildDemoEstimates(嘔壍, { seed: "savd-demo-v1" })).toEqual(甃壍);
        expect(buildDemoEstimates(嘔壍, { seed: "another-seed" })).not.toEqual(甃壍);
        expect(甃壍.warnings).toEqual([]);
    });
    it("simulates budgets for Search, Shopping and Display only — the demo leaves PMax, Video and Demand Gen without", () => {
        expect(鏲壍.map((翐壍) => 翐壍.campaignId)).toEqual(["c1", "c2", "c4", "c6", "c8"]);
        for (const 麿壍 of ["c3", "c5", "c7"])
            expect(甃壍.simulations.filter((殮壍) => 殮壍.campaignId === 麿壍), 麿壍).toEqual([]);
        expect(嘔壍.dims.campaigns.get("c3")?.type).toBe("PMax");
    });
    it("replays the 7 days before the anchor at 0.5×–2× the daily budget, reconciling with campaign_daily at 1×", () => {
        for (const 誝壍 of 鏲壍) {
            expect(誝壍).toMatchObject({ start: addDays(ANCHOR, -7), end: addDays(ANCHOR, -1), modification: "UNIFORM" });
            const 垌壍 = 嘔壍.dims.campaigns.get(誝壍.campaignId)!.budget_daily!;
            expect(誝壍.points.map((登壍) => 登壍.value)).toEqual(BUDGET_MULTIPLIERS.map((镪壍) => Math.round(垌壍 * 镪壍 * 100) / 100));
            const 扙壍 = 嘔壍.tables.campaign_daily.filter((腈壍) => 腈壍.campaign_id === 誝壍.campaignId && 腈壍.date >= 誝壍.start && 腈壍.date <= 誝壍.end).reduce((丷壍, 洦壍) => 丷壍 + 洦壍.cost, 0);
            expect(誝壍.points[2]!.cost).toBeCloseTo(扙壍, 1);
        }
    });
    it("has diminishing returns, and budget-limited campaigns turn extra budget into spend", () => {
        for (const 谕壍 of 鏲壍) {
            const 处壍 = 谕壍.points.map((石壍) => 石壍.conversions / 石壍.cost);
            for (let 離壍 = 1; 離壍 < 处壍.length; 離壍++)
                expect(处壍[離壍]!, 谕壍.campaignId).toBeLessThan(处壍[離壍 - 1]! + 1e-9);
            const 揑壍 = 谕壍.points.map((苀壍) => 苀壍.convValue);
            expect([...揑壍].sort((侯壍, 溞壍) => 侯壍 - 溞壍), 谕壍.campaignId).toEqual(揑壍);
        }
        const 趍壍 = (婼壍: string) => {
            const 祫壍 = 鏲壍.find((顚壍) => 顚壍.campaignId === 婼壍)!;
            return 祫壍.points[5]!.cost / 祫壍.points[2]!.cost;
        };
        expect(趍壍("c1")).toBeGreaterThan(1.6);
        expect(趍壍("c8")).toBeLessThan(1.35);
        expect(spendElasticity(0.25)).toBeCloseTo(0.75, 6);
        expect(spendElasticity(0)).toBe(0.1);
        expect(spendElasticity(1)).toBe(0.85);
    });
    it("simulates targets only for campaigns bidding with one (and not for PMax)", () => {
        const 敉壍 = 甃壍.simulations.filter((萸壍) => 萸壍.type !== "BUDGET");
        expect(敉壍.map((儧壍) => `${儧壍.campaignId}:${儧壍.type}`)).toEqual(["c4:TARGET_ROAS"]);
        const 瀖壍 = 敉壍[0]!;
        expect(瀖壍.points.map((輅壍) => 輅壍.value)).toEqual([2.8, 3.4, 4, 4.6, 5.2, 6]);
        expect(瀖壍.points.every((寴壍) => 寴壍.requiredBudget !== null && 寴壍.requiredBudget * 7 > 寴壍.cost)).toBe(true);
        expect(瀖壍.points[0]!.cost).toBeGreaterThan(瀖壍.points[5]!.cost);
        expect(瀖壍.points[5]!.convValue / 瀖壍.points[5]!.cost).toBeGreaterThan(瀖壍.points[0]!.convValue / 瀖壍.points[0]!.cost);
        const 竣壍 = buildDemoEstimates(outletDataset(), { seed: "savd-demo-v1" });
        expect(竣壍.simulations.filter((駒壍) => 駒壍.type !== "BUDGET").map((曁壍) => `${曁壍.campaignId}:${曁壍.type}`)).toEqual(["t2:TARGET_CPA", "t4:TARGET_ROAS"]);
        expect(竣壍.simulations.some((薰壍) => 薰壍.campaignId === "t3")).toBe(false);
    });
    it("recommends a budget only for clearly budget-limited campaigns, with impacts read off the simulation", () => {
        expect(甃壍.recommendations.map((功壍) => 功壍.campaignId)).toEqual(["c1"]);
        const 熎壍 = 甃壍.recommendations[0]!;
        const 遽壍 = 鏲壍.find((嵬壍) => 嵬壍.campaignId === "c1")!;
        expect(熎壍).toMatchObject({ type: "CAMPAIGN_BUDGET", currentBudget: 420, recommendedBudget: 630, campaignIds: ["c1"], budgetId: "b-c1", dismissed: false });
        expect(熎壍.options.map((籛壍) => 籛壍.budget)).toEqual([525, 630, 840]);
        const 魊壍 = (根壍: number) => 遽壍.points.find((蜨壍) => 蜨壍.value === 根壍)!;
        for (const 吗壍 of 熎壍.options) {
            expect(吗壍.impact?.base).toMatchObject({ cost: 魊壍(420).cost, conversions: 魊壍(420).conversions });
            expect(吗壍.impact?.potential).toMatchObject({ cost: 魊壍(吗壍.budget).cost, conversions: 魊壍(吗壍.budget).conversions, convValue: 魊壍(吗壍.budget).convValue, videoViews: null });
        }
        expect(熎壍.impact).toEqual(熎壍.options[1]!.impact);
        expect(buildDemoEstimates(outletDataset(), { seed: "savd-demo-v1" }).recommendations).toEqual([]);
    });
});
describe("google estimates service (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("returns Google's estimates next to our model and states the policy", async () => {
        const 猆壍 = await requestContext();
        const 釵壍 = await getGoogleEstimatesView(猆壍, { objective: "conv_value" });
        expect(釵壍).toMatchObject({ mode: "live", currency: "USD", dataThrough: "2026-09-28", objective: "conv_value", warnings: [] });
        expect(釵壍.blank).toBeNull();
        expect(釵壍.policy).toEqual(ESTIMATE_POLICY);
        expect(釵壍.campaigns.map((廤壍) => 廤壍.campaignId)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
        const 緓壍 = 釵壍.campaigns[0]!;
        expect(緓壍.simulations.map((鳂壍) => 鳂壍.type)).toEqual(["BUDGET"]);
        expect(緓壍.simulations[0]).toMatchObject({ days: 7, current: 420, stale: false });
        expect(緓壍.simulations[0]!.perDay).toHaveLength(6);
        expect(緓壍.decision).toMatchObject({ lead: "google_simulator", proposedDaily: 420, objective: "conv_value" });
        expect(緓壍.modelCurve?.objective).toBe("conv_value");
        expect(緓壍.modelCurve?.source).toBeUndefined();
        expect(緓壍.simulatorCurve).toMatchObject({ source: "google_simulator", confidence: "high" });
        expect(緓壍.note).toBeNull();
        const 榱壍 = 釵壍.campaigns.find((袠壍) => 袠壍.campaignId === "c3")!;
        expect(榱壍).toMatchObject({ type: "PMax", simulations: [], simulatorCurve: null, note: "Google returned no budget simulation for this campaign, so our model leads." });
        expect(榱壍.decision?.model).toBeGreaterThan(0);
        expect(釵壍.campaigns.find((喏壍) => 喏壍.campaignId === "c4")?.simulations.map((瑾壍) => 瑾壍.type)).toEqual(["BUDGET", "TARGET_ROAS"]);
        expect(釵壍.recommendations).toHaveLength(1);
        expect(釵壍.recommendations[0]).toMatchObject({ campaignId: "c1", campaignName: "Brand — Core Terms", campaignType: "Search", liveBudget: 420, recommendedBudget: 630, applied: false });
        expect(釵壍.recommendations[0]!.deepLink).toContain("campaignId=c1");
    });
    it("degrades to our model with a warning when Google's estimates can't be read", async () => {
        const 鍭壍 = await requestContext();
        const 恜壍: RequestContext = { ...鍭壍, source: Object.assign(Object.create(Object.getPrototypeOf(鍭壍.source) as object) as typeof 鍭壍.source, 鍭壍.source, { getGoogleEstimates: vi.fn(async () => Promise.reject(new Error("boom"))) }) };
        const 罋壍 = await getGoogleEstimatesView(恜壍, { objective: "conv_value" });
        expect(罋壍.warnings).toEqual(["Google's simulators and recommendations are unavailable right now; every estimate here is our model's."]);
        expect(罋壍.recommendations).toEqual([]);
        expect(罋壍.campaigns.every((鸺壍) => 鸺壍.simulations.length === 0 && (鸺壍.decision === null || 鸺壍.decision.lead === "model"))).toBe(true);
        const 欩壍 = await optimize(恜壍, optimizeRequestSchema.parse({}));
        expect(欩壍.rows.every((記壍) => 記壍.curveSource === "model")).toBe(true);
        expect(欩壍.warnings).toContain("Google's simulators and recommendations are unavailable right now; every estimate here is our model's.");
    });
});
describe("optimizer curve source (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("uses Google's simulator curves where the policy allows on auto, our model elsewhere, and keeps the total", async () => {
        const 圇壍 = await requestContext();
        const 痶壍 = await optimize(圇壍, optimizeRequestSchema.parse({}));
        expect(Object.fromEntries(痶壍.rows.map((铥壍) => [铥壍.unitId, 铥壍.curveSource]))).toEqual({
            c1: "google_simulator",
            c2: "google_simulator",
            c3: "model",
            c4: "google_simulator",
            c5: "model",
            c6: "google_simulator",
            c7: "model",
            c8: "google_simulator",
        });
        const 懔壍 = await optimize(圇壍, optimizeRequestSchema.parse({ curveSource: "model" }));
        expect(懔壍.rows.every((胃壍) => 胃壍.curveSource === "model")).toBe(true);
        for (const 龲壍 of [痶壍, 懔壍]) {
            expect(龲壍.totals.recommended).toBeCloseTo(龲壍.totals.current, 6);
            expect(龲壍.rows.reduce((没壍, 讐壍) => 没壍 + 讐壍.recommended, 0)).toBeCloseTo(龲壍.totals.current, 6);
        }
        expect(痶壍.totals.expectedCurrent).not.toBeCloseTo(懔壍.totals.expectedCurrent, 0);
        expect(痶壍.curves).toMatchObject({ mode: "auto", google: 5, model: 3, available: 5 });
        expect(痶壍.curves?.calibration).toBeGreaterThan(0.5);
        expect(痶壍.curves?.calibration).toBeLessThan(1);
        for (const 塿壍 of 痶壍.rows)
            expect(塿壍.curveCalibration).toBe(塿壍.curveSource === "model" ? 痶壍.curves?.calibration : undefined);
        const 睮壍 = (陝壍: typeof 痶壍) => 陝壍.rows.find((捌壍) => 捌壍.unitId === "c3");
        expect(睮壍(痶壍)?.bound).not.toBe("max");
        expect(睮壍(痶壍)?.recommended).toBeCloseTo(睮壍(懔壍)?.recommended ?? 0, -3);
        expect(懔壍.curves).toEqual({ mode: "model", google: 0, model: 8, available: 0, calibration: null });
        expect(懔壍.rows.every((舻壍) => 舻壍.curveCalibration === undefined)).toBe(true);
    });
    it("the scenario frontier follows the same curve source", async () => {
        const 伪壍 = await requestContext();
        const 渙壍 = await scenarios(伪壍, scenariosRequestSchema.parse({}));
        const 贈壍 = await scenarios(伪壍, scenariosRequestSchema.parse({ curveSource: "model" }));
        expect(渙壍.points).toHaveLength(贈壍.points.length);
        expect(渙壍.points.find((姷壍) => 姷壍.pct === 0)?.expected).not.toBeCloseTo(贈壍.points.find((磦壍) => 磦壍.pct === 0)?.expected ?? 0, 0);
    });
});
describe("GET /api/budget/google-estimates (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("validates the query and answers with Google's estimates", async () => {
        const 韕壍 = await GET(new Request("http://localhost:3000/api/budget/google-estimates?objective=conversions"));
        expect(韕壍.status).toBe(200);
        expect(韕壍.headers.get("cache-control")).toBe("no-store");
        const 擄壍 = (await 韕壍.json()) as {
            mode: string;
            objective: string;
            blank: {
                note: string;
            } | null;
            campaigns: unknown[];
        };
        expect(擄壍).toMatchObject({ mode: "live", objective: "conversions" });
        expect(擄壍.blank).toBeNull();
        expect(擄壍.campaigns).toHaveLength(8);
        const 莳壍 = await GET(new Request("http://localhost:3000/api/budget/google-estimates?objective=clicks"));
        expect(莳壍.status).toBe(400);
        expect(((await 莳壍.json()) as {
            error: {
                code: string;
            };
        }).error.code).toBe("VALIDATION_ERROR");
    });
});
