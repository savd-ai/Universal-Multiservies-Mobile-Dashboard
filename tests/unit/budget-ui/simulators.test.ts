import { describe, expect, it } from "vitest";
import { availabilityLabel, defaultCampaign, keyOfType, pointRows, settingLabel, typeOfKey, weeklyDelta, weeklyImpactLine } from "@/features/budget/lib/simulators";
import type { RecommendationImpact, SimulationDayPoint, SimulationView } from "@/lib/domain/contracts/estimates";
const day = (value: number, cost: number, conversions: number, convValue: number): SimulationDayPoint => ({ value, cost, clicks: 10, impressions: 100, conversions, convValue, requiredBudget: null });
const view = (value: SimulationView["type"]): Pick<SimulationView, "type"> => ({ type: value });
describe("simulators helpers", () => {
    it("labels settings by simulation type", () => {
        expect(settingLabel("BUDGET", 420, "USD")).toBe("$420/day");
        expect(settingLabel("TARGET_CPA", 28.5, "USD")).toBe("$28.50");
        expect(settingLabel("TARGET_CPA", 140, "USD")).toBe("$140");
        expect(settingLabel("TARGET_ROAS", 4, "USD")).toBe("4.00x");
        expect(settingLabel("BUDGET", null, "USD")).toBe("—");
        expect(typeOfKey("target_roas")).toBe("TARGET_ROAS");
        expect(keyOfType("TARGET_CPA")).toBe("target_cpa");
    });
    it("adds CPA and ROAS per point and marks the current setting", () => {
        const rows = pointRows({ perDay: [day(210, 200, 10, 900), day(420, 400, 16, 1500), day(630, 0, 0, 0)], current: 420 });
        expect(rows.map((r) => [r.cpa, r.roas, r.current])).toEqual([
            [20, 4.5, false],
            [25, 3.75, true],
            [null, null, false],
        ]);
        expect(pointRows({ perDay: [day(210, 200, 10, 900)], current: null })[0]?.current).toBe(false);
    });
    it("explains in the picker what Google returned for each campaign", () => {
        expect(availabilityLabel({ type: "Shopping", simulations: [view("BUDGET"), view("TARGET_ROAS")] as SimulationView[] })).toBe("Budget · Target ROAS");
        expect(availabilityLabel({ type: "PMax", simulations: [] })).toBe("No simulations from Google");
        expect(availabilityLabel({ type: "Video", simulations: [] })).toBe("No simulations from Google");
    });
    it("opens on the first campaign with a budget simulation", () => {
        const a = { id: "a", simulations: [] as SimulationView[] };
        const b = { id: "b", simulations: [view("TARGET_CPA")] as SimulationView[] };
        const c = { id: "c", simulations: [view("BUDGET")] as SimulationView[] };
        expect(defaultCampaign([a, b, c])?.id).toBe("c");
        expect(defaultCampaign([a, b])?.id).toBe("b");
        expect(defaultCampaign([a])?.id).toBe("a");
        expect(defaultCampaign([])).toBeNull();
    });
    it("summarises a recommendation's weekly impact from what Google reported", () => {
        const impact: RecommendationImpact = {
            base: { impressions: 49000, clicks: 2940, cost: 2940, conversions: 98, convValue: 10290, videoViews: null },
            potential: { impressions: 63500, clicks: 3800, cost: 3480, conversions: 114.5, convValue: 12010, videoViews: null },
        };
        const d = weeklyDelta(impact);
        expect(d).toEqual({ conversions: 16.5, convValue: 1720, cost: 540, clicks: 860 });
        expect(weeklyImpactLine(d, "USD")).toBe("+16.5 conv. · +$1,720 value · +$540 cost");
        const clicksOnly = weeklyDelta({ base: { ...impact.base, conversions: null, convValue: null, cost: null }, potential: { ...impact.potential, conversions: null, convValue: null, cost: null } });
        expect(weeklyImpactLine(clicksOnly, "USD")).toBe("+860 clicks");
        const empty = { impressions: null, clicks: null, cost: null, conversions: null, convValue: null, videoViews: null };
        expect(weeklyDelta({ base: empty, potential: empty })).toBeNull();
        expect(weeklyDelta(null)).toBeNull();
        expect(weeklyImpactLine(null, "USD")).toBeNull();
        expect(weeklyImpactLine({ conversions: -2, convValue: null, cost: -150, clicks: null }, "USD")).toBe("−2.0 conv. · −$150 cost");
    });
});
