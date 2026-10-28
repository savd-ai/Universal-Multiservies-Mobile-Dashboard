import { describe, expect, it } from "vitest";
import type { OptimizeResult, PacingRow } from "@/lib/domain/contracts/budget";
import { flightPreview, planFlightPreview } from "@/features/budget/lib/flighting";
import { curveMixLine, curveSourceLabel, diffRows, formatOutcome, liftSummary, lowConfidenceNames, marginalLabel, optimizeBody, optimizerChanges, optimizerConstraints, recommendedTargets, validateSettings } from "@/features/budget/lib/optimizer";
const pr = (unitId: string, monthlyTarget: number, over: Partial<PacingRow> = {}) => ({ unitId, campaignIds: [unitId], name: unitId.toUpperCase(), type: "Search", dailyBudget: monthlyTarget / 30, monthlyTarget, ...over }) as PacingRow;
describe("optimizer request", () => {
    const rows = [pr("c1", 12600), pr("c2", 23400)];
    it("fixes locked units at their saved target and bounds the rest", () => {
        expect(optimizerConstraints(rows, { c1: true }, 0.5, 1.6)).toEqual({ c1: { locked: 12600 }, c2: { min: 11700, max: 37440 } });
    });
    it("builds a monthly body on the $50 grid", () => {
        const body = optimizeBody("2026-09", { strategy: "marginal", objective: "conversions", total: 36000.004, minMult: 0.5, maxMult: 1.6 }, rows, {});
        expect(body).toMatchObject({ month: "2026-09", period: "monthly", total: 36000, objective: "conversions", strategy: "marginal", roundTo: 50 });
    });
    it("validates settings", () => {
        const ok = { strategy: "marginal" as const, objective: "conv_value" as const, total: 1, minMult: 0.5, maxMult: 1.6 };
        expect(validateSettings(ok)).toBeNull();
        expect(validateSettings({ ...ok, total: 0 })).toMatch(/total/);
        expect(validateSettings({ ...ok, minMult: 2 })).toMatch(/above the maximum/);
        expect(validateSettings({ ...ok, minMult: -1 })).toMatch(/negative/);
    });
});
describe("optimizer result", () => {
    const result: OptimizeResult = {
        objective: "conv_value",
        strategy: "marginal",
        period: "monthly",
        rows: [
            { unitId: "c1", name: "C1", current: 12600, recommended: 20150, delta: 7550, deltaPct: 0.599, expected: { current: 1, recommended: 2 }, marginalCost: 0.0633, bound: "max", curveConfidence: "medium" },
            { unitId: "c2", name: "C2", current: 23400, recommended: 11700, delta: -11700, deltaPct: -0.5, expected: { current: 1, recommended: 1 }, marginalCost: 0.45, bound: "min", curveConfidence: "low" },
            { unitId: "budget:7", name: "Shared", current: 9000, recommended: 13150, delta: 4150, deltaPct: 0.46, expected: { current: 1, recommended: 1 }, marginalCost: 0.3, bound: null, curveConfidence: "high" },
            { unitId: "c4", name: "C4", current: 9000, recommended: 9000, delta: 0, deltaPct: 0, expected: { current: 1, recommended: 1 }, marginalCost: 0.3, bound: "locked", curveConfidence: "high" },
        ],
        totals: { current: 54000, recommended: 54000, expectedCurrent: 100, expectedRecommended: 117.5, liftPct: 0.175 },
        warnings: [],
    };
    const rows = [pr("c1", 12600, { dailyBudget: 420 }), pr("c2", 23400, { dailyBudget: 780 }), pr("budget:7", 9000, { campaignIds: ["x", "y"], type: "Shared" }), pr("c4", 9000, { dailyBudget: 300 })];
    it("adds daily equivalents and flags shared units", () => {
        const d = diffRows(result, rows, 30);
        expect(d[0]).toMatchObject({ currentDaily: 420, recommendedDaily: 671.67, campaignId: "c1", shared: false, liveDaily: 420 });
        expect(d[2]).toMatchObject({ shared: true, campaignId: null });
    });
    it("turns recommended monthly amounts into daily set_budget items", () => {
        const { changes, skipped } = optimizerChanges(diffRows(result, rows, 30));
        expect(changes).toEqual([
            { unitId: "c1", campaignId: "c1", name: "C1", from: 420, to: 671.67 },
            { unitId: "c2", campaignId: "c2", name: "C2", from: 780, to: 390 },
        ]);
        expect(skipped).toEqual([
            { name: "Shared", reason: "Shared budget — edit it in Google Ads (Shared library)" },
            { name: "C4", reason: "Already at this budget" },
        ]);
    });
    it("summarises lift, targets and confidence", () => {
        expect(recommendedTargets(result)).toEqual({ c1: 20150, c2: 11700, "budget:7": 13150, c4: 9000 });
        expect(liftSummary(result)).toMatchObject({ pct: 0.175, sameBudget: true, before: 100, after: 117.5 });
        expect(lowConfidenceNames(result)).toEqual(["C2"]);
    });
    it("labels marginal returns and outcomes", () => {
        expect(marginalLabel("conv_value", 0.2, "USD")).toBe("5.00x");
        expect(marginalLabel("conversions", 19.4648, "USD")).toBe("$19.46/conv");
        expect(marginalLabel("conversions", 103.07, "USD")).toBe("$103/conv");
        expect(marginalLabel("conversions", null, "USD")).toBe("—");
        expect(formatOutcome("conv_value", 777011, "USD")).toBe("$777K");
        expect(formatOutcome("conversions", 8511.56, "USD")).toBe("8,512");
        expect(formatOutcome("conversions", 45.96, "USD")).toBe("46.0");
    });
});
describe("curve sources", () => {
    it("labels each row's curve and says which curves priced the split", () => {
        expect(curveSourceLabel("google_simulator")).toBe("Google simulator");
        expect(curveSourceLabel("model", 0.84)).toBe("Our model, matched to Google");
        expect(curveSourceLabel(undefined)).toBe("Our model");
        expect(curveMixLine(undefined)).toBeNull();
        expect(curveMixLine({ mode: "model", google: 0, model: 8, available: 0, calibration: null })).toMatch(/^Our model prices all 8 budgets/);
        expect(curveMixLine({ mode: "auto", google: 5, model: 3, available: 5, calibration: 0.8409 })).toBe("Google's budget simulators price 5 of 8 budgets. Our model prices the other 3, with its curves matched to Google's (exponents ×0.84) so the split doesn't favour either source.");
        expect(curveMixLine({ mode: "auto", google: 0, model: 8, available: 1, calibration: null })).toMatch(/only 1 of them, too few/);
        expect(curveMixLine({ mode: "auto", google: 0, model: 8, available: 0, calibration: null })).toMatch(/no fresh budget simulation/);
        expect(curveMixLine({ mode: "auto", google: 8, model: 0, available: 8, calibration: null })).toBe("Google's budget simulators price all 8 budgets.");
    });
});
describe("flighting preview", () => {
    it("even spreads to the cent and sums exactly", () => {
        const p = flightPreview(1000, "2026-10", "even");
        expect(p.days).toHaveLength(31);
        expect(p.total).toBe(1000);
        expect(p.avgDaily).toBeCloseTo(32.26, 2);
        expect(Math.max(...p.days.map((d) => d.amount)) - Math.min(...p.days.map((d) => d.amount))).toBeLessThanOrEqual(0.01);
    });
    it("front- and back-loading move spend to the start / end", () => {
        const front = flightPreview(31000, "2026-10", "front_loaded");
        const back = flightPreview(31000, "2026-10", "back_loaded");
        expect(front.total).toBe(31000);
        expect(front.firstWeekShare).toBeGreaterThan(front.lastWeekShare);
        expect(back.lastWeekShare).toBeGreaterThan(back.firstWeekShare);
        expect(front.peak?.date).toBe("2026-10-01");
        expect(back.peak?.date).toBe("2026-10-31");
        expect(front.peak?.amount).toBeCloseTo(1300, 0);
    });
    it("weekday weighting puts weekends below weekdays", () => {
        const p = flightPreview(30000, "2026-11", "dow_weighted");
        const sat = p.days.find((d) => d.date === "2026-11-07")?.amount ?? 0;
        const mon = p.days.find((d) => d.date === "2026-11-09")?.amount ?? 0;
        expect(sat).toBeLessThan(mon);
        expect(p.total).toBe(30000);
    });
    it("sums lines with their own patterns", () => {
        const p = planFlightPreview([
            { monthly: { "2026-10": 3100 }, flighting: { pattern: "even" } },
            { monthly: { "2026-10": 3100 }, flighting: { pattern: "front_loaded" } },
            { monthly: {}, flighting: { pattern: "even" } },
        ], "2026-10");
        expect(p.total).toBe(6200);
        expect(p.days[0]?.amount).toBeCloseTo(100 + 130, 0);
        expect(planFlightPreview([], "2026-10").days).toHaveLength(31);
    });
});
