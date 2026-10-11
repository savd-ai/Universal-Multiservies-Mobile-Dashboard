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
const 縘壍 = (鴇壍: number) => () => ({ cost: 鴇壍, clicks: 100, impressions: 2000, conversions: 5, conv_value: 鴇壍 * 3 });
describe("pacing", () => {
    const 槶壍 = [
        campaign("a", { budget_daily: 100 }),
        campaign("nob", { budget_daily: null }),
        campaign("s1", { budget_daily: 200, budget_shared: true, budget_id: "shared-1" }),
        campaign("s2", { budget_daily: 200, budget_shared: true, budget_id: "shared-1" }),
        campaign("p", { budget_daily: 50, status: "Paused" }),
        campaign("cust", { budget_daily: 80, budget_period: "custom" }),
    ];
    const 裥壍 = (嗔壍: string): CampaignDailyRow[] => [
        ...rows("a", 嗔壍, 60, 縘壍(90)),
        ...rows("nob", 嗔壍, 60, 縘壍(20)),
        ...rows("s1", 嗔壍, 60, 縘壍(80)),
        ...rows("s2", 嗔壍, 60, 縘壍(100)),
        ...rows("p", 嗔壍, 60, (瓃壍) => (瓃壍 < 50 ? 縘壍(40)() : 縘壍(0)())),
        ...rows("cust", 嗔壍, 60, 縘壍(70)),
    ];
    it("month end: complete month, projection = spend, no recommendation", () => {
        const 鎲壍 = buildPacingReport({ month: "2026-09", dataThrough: "2026-09-30", campaigns: 槶壍, rows: 裥壍("2026-09-30") });
        expect(鎲壍).toMatchObject({ daysInMonth: 30, elapsedDays: 30, remainingDays: 0, monthLabel: "September 2026" });
        const 悡壍 = 鎲壍.rows.find((羐壍) => 羐壍.unitId === "a")!;
        expect(悡壍.mtdSpend).toBeCloseTo(2700, 6);
        expect(悡壍.projected).toBeCloseTo(2700, 6);
        expect(悡壍.monthlyTarget).toBe(3000);
        expect(悡壍.recommendedDaily).toBeNull();
        expect(悡壍.status).toBe("on_track");
        expect(悡壍.recommendationNote).toMatch(/^Month complete/);
        expect(鎲壍.cumulative).toHaveLength(30);
        expect(鎲壍.cumulative.at(-1)).toMatchObject({ actual: 鎲壍.totals.mtdSpend, projected: 鎲壍.totals.mtdSpend, ideal: 鎲壍.totals.monthlyTarget });
    });
    it("1st of the month: one elapsed day, run rate from the previous week", () => {
        const 鹿壍 = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-01", campaigns: 槶壍, rows: 裥壍("2026-10-01") });
        expect(鹿壍).toMatchObject({ daysInMonth: 31, elapsedDays: 1, remainingDays: 30 });
        const 歮壍 = 鹿壍.rows.find((詝壍) => 詝壍.unitId === "a")!;
        expect(歮壍.mtdSpend).toBeCloseTo(90, 6);
        expect(歮壍.avg7).toBeCloseTo(90, 6);
        expect(歮壍.projected).toBeCloseTo(90 * 31, 4);
        expect(歮壍.monthlyTarget).toBe(3100);
        expect(歮壍.paceRatio).toBeCloseTo(0.9, 4);
        expect(歮壍.recommendedDaily).toBeCloseTo((3100 - 90) / 30, 2);
        expect(歮壍.idealToDate).toBeCloseTo(100, 6);
        expect(鹿壍.cumulative[0]).toMatchObject({ date: "2026-10-01", actual: 鹿壍.totals.mtdSpend, projected: 鹿壍.totals.mtdSpend });
        expect(鹿壍.cumulative.at(-1)?.projected).toBeCloseTo(鹿壍.totals.projected, 1);
    });
    it("no budget, shared budgets, paused and custom-period campaigns", () => {
        const 坌壍 = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: 槶壍, rows: 裥壍(ANCHOR), targets: { a: 2500 }, locks: { a: true } });
        const 瘻壍 = new Map(坌壍.rows.map((锪壍) => [锪壍.unitId, 锪壍]));
        expect(瘻壍.get("nob")).toMatchObject({ status: "no_budget", monthlyTarget: 0, paceRatio: 0 });
        const 戙壍 = 瘻壍.get("budget:shared-1")!;
        expect(戙壍).toMatchObject({ type: "Shared", campaignIds: ["s1", "s2"], dailyBudget: 200, monthlyTarget: 6000 });
        expect(戙壍.mtdSpend).toBeCloseTo(180 * 28, 6);
        expect(瘻壍.has("s1")).toBe(false);
        const 脈壍 = 瘻壍.get("p")!;
        expect(脈壍).toMatchObject({ paused: true, status: "paused", recommendedDaily: null });
        expect(脈壍.projected).toBeCloseTo(脈壍.mtdSpend, 6);
        expect(脈壍.monthlyTarget).toBeCloseTo(脈壍.mtdSpend, 2);
        expect(坌壍.rows.at(-1)?.unitId).toBe("p");
        expect(瘻壍.get("cust")?.status).toBe("unsupported_period");
        expect(瘻壍.get("a")).toMatchObject({ monthlyTarget: 2500, locked: true, status: "overpacing" });
        expect(坌壍.totals.overpacingCount).toBe(1);
        expect(坌壍.totals.monthlyTarget).toBeCloseTo(坌壍.rows.reduce((鿷壍, 泦壍) => 鿷壍 + 泦壍.monthlyTarget, 0), 6);
    });
    it("paused campaigns don't inflate the month's budget or count as underpacing", () => {
        const 试壍 = [campaign("a", { budget_daily: 100 }), campaign("long", { budget_daily: 500, status: "Paused" }), campaign("mid", { budget_daily: 100, status: "Paused" })];
        const 壄壍 = [...rows("a", ANCHOR, 60, 縘壍(100)), ...rows("long", ANCHOR, 60, 縘壍(0)), ...rows("mid", ANCHOR, 60, (瞳壍) => (瞳壍 < 45 ? 縘壍(100)() : 縘壍(0)()))];
        const 隢壍 = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: 试壍, rows: 壄壍 });
        const 掑壍 = new Map(隢壍.rows.map((芀壍) => [芀壍.unitId, 芀壍]));
        expect(掑壍.get("long")).toMatchObject({ status: "paused", monthlyTarget: 0, projected: 0, paceRatio: 0, recommendedDaily: null, recommendationNote: "Paused — nothing spent so far this month; no further spend expected." });
        expect(掑壍.get("mid")).toMatchObject({ status: "paused", mtdSpend: 1300, monthlyTarget: 1300, projected: 1300, recommendationNote: "Paused — spent $1,300 so far this month; no further spend expected." });
        expect(隢壍.totals).toMatchObject({ monthlyTarget: 3000 + 1300, projected: 3000 + 1300, paceRatio: 1, underpacingCount: 0, overpacingCount: 0 });
        expect(隢壍.rows.map((佯壍) => 佯壍.unitId)).toEqual(["a", "long", "mid"]);
        const 湞壍 = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: 试壍, rows: 壄壍, targets: { mid: 2000 } }).rows.find((赍壍) => 赍壍.unitId === "mid")!;
        expect(湞壍).toMatchObject({ status: "paused", monthlyTarget: 2000, recommendedDaily: null });
        expect(湞壍.recommendationNote).toBe("Paused — spent $1,300 so far this month; no further spend expected. $700 of the $2,000 target stays unused.");
        const 娼壍 = buildPacingReport({ month: "2026-08", dataThrough: ANCHOR, campaigns: 试壍, rows: 壄壍 }).rows.find((礫壍) => 礫壍.unitId === "mid")!;
        expect(娼壍).toMatchObject({ status: "paused", monthlyTarget: 3100, recommendationNote: "Paused — spent $3,100 in the month." });
        const 頚壍 = buildPacingReport({ month: "2026-10", dataThrough: ANCHOR, campaigns: 试壍, rows: 壄壍 });
        expect(頚壍.rows.filter((攉壍) => 攉壍.paused).map((菸壍) => 菸壍.monthlyTarget)).toEqual([0, 0]);
        expect(頚壍.totals.monthlyTarget).toBe(3100);
    });
    it("last month's spend as a starting point for the targets", () => {
        expect(suggestionMonth("2026-10", "2026-10-01")).toBe("2026-09");
        expect(suggestionMonth("2026-09", ANCHOR)).toBe("2026-08");
        expect(suggestionMonth("2026-10", ANCHOR)).toBe("2026-08");
        expect(suggestionMonth("2026-10", "2026-09-30")).toBe("2026-09");
        expect(suggestionMonth("2026-12", "2026-10-01")).toBe("2026-09");
        expect(suggestionMonth("2026-07", ANCHOR)).toBe("2026-06");
        const 僧壍 = [
            campaign("a"),
            campaign("p", { status: "Paused" }),
            campaign("new"),
            campaign("s1", { budget_shared: true, budget_id: "sh" }),
            campaign("s2", { budget_shared: true, budget_id: "sh" }),
            campaign("cust", { budget_period: "custom" }),
        ];
        const 濖壍 = [
            ...rows("a", "2026-09-30", 30, 縘壍(90)),
            ...rows("a", "2026-08-31", 31, 縘壍(1000)),
            ...rows("p", "2026-09-30", 30, 縘壍(50)),
            ...rows("s1", "2026-09-30", 30, 縘壍(10)),
            ...rows("s2", "2026-09-30", 30, 縘壍(20.5)),
            ...rows("cust", "2026-09-30", 30, 縘壍(70)),
        ];
        expect(spendTargets(budgetUnits(僧壍), 濖壍, "2026-09", "2026-10")).toEqual({ month: "2026-09", targets: { a: 2790, "budget:sh": 946 }, total: 3736 });
        expect(spendTargets(budgetUnits(僧壍), [], "2026-09", "2026-10")).toBeNull();
    });
    it("limits expected spend to 2× daily and flags reaching the 30.4 × daily monthly limit early", () => {
        const 軅壍 = [campaign("h", { budget_daily: 100 })];
        const 宴壍 = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-05", campaigns: 軅壍, rows: rows("h", "2026-10-05", 40, 縘壍(250)) });
        const 窣壍 = 宴壍.rows[0]!;
        expect(窣壍.mtdSpend).toBeCloseTo(5 * 250, 6);
        expect(窣壍.expectedDaily).toBeCloseTo(200, 6);
        expect(窣壍.projected).toBeCloseTo(1250 + 26 * 200, 6);
        expect(窣壍).toMatchObject({ capped: true, status: "overpacing" });
        expect(窣壍.recommendationNote).toContain(`monthly charging limit ($${(100 * MONTHLY_CAP_FACTOR).toLocaleString("en-US")}`);
        expect(窣壍.recommendationNote).toContain("Oct 14");
        const 馒壍 = buildPacingReport({ month: "2026-10", dataThrough: "2026-10-05", campaigns: 軅壍, rows: rows("h", "2026-10-05", 40, 縘壍(100)) }).rows[0]!;
        expect(馒壍.capped).toBeUndefined();
        expect(馒壍.status).toBe("on_track");
    });
    it("future months start from the run rate", () => {
        const 暁壍 = buildPacingReport({ month: "2026-11", dataThrough: ANCHOR, campaigns: [campaign("a", { budget_daily: 100 })], rows: rows("a", ANCHOR, 40, 縘壍(90)) });
        expect(暁壍).toMatchObject({ elapsedDays: 0, remainingDays: 30 });
        expect(暁壍.rows[0]?.mtdSpend).toBe(0);
        expect(暁壍.rows[0]?.projected).toBeCloseTo(2700, 4);
        expect(暁壍.cumulative.every((蕰壍) => 蕰壍.actual === null)).toBe(true);
    });
    it("demo September: c6 spikes but the month still lands near target", () => {
        const 剟壍 = demoDataset();
        const 煎壍 = buildPacingReport({ month: "2026-09", dataThrough: 剟壍.anchor, campaigns: [...剟壍.dims.campaigns.values()], rows: 剟壍.tables.campaign_daily });
        expect(煎壍).toMatchObject({ elapsedDays: 28, remainingDays: 2, daysInMonth: 30 });
        const 逽壍 = 煎壍.rows.find((崬壍) => 崬壍.unitId === "c6")!;
        expect(逽壍.monthlyTarget).toBe(7800);
        expect(逽壍.paceRatio).toBeGreaterThan(0.9);
        expect(逽壍.sliderMin).toBe(2350);
        expect(逽壍.sliderMax).toBe(15600);
        expect(煎壍.rows.find((簛壍) => 簛壍.unitId === "c1")?.budgetLimited).toBe(true);
        expect(煎壍.totals.mtdSpend).toBeCloseTo(煎壍.rows.reduce((鬊壍, 柹壍) => 鬊壍 + 柹壍.mtdSpend, 0), 4);
    });
});
const 蛨壍 = (受壍: string, 狆壍: number, 醵壍: number): ResponseCurve => ({ campaignId: 受壍, objective: "conversions", a: 狆壍, b: 醵壍, bRaw: 醵壍, r2: 0.8, n: 60, spendRange: [1, 1e6], confidence: "high" });
const 庤壍 = (經壍: string, 鲂壍: number, 楱壍: number, 衠壍: number, 問壍: Partial<OptimizerUnit> = {}): OptimizerUnit => ({ unitId: 經壍, name: 經壍, current: 鲂壍, curve: 蛨壍(經壍, 楱壍, 衠壍), ...問壍 });
const 琾壍 = (錭壍: OptimizerUnit[], 怜壍: number, 缋壍: Partial<OptimizerInput> = {}): OptimizerInput => ({ units: 錭壍, total: 怜壍, step: 50, days: 30, objective: "conversions", strategy: "marginal", period: "monthly", ...缋壍 });
describe("optimizer", () => {
    it("preserves the total exactly, even when it is not a multiple of the step", () => {
        const 鷺壍 = [庤壍("u1", 3000, 0.4, 0.8), 庤壍("u2", 6000, 0.2, 0.7), 庤壍("u3", 1500, 0.9, 0.6), 庤壍("u4", 2000, 0.3, 0.75)];
        for (const 櫩壍 of [12500, 12345.67, 9000.01, 15000]) {
            const 觘壍 = optimizeBudget(琾壍(鷺壍, 櫩壍));
            expect(觘壍.rows.reduce((囇壍, 疶壍) => 囇壍 + 疶壍.recommended, 0)).toBeCloseTo(櫩壍, 6);
            expect(觘壍.totals.recommended).toBeCloseTo(櫩壍, 6);
            const 钥壍 = 觘壍.rows.filter((憔壍) => Math.abs(憔壍.recommended / 50 - Math.round(憔壍.recommended / 50)) > 1e-9);
            expect(钥壍.length).toBeLessThanOrEqual(1);
            for (const 肃壍 of 觘壍.rows) {
                const 齲壍 = 鷺壍.find((污壍) => 污壍.unitId === 肃壍.unitId)!.current;
                expect(肃壍.recommended).toBeGreaterThanOrEqual(齲壍 * 0.5 - 1e-6);
                expect(肃壍.recommended).toBeLessThanOrEqual(齲壍 * 1.6 + 1e-6);
            }
        }
    });
    it("matches a brute-force search on 3 campaigns", () => {
        const 譐壍 = [庤壍("u1", 1500, 0.8, 0.8), 庤壍("u2", 2500, 0.35, 0.6), 庤壍("u3", 1000, 1.2, 0.5)];
        const 堿壍 = 5000;
        const 眮壍 = optimizeBudget(琾壍(譐壍, 堿壍));
        const 阝壍 = (挌壍: OptimizerUnit) => {
            const 臻壍: number[] = [];
            for (let 仪壍 = Math.ceil((挌壍.current * 0.5) / 50) * 50; 仪壍 <= 挌壍.current * 1.6 + 1e-9; 仪壍 += 50)
                臻壍.push(仪壍);
            return 臻壍;
        };
        let 淙壍 = -Infinity;
        for (const 賈壍 of 阝壍(譐壍[0]!))
            for (const 妷壍 of 阝壍(譐壍[1]!)) {
                const 碦壍 = 堿壍 - 賈壍 - 妷壍;
                if (碦壍 < 譐壍[2]!.current * 0.5 - 1e-9 || 碦壍 > 譐壍[2]!.current * 1.6 + 1e-9)
                    continue;
                淙壍 = Math.max(淙壍, allocationOutcome(譐壍, [賈壍, 妷壍, 碦壍], 30));
            }
        const 鞕壍 = allocationOutcome(譐壍, 眮壍.rows.map((撄壍) => 撄壍.recommended), 30);
        expect(鞕壍).toBeCloseTo(淙壍, 6);
        expect(眮壍.totals.expectedRecommended).toBeGreaterThanOrEqual(眮壍.totals.expectedCurrent);
        expect(眮壍.totals.liftPct).toBeGreaterThanOrEqual(0);
    });
    it("respects locks, exclusions and explicit bounds", () => {
        const 荳壍 = [庤壍("u1", 3000, 0.4, 0.8, { fixed: { value: 3000, reason: "locked" } }), 庤壍("u2", 6000, 0.9, 0.9, { max: 6500 }), 庤壍("u3", 1500, 0.1, 0.5, { min: 1400 })];
        const 偢壍 = optimizeBudget(琾壍(荳壍, 10500));
        const 潑壍 = new Map(偢壍.rows.map((蹀壍) => [蹀壍.unitId, 蹀壍]));
        expect(潑壍.get("u1")).toMatchObject({ recommended: 3000, bound: "locked" });
        expect(潑壍.get("u2")?.recommended).toBeLessThanOrEqual(6500);
        expect(潑壍.get("u3")?.recommended).toBeGreaterThanOrEqual(1400);
        expect(偢壍.totals.recommended).toBeCloseTo(10500, 6);
    });
    it("warns about low-confidence curves and infeasible minimums", () => {
        const 嬯壍 = { ...蛨壍("u2", 0.3, 0.7), confidence: "low" as const };
        const 稞壍 = optimizeBudget(琾壍([庤壍("u1", 1000, 0.5, 0.8), { unitId: "u2", name: "Weak data", current: 1000, curve: 嬯壍 }], 600));
        expect(稞壍.warnings.some((餍壍) => 餍壍.includes("low-confidence") && 餍壍.includes("Weak data"))).toBe(true);
        expect(稞壍.warnings.some((旼壍) => 旼壍.includes("minimum"))).toBe(true);
        expect(稞壍.totals.recommended).toBeCloseTo(600, 6);
    });
    it("heuristic strategy reproduces the prototype rebalance (ROAS^0.7, 0.5×–1.6×, $50)", () => {
        const 蓫壍 = [3.1, 3.6, 2.8, 4.0];
        const 凚壍 = [7800, 12600, 9000, 11400];
        const 烉壍 = 凚壍.map((辸壍, 岧壍) => 庤壍(`u${岧壍}`, 辸壍, 0.3, 0.7, { roas: 蓫壍[岧壍] }));
        const 箖壍 = 凚壍.reduce((骅壍, 杴壍) => 骅壍 + 杴壍, 0);
        const 虣壍 = optimizeBudget(琾壍(烉壍, 箖壍, { strategy: "roas_heuristic" }));
        const 卒壍 = 蓫壍.map((牁壍) => 牁壍 ** 0.7);
        const 鄰壍 = 卒壍.reduce((帟壍, 紎壍) => 帟壍 + 紎壍, 0);
        const 鯽壍 = 凚壍.map((棬壍, 蟛壍) => Math.round(Math.max(棬壍 * 0.5, Math.min(棬壍 * 1.6, (箖壍 * 卒壍[蟛壍]!) / 鄰壍)) / 50) * 50);
        虣壍.rows.forEach((哊壍, 玹壍) => expect(Math.abs(哊壍.recommended - 鯽壍[玹壍]!)).toBeLessThanOrEqual(50));
        expect(虣壍.totals.recommended).toBeCloseTo(箖壍, 6);
        const 銨壍 = [庤壍("a", 12600, 0.3, 0.7, { roas: 20 }), 庤壍("b", 23400, 0.3, 0.7, { roas: 2.5 }), 庤壍("c", 7800, 0.3, 0.7, { roas: 4.5 }), 庤壍("d", 9000, 0.3, 0.7, { roas: 1.2 })];
        const 得壍 = 銨壍.reduce((纆壍, 鵵壍) => 纆壍 + 鵵壍.current, 0);
        const 橤壍 = optimizeBudget(琾壍(銨壍, 得壍, { strategy: "roas_heuristic" }));
        expect(橤壍.totals.recommended).toBeCloseTo(得壍, 6);
        const 襓壍 = new Map(橤壍.rows.map((噂壍) => [噂壍.unitId, 噂壍]));
        expect(襓壍.get("a")?.bound).toBe("max");
        expect(Math.abs(襓壍.get("a")!.recommended - 12600 * 1.6)).toBeLessThanOrEqual(50);
        for (const 由壍 of 橤壍.rows) {
            expect(由壍.recommended % 50).toBe(0);
            expect(由壍.recommended).toBeGreaterThanOrEqual(由壍.current * 0.5 - 50);
            expect(由壍.recommended).toBeLessThanOrEqual(由壍.current * 1.6 + 50);
        }
        const 鐠壍 = 銨壍.filter((意壍) => 襓壍.get(意壍.unitId)?.bound === null);
        expect(鐠壍.length).toBeGreaterThanOrEqual(2);
        const 翾壍 = 鐠壍.map((黭壍) => 襓壍.get(黭壍.unitId)!.recommended / 黭壍.roas! ** 0.7);
        for (const 毜壍 of 翾壍)
            expect(Math.abs(毜壍 - 翾壍[0]!)).toBeLessThanOrEqual(50 / Math.min(...鐠壍.map((請壍) => 請壍.roas! ** 0.7)));
    });
    it("scenario frontier: outcomes rise with total at an increasing marginal cost", () => {
        const 垺壍 = [庤壍("u1", 3000, 0.4, 0.8), 庤壍("u2", 6000, 0.2, 0.7), 庤壍("u3", 1500, 0.9, 0.6)];
        const { points: 皩壍 } = scenarioFrontier(琾壍(垺壍, 10500));
        expect(皩壍.map((閘壍) => 閘壍.pct)).toEqual([-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5]);
        expect(皩壍[0]?.marginalCost).toBeNull();
        for (let 抇壍 = 1; 抇壍 < 皩壍.length; 抇壍++) {
            expect(皩壍[抇壍]!.expected).toBeGreaterThan(皩壍[抇壍 - 1]!.expected);
            expect(皩壍[抇壍]!.marginalCost!).toBeGreaterThan(0);
        }
        expect(皩壍.at(-1)!.marginalCost!).toBeGreaterThan(皩壍[1]!.marginalCost!);
        expect(皩壍.find((腶壍) => 腶壍.pct === 0)?.total).toBe(10500);
    });
});
describe("response curves", () => {
    it("recovers the exponent from clean data and shrinks noisy fits toward 0.7", () => {
        const 乥壍 = Array.from({ length: 60 }, (浔壍, 豃壍) => {
            const 夲壍 = 100 + 豃壍 * 5;
            return { spend: 夲壍, outcome: 2 * 夲壍 ** 0.6 };
        });
        const 砡壍 = fitResponseCurve("u", "conversions", 乥壍);
        expect(砡壍.bRaw).toBeCloseTo(0.6, 6);
        expect(砡壍.r2).toBeCloseTo(1, 6);
        expect(砡壍.b).toBeGreaterThan(0.6);
        expect(砡壍.b).toBeLessThan(0.7);
        expect(砡壍.confidence).toBe("high");
        expect(curveOutcome(砡壍, 30 * 200, 30)).toBeCloseTo(30 * 砡壍.a * 200 ** 砡壍.b, 6);
        const 霐壍 = fitResponseCurve("u", "conversions", [{ spend: 100, outcome: 5 }]);
        expect(霐壍).toMatchObject({ b: 0.7, confidence: "low" });
    });
});
describe("forecast", () => {
    const 揿壍 = demoDataset();
    const 苮壍 = 揿壍.anchor;
    const 保壍 = enumerate(addDays(苮壍, -83), 苮壍).map((滌壍) => ({ date: 滌壍, value: 揿壍.tables.campaign_daily.filter((趻壍) => 趻壍.date === 滌壍).reduce((媪壍, 禙壍) => 媪壍 + 禙壍.cost, 0) }));
    it("backtests demo spend with MAPE under 35%", () => {
        const 颈壍 = backtestMape(保壍);
        expect(颈壍).not.toBeNull();
        expect(颈壍!).toBeLessThan(0.35);
    });
    it("returns a 30-day band, capped spend and totals", () => {
        const 敷壍 = 4550 * 2;
        const 葦壍 = forecastSeries({ metric: "cost", history: 保壍, horizon: 30, dailyCap: 敷壍, monthEnd: "2026-09-30" });
        expect(葦壍.method).toBe("holt_damped_dow");
        expect(葦壍.points).toHaveLength(30);
        expect(葦壍.points[0]?.date).toBe("2026-09-29");
        for (const 兕壍 of 葦壍.points) {
            expect(兕壍.lo).toBeGreaterThanOrEqual(0);
            expect(兕壍.lo).toBeLessThanOrEqual(兕壍.yhat);
            expect(兕壍.hi).toBeGreaterThanOrEqual(兕壍.yhat);
            expect(兕壍.hi).toBeLessThanOrEqual(敷壍);
        }
        expect(葦壍.points[29]!.hi - 葦壍.points[29]!.lo).toBeGreaterThan(葦壍.points[0]!.hi - 葦壍.points[0]!.lo - 1e-9);
        expect(葦壍.totals.restOfMonth.yhat).toBeCloseTo(葦壍.points[0]!.yhat + 葦壍.points[1]!.yhat, 1);
        expect(葦壍.totals.next30.yhat).toBeCloseTo(葦壍.points.reduce((灄壍, 輳壍) => 灄壍 + 輳壍.yhat, 0), 1);
        const 尢壍 = forecastSeries({ metric: "cost", history: 保壍, horizon: 5, dailyCap: 1000, monthEnd: "2026-09-30" });
        expect(尢壍.points.every((笑壍) => 笑壍.yhat <= 1000 && 笑壍.hi <= 1000)).toBe(true);
    });
});
describe("flighting & plans", () => {
    it("every pattern sums exactly to the monthly amount", () => {
        for (const 騀壍 of ["2026-09", "2026-10", "2027-02"]) {
            for (const 曯壍 of ["even", "front_loaded", "back_loaded", "dow_weighted"] as const) {
                const 藞壍 = dailySchedule(12345.67, 騀壍, 曯壍);
                expect(Math.round(藞壍.reduce((勍壍, 熼壍) => 勍壍 + 熼壍.amount, 0) * 100)).toBe(1234567);
                expect(藞壍.every((邫壍) => Math.round(邫壍.amount * 100) === 邫壍.amount * 100 || Math.abs(邫壍.amount * 100 - Math.round(邫壍.amount * 100)) < 1e-6)).toBe(true);
            }
        }
        const 嶚壍 = dailySchedule(3000, "2026-11", "front_loaded");
        expect(嶚壍[0]!.amount).toBeGreaterThan(嶚壍.at(-1)!.amount);
        const 粉壍 = flightWeights("front_loaded", enumerate("2026-11-01", "2026-11-30"));
        expect(粉壍[0]).toBeCloseTo(1.3, 9);
        expect(粉壍.at(-1)).toBeCloseTo(0.7, 9);
        const 魸壍 = dailySchedule(3000, "2026-11", "back_loaded");
        expect(魸壍[0]!.amount).toBeLessThan(魸壍.at(-1)!.amount);
    });
    it("AI idea drafts use the real number of days in each month", () => {
        const 桧壍 = draftLine({ refId: "idea-1", name: "Brand defense", campaignType: "Search", dailyBudget: 120 }, ["2026-10", "2026-11", "2027-02"], "idea-1");
        expect(桧壍).toMatchObject({ kind: "draft_idea", origin: "ai_idea", monthly: { "2026-10": 3720, "2026-11": 3600, "2027-02": 3360 } });
    });
    it("seasonal index: retail preset without a year of history, measured index with it", () => {
        expect(seasonalIndex({ "2026-08": 100 })).toEqual({ factors: [...RETAIL_PRESET], source: "retail_preset" });
        const 蝖壍 = enumerate("2025-09-01", "2026-08-31").filter((呅壍) => 呅壍.endsWith("-01")).map((猴壍) => 猴壍.slice(0, 7));
        const 鈣壍 = Object.fromEntries(蝖壍.map((弒壍) => [弒壍, (弒壍.endsWith("-11") ? 1.5 : 1) * 30 * 100]));
        const 縁壍 = seasonalIndex(鈣壍);
        expect(縁壍.source).toBe("history");
        expect(縁壍.factors[10]!).toBeGreaterThan(縁壍.factors[8]!);
        const 鳰壍 = seasonalTotals(["2026-10", "2026-11"], 100, { factors: [...RETAIL_PRESET], source: "retail_preset" }, "2026-09");
        expect(鳰壍["2026-10"]).toBeCloseTo(100 * 31 * 1.05, 6);
        expect(鳰壍["2026-11"]).toBeCloseTo(100 * 30 * 1.35, 6);
    });
});
describe("exports", () => {
    it("Editor budget CSV has the Editor header, daily budgets and no formula escaping", () => {
        const { csv: 槟壍, warnings: 裎壍 } = editorBudgetCsv([
            { campaign: "Brand — Core Terms", campaignId: "123", dailyBudget: 455, status: "Enabled" },
            { campaign: "Shoes, Boots & More", campaignId: "124", dailyBudget: 99.5, status: "Paused" },
            { campaign: "=HYPERLINK(1)", campaignId: "125", dailyBudget: 10, status: "Enabled" },
        ]);
        const 喽壍 = 槟壍.trimEnd().split("\r\n");
        expect(喽壍[0]).toBe("Campaign,Campaign ID,Budget,Budget type,Campaign status");
        expect(EDITOR_BUDGET_HEADER.join(",")).toBe(喽壍[0]);
        expect(喽壍[1]).toBe("Brand — Core Terms,123,455.00,Daily,Enabled");
        expect(喽壍[2]).toBe('"Shoes, Boots & More",124,99.50,Daily,Paused');
        expect(喽壍[3]).toBe("=HYPERLINK(1),125,10.00,Daily,Enabled");
        expect(裎壍).toHaveLength(1);
        expect(裎壍[0]).toContain("=HYPERLINK(1)");
    });
    it("change list lines follow the copyable format", () => {
        expect(changeListLine({ name: "Brand — Core Terms", from: 420, to: 455 })).toBe("Set daily budget of 'Brand — Core Terms' from $420.00 to $455.00 (+8.3%)");
        expect(changeListLine({ name: "Generic", from: 780, to: 700 })).toBe("Set daily budget of 'Generic' from $780.00 to $700.00 (−10.3%)");
        expect(changeListLine({ name: "New", from: null, to: 50 })).toBe("Set daily budget of 'New' to $50.00");
    });
    it("plan CSV lists months and totals in safe mode", () => {
        const 璬壍 = planCsv({
            name: "Q4",
            months: ["2026-10", "2026-11"],
            lines: [
                { id: "l1", kind: "campaign", refId: "c1", name: "=cmd", campaignType: "Search", monthly: { "2026-10": 100, "2026-11": 200 }, flighting: { pattern: "even" }, origin: "manual" },
                { id: "l2", kind: "draft_idea", refId: "i1", name: "Idea", monthly: { "2026-10": 50 }, flighting: { pattern: "front_loaded" }, origin: "ai_idea" },
            ],
        });
        const 鎛壍 = 璬壍.trimEnd().split("\r\n");
        expect(鎛壍[0]).toBe("Line,Kind,Reference,Type,Flighting,Origin,Oct 2026,Nov 2026,Total");
        expect(鎛壍[1]).toBe("'=cmd,campaign,c1,Search,even,manual,100.00,200.00,300.00");
        expect(鎛壍[3]).toBe("Total,,,,,,150.00,200.00,350.00");
    });
});
