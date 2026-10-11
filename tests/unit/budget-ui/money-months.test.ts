import { describe, expect, it } from "vitest";
import { dailyFromMonthly, money, moneyExact, parseMoney, perDay, roundMoney, snapToRange } from "@/features/budget/lib/money";
import { isMonthKey, monthDiff, monthLabel, monthName, monthPhase, monthSeq, monthShort, monthSpan, shiftMonth } from "@/features/budget/lib/months";
describe("money rounding to the $50 planning grid", () => {
    it("rounds half up to the nearest 50", () => {
        expect(roundMoney(12345)).toBe(12350);
        expect(roundMoney(12324)).toBe(12300);
        expect(roundMoney(12325)).toBe(12350);
        expect(roundMoney(13020)).toBe(13000);
        expect(roundMoney(24)).toBe(0);
        expect(roundMoney(25)).toBe(50);
    });
    it("never goes below zero and ignores non-finite input", () => {
        expect(roundMoney(-120)).toBe(0);
        expect(roundMoney(Number.NaN)).toBe(0);
        expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
    });
    it("supports other steps and stays clean to the cent", () => {
        expect(roundMoney(465.4, 1)).toBe(465);
        expect(roundMoney(1234, 100)).toBe(1200);
        expect(roundMoney(0.3, 0.1)).toBe(0.3);
    });
    it("snaps into a slider range", () => {
        expect(snapToRange(90000, 3800, 25200)).toBe(25200);
        expect(snapToRange(10, 3800, 25200)).toBe(3800);
        expect(snapToRange(12610, 3800, 25200)).toBe(12600);
    });
    it("parses typed amounts", () => {
        expect(parseMoney("$12,345.60")).toBe(12345.6);
        expect(parseMoney("12.5k")).toBe(12500);
        expect(parseMoney("1.2M")).toBe(1200000);
        expect(parseMoney(" 13 000 ")).toBe(13000);
        expect(parseMoney("₫450")).toBe(450);
        expect(parseMoney("-5")).toBeNull();
        expect(parseMoney("abc")).toBeNull();
        expect(parseMoney("")).toBeNull();
        expect(parseMoney("1.2.3")).toBeNull();
    });
    it("converts monthly to daily to the cent", () => {
        expect(dailyFromMonthly(20150, 30)).toBe(671.67);
        expect(dailyFromMonthly(13020, 31)).toBe(420);
        expect(dailyFromMonthly(100, 0)).toBe(0);
    });
    it("formats like the prototype", () => {
        expect(money(136500, "USD")).toBe("$136.5K");
        expect(money(9826.66, "USD")).toBe("$9,827");
        expect(money(null, "USD")).toBe("—");
        expect(moneyExact(12600, "USD")).toBe("$12,600");
        expect(perDay(585.57, "USD")).toBe("$586/day");
    });
});
describe("month keys", () => {
    it("validates", () => {
        expect(isMonthKey("2026-09")).toBe(true);
        expect(isMonthKey("2026-13")).toBe(false);
        expect(isMonthKey("2026-9")).toBe(false);
        expect(isMonthKey(null)).toBe(false);
    });
    it("shifts across years", () => {
        expect(shiftMonth("2026-09", 1)).toBe("2026-10");
        expect(shiftMonth("2026-12", 1)).toBe("2027-01");
        expect(shiftMonth("2026-01", -1)).toBe("2025-12");
        expect(shiftMonth("2026-09", 12)).toBe("2027-09");
        expect(monthDiff("2026-09", "2027-03")).toBe(6);
        expect(monthSeq("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
    });
    it("labels", () => {
        expect(monthName("2026-09")).toBe("September");
        expect(monthLabel("2026-10")).toBe("October 2026");
        expect(monthShort("2026-10")).toBe("Oct 2026");
        expect(monthSpan(["2026-12", "2026-10", "2026-11"])).toBe("Oct – Dec 2026");
        expect(monthSpan(["2026-11", "2027-02"])).toBe("Nov 2026 – Feb 2027");
        expect(monthSpan(["2026-10"])).toBe("Oct 2026");
        expect(monthSpan([])).toBe("");
        expect(monthPhase("2026-08", "2026-09")).toBe("past");
        expect(monthPhase("2026-09", "2026-09")).toBe("current");
        expect(monthPhase("2026-10", "2026-09")).toBe("future");
    });
});
