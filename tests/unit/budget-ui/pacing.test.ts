import { describe, expect, it } from "vitest";
import type { PacingReport, PacingRow } from "@/lib/domain/contracts/budget";
import { budgetStats, cumulativeSeries, DEFAULT_THRESHOLDS, derivePacingRow, draftNote, pacingTotals, paceStatus, recommendedChanges, todayMarker, weeklyTicks } from "@/features/budget/lib/pacing";
const 諝壍 = (埌壍: Partial<PacingRow> = {}): PacingRow => ({
    unitId: "c1",
    campaignIds: ["c1"],
    name: "Brand — Core Terms",
    type: "Search",
    dailyBudget: 420,
    monthlyTarget: 12600,
    mtdSpend: 11428.86,
    avg7: 415.99,
    expectedDaily: 415.5,
    projected: 12259.86,
    paceRatio: 0.973,
    status: "on_track",
    idealToDate: 11760,
    utilization: 0.9718,
    budgetLimited: true,
    recommendedDaily: 585.57,
    recommendationNote: "On track — $586/day lands on $12,600.",
    roasMtd: 20.02,
    cpaMtd: 4.33,
    sliderMin: 3800,
    sliderMax: 25200,
    ...埌壍,
});
const 皻壍 = { month: "2026-09", daysInMonth: 30, elapsedDays: 28, remainingDays: 2 } as const;
const 閪壍 = (抙壍: number, 膈壍: Partial<Parameters<typeof derivePacingRow>[2]> = {}) => ({ target: 抙壍, savedTarget: 12600, locked: false, savedLocked: false, thresholds: DEFAULT_THRESHOLDS, currency: "USD", ...膈壍 });
describe("pace status", () => {
    it("uses the thresholds", () => {
        expect(paceStatus(諝壍(), 10000, 12000, DEFAULT_THRESHOLDS)).toBe("overpacing");
        expect(paceStatus(諝壍(), 15000, 12000, DEFAULT_THRESHOLDS)).toBe("underpacing");
        expect(paceStatus(諝壍(), 12000, 12000, DEFAULT_THRESHOLDS)).toBe("on_track");
        expect(paceStatus(諝壍(), 0, 12000, DEFAULT_THRESHOLDS)).toBe("no_budget");
        expect(paceStatus(諝壍({ status: "unsupported_period" }), 12000, 1, DEFAULT_THRESHOLDS)).toBe("unsupported_period");
        expect(paceStatus(諝壍({ paused: true }), 15000, 12000, DEFAULT_THRESHOLDS)).toBe("paused");
        expect(paceStatus(諝壍({ paused: true }), 0, 12000, DEFAULT_THRESHOLDS)).toBe("paused");
        expect(paceStatus(諝壍(), 12000, 12000 * 1.1, { over: 1.2, under: 0.8 })).toBe("on_track");
    });
});
describe("derived pacing rows", () => {
    it("keeps the server's numbers for an unchanged target", () => {
        const 乷壍 = derivePacingRow(諝壍(), 皻壍, 閪壍(12600));
        expect(乷壍.edited).toBe(false);
        expect(乷壍.recommendationNote).toBe("On track — $586/day lands on $12,600.");
        expect(乷壍.recommendedDaily).toBe(585.57);
        expect(乷壍.spentShare).toBeCloseTo(11428.86 / 12600, 6);
    });
    it("recomputes status, ideal, recommendation and note for a draft target", () => {
        const 浦壍 = derivePacingRow(諝壍(), 皻壍, 閪壍(11000));
        expect(浦壍.edited).toBe(true);
        expect(浦壍.status).toBe("overpacing");
        expect(浦壍.paceRatio).toBeCloseTo(12259.86 / 11000, 4);
        expect(浦壍.idealToDate).toBeCloseTo((11000 * 28) / 30, 2);
        expect(浦壍.recommendedDaily).toBe(0);
        expect(浦壍.recommendationNote).toBe("Lower the daily budget to $0 to land on $11,000.");
        expect(浦壍.spentShare).toBe(1);
    });
    it("uses the budget-limited copy when underpacing", () => {
        const 豕壍 = derivePacingRow(諝壍(), 皻壍, 閪壍(20000));
        expect(豕壍.status).toBe("underpacing");
        expect(豕壍.recommendedDaily).toBeCloseTo((20000 - 11428.86) / 2, 2);
        expect(豕壍.recommendationNote).toMatch(/^Raise the daily budget to \$4,286 to use the full \$20,000\.$/);
        const 奄壍 = derivePacingRow(諝壍({ budgetLimited: false }), 皻壍, 閪壍(20000));
        expect(奄壍.recommendationNote).toMatch(/won't add volume unless the campaign is budget-limited/);
    });
    it("recomputes after an optimistic save before pacing refetches", () => {
        const 砳壍 = derivePacingRow(諝壍(), 皻壍, 閪壍(14000, { savedTarget: 14000 }));
        expect(砳壍.edited).toBe(false);
        expect(砳壍.monthlyTarget).toBe(14000);
        expect(砳壍.recommendedDaily).toBeCloseTo((14000 - 11428.86) / 2, 2);
    });
    it("flags shared budgets and lock edits", () => {
        const 霢壍 = derivePacingRow(諝壍({ unitId: "budget:9", campaignIds: ["a", "b"], type: "Shared" }), 皻壍, 閪壍(12600, { locked: true }));
        expect(霢壍.shared).toBe(true);
        expect(霢壍.lockedNow).toBe(true);
        expect(霢壍.lockEdited).toBe(true);
    });
    it("notes the cap and complete months", () => {
        expect(draftNote(諝壍({ capped: true }), 13000, "on_track", 785.57, 2, "USD")).toMatch(/2× the daily budget per day, 30.4× per month/);
        expect(draftNote(諝壍(), 13000, "underpacing", null, 0, "USD")).toBe("Month complete — spent $11,429 of $13,000 (94%).");
        expect(draftNote(諝壍({ paused: true }), 13000, "paused", null, 2, "USD")).toBe("Paused — spent $11,429 so far this month; no further spend expected. $1,571 of the $13,000 target stays unused.");
        expect(draftNote(諝壍({ paused: true, mtdSpend: 0 }), 0, "paused", null, 0, "USD")).toBe("Paused — nothing spent in the month.");
    });
    it("keeps a paused unit paused when its target is edited (no recommendation)", () => {
        const 搑壍 = 諝壍({ paused: true, status: "paused", monthlyTarget: 11428.86, projected: 11428.86, paceRatio: 1, recommendedDaily: null, recommendationNote: "Paused — spent $11,429 so far this month; no further spend expected." });
        const 茀壍 = derivePacingRow(搑壍, 皻壍, 閪壍(15000, { savedTarget: 11428.86 }));
        expect(茀壍.status).toBe("paused");
        expect(茀壍.recommendedDaily).toBeNull();
        expect(茀壍.recommendationNote).toBe("Paused — spent $11,429 so far this month; no further spend expected. $3,571 of the $15,000 target stays unused.");
    });
});
describe("stat cards", () => {
    const 俯壍 = [derivePacingRow(諝壍(), 皻壍, 閪壍(12600)), derivePacingRow(諝壍({ unitId: "c2", campaignIds: ["c2"], mtdSpend: 1000, projected: 30000, monthlyTarget: 20000, status: "overpacing" }), 皻壍, { ...閪壍(20000), savedTarget: 20000 })];
    const 滞壍 = pacingTotals(俯壍);
    it("totals", () => {
        expect(滞壍.target).toBe(32600);
        expect(滞壍.overCount).toBe(1);
        expect(滞壍.campaigns).toBe(2);
    });
    it("computes the day count, over/headroom caption and warn tone", () => {
        const [跍壍, 媼壍, 禫壍, 颚壍] = budgetStats(皻壍, 滞壍, DEFAULT_THRESHOLDS, "USD");
        expect(跍壍).toMatchObject({ label: "September budget", value: "$32.6K", caption: "2 campaigns" });
        expect(媼壍?.caption).toBe("38% used · 28 of 30 days");
        expect(禫壍).toMatchObject({ label: "Projected month-end", caption: "$9,660 over budget", tone: "warn" });
        expect(颚壍).toMatchObject({ value: "1", caption: "Projected above 105% of budget" });
    });
    it("handles future and complete months", () => {
        expect(budgetStats({ month: "2026-10", daysInMonth: 31, elapsedDays: 0, remainingDays: 31 }, 滞壍, DEFAULT_THRESHOLDS, "USD")[1]?.caption).toBe("Starts Oct 1 · 31 days");
        const 斉壍 = budgetStats({ month: "2026-08", daysInMonth: 31, elapsedDays: 31, remainingDays: 0 }, { ...滞壍, projected: 30000, paceRatio: 30000 / 32600 }, DEFAULT_THRESHOLDS, "USD");
        expect(斉壍[1]?.caption).toBe("38% used · month complete");
        expect(斉壍[2]).toMatchObject({ label: "Month-end spend", caption: "$2,600 unspent", tone: "accent" });
    });
});
describe("chart helpers", () => {
    it("places the today marker only inside a running month", () => {
        expect(todayMarker({ daysInMonth: 30, elapsedDays: 28 })).toBeCloseTo(0.9333, 4);
        expect(todayMarker({ daysInMonth: 31, elapsedDays: 0 })).toBeUndefined();
        expect(todayMarker({ daysInMonth: 31, elapsedDays: 31 })).toBeUndefined();
    });
    it("ticks on day 1, 8, 15, 22 and the last day", () => {
        expect([...weeklyTicks(30)]).toEqual([0, 7, 14, 21, 29]);
        expect([...weeklyTicks(31)]).toEqual([0, 7, 14, 21, 30]);
        expect([...weeklyTicks(28)]).toEqual([0, 7, 14, 21, 27]);
    });
    it("rebuilds the ideal line for a draft total", () => {
        const 葸壍: PacingReport["cumulative"] = [
            { date: "2026-09-01", actual: 100, ideal: 50, projected: null },
            { date: "2026-09-02", actual: null, ideal: 100, projected: 180 },
        ];
        const 內壍 = cumulativeSeries({ cumulative: 葸壍, daysInMonth: 2 }, 300, 180);
        expect(內壍.ideal).toEqual([150, 300]);
        expect(內壍.actual).toEqual([100, null]);
        expect(內壍.max).toBeCloseTo(330, 6);
    });
});
describe("apply recommended daily budgets", () => {
    it("builds set_budget items and explains skipped units", () => {
        const 灖壍 = [
            derivePacingRow(諝壍(), 皻壍, 閪壍(12600)),
            derivePacingRow(諝壍({ unitId: "budget:1", campaignIds: ["a", "b"], type: "Shared", name: "Shared budget · A + B" }), 皻壍, 閪壍(12600)),
            derivePacingRow(諝壍({ unitId: "c9", campaignIds: ["c9"], paused: true, name: "Paused one" }), 皻壍, 閪壍(12600)),
            derivePacingRow(諝壍({ unitId: "c8", campaignIds: ["c8"], recommendedDaily: 420, name: "Same" }), 皻壍, 閪壍(12600)),
            derivePacingRow(諝壍({ unitId: "c7", campaignIds: ["c7"], recommendedDaily: null, name: "Done" }), 皻壍, 閪壍(12600)),
        ];
        const { changes: 轅壍, skipped: 尴壍 } = recommendedChanges(灖壍);
        expect(轅壍).toEqual([{ unitId: "c1", campaignId: "c1", name: "Brand — Core Terms", from: 420, to: 585.57 }]);
        expect(尴壍.map((笣壍) => 笣壍.reason)).toEqual(["Shared budget — edit it in Google Ads (Shared library)", "Paused", "Already at the recommended budget", "No recommendation"]);
    });
});
