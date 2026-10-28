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
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
const DATA_THROUGH = "2026-09-28";
function sim(points: [
    number,
    number,
    number
][], over: Partial<CampaignSimulation> = {}): CampaignSimulation {
    const days = 7;
    const pts: SimulationPoint[] = points.map(([value, cost, conversions]) => ({ value, cost: cost * days, clicks: cost * 2 * days, impressions: cost * 40 * days, conversions: conversions * days, convValue: conversions * 50 * days, requiredBudget: null }));
    return { campaignId: "c1", type: "BUDGET", modification: "UNIFORM", start: "2026-09-21", end: "2026-09-27", points: pts, ...over };
}
const POWER = sim([100, 150, 200, 250, 300, 400].map((b) => [b, b * 0.9, 2 * (b * 0.9) ** 0.7] as [
    number,
    number,
    number
]));
const LINEAR = sim([
    [200, 200, 10],
    [400, 380, 16],
    [600, 500, 20],
]);
describe("simulation points", () => {
    it("turns window totals into per-day points, sorted, one per setting", () => {
        expect(simulationDays(LINEAR)).toBe(7);
        expect(simulationDays({ start: "2026-09-27", end: "2026-09-27" })).toBe(1);
        const shuffled = { ...LINEAR, points: [LINEAR.points[2]!, LINEAR.points[0]!, { ...LINEAR.points[0]!, cost: 1 }, LINEAR.points[1]!] };
        const pts = perDayPoints(shuffled);
        expect(pts.map((p) => p.value)).toEqual([200, 400, 600]);
        expect(pts[0]).toMatchObject({ value: 200, cost: 200, conversions: 10, convValue: 500, clicks: 400 });
    });
    it("interpolates linearly between settings and extends the end segments by at most 5 %", () => {
        expect(interpolateSimulation(LINEAR, 400)).toMatchObject({ value: 400, cost: 380, conversions: 16 });
        expect(interpolateSimulation(LINEAR, 300)).toMatchObject({ cost: 290, conversions: 13 });
        expect(interpolateSimulation(LINEAR, 500)).toMatchObject({ cost: 440, conversions: 18 });
        expect(interpolateSimulation(LINEAR, 190)!.cost).toBeCloseTo(191, 6);
        expect(interpolateSimulation(LINEAR, 630)!.conversions).toBeCloseTo(20.6, 6);
        expect(interpolateSimulation(LINEAR, 189)).toBeNull();
        expect(interpolateSimulation(LINEAR, 631)).toBeNull();
        expect(interpolateSimulation(LINEAR, 0)).toBeNull();
        expect(interpolateSimulation(LINEAR, Number.NaN)).toBeNull();
        expect(interpolatePoints(perDayPoints(LINEAR), 199, 0)).toBeNull();
    });
    it("handles one point, required budgets and never goes negative", () => {
        const one = sim([[300, 280, 12]]);
        expect(interpolateSimulation(one, 310)).toMatchObject({ value: 310, cost: 280, conversions: 12 });
        expect(interpolateSimulation(one, 320)).toBeNull();
        const target = { ...LINEAR, type: "TARGET_CPA" as const, points: LINEAR.points.map((p, i) => ({ ...p, requiredBudget: [210, 400, 530][i] ?? null })) };
        expect(interpolateSimulation(target, 300)?.requiredBudget).toBeCloseTo(305, 6);
        const partial = { ...target, points: target.points.map((p, i) => (i === 1 ? { ...p, requiredBudget: null } : p)) };
        expect(interpolateSimulation(partial, 300)?.requiredBudget).toBeNull();
        const falling = sim([
            [100, 100, 1],
            [200, 200, 10],
        ]);
        expect(interpolateSimulation(falling, 96)!.conversions).toBeGreaterThanOrEqual(0);
    });
});
describe("simulator curve fit", () => {
    it("recovers an exact power law of cost with full confidence and no shrinkage", () => {
        const c = fitSimulationCurve("c1", "conversions", POWER)!;
        expect(c.b).toBeCloseTo(0.7, 6);
        expect(c.a).toBeCloseTo(2, 6);
        expect(c).toMatchObject({ campaignId: "c1", objective: "conversions", r2: 1, n: 6, confidence: "high", source: "google_simulator" });
        expect(c.spendRange).toEqual([90, 360]);
        expect(curveOutcome(c, 200)).toBeCloseTo(2 * 200 ** 0.7, 6);
        const value = fitSimulationCurve("c1", "conv_value", POWER)!;
        expect(value.a).toBeCloseTo(100, 4);
        expect(value.b).toBeCloseTo(0.7, 6);
    });
    it("clamps convex points to b = 1 and grades sparse or narrow simulations", () => {
        const convex = sim([
            [100, 100, 1],
            [200, 200, 4],
            [300, 300, 9],
        ]);
        expect(fitSimulationCurve("c1", "conversions", convex)?.b).toBe(1);
        const three = sim([
            [100, 100, 10],
            [150, 140, 12.6],
            [200, 170, 14.5],
        ]);
        expect(fitSimulationCurve("c1", "conversions", three)?.confidence).toBe("medium");
        expect(fitSimulationCurve("c1", "conversions", sim([[100, 100, 10]]))).toBeNull();
        expect(fitSimulationCurve("c1", "conversions", sim([
            [100, 100, 10],
            [200, 101, 10.1],
        ]))).toBeNull();
        expect(fitSimulationCurve("c1", "conversions", sim([
            [100, 100, 0],
            [200, 180, 0],
            [300, 250, 12],
        ]))).toBeNull();
    });
});
describe("picking and normalising simulations", () => {
    it("prefers the latest window, then UNIFORM over DEFAULT over SCALING", () => {
        const older = { ...LINEAR, end: "2026-09-20", start: "2026-09-14" };
        const scaling = { ...LINEAR, modification: "SCALING" as const };
        expect(pickSimulation([older, scaling, LINEAR], "c1", "BUDGET")).toBe(LINEAR);
        expect(pickSimulation([older], "c1", "BUDGET")).toBe(older);
        expect(pickSimulation([LINEAR], "c2", "BUDGET")).toBeNull();
        expect(pickSimulation([LINEAR], "c1", "TARGET_ROAS")).toBeNull();
        expect(pickSimulation([{ ...LINEAR, points: [] }], "c1", "BUDGET")).toBeNull();
    });
    it("scales relative (SCALING) simulations by the current setting", () => {
        const rel = { ...LINEAR, type: "TARGET_CPA" as const, modification: "SCALING" as const, relative: true, points: LINEAR.points.map((p, i) => ({ ...p, value: [0.8, 1, 1.2][i] as number })) };
        const abs = absoluteSimulation(rel, 30)!;
        expect(abs.points.map((p) => p.value)).toEqual([24, 30, 36]);
        expect(abs.relative).toBeUndefined();
        expect(absoluteSimulation(rel, null)).toBeNull();
        expect(absoluteSimulation(rel, 0)).toBeNull();
        expect(absoluteSimulation(LINEAR, null)).toBe(LINEAR);
    });
});
describe("source policy", () => {
    const model = { a: 0.2, b: 0.8 };
    const base = { campaign: { type: "Search" as const }, simulation: LINEAR, modelCurve: model, dataThrough: DATA_THROUGH, objective: "conversions" as const, currency: "USD" };
    it("Google leads inside a fresh simulated range, our model is the second opinion", () => {
        const d = chooseBudgetEstimate({ ...base, proposedDaily: 400 });
        expect(d.lead).toBe("google_simulator");
        expect(d.reason).toBe("Google's budget simulator covers $400/day (Sep 21 – Sep 27), so it leads; our model is a second opinion.");
        expect(d.googleOutcome).toBe(16);
        expect(d.model).toBeCloseTo(curveOutcome(model, 400), 9);
        expect(d.disagreementPct).toBeCloseTo(Math.round((curveOutcome(model, 400) / 16 - 1) * 1e4) / 1e4, 9);
        expect(d.google).toMatchObject({ value: 400, cost: 380 });
        expect(chooseBudgetEstimate({ ...base, proposedDaily: 400, objective: "conv_value" }).googleOutcome).toBe(800);
    });
    it("treats Performance Max like any campaign: Google leads with a fresh simulation, our model without one", () => {
        expect(chooseBudgetEstimate({ ...base, campaign: { type: "PMax" }, proposedDaily: 400 })).toMatchObject({ lead: "google_simulator", googleOutcome: 16 });
        expect(budgetSimulatorGap("PMax", LINEAR, DATA_THROUGH)).toBeNull();
        const none = chooseBudgetEstimate({ ...base, campaign: { type: "PMax" }, simulation: null, proposedDaily: 400 });
        expect(none).toMatchObject({ lead: "model", google: null, googleOutcome: null, disagreementPct: null });
        expect(none.reason).toBe("Google returned no budget simulation for this campaign, so our model leads.");
    });
    it("never lets a shared-budget campaign's simulation lead: it shows the campaign on a budget of its own", () => {
        const d = chooseBudgetEstimate({ ...base, campaign: { type: "Search", budget_shared: true }, modelCurve: null, proposedDaily: 400 });
        expect(d).toMatchObject({ lead: "model", googleOutcome: 16, model: null, disagreementPct: null });
        expect(d.reason).toBe("This campaign shares its budget with other campaigns. Google simulated it as if the budget were its own, so those points don't describe the shared budget — plan the shared budget as a whole.");
        expect(budgetSimulatorGap("Search", LINEAR, DATA_THROUGH, true)).toBe("shared");
        expect(budgetSimulatorGap("Shared", LINEAR, DATA_THROUGH)).toBe("shared");
        expect(chooseBudgetEstimate({ ...base, campaign: { type: "Search", budget_shared: true }, simulation: null, modelCurve: null, proposedDaily: 400 }).reason).toBe("This campaign shares its budget with other campaigns — plan the shared budget as a whole.");
    });
    it("our model leads without a budget simulation (targets only or none)", () => {
        const d = chooseBudgetEstimate({ ...base, simulation: null, proposedDaily: 400 });
        expect(d.lead).toBe("model");
        expect(d.reason).toBe("Google returned no budget simulation for this campaign, so our model leads.");
        expect(chooseBudgetEstimate({ ...base, simulation: { ...LINEAR, type: "TARGET_CPA" }, proposedDaily: 400 }).lead).toBe("model");
        expect(chooseBudgetEstimate({ ...base, simulation: { ...LINEAR, relative: true }, proposedDaily: 400 }).lead).toBe("model");
    });
    it("our model leads when the simulation ended more than 14 days before the data (Google is still shown)", () => {
        const stale = { ...LINEAR, start: "2026-09-07", end: addDays(DATA_THROUGH, -(STALE_AFTER_DAYS + 1)) };
        const d = chooseBudgetEstimate({ ...base, simulation: stale, proposedDaily: 400 });
        expect(d.lead).toBe("model");
        expect(d.reason).toBe("Google's budget simulation ended Sep 13, more than 14 days before the latest data, so our model leads.");
        expect(d.googleOutcome).toBe(16);
        expect(d.disagreementPct).not.toBeNull();
        const boundary = { ...LINEAR, end: addDays(DATA_THROUGH, -STALE_AFTER_DAYS) };
        expect(chooseBudgetEstimate({ ...base, simulation: boundary, proposedDaily: 400 }).lead).toBe("google_simulator");
    });
    it("our model leads outside the simulated budgets (±5 %)", () => {
        const out = chooseBudgetEstimate({ ...base, proposedDaily: 700 });
        expect(out).toMatchObject({ lead: "model", google: null, disagreementPct: null });
        expect(out.reason).toBe("$700/day is outside the budgets Google simulated ($200–$600/day), so our model leads.");
        expect(out.model).toBeCloseTo(curveOutcome(model, 700), 9);
        expect(chooseBudgetEstimate({ ...base, proposedDaily: 185 }).lead).toBe("model");
        expect(chooseBudgetEstimate({ ...base, proposedDaily: 625 }).lead).toBe("google_simulator");
        expect(chooseBudgetEstimate({ ...base, proposedDaily: 195 }).lead).toBe("google_simulator");
    });
    it("works without a model curve or a budget to evaluate", () => {
        const noModel = chooseBudgetEstimate({ ...base, modelCurve: null, proposedDaily: 400 });
        expect(noModel).toMatchObject({ lead: "google_simulator", model: null, disagreementPct: null });
        const neither = chooseBudgetEstimate({ ...base, modelCurve: null, simulation: null, proposedDaily: 400 });
        expect(neither.reason).toMatch(/Our model has no response curve for it either\.$/);
        expect(chooseBudgetEstimate({ ...base, proposedDaily: 0 })).toMatchObject({ lead: "model", reason: "There is no daily budget to evaluate.", google: null, model: null });
    });
    it("describes agreement within 10 % and which way a larger gap goes", () => {
        expect(agreementLine(0.04)).toBe("Google and our model agree within 10%");
        expect(agreementLine(-0.1)).toBe("Google and our model agree within 10%");
        expect(agreementLine(0.25)).toBe("Our model is 25% more optimistic than Google");
        expect(agreementLine(-0.304)).toBe("Our model is 30% more conservative than Google");
        expect(agreementLine(null)).toBeNull();
    });
    it("publishes the policy as data", () => {
        expect(ESTIMATE_POLICY.map((r) => [r.id, r.lead])).toEqual([
            ["pacing", "model"],
            ["trend", "model"],
            ["budget_whatif", "google_simulator"],
            ["target_whatif", "google_simulator"],
            ["reallocation", "model"],
            ["shared_budget", "model"],
        ]);
        expect(ESTIMATE_POLICY.some((r) => /no budget simulator for Performance Max/.test(r.why))).toBe(false);
        expect(ESTIMATE_POLICY.find((r) => r.id === "trend")?.why).toMatch(/Performance Planner isn't available in the Google Ads API/);
        expect(ESTIMATE_POLICY.find((r) => r.id === "target_whatif")?.why).toBe("We don't model bid targets.");
        expect(ESTIMATE_POLICY.every((r) => r.question && r.leadLabel && r.why)).toBe(true);
    });
    it("feeds the optimizer simulator curves only for single-campaign units (PMax included) with a fresh budget simulation", () => {
        const sims = [LINEAR, { ...POWER, campaignId: "c2" }, { ...LINEAR, campaignId: "pm" }, { ...LINEAR, campaignId: "old", end: "2026-09-01", start: "2026-08-26" }, { ...LINEAR, campaignId: "s1" }];
        const units = [
            { unitId: "c1", campaignIds: ["c1"], type: "Search" as const },
            { unitId: "c2", campaignIds: ["c2"], type: "Shopping" as const },
            { unitId: "pm", campaignIds: ["pm"], type: "PMax" as const },
            { unitId: "old", campaignIds: ["old"], type: "Search" as const },
            { unitId: "budget:9", campaignIds: ["s1", "s2"], type: "Shared" as const },
            { unitId: "none", campaignIds: ["none"], type: "Display" as const },
        ];
        const curves = simulatorCurves(units, sims, "conversions", DATA_THROUGH);
        expect([...curves.keys()]).toEqual(["c1", "c2", "pm"]);
        expect(curves.get("c2")).toMatchObject({ campaignId: "c2", source: "google_simulator" });
    });
});
describe("blending Google's curves with ours", () => {
    const curve = (id: string, b: number, over: Partial<ResponseCurve> = {}): ResponseCurve => ({ campaignId: id, objective: "conversions", a: 2, b, bRaw: b, r2: 0.8, n: 60, spendRange: [100, 400], confidence: "high", ...over });
    const g = (id: string, b: number) => curve(id, b, { source: "google_simulator", spendRange: [80, 500] });
    it("calibrates our curve's exponent and keeps its outcome at the typical spend", () => {
        const m = curve("u1", 0.9);
        const c = calibrateCurve(m, 0.75);
        expect(c.b).toBeCloseTo(0.675, 9);
        expect(c.calibration).toBe(0.75);
        expect(curveOutcome(c, 200)).toBeCloseTo(curveOutcome(m, 200), 9);
        expect(curveOutcome(c, 400)).toBeLessThan(curveOutcome(m, 400));
        expect(curveOutcome(c, 100)).toBeGreaterThan(curveOutcome(m, 100));
        expect(calibrateCurve(curve("u2", 0.9), 1.5).b).toBe(0.95);
        expect(calibrateCurve(curve("u3", 0.9, { spendRange: [0, 0] }), 0.75)).toEqual(curve("u3", 0.9, { spendRange: [0, 0] }));
    });
    it("puts every unit on Google's scale when at least two units have both curves", () => {
        const model = new Map([
            ["u1", curve("u1", 0.9)],
            ["u2", curve("u2", 0.8)],
            ["u3", curve("u3", 0.9)],
            ["pmax", curve("pmax", 0.92)],
        ]);
        const google = new Map([
            ["u1", g("u1", 0.63)],
            ["u2", g("u2", 0.64)],
            ["u3", g("u3", 0.81)],
        ]);
        const blend = blendCurves(model, google);
        expect(blend).toMatchObject({ google: 3, model: 1, available: 3, calibration: 0.8, basis: 3 });
        expect(blend.curves.get("u1")).toBe(google.get("u1"));
        expect(blend.curves.get("pmax")).toMatchObject({ b: 0.92 * 0.8, calibration: 0.8 });
        expect(blend.curves.get("pmax")?.source).toBeUndefined();
    });
    it("leaves Google out below two overlapping units, needs no calibration when Google prices everything, and clamps the factor", () => {
        const model = new Map([
            ["u1", curve("u1", 0.9)],
            ["pmax", curve("pmax", 0.9)],
        ]);
        const one = blendCurves(model, new Map([["u1", g("u1", 0.6)]]));
        expect(one).toMatchObject({ google: 0, model: 2, available: 1, calibration: null, basis: 1 });
        expect(one.curves.get("u1")).toBe(model.get("u1"));
        const none = blendCurves(model, new Map());
        expect(none).toMatchObject({ google: 0, model: 2, available: 0, calibration: null });
        const all = blendCurves(model, new Map([["u1", g("u1", 0.6)], ["pmax", g("pmax", 0.5)]]));
        expect(all).toMatchObject({ google: 2, model: 0, calibration: null });
        const steep = blendCurves(new Map([...model, ["u2", curve("u2", 0.9)]]), new Map([["u1", g("u1", 0.1)], ["u2", g("u2", 0.1)]]));
        expect(steep.calibration).toBe(CALIBRATION_RANGE[0]);
    });
});
describe("synthetic estimates", () => {
    const ds = demoDataset();
    const est = buildDemoEstimates(ds, { seed: "savd-demo-v1" });
    const budgetSims = est.simulations.filter((s) => s.type === "BUDGET");
    it("is deterministic per seed and pure", () => {
        expect(buildDemoEstimates(ds, { seed: "savd-demo-v1" })).toEqual(est);
        expect(buildDemoEstimates(ds, { seed: "another-seed" })).not.toEqual(est);
        expect(est.warnings).toEqual([]);
    });
    it("simulates budgets for Search, Shopping and Display only — the demo leaves PMax, Video and Demand Gen without", () => {
        expect(budgetSims.map((s) => s.campaignId)).toEqual(["c1", "c2", "c4", "c6", "c8"]);
        for (const id of ["c3", "c5", "c7"])
            expect(est.simulations.filter((s) => s.campaignId === id), id).toEqual([]);
        expect(ds.dims.campaigns.get("c3")?.type).toBe("PMax");
    });
    it("replays the 7 days before the anchor at 0.5×–2× the daily budget, reconciling with campaign_daily at 1×", () => {
        for (const s of budgetSims) {
            expect(s).toMatchObject({ start: addDays(ANCHOR, -7), end: addDays(ANCHOR, -1), modification: "UNIFORM" });
            const budget = ds.dims.campaigns.get(s.campaignId)!.budget_daily!;
            expect(s.points.map((p) => p.value)).toEqual(BUDGET_MULTIPLIERS.map((m) => Math.round(budget * m * 100) / 100));
            const actual = ds.tables.campaign_daily.filter((r) => r.campaign_id === s.campaignId && r.date >= s.start && r.date <= s.end).reduce((sum, r) => sum + r.cost, 0);
            expect(s.points[2]!.cost).toBeCloseTo(actual, 1);
        }
    });
    it("has diminishing returns, and budget-limited campaigns turn extra budget into spend", () => {
        for (const s of budgetSims) {
            const perDollar = s.points.map((p) => p.conversions / p.cost);
            for (let i = 1; i < perDollar.length; i++)
                expect(perDollar[i]!, s.campaignId).toBeLessThan(perDollar[i - 1]! + 1e-9);
            const values = s.points.map((p) => p.convValue);
            expect([...values].sort((a, b) => a - b), s.campaignId).toEqual(values);
        }
        const growth = (id: string) => {
            const s = budgetSims.find((x) => x.campaignId === id)!;
            return s.points[5]!.cost / s.points[2]!.cost;
        };
        expect(growth("c1")).toBeGreaterThan(1.6);
        expect(growth("c8")).toBeLessThan(1.35);
        expect(spendElasticity(0.25)).toBeCloseTo(0.75, 6);
        expect(spendElasticity(0)).toBe(0.1);
        expect(spendElasticity(1)).toBe(0.85);
    });
    it("simulates targets only for campaigns bidding with one (and not for PMax)", () => {
        const targets = est.simulations.filter((s) => s.type !== "BUDGET");
        expect(targets.map((s) => `${s.campaignId}:${s.type}`)).toEqual(["c4:TARGET_ROAS"]);
        const roas = targets[0]!;
        expect(roas.points.map((p) => p.value)).toEqual([2.8, 3.4, 4, 4.6, 5.2, 6]);
        expect(roas.points.every((p) => p.requiredBudget !== null && p.requiredBudget * 7 > p.cost)).toBe(true);
        expect(roas.points[0]!.cost).toBeGreaterThan(roas.points[5]!.cost);
        expect(roas.points[5]!.convValue / roas.points[5]!.cost).toBeGreaterThan(roas.points[0]!.convValue / roas.points[0]!.cost);
        const outlet = buildDemoEstimates(outletDataset(), { seed: "savd-demo-v1" });
        expect(outlet.simulations.filter((s) => s.type !== "BUDGET").map((s) => `${s.campaignId}:${s.type}`)).toEqual(["t2:TARGET_CPA", "t4:TARGET_ROAS"]);
        expect(outlet.simulations.some((s) => s.campaignId === "t3")).toBe(false);
    });
    it("recommends a budget only for clearly budget-limited campaigns, with impacts read off the simulation", () => {
        expect(est.recommendations.map((r) => r.campaignId)).toEqual(["c1"]);
        const rec = est.recommendations[0]!;
        const s = budgetSims.find((x) => x.campaignId === "c1")!;
        expect(rec).toMatchObject({ type: "CAMPAIGN_BUDGET", currentBudget: 420, recommendedBudget: 630, campaignIds: ["c1"], budgetId: "b-c1", dismissed: false });
        expect(rec.options.map((o) => o.budget)).toEqual([525, 630, 840]);
        const at = (v: number) => s.points.find((p) => p.value === v)!;
        for (const o of rec.options) {
            expect(o.impact?.base).toMatchObject({ cost: at(420).cost, conversions: at(420).conversions });
            expect(o.impact?.potential).toMatchObject({ cost: at(o.budget).cost, conversions: at(o.budget).conversions, convValue: at(o.budget).convValue, videoViews: null });
        }
        expect(rec.impact).toEqual(rec.options[1]!.impact);
        expect(buildDemoEstimates(outletDataset(), { seed: "savd-demo-v1" }).recommendations).toEqual([]);
    });
});
describe("google estimates service (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("returns Google's estimates next to our model and states the policy", async () => {
        const ctx = await requestContext();
        const view = await getGoogleEstimatesView(ctx, { objective: "conv_value" });
        expect(view).toMatchObject({ mode: "live", currency: "USD", dataThrough: "2026-09-28", objective: "conv_value", warnings: [] });
        expect(view.blank).toBeNull();
        expect(view.policy).toEqual(ESTIMATE_POLICY);
        expect(view.campaigns.map((c) => c.campaignId)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
        const c1 = view.campaigns[0]!;
        expect(c1.simulations.map((s) => s.type)).toEqual(["BUDGET"]);
        expect(c1.simulations[0]).toMatchObject({ days: 7, current: 420, stale: false });
        expect(c1.simulations[0]!.perDay).toHaveLength(6);
        expect(c1.decision).toMatchObject({ lead: "google_simulator", proposedDaily: 420, objective: "conv_value" });
        expect(c1.modelCurve?.objective).toBe("conv_value");
        expect(c1.modelCurve?.source).toBeUndefined();
        expect(c1.simulatorCurve).toMatchObject({ source: "google_simulator", confidence: "high" });
        expect(c1.note).toBeNull();
        const c3 = view.campaigns.find((c) => c.campaignId === "c3")!;
        expect(c3).toMatchObject({ type: "PMax", simulations: [], simulatorCurve: null, note: "Google returned no budget simulation for this campaign, so our model leads." });
        expect(c3.decision?.model).toBeGreaterThan(0);
        expect(view.campaigns.find((c) => c.campaignId === "c4")?.simulations.map((s) => s.type)).toEqual(["BUDGET", "TARGET_ROAS"]);
        expect(view.recommendations).toHaveLength(1);
        expect(view.recommendations[0]).toMatchObject({ campaignId: "c1", campaignName: "Brand — Core Terms", campaignType: "Search", liveBudget: 420, recommendedBudget: 630, applied: false });
        expect(view.recommendations[0]!.deepLink).toContain("campaignId=c1");
    });
    it("degrades to our model with a warning when Google's estimates can't be read", async () => {
        const ctx = await requestContext();
        const broken: RequestContext = { ...ctx, source: Object.assign(Object.create(Object.getPrototypeOf(ctx.source) as object) as typeof ctx.source, ctx.source, { getGoogleEstimates: vi.fn(async () => Promise.reject(new Error("boom"))) }) };
        const view = await getGoogleEstimatesView(broken, { objective: "conv_value" });
        expect(view.warnings).toEqual(["Google's simulators and recommendations are unavailable right now; every estimate here is our model's."]);
        expect(view.recommendations).toEqual([]);
        expect(view.campaigns.every((c) => c.simulations.length === 0 && (c.decision === null || c.decision.lead === "model"))).toBe(true);
        const opt = await optimize(broken, optimizeRequestSchema.parse({}));
        expect(opt.rows.every((r) => r.curveSource === "model")).toBe(true);
        expect(opt.warnings).toContain("Google's simulators and recommendations are unavailable right now; every estimate here is our model's.");
    });
});
describe("optimizer curve source (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("uses Google's simulator curves where the policy allows on auto, our model elsewhere, and keeps the total", async () => {
        const ctx = await requestContext();
        const auto = await optimize(ctx, optimizeRequestSchema.parse({}));
        expect(Object.fromEntries(auto.rows.map((r) => [r.unitId, r.curveSource]))).toEqual({
            c1: "google_simulator",
            c2: "google_simulator",
            c3: "model",
            c4: "google_simulator",
            c5: "model",
            c6: "google_simulator",
            c7: "model",
            c8: "google_simulator",
        });
        const modelOnly = await optimize(ctx, optimizeRequestSchema.parse({ curveSource: "model" }));
        expect(modelOnly.rows.every((r) => r.curveSource === "model")).toBe(true);
        for (const res of [auto, modelOnly]) {
            expect(res.totals.recommended).toBeCloseTo(res.totals.current, 6);
            expect(res.rows.reduce((s, r) => s + r.recommended, 0)).toBeCloseTo(res.totals.current, 6);
        }
        expect(auto.totals.expectedCurrent).not.toBeCloseTo(modelOnly.totals.expectedCurrent, 0);
        expect(auto.curves).toMatchObject({ mode: "auto", google: 5, model: 3, available: 5 });
        expect(auto.curves?.calibration).toBeGreaterThan(0.5);
        expect(auto.curves?.calibration).toBeLessThan(1);
        for (const r of auto.rows)
            expect(r.curveCalibration).toBe(r.curveSource === "model" ? auto.curves?.calibration : undefined);
        const pmax = (res: typeof auto) => res.rows.find((r) => r.unitId === "c3");
        expect(pmax(auto)?.bound).not.toBe("max");
        expect(pmax(auto)?.recommended).toBeCloseTo(pmax(modelOnly)?.recommended ?? 0, -3);
        expect(modelOnly.curves).toEqual({ mode: "model", google: 0, model: 8, available: 0, calibration: null });
        expect(modelOnly.rows.every((r) => r.curveCalibration === undefined)).toBe(true);
    });
    it("the scenario frontier follows the same curve source", async () => {
        const ctx = await requestContext();
        const auto = await scenarios(ctx, scenariosRequestSchema.parse({}));
        const model = await scenarios(ctx, scenariosRequestSchema.parse({ curveSource: "model" }));
        expect(auto.points).toHaveLength(model.points.length);
        expect(auto.points.find((p) => p.pct === 0)?.expected).not.toBeCloseTo(model.points.find((p) => p.pct === 0)?.expected ?? 0, 0);
    });
});
describe("GET /api/budget/google-estimates (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("validates the query and answers with Google's estimates", async () => {
        const res = await GET(new Request("http://localhost:3000/api/budget/google-estimates?objective=conversions"));
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("no-store");
        const body = (await res.json()) as {
            mode: string;
            objective: string;
            blank: {
                note: string;
            } | null;
            campaigns: unknown[];
        };
        expect(body).toMatchObject({ mode: "live", objective: "conversions" });
        expect(body.blank).toBeNull();
        expect(body.campaigns).toHaveLength(8);
        const bad = await GET(new Request("http://localhost:3000/api/budget/google-estimates?objective=clicks"));
        expect(bad.status).toBe(400);
        expect(((await bad.json()) as {
            error: {
                code: string;
            };
        }).error.code).toBe("VALIDATION_ERROR");
    });
});
