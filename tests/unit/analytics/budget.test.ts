import { describe, expect, it } from "vitest";
import { curveOutcome, fitResponseCurve } from "@/lib/domain/budget/curves";
import { changeListLine, EDITOR_BUDGET_HEADER, editorBudgetCsv, planCsv } from "@/lib/domain/budget/exports";
import { dailySchedule, flightWeights } from "@/lib/domain/budget/flighting";
import { backtestMape, forecastSeries } from "@/lib/domain/budget/forecast";
import { allocationOutcome, optimizeBudget, type OptimizerInput, type OptimizerUnit } from "@/lib/domain/budget/optimizer";
import { buildPacingReport, spendTargets, suggestionMonth } from "@/lib/domain/budget/pacing";
import { draftLine, RETAIL_PRESET, seasonalIndex, seasonalTotals } from "@/lib/domain/budget/plans";
import { scenarioFrontier } from "@/lib/domain/budget/scenarios";
import { budgetUnits } from "@/lib/domain/budget/units";
import { MONTHLY_CAP_FACTOR, type ResponseCurve } from "@/lib/domain/contracts/budget";
import { addDays, enumerate } from "@/lib/domain/dates";
import type { CampaignDailyRow } from "@/lib/domain/schema/facts";
import { ANCHOR, campaign, demoDataset, rows } from "./helpers";
const flat = (cost: number) => () => ({ cost, clicks: 100, impressions: 2000, conversions: 5, conv_value: cost * 3 });
describe("pacing", () => {
    const campaigns = [
        campaign("a", { budget_daily: 100 }),
        campaign("nob", { budget_daily: null }),
        campaign("s1", { budget_daily: 200, budget_shared: true, budget_id: "shared-1" }),
        campaign("s2", { budget_daily: 200, budget_shared: true, budget_id: "shared-1" }),
        campaign("p", { budget_daily: 50, status: "Paused" }),
        campaign("cust", { budget_daily: 80, budget_period: "custom" }),
    ];
    const data = (end: string): CampaignDailyRow[] => [
        ...rows("a", end, 60, flat(90)),
        ...rows("nob", end, 60, flat(20)),
        ...rows("s1", end, 60, flat(80)),
        ...rows("s2", end, 60, flat(100)),
        ...rows("p", end, 60, (i) => (i < 50 ? flat(40)() : flat(0)())),
        ...rows("cust", end, 60, flat(70)),
    ];
    it("month end: complete month, projection = spend, no recommendation", () => {
        const r = buildPacingReport({ month: "2026-09", dataThrough: "2026-09-30", campaigns, rows: data("2026-09-30") });
        expect(r).toMatchObject({ daysInMonth: 30, elapsedDays: 30, remainingDays: 0, monthLabel: "September 2026" });
        const a = r.rows.find((x) => x.unitId === "a")!;
        expect(a.mtdSpend).toBeCloseTo(2700, 6);
        expect(a.projected).toBeCloseTo(2700, 6);
        expect(a.monthlyTarget).toBe(3000);
        expect(a.recommendedDaily).toBeNull();
        expect(a.status).toBe("on_track");
        expect(a.recommendationNote).toMatch(/^Month complete/);
        expect(r.cumulative).toHaveLength(30);
        expect(r.cumulative.at(-1)).toMatchObject({ actual: r.totals.mtdSpend, projected: r.totals.mtdSpend, ideal: r.totals.monthlyTarget });
    });
    it("1st of the month: one elapsed day, run rate from the previous week", () => {
        const r = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-01", campaigns, rows: data("2026-10-01") });
        expect(r).toMatchObject({ daysInMonth: 31, elapsedDays: 1, remainingDays: 30 });
        const a = r.rows.find((x) => x.unitId === "a")!;
        expect(a.mtdSpend).toBeCloseTo(90, 6);
        expect(a.avg7).toBeCloseTo(90, 6);
        expect(a.projected).toBeCloseTo(90 * 31, 4);
        expect(a.monthlyTarget).toBe(3100);
        expect(a.paceRatio).toBeCloseTo(0.9, 4);
        expect(a.recommendedDaily).toBeCloseTo((3100 - 90) / 30, 2);
        expect(a.idealToDate).toBeCloseTo(100, 6);
        expect(r.cumulative[0]).toMatchObject({ date: "2026-10-01", actual: r.totals.mtdSpend, projected: r.totals.mtdSpend });
        expect(r.cumulative.at(-1)?.projected).toBeCloseTo(r.totals.projected, 1);
    });
    it("no budget, shared budgets, paused and custom-period campaigns", () => {
        const r = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns, rows: data(ANCHOR), targets: { a: 2500 }, locks: { a: true } });
        const byId = new Map(r.rows.map((x) => [x.unitId, x]));
        expect(byId.get("nob")).toMatchObject({ status: "no_budget", monthlyTarget: 0, paceRatio: 0 });
        const shared = byId.get("budget:shared-1")!;
        expect(shared).toMatchObject({ type: "Shared", campaignIds: ["s1", "s2"], dailyBudget: 200, monthlyTarget: 6000 });
        expect(shared.mtdSpend).toBeCloseTo(180 * 28, 6);
        expect(byId.has("s1")).toBe(false);
        const paused = byId.get("p")!;
        expect(paused).toMatchObject({ paused: true, status: "paused", recommendedDaily: null });
        expect(paused.projected).toBeCloseTo(paused.mtdSpend, 6);
        expect(paused.monthlyTarget).toBeCloseTo(paused.mtdSpend, 2);
        expect(r.rows.at(-1)?.unitId).toBe("p");
        expect(byId.get("cust")?.status).toBe("unsupported_period");
        expect(byId.get("a")).toMatchObject({ monthlyTarget: 2500, locked: true, status: "overpacing" });
        expect(r.totals.overpacingCount).toBe(1);
        expect(r.totals.monthlyTarget).toBeCloseTo(r.rows.reduce((s, x) => s + x.monthlyTarget, 0), 6);
    });
    it("paused campaigns don't inflate the month's budget or count as underpacing", () => {
        const cs = [campaign("a", { budget_daily: 100 }), campaign("long", { budget_daily: 500, status: "Paused" }), campaign("mid", { budget_daily: 100, status: "Paused" })];
        const data2 = [...rows("a", ANCHOR, 60, flat(100)), ...rows("long", ANCHOR, 60, flat(0)), ...rows("mid", ANCHOR, 60, (i) => (i < 45 ? flat(100)() : flat(0)()))];
        const r = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: cs, rows: data2 });
        const byId = new Map(r.rows.map((x) => [x.unitId, x]));
        expect(byId.get("long")).toMatchObject({ status: "paused", monthlyTarget: 0, projected: 0, paceRatio: 0, recommendedDaily: null, recommendationNote: "Paused — nothing spent so far this month; no further spend expected." });
        expect(byId.get("mid")).toMatchObject({ status: "paused", mtdSpend: 1300, monthlyTarget: 1300, projected: 1300, recommendationNote: "Paused — spent $1,300 so far this month; no further spend expected." });
        expect(r.totals).toMatchObject({ monthlyTarget: 3000 + 1300, projected: 3000 + 1300, paceRatio: 1, underpacingCount: 0, overpacingCount: 0 });
        expect(r.rows.map((x) => x.unitId)).toEqual(["a", "long", "mid"]);
        const planned = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: cs, rows: data2, targets: { mid: 2000 } }).rows.find((x) => x.unitId === "mid")!;
        expect(planned).toMatchObject({ status: "paused", monthlyTarget: 2000, recommendedDaily: null });
        expect(planned.recommendationNote).toBe("Paused — spent $1,300 so far this month; no further spend expected. $700 of the $2,000 target stays unused.");
        const done = buildPacingReport({ month: "2026-08", dataThrough: ANCHOR, campaigns: cs, rows: data2 }).rows.find((x) => x.unitId === "mid")!;
        expect(done).toMatchObject({ status: "paused", monthlyTarget: 3100, recommendationNote: "Paused — spent $3,100 in the month." });
        const next = buildPacingReport({ month: "2026-10", dataThrough: ANCHOR, campaigns: cs, rows: data2 });
        expect(next.rows.filter((x) => x.paused).map((x) => x.monthlyTarget)).toEqual([0, 0]);
        expect(next.totals.monthlyTarget).toBe(3100);
    });
    it("last month's spend as a starting point for the targets", () => {
        expect(suggestionMonth("2026-10", "2026-10-01")).toBe("2026-09");
        expect(suggestionMonth("2026-09", ANCHOR)).toBe("2026-08");
        expect(suggestionMonth("2026-10", ANCHOR)).toBe("2026-08");
        expect(suggestionMonth("2026-10", "2026-09-30")).toBe("2026-09");
        expect(suggestionMonth("2026-12", "2026-10-01")).toBe("2026-09");
        expect(suggestionMonth("2026-07", ANCHOR)).toBe("2026-06");
        const cs = [
            campaign("a"),
            campaign("p", { status: "Paused" }),
            campaign("new"),
            campaign("s1", { budget_shared: true, budget_id: "sh" }),
            campaign("s2", { budget_shared: true, budget_id: "sh" }),
            campaign("cust", { budget_period: "custom" }),
        ];
        const data2 = [
            ...rows("a", "2026-09-30", 30, flat(90)),
            ...rows("a", "2026-08-31", 31, flat(1000)),
            ...rows("p", "2026-09-30", 30, flat(50)),
            ...rows("s1", "2026-09-30", 30, flat(10)),
            ...rows("s2", "2026-09-30", 30, flat(20.5)),
            ...rows("cust", "2026-09-30", 30, flat(70)),
        ];
        expect(spendTargets(budgetUnits(cs), data2, "2026-09", "2026-10")).toEqual({ month: "2026-09", targets: { a: 2790, "budget:sh": 946 }, total: 3736 });
        expect(spendTargets(budgetUnits(cs), [], "2026-09", "2026-10")).toBeNull();
    });
    it("limits expected spend to 2× daily and flags reaching the 30.4 × daily monthly limit early", () => {
        const hot = [campaign("h", { budget_daily: 100 })];
        const r = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-05", campaigns: hot, rows: rows("h", "2026-10-05", 40, flat(250)) });
        const h = r.rows[0]!;
        expect(h.mtdSpend).toBeCloseTo(5 * 250, 6);
        expect(h.expectedDaily).toBeCloseTo(200, 6);
        expect(h.projected).toBeCloseTo(1250 + 26 * 200, 6);
        expect(h).toMatchObject({ capped: true, status: "overpacing" });
        expect(h.recommendationNote).toContain(`monthly charging limit ($${(100 * MONTHLY_CAP_FACTOR).toLocaleString("en-US")}`);
        expect(h.recommendationNote).toContain("Oct 14");
        const full = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-05", campaigns: hot, rows: rows("h", "2026-10-05", 40, flat(100)) }).rows[0]!;
        expect(full.capped).toBeUndefined();
        expect(full.status).toBe("on_track");
    });
    it("future months start from the run rate", () => {
        const r = buildPacingReport({ month: "2026-11", dataThrough: ANCHOR, campaigns: [campaign("a", { budget_daily: 100 })], rows: rows("a", ANCHOR, 40, flat(90)) });
        expect(r).toMatchObject({ elapsedDays: 0, remainingDays: 30 });
        expect(r.rows[0]?.mtdSpend).toBe(0);
        expect(r.rows[0]?.projected).toBeCloseTo(2700, 4);
        expect(r.cumulative.every((p) => p.actual === null)).toBe(true);
    });
    it("demo September: c6 spikes but the month still lands near target", () => {
        const ds = demoDataset();
        const r = buildPacingReport({ month: "2026-09", dataThrough: ds.anchor, campaigns: [...ds.dims.campaigns.values()], rows: ds.tables.campaign_daily });
        expect(r).toMatchObject({ elapsedDays: 28, remainingDays: 2, daysInMonth: 30 });
        const c6 = r.rows.find((x) => x.unitId === "c6")!;
        expect(c6.monthlyTarget).toBe(7800);
        expect(c6.paceRatio).toBeGreaterThan(0.9);
        expect(c6.sliderMin).toBe(2350);
        expect(c6.sliderMax).toBe(15600);
        expect(r.rows.find((x) => x.unitId === "c1")?.budgetLimited).toBe(true);
        expect(r.totals.mtdSpend).toBeCloseTo(r.rows.reduce((s, x) => s + x.mtdSpend, 0), 4);
    });
});
const curve = (id: string, a: number, b: number): ResponseCurve => ({ campaignId: id, objective: "conversions", a, b, bRaw: b, r2: 0.8, n: 60, spendRange: [1, 1e6], confidence: "high" });
const unit = (id: string, current: number, a: number, b: number, extra: Partial<OptimizerUnit> = {}): OptimizerUnit => ({ unitId: id, name: id, current, curve: curve(id, a, b), ...extra });
const base = (units: OptimizerUnit[], total: number, extra: Partial<OptimizerInput> = {}): OptimizerInput => ({ units, total, step: 50, days: 30, objective: "conversions", strategy: "marginal", period: "monthly", ...extra });
describe("optimizer", () => {
    it("preserves the total exactly, even when it is not a multiple of the step", () => {
        const units = [unit("u1", 3000, 0.4, 0.8), unit("u2", 6000, 0.2, 0.7), unit("u3", 1500, 0.9, 0.6), unit("u4", 2000, 0.3, 0.75)];
        for (const total of [12500, 12345.67, 9000.01, 15000]) {
            const res = optimizeBudget(base(units, total));
            expect(res.rows.reduce((s, r) => s + r.recommended, 0)).toBeCloseTo(total, 6);
            expect(res.totals.recommended).toBeCloseTo(total, 6);
            const offGrid = res.rows.filter((r) => Math.abs(r.recommended / 50 - Math.round(r.recommended / 50)) > 1e-9);
            expect(offGrid.length).toBeLessThanOrEqual(1);
            for (const r of res.rows) {
                const cur = units.find((u) => u.unitId === r.unitId)!.current;
                expect(r.recommended).toBeGreaterThanOrEqual(cur * 0.5 - 1e-6);
                expect(r.recommended).toBeLessThanOrEqual(cur * 1.6 + 1e-6);
            }
        }
    });
    it("matches a brute-force search on 3 campaigns", () => {
        const units = [unit("u1", 1500, 0.8, 0.8), unit("u2", 2500, 0.35, 0.6), unit("u3", 1000, 1.2, 0.5)];
        const total = 5000;
        const res = optimizeBudget(base(units, total));
        const grid = (u: OptimizerUnit) => {
            const out: number[] = [];
            for (let v = Math.ceil((u.current * 0.5) / 50) * 50; v <= u.current * 1.6 + 1e-9; v += 50)
                out.push(v);
            return out;
        };
        let best = -Infinity;
        for (const x1 of grid(units[0]!))
            for (const x2 of grid(units[1]!)) {
                const x3 = total - x1 - x2;
                if (x3 < units[2]!.current * 0.5 - 1e-9 || x3 > units[2]!.current * 1.6 + 1e-9)
                    continue;
                best = Math.max(best, allocationOutcome(units, [x1, x2, x3], 30));
            }
        const got = allocationOutcome(units, res.rows.map((r) => r.recommended), 30);
        expect(got).toBeCloseTo(best, 6);
        expect(res.totals.expectedRecommended).toBeGreaterThanOrEqual(res.totals.expectedCurrent);
        expect(res.totals.liftPct).toBeGreaterThanOrEqual(0);
    });
    it("respects locks, exclusions and explicit bounds", () => {
        const units = [unit("u1", 3000, 0.4, 0.8, { fixed: { value: 3000, reason: "locked" } }), unit("u2", 6000, 0.9, 0.9, { max: 6500 }), unit("u3", 1500, 0.1, 0.5, { min: 1400 })];
        const res = optimizeBudget(base(units, 10500));
        const by = new Map(res.rows.map((r) => [r.unitId, r]));
        expect(by.get("u1")).toMatchObject({ recommended: 3000, bound: "locked" });
        expect(by.get("u2")?.recommended).toBeLessThanOrEqual(6500);
        expect(by.get("u3")?.recommended).toBeGreaterThanOrEqual(1400);
        expect(res.totals.recommended).toBeCloseTo(10500, 6);
    });
    it("warns about low-confidence curves and infeasible minimums", () => {
        const low = { ...curve("u2", 0.3, 0.7), confidence: "low" as const };
        const res = optimizeBudget(base([unit("u1", 1000, 0.5, 0.8), { unitId: "u2", name: "Weak data", current: 1000, curve: low }], 600));
        expect(res.warnings.some((w) => w.includes("low-confidence") && w.includes("Weak data"))).toBe(true);
        expect(res.warnings.some((w) => w.includes("minimum"))).toBe(true);
        expect(res.totals.recommended).toBeCloseTo(600, 6);
    });
    it("heuristic strategy reproduces the prototype rebalance (ROAS^0.7, 0.5×–1.6×, $50)", () => {
        const roas = [3.1, 3.6, 2.8, 4.0];
        const current = [7800, 12600, 9000, 11400];
        const units = current.map((c, i) => unit(`u${i}`, c, 0.3, 0.7, { roas: roas[i] }));
        const total = current.reduce((a, b) => a + b, 0);
        const res = optimizeBudget(base(units, total, { strategy: "roas_heuristic" }));
        const w = roas.map((r) => r ** 0.7);
        const ws = w.reduce((a, b) => a + b, 0);
        const prototype = current.map((b, i) => Math.round(Math.max(b * 0.5, Math.min(b * 1.6, (total * w[i]!) / ws)) / 50) * 50);
        res.rows.forEach((r, i) => expect(Math.abs(r.recommended - prototype[i]!)).toBeLessThanOrEqual(50));
        expect(res.totals.recommended).toBeCloseTo(total, 6);
        const skew = [unit("a", 12600, 0.3, 0.7, { roas: 20 }), unit("b", 23400, 0.3, 0.7, { roas: 2.5 }), unit("c", 7800, 0.3, 0.7, { roas: 4.5 }), unit("d", 9000, 0.3, 0.7, { roas: 1.2 })];
        const t2 = skew.reduce((s, u) => s + u.current, 0);
        const r2 = optimizeBudget(base(skew, t2, { strategy: "roas_heuristic" }));
        expect(r2.totals.recommended).toBeCloseTo(t2, 6);
        const by = new Map(r2.rows.map((r) => [r.unitId, r]));
        expect(by.get("a")?.bound).toBe("max");
        expect(Math.abs(by.get("a")!.recommended - 12600 * 1.6)).toBeLessThanOrEqual(50);
        for (const r of r2.rows) {
            expect(r.recommended % 50).toBe(0);
            expect(r.recommended).toBeGreaterThanOrEqual(r.current * 0.5 - 50);
            expect(r.recommended).toBeLessThanOrEqual(r.current * 1.6 + 50);
        }
        const free = skew.filter((u) => by.get(u.unitId)?.bound === null);
        expect(free.length).toBeGreaterThanOrEqual(2);
        const lambdas = free.map((u) => by.get(u.unitId)!.recommended / u.roas! ** 0.7);
        for (const l of lambdas)
            expect(Math.abs(l - lambdas[0]!)).toBeLessThanOrEqual(50 / Math.min(...free.map((u) => u.roas! ** 0.7)));
    });
    it("scenario frontier: outcomes rise with total at an increasing marginal cost", () => {
        const units = [unit("u1", 3000, 0.4, 0.8), unit("u2", 6000, 0.2, 0.7), unit("u3", 1500, 0.9, 0.6)];
        const { points } = scenarioFrontier(base(units, 10500));
        expect(points.map((p) => p.pct)).toEqual([-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5]);
        expect(points[0]?.marginalCost).toBeNull();
        for (let i = 1; i < points.length; i++) {
            expect(points[i]!.expected).toBeGreaterThan(points[i - 1]!.expected);
            expect(points[i]!.marginalCost!).toBeGreaterThan(0);
        }
        expect(points.at(-1)!.marginalCost!).toBeGreaterThan(points[1]!.marginalCost!);
        expect(points.find((p) => p.pct === 0)?.total).toBe(10500);
    });
});
describe("response curves", () => {
    it("recovers the exponent from clean data and shrinks noisy fits toward 0.7", () => {
        const pts = Array.from({ length: 60 }, (_, i) => {
            const spend = 100 + i * 5;
            return { spend, outcome: 2 * spend ** 0.6 };
        });
        const c = fitResponseCurve("u", "conversions", pts);
        expect(c.bRaw).toBeCloseTo(0.6, 6);
        expect(c.r2).toBeCloseTo(1, 6);
        expect(c.b).toBeGreaterThan(0.6);
        expect(c.b).toBeLessThan(0.7);
        expect(c.confidence).toBe("high");
        expect(curveOutcome(c, 30 * 200, 30)).toBeCloseTo(30 * c.a * 200 ** c.b, 6);
        const tooFew = fitResponseCurve("u", "conversions", [{ spend: 100, outcome: 5 }]);
        expect(tooFew).toMatchObject({ b: 0.7, confidence: "low" });
    });
});
describe("forecast", () => {
    const ds = demoDataset();
    const end = ds.anchor;
    const history = enumerate(addDays(end, -83), end).map((date) => ({ date, value: ds.tables.campaign_daily.filter((r) => r.date === date).reduce((s, r) => s + r.cost, 0) }));
    it("backtests demo spend with MAPE under 35%", () => {
        const mape = backtestMape(history);
        expect(mape).not.toBeNull();
        expect(mape!).toBeLessThan(0.35);
    });
    it("returns a 30-day band, capped spend and totals", () => {
        const dailyCap = 4550 * 2;
        const f = forecastSeries({ metric: "cost", history, horizon: 30, dailyCap, monthEnd: "2026-09-30" });
        expect(f.method).toBe("holt_damped_dow");
        expect(f.points).toHaveLength(30);
        expect(f.points[0]?.date).toBe("2026-09-29");
        for (const p of f.points) {
            expect(p.lo).toBeGreaterThanOrEqual(0);
            expect(p.lo).toBeLessThanOrEqual(p.yhat);
            expect(p.hi).toBeGreaterThanOrEqual(p.yhat);
            expect(p.hi).toBeLessThanOrEqual(dailyCap);
        }
        expect(f.points[29]!.hi - f.points[29]!.lo).toBeGreaterThan(f.points[0]!.hi - f.points[0]!.lo - 1e-9);
        expect(f.totals.restOfMonth.yhat).toBeCloseTo(f.points[0]!.yhat + f.points[1]!.yhat, 1);
        expect(f.totals.next30.yhat).toBeCloseTo(f.points.reduce((s, p) => s + p.yhat, 0), 1);
        const capped = forecastSeries({ metric: "cost", history, horizon: 5, dailyCap: 1000, monthEnd: "2026-09-30" });
        expect(capped.points.every((p) => p.yhat <= 1000 && p.hi <= 1000)).toBe(true);
    });
});
describe("flighting & plans", () => {
    it("every pattern sums exactly to the monthly amount", () => {
        for (const month of ["2026-09", "2026-10", "2027-02"]) {
            for (const pattern of ["even", "front_loaded", "back_loaded", "dow_weighted"] as const) {
                const sched = dailySchedule(12345.67, month, pattern);
                expect(Math.round(sched.reduce((s, d) => s + d.amount, 0) * 100)).toBe(1234567);
                expect(sched.every((d) => Math.round(d.amount * 100) === d.amount * 100 || Math.abs(d.amount * 100 - Math.round(d.amount * 100)) < 1e-6)).toBe(true);
            }
        }
        const front = dailySchedule(3000, "2026-11", "front_loaded");
        expect(front[0]!.amount).toBeGreaterThan(front.at(-1)!.amount);
        const w = flightWeights("front_loaded", enumerate("2026-11-01", "2026-11-30"));
        expect(w[0]).toBeCloseTo(1.3, 9);
        expect(w.at(-1)).toBeCloseTo(0.7, 9);
        const back = dailySchedule(3000, "2026-11", "back_loaded");
        expect(back[0]!.amount).toBeLessThan(back.at(-1)!.amount);
    });
    it("AI idea drafts use the real number of days in each month", () => {
        const line = draftLine({ refId: "idea-1", name: "Brand defense", campaignType: "Search", dailyBudget: 120 }, ["2026-10", "2026-11", "2027-02"], "idea-1");
        expect(line).toMatchObject({ kind: "draft_idea", origin: "ai_idea", monthly: { "2026-10": 3720, "2026-11": 3600, "2027-02": 3360 } });
    });
    it("seasonal index: retail preset without a year of history, measured index with it", () => {
        expect(seasonalIndex({ "2026-08": 100 })).toEqual({ factors: [...RETAIL_PRESET], source: "retail_preset" });
        const months = enumerate("2025-09-01", "2026-08-31").filter((d) => d.endsWith("-01")).map((d) => d.slice(0, 7));
        const spend = Object.fromEntries(months.map((m) => [m, (m.endsWith("-11") ? 1.5 : 1) * 30 * 100]));
        const idx = seasonalIndex(spend);
        expect(idx.source).toBe("history");
        expect(idx.factors[10]!).toBeGreaterThan(idx.factors[8]!);
        const totals = seasonalTotals(["2026-10", "2026-11"], 100, { factors: [...RETAIL_PRESET], source: "retail_preset" }, "2026-09");
        expect(totals["2026-10"]).toBeCloseTo(100 * 31 * 1.05, 6);
        expect(totals["2026-11"]).toBeCloseTo(100 * 30 * 1.35, 6);
    });
});
describe("exports", () => {
    it("Editor budget CSV has the Editor header, daily budgets and no formula escaping", () => {
        const { csv, warnings } = editorBudgetCsv([
            { campaign: "Brand — Core Terms", campaignId: "123", dailyBudget: 455, status: "Enabled" },
            { campaign: "Shoes, Boots & More", campaignId: "124", dailyBudget: 99.5, status: "Paused" },
            { campaign: "=HYPERLINK(1)", campaignId: "125", dailyBudget: 10, status: "Enabled" },
        ]);
        const lines = csv.trimEnd().split("\r\n");
        expect(lines[0]).toBe("Campaign,Campaign ID,Budget,Budget type,Campaign status");
        expect(EDITOR_BUDGET_HEADER.join(",")).toBe(lines[0]);
        expect(lines[1]).toBe("Brand — Core Terms,123,455.00,Daily,Enabled");
        expect(lines[2]).toBe('"Shoes, Boots & More",124,99.50,Daily,Paused');
        expect(lines[3]).toBe("=HYPERLINK(1),125,10.00,Daily,Enabled");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("=HYPERLINK(1)");
    });
    it("change list lines follow the copyable format", () => {
        expect(changeListLine({ name: "Brand — Core Terms", from: 420, to: 455 })).toBe("Set daily budget of 'Brand — Core Terms' from $420.00 to $455.00 (+8.3%)");
        expect(changeListLine({ name: "Generic", from: 780, to: 700 })).toBe("Set daily budget of 'Generic' from $780.00 to $700.00 (−10.3%)");
        expect(changeListLine({ name: "New", from: null, to: 50 })).toBe("Set daily budget of 'New' to $50.00");
    });
    it("plan CSV lists months and totals in safe mode", () => {
        const csv = planCsv({
            name: "Q4",
            months: ["2026-10", "2026-11"],
            lines: [
                { id: "l1", kind: "campaign", refId: "c1", name: "=cmd", campaignType: "Search", monthly: { "2026-10": 100, "2026-11": 200 }, flighting: { pattern: "even" }, origin: "manual" },
                { id: "l2", kind: "draft_idea", refId: "i1", name: "Idea", monthly: { "2026-10": 50 }, flighting: { pattern: "front_loaded" }, origin: "ai_idea" },
            ],
        });
        const lines = csv.trimEnd().split("\r\n");
        expect(lines[0]).toBe("Line,Kind,Reference,Type,Flighting,Origin,Oct 2026,Nov 2026,Total");
        expect(lines[1]).toBe("'=cmd,campaign,c1,Search,even,manual,100.00,200.00,300.00");
        expect(lines[3]).toBe("Total,,,,,,150.00,200.00,350.00");
    });
});
