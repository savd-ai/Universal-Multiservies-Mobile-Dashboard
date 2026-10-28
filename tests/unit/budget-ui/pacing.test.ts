import { describe, expect, it } from "vitest";
import type { PacingReport, PacingRow } from "@/lib/domain/contracts/budget";
import { budgetStats, cumulativeSeries, DEFAULT_THRESHOLDS, derivePacingRow, draftNote, pacingTotals, paceStatus, recommendedChanges, todayMarker, weeklyTicks } from "@/features/budget/lib/pacing";
const row = (over: Partial<PacingRow> = {}): PacingRow => ({
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
    ...over,
});
const report = { month: "2026-09", daysInMonth: 30, elapsedDays: 28, remainingDays: 2 } as const;
const opts = (target: number, extra: Partial<Parameters<typeof derivePacingRow>[2]> = {}) => ({ target, savedTarget: 12600, locked: false, savedLocked: false, thresholds: DEFAULT_THRESHOLDS, currency: "USD", ...extra });
describe("pace status", () => {
    it("uses the thresholds", () => {
        expect(paceStatus(row(), 10000, 12000, DEFAULT_THRESHOLDS)).toBe("overpacing");
        expect(paceStatus(row(), 15000, 12000, DEFAULT_THRESHOLDS)).toBe("underpacing");
        expect(paceStatus(row(), 12000, 12000, DEFAULT_THRESHOLDS)).toBe("on_track");
        expect(paceStatus(row(), 0, 12000, DEFAULT_THRESHOLDS)).toBe("no_budget");
        expect(paceStatus(row({ status: "unsupported_period" }), 12000, 1, DEFAULT_THRESHOLDS)).toBe("unsupported_period");
        expect(paceStatus(row({ paused: true }), 15000, 12000, DEFAULT_THRESHOLDS)).toBe("paused");
        expect(paceStatus(row({ paused: true }), 0, 12000, DEFAULT_THRESHOLDS)).toBe("paused");
        expect(paceStatus(row(), 12000, 12000 * 1.1, { over: 1.2, under: 0.8 })).toBe("on_track");
    });
});
describe("derived pacing rows", () => {
    it("keeps the server's numbers for an unchanged target", () => {
        const v = derivePacingRow(row(), report, opts(12600));
        expect(v.edited).toBe(false);
        expect(v.recommendationNote).toBe("On track — $586/day lands on $12,600.");
        expect(v.recommendedDaily).toBe(585.57);
        expect(v.spentShare).toBeCloseTo(11428.86 / 12600, 6);
    });
    it("recomputes status, ideal, recommendation and note for a draft target", () => {
        const v = derivePacingRow(row(), report, opts(11000));
        expect(v.edited).toBe(true);
        expect(v.status).toBe("overpacing");
        expect(v.paceRatio).toBeCloseTo(12259.86 / 11000, 4);
        expect(v.idealToDate).toBeCloseTo((11000 * 28) / 30, 2);
        expect(v.recommendedDaily).toBe(0);
        expect(v.recommendationNote).toBe("Lower the daily budget to $0 to land on $11,000.");
        expect(v.spentShare).toBe(1);
    });
    it("uses the budget-limited copy when underpacing", () => {
        const v = derivePacingRow(row(), report, opts(20000));
        expect(v.status).toBe("underpacing");
        expect(v.recommendedDaily).toBeCloseTo((20000 - 11428.86) / 2, 2);
        expect(v.recommendationNote).toMatch(/^Raise the daily budget to \$4,286 to use the full \$20,000\.$/);
        const notLimited = derivePacingRow(row({ budgetLimited: false }), report, opts(20000));
        expect(notLimited.recommendationNote).toMatch(/won't add volume unless the campaign is budget-limited/);
    });
    it("recomputes after an optimistic save before pacing refetches", () => {
        const v = derivePacingRow(row(), report, opts(14000, { savedTarget: 14000 }));
        expect(v.edited).toBe(false);
        expect(v.monthlyTarget).toBe(14000);
        expect(v.recommendedDaily).toBeCloseTo((14000 - 11428.86) / 2, 2);
    });
    it("flags shared budgets and lock edits", () => {
        const v = derivePacingRow(row({ unitId: "budget:9", campaignIds: ["a", "b"], type: "Shared" }), report, opts(12600, { locked: true }));
        expect(v.shared).toBe(true);
        expect(v.lockedNow).toBe(true);
        expect(v.lockEdited).toBe(true);
    });
    it("notes the cap and complete months", () => {
        expect(draftNote(row({ capped: true }), 13000, "on_track", 785.57, 2, "USD")).toMatch(/2× the daily budget per day, 30.4× per month/);
        expect(draftNote(row(), 13000, "underpacing", null, 0, "USD")).toBe("Month complete — spent $11,429 of $13,000 (94%).");
        expect(draftNote(row({ paused: true }), 13000, "paused", null, 2, "USD")).toBe("Paused — spent $11,429 so far this month; no further spend expected. $1,571 of the $13,000 target stays unused.");
        expect(draftNote(row({ paused: true, mtdSpend: 0 }), 0, "paused", null, 0, "USD")).toBe("Paused — nothing spent in the month.");
    });
    it("keeps a paused unit paused when its target is edited (no recommendation)", () => {
        const paused = row({ paused: true, status: "paused", monthlyTarget: 11428.86, projected: 11428.86, paceRatio: 1, recommendedDaily: null, recommendationNote: "Paused — spent $11,429 so far this month; no further spend expected." });
        const v = derivePacingRow(paused, report, opts(15000, { savedTarget: 11428.86 }));
        expect(v.status).toBe("paused");
        expect(v.recommendedDaily).toBeNull();
        expect(v.recommendationNote).toBe("Paused — spent $11,429 so far this month; no further spend expected. $3,571 of the $15,000 target stays unused.");
    });
});
describe("stat cards", () => {
    const views = [derivePacingRow(row(), report, opts(12600)), derivePacingRow(row({ unitId: "c2", campaignIds: ["c2"], mtdSpend: 1000, projected: 30000, monthlyTarget: 20000, status: "overpacing" }), report, { ...opts(20000), savedTarget: 20000 })];
    const totals = pacingTotals(views);
    it("totals", () => {
        expect(totals.target).toBe(32600);
        expect(totals.overCount).toBe(1);
        expect(totals.campaigns).toBe(2);
    });
    it("computes the day count, over/headroom caption and warn tone", () => {
        const [budget, spent, projected, over] = budgetStats(report, totals, DEFAULT_THRESHOLDS, "USD");
        expect(budget).toMatchObject({ label: "September budget", value: "$32.6K", caption: "2 campaigns" });
        expect(spent?.caption).toBe("38% used · 28 of 30 days");
        expect(projected).toMatchObject({ label: "Projected month-end", caption: "$9,660 over budget", tone: "warn" });
        expect(over).toMatchObject({ value: "1", caption: "Projected above 105% of budget" });
    });
    it("handles future and complete months", () => {
        expect(budgetStats({ month: "2026-10", daysInMonth: 31, elapsedDays: 0, remainingDays: 31 }, totals, DEFAULT_THRESHOLDS, "USD")[1]?.caption).toBe("Starts Oct 1 · 31 days");
        const done = budgetStats({ month: "2026-08", daysInMonth: 31, elapsedDays: 31, remainingDays: 0 }, { ...totals, projected: 30000, paceRatio: 30000 / 32600 }, DEFAULT_THRESHOLDS, "USD");
        expect(done[1]?.caption).toBe("38% used · month complete");
        expect(done[2]).toMatchObject({ label: "Month-end spend", caption: "$2,600 unspent", tone: "accent" });
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
        const cumulative: PacingReport["cumulative"] = [
            { date: "2026-09-01", actual: 100, ideal: 50, projected: null },
            { date: "2026-09-02", actual: null, ideal: 100, projected: 180 },
        ];
        const s = cumulativeSeries({ cumulative, daysInMonth: 2 }, 300, 180);
        expect(s.ideal).toEqual([150, 300]);
        expect(s.actual).toEqual([100, null]);
        expect(s.max).toBeCloseTo(330, 6);
    });
});
describe("apply recommended daily budgets", () => {
    it("builds set_budget items and explains skipped units", () => {
        const views = [
            derivePacingRow(row(), report, opts(12600)),
            derivePacingRow(row({ unitId: "budget:1", campaignIds: ["a", "b"], type: "Shared", name: "Shared budget · A + B" }), report, opts(12600)),
            derivePacingRow(row({ unitId: "c9", campaignIds: ["c9"], paused: true, name: "Paused one" }), report, opts(12600)),
            derivePacingRow(row({ unitId: "c8", campaignIds: ["c8"], recommendedDaily: 420, name: "Same" }), report, opts(12600)),
            derivePacingRow(row({ unitId: "c7", campaignIds: ["c7"], recommendedDaily: null, name: "Done" }), report, opts(12600)),
        ];
        const { changes, skipped } = recommendedChanges(views);
        expect(changes).toEqual([{ unitId: "c1", campaignId: "c1", name: "Brand — Core Terms", from: 420, to: 585.57 }]);
        expect(skipped.map((s) => s.reason)).toEqual(["Shared budget — edit it in Google Ads (Shared library)", "Paused", "Already at the recommended budget", "No recommendation"]);
    });
});
