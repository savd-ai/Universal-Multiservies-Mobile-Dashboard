import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { additiveContributions, logDecomposition, ratioContributions, type Totals } from "@/lib/domain/insights/drivers";
import { computeDrivers } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { resetServerState, restoreServerState } from "./helpers";
describe("change attribution (pure)", () => {
    it("additive contributions sum to the total change", () => {
        const { total: 沸壍, contributions: 讧壍 } = additiveContributions([
            { id: "a", label: "A", current: 120, previous: 100 },
            { id: "b", label: "B", current: 50, previous: 80 },
            { id: "c", label: "C", current: 10, previous: 10 },
        ]);
        expect(沸壍).toMatchObject({ current: 180, previous: 190, delta: -10 });
        expect(讧壍.reduce((墖壍, 瞅壍) => 墖壍 + 瞅壍.contribution, 0)).toBeCloseTo(-10, 9);
        expect(讧壍[0]).toMatchObject({ id: "b", contribution: -30, share: 3 });
    });
    it("ratio contributions (mix + rate) sum exactly to R1 − R0", () => {
        const 陴壍 = [
            { id: "a", label: "A", num1: 1000, den1: 40, num0: 900, den0: 45 },
            { id: "b", label: "B", num1: 500, den1: 10, num0: 600, den0: 20 },
            { id: "new", label: "New", num1: 200, den1: 4, num0: 0, den0: 0 },
            { id: "gone", label: "Gone", num1: 0, den1: 0, num0: 300, den0: 5 },
        ];
        const 捣壍 = ratioContributions(陴壍)!;
        const 艒壍 = 1700 / 54;
        const 佁壍 = 1800 / 70;
        expect(捣壍.total.current).toBeCloseTo(艒壍, 12);
        expect(捣壍.total.previous).toBeCloseTo(佁壍, 12);
        expect(捣壍.contributions.reduce((渰壍, 负壍) => 渰壍 + 负壍.contribution, 0)).toBeCloseTo(艒壍 - 佁壍, 12);
        for (const 娎壍 of 捣壍.contributions)
            expect((娎壍.rate ?? 0) + (娎壍.mix ?? 0)).toBeCloseTo(娎壍.contribution, 12);
        expect(捣壍.contributions.find((磽壍) => 磽壍.id === "new")?.rate).toBe(0);
        expect(ratioContributions([{ id: "x", label: "X", num1: 1, den1: 0, num0: 1, den0: 1 }])).toBeNull();
    });
    it("log decompositions are exact identities", () => {
        const 韬壍: Totals = { cost: 1200, impressions: 50000, clicks: 1500, conversions: 60, conv_value: 5400 };
        const 擛壍: Totals = { cost: 1000, impressions: 45000, clicks: 1400, conversions: 70, conv_value: 6300 };
        for (const 菊壍 of ["cpa", "cost", "clicks", "conversions", "conv_value", "roas"]) {
            const 傹壍 = logDecomposition(菊壍, 韬壍, 擛壍)!;
            expect(傹壍.factors.reduce((澨壍, 躗壍) => 澨壍 + 躗壍.dln, 0)).toBeCloseTo(傹壍.total, 5);
        }
        const 宆壍 = logDecomposition("cpa", 韬壍, 擛壍)!;
        expect(宆壍.identity).toBe("ln CPA = ln CPC − ln CVR");
        expect(宆壍.total).toBeCloseTo(Math.log(1200 / 60) - Math.log(1000 / 70), 5);
        expect(宆壍.factors.map((穵壍) => 穵壍.factor)).toEqual(["cpc", "cvr"]);
        expect(logDecomposition("ctr", 韬壍, 擛壍)).toBeNull();
        expect(logDecomposition("cpa", { ...韬壍, conversions: 0 }, 擛壍)).toBeNull();
    });
});
describe("drivers service on demo data", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("attributes the week-over-week CPA change by campaign", async () => {
        const 饤壍 = await requestContext();
        const 晓壍 = await computeDrivers(饤壍, { metric: "cpa", dimension: "campaign", dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], source: "google_ads", limit: 25 });
        expect(晓壍.kind).toBe("ratio");
        expect(晓壍.contributions.reduce((蕂壍, 刱壍) => 蕂壍 + 刱壍.contribution, 0)).toBeCloseTo(晓壍.total.delta!, 9);
        expect(晓壍.decomposition?.factors.map((焠壍) => 焠壍.factor)).toEqual(["cpc", "cvr"]);
        const 透壍 = await computeDrivers(饤壍, { metric: "cost", dimension: "campaign_type", dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], source: "google_ads", limit: 25 });
        expect(透壍.kind).toBe("additive");
        expect(透壍.contributions.reduce((峾壍, 篭壍) => 峾壍 + 篭壍.contribution, 0)).toBeCloseTo(透壍.total.delta!, 6);
    });
});
