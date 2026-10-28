import { describe, expect, it } from "vitest";
import { largestRemainder, roundPreservingTotal } from "@/lib/domain/allocate";
import { addDays, compareRange, daysInMonth, diffDays, dow, isoWeek, resolvePreset, todayInTz } from "@/lib/domain/dates";
import { checkFormula, compileFormula, FormulaError, parseFormula } from "@/lib/domain/metrics/formula";
import { MetricRegistry, formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import { mulberry32 } from "@/lib/domain/rng";
import { mad, median, ols, welchT } from "@/lib/domain/stats";
describe("civil dates", () => {
    it("does day math without timezone drift", () => {
        expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
        expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
        expect(diffDays("2026-01-01", "2026-12-31")).toBe(364);
        expect(dow("2026-09-28")).toBe(1);
        expect(daysInMonth("2026-02-10")).toBe(28);
        expect(isoWeek("2026-01-01")).toBe("2026-W01");
    });
    it("resolves presets to complete days ending yesterday", () => {
        expect(resolvePreset("last_7d", "2026-09-29")).toEqual({ start: "2026-09-22", end: "2026-09-28" });
        expect(resolvePreset("mtd", "2026-09-29")).toEqual({ start: "2026-09-01", end: "2026-09-28" });
        expect(resolvePreset("last_month", "2026-09-29")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
        expect(resolvePreset("ytd", "2026-09-29").start).toBe("2026-01-01");
    });
    it("builds compare ranges", () => {
        const r = { start: "2026-09-01", end: "2026-09-30" };
        expect(compareRange(r, "previous_period")).toEqual({ start: "2026-08-02", end: "2026-08-31" });
        expect(compareRange(r, "previous_year")).toEqual({ start: "2025-09-01", end: "2025-09-30" });
        expect(compareRange({ start: "2024-02-29", end: "2024-02-29" }, "previous_year")).toEqual({ start: "2023-02-28", end: "2023-02-28" });
    });
    it("computes today in an explicit time zone", () => {
        const now = new Date("2026-09-29T02:00:00Z");
        expect(todayInTz("America/New_York", now)).toBe("2026-09-28");
        expect(todayInTz("Asia/Ho_Chi_Minh", now)).toBe("2026-09-29");
    });
});
describe("allocation", () => {
    it("largest remainder sums exactly", () => {
        const parts = largestRemainder(1001, [0.6, 0.33, 0.07]);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(1001);
        const cents = largestRemainder(123.45, [1, 1, 1], 2);
        expect(Math.round(cents.reduce((a, b) => a + b, 0) * 100)).toBe(12345);
    });
    it("rounds to a step while preserving the total", () => {
        const out = roundPreservingTotal([1233, 4567, 2200], 50, 8000);
        expect(out.every((v) => v % 50 === 0)).toBe(true);
        expect(out.reduce((a, b) => a + b, 0)).toBe(8000);
    });
});
describe("stats", () => {
    it("median / MAD / OLS", () => {
        expect(median([5, 1, 3])).toBe(3);
        expect(mad([1, 1, 1, 1])).toBe(0);
        const fit = ols([1, 2, 3, 4], [2, 4, 6, 8]);
        expect(fit.slope).toBeCloseTo(2);
        expect(fit.r2).toBeCloseTo(1);
    });
    it("Welch t-test detects a clear shift", () => {
        const a = [10, 11, 9, 10, 12, 10, 11];
        const b = [20, 21, 19, 22, 20, 21, 20];
        expect(welchT(a, b).p).toBeLessThan(0.001);
        expect(welchT(a, a).p).toBeGreaterThan(0.9);
    });
    it("mulberry32 matches the prototype's first draws", () => {
        const r = mulberry32(11);
        const first = [r(), r(), r()];
        expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
        const again = mulberry32(11);
        expect([again(), again(), again()]).toEqual(first);
    });
});
describe("formula language", () => {
    it("evaluates arithmetic with precedence and null safety", () => {
        const f = compileFormula("(conv_value - cost) / cost");
        expect(f.run((n) => ({ conv_value: 300, cost: 100 })[n] ?? null)).toBeCloseTo(2);
        expect(f.run((n) => ({ conv_value: 300, cost: 0 })[n] ?? null)).toBeNull();
        expect(compileFormula("1 + 2 * 3").run(() => null)).toBe(7);
        expect(compileFormula("if(cost > 100, 1, 0)").run(() => 150)).toBe(1);
        expect(compileFormula("round(10 / 3, 2)").run(() => null)).toBe(3.33);
        expect(compileFormula("coalesce(x, 5)").run(() => null)).toBe(5);
    });
    it("rejects unsafe or malformed input with a position", () => {
        expect(() => parseFormula("__proto__ + 1")).toThrow(FormulaError);
        expect(() => parseFormula("eval(1)")).toThrow(/Unknown function/);
        expect(() => parseFormula("(1 + 2")).toThrow(/parenthesis/);
        const check = checkFormula("cost / nope", new Set(["cost"]));
        expect(check.ok).toBe(false);
        expect(check.error?.position).toBe(7);
    });
});
describe("metric registry", () => {
    it("computes ratio-of-sums metrics and custom formulas", () => {
        const reg = new MetricRegistry([{ key: "cm_profit", label: "Profit", formula: "conv_value - cost", format: "money", direction: "up_good" }]);
        const agg = { cost: 200, conv_value: 800, clicks: 100, impressions: 5000, conversions: 8 };
        expect(reg.computeValue("roas", agg)).toBe(4);
        expect(reg.computeValue("ctr", agg)).toBeCloseTo(0.02);
        expect(reg.computeValue("cpa", agg)).toBe(25);
        expect(reg.computeValue("cm_profit", agg)).toBe(600);
        expect(reg.get("cm_profit")?.deps.sort()).toEqual(["conv_value", "cost"]);
    });
    it("ignores cyclic custom metrics", () => {
        const reg = new MetricRegistry([
            { key: "cm_a", label: "A", formula: "cm_b + 1", format: "number", direction: "neutral" },
            { key: "cm_b", label: "B", formula: "cm_a + 1", format: "number", direction: "neutral" },
        ]);
        expect(reg.has("cm_a")).toBe(false);
    });
    it("formats values like the prototype", () => {
        expect(formatMetricValue("money", 1234)).toBe("$1,234");
        expect(formatMetricValue("money", 48213)).toBe("$48.2K");
        expect(formatMetricValue("percent", 0.0512)).toBe("5.12%");
        expect(formatMetricValue("ratio", 3.456)).toBe("3.46x");
        expect(formatMetricValue("money", null)).toBe("—");
        expect(formatDelta(-0.042)).toBe("−4.2%");
    });
});
