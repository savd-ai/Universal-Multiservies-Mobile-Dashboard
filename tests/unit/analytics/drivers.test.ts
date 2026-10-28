import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { additiveContributions, logDecomposition, ratioContributions, type Totals } from "@/lib/domain/insights/drivers";
import { computeDrivers } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { resetServerState, restoreServerState } from "./helpers";
describe("change attribution (pure)", () => {
    it("additive contributions sum to the total change", () => {
        const { total, contributions } = additiveContributions([
            { id: "a", label: "A", current: 120, previous: 100 },
            { id: "b", label: "B", current: 50, previous: 80 },
            { id: "c", label: "C", current: 10, previous: 10 },
        ]);
        expect(total).toMatchObject({ current: 180, previous: 190, delta: -10 });
        expect(contributions.reduce((s, c) => s + c.contribution, 0)).toBeCloseTo(-10, 9);
        expect(contributions[0]).toMatchObject({ id: "b", contribution: -30, share: 3 });
    });
    it("ratio contributions (mix + rate) sum exactly to R1 − R0", () => {
        const segs = [
            { id: "a", label: "A", num1: 1000, den1: 40, num0: 900, den0: 45 },
            { id: "b", label: "B", num1: 500, den1: 10, num0: 600, den0: 20 },
            { id: "new", label: "New", num1: 200, den1: 4, num0: 0, den0: 0 },
            { id: "gone", label: "Gone", num1: 0, den1: 0, num0: 300, den0: 5 },
        ];
        const out = ratioContributions(segs)!;
        const R1 = 1700 / 54;
        const R0 = 1800 / 70;
        expect(out.total.current).toBeCloseTo(R1, 12);
        expect(out.total.previous).toBeCloseTo(R0, 12);
        expect(out.contributions.reduce((s, c) => s + c.contribution, 0)).toBeCloseTo(R1 - R0, 12);
        for (const c of out.contributions)
            expect((c.rate ?? 0) + (c.mix ?? 0)).toBeCloseTo(c.contribution, 12);
        expect(out.contributions.find((c) => c.id === "new")?.rate).toBe(0);
        expect(ratioContributions([{ id: "x", label: "X", num1: 1, den1: 0, num0: 1, den0: 1 }])).toBeNull();
    });
    it("log decompositions are exact identities", () => {
        const cur: Totals = { cost: 1200, impressions: 50000, clicks: 1500, conversions: 60, conv_value: 5400 };
        const prev: Totals = { cost: 1000, impressions: 45000, clicks: 1400, conversions: 70, conv_value: 6300 };
        for (const metric of ["cpa", "cost", "clicks", "conversions", "conv_value", "roas"]) {
            const d = logDecomposition(metric, cur, prev)!;
            expect(d.factors.reduce((s, f) => s + f.dln, 0)).toBeCloseTo(d.total, 5);
        }
        const cpa = logDecomposition("cpa", cur, prev)!;
        expect(cpa.identity).toBe("ln CPA = ln CPC − ln CVR");
        expect(cpa.total).toBeCloseTo(Math.log(1200 / 60) - Math.log(1000 / 70), 5);
        expect(cpa.factors.map((f) => f.factor)).toEqual(["cpc", "cvr"]);
        expect(logDecomposition("ctr", cur, prev)).toBeNull();
        expect(logDecomposition("cpa", { ...cur, conversions: 0 }, prev)).toBeNull();
    });
});
describe("drivers service on demo data", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("attributes the week-over-week CPA change by campaign", async () => {
        const ctx = await requestContext();
        const res = await computeDrivers(ctx, { metric: "cpa", dimension: "campaign", dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], source: "google_ads", limit: 25 });
        expect(res.kind).toBe("ratio");
        expect(res.contributions.reduce((s, c) => s + c.contribution, 0)).toBeCloseTo(res.total.delta!, 9);
        expect(res.decomposition?.factors.map((f) => f.factor)).toEqual(["cpc", "cvr"]);
        const spend = await computeDrivers(ctx, { metric: "cost", dimension: "campaign_type", dateRange: { preset: "last_7d" }, compare: "previous_period", filters: [], source: "google_ads", limit: 25 });
        expect(spend.kind).toBe("additive");
        expect(spend.contributions.reduce((s, c) => s + c.contribution, 0)).toBeCloseTo(spend.total.delta!, 6);
    });
});
