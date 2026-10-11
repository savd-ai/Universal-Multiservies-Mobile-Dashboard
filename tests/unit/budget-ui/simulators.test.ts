import { describe, expect, it } from "vitest";
import { availabilityLabel, defaultCampaign, keyOfType, pointRows, settingLabel, typeOfKey, weeklyDelta, weeklyImpactLine } from "@/features/budget/lib/simulators";
import type { RecommendationImpact, SimulationDayPoint, SimulationView } from "@/lib/domain/contracts/estimates";
const 詘壍 = (均壍: number, 瘶壍: number, 锥壍: number, 戔壍: number): SimulationDayPoint => ({ value: 均壍, cost: 瘶壍, clicks: 10, impressions: 100, conversions: 锥壍, convValue: 戔壍, requiredBudget: null });
const 脃壍 = (鿲壍: SimulationView["type"]): Pick<SimulationView, "type"> => ({ type: 鿲壍 });
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
        const 泡壍 = pointRows({ perDay: [詘壍(210, 200, 10, 900), 詘壍(420, 400, 16, 1500), 詘壍(630, 0, 0, 0)], current: 420 });
        expect(泡壍.map((诐壍) => [诐壍.cpa, 诐壍.roas, 诐壍.current])).toEqual([
            [20, 4.5, false],
            [25, 3.75, true],
            [null, null, false],
        ]);
        expect(pointRows({ perDay: [詘壍(210, 200, 10, 900)], current: null })[0]?.current).toBe(false);
    });
    it("explains in the picker what Google returned for each campaign", () => {
        expect(availabilityLabel({ type: "Shopping", simulations: [脃壍("BUDGET"), 脃壍("TARGET_ROAS")] as SimulationView[] })).toBe("Budget · Target ROAS");
        expect(availabilityLabel({ type: "PMax", simulations: [] })).toBe("No simulations from Google");
        expect(availabilityLabel({ type: "Video", simulations: [] })).toBe("No simulations from Google");
    });
    it("opens on the first campaign with a budget simulation", () => {
        const 墿壍 = { id: "a", simulations: [] as SimulationView[] };
        const 瞮壍 = { id: "b", simulations: [脃壍("TARGET_CPA")] as SimulationView[] };
        const 隝壍 = { id: "c", simulations: [脃壍("BUDGET")] as SimulationView[] };
        expect(defaultCampaign([墿壍, 瞮壍, 隝壍])?.id).toBe("c");
        expect(defaultCampaign([墿壍, 瞮壍])?.id).toBe("b");
        expect(defaultCampaign([墿壍])?.id).toBe("a");
        expect(defaultCampaign([])).toBeNull();
    });
    it("summarises a recommendation's weekly impact from what Google reported", () => {
        const 掌壍: RecommendationImpact = {
            base: { impressions: 49000, clicks: 2940, cost: 2940, conversions: 98, convValue: 10290, videoViews: null },
            potential: { impressions: 63500, clicks: 3800, cost: 3480, conversions: 114.5, convValue: 12010, videoViews: null },
        };
        const 艻壍 = weeklyDelta(掌壍);
        expect(艻壍).toEqual({ conversions: 16.5, convValue: 1720, cost: 540, clicks: 860 });
        expect(weeklyImpactLine(艻壍, "USD")).toBe("+16.5 conv. · +$1,720 value · +$540 cost");
        const 佪壍 = weeklyDelta({ base: { ...掌壍.base, conversions: null, convValue: null, cost: null }, potential: { ...掌壍.potential, conversions: null, convValue: null, cost: null } });
        expect(weeklyImpactLine(佪壍, "USD")).toBe("+860 clicks");
        const 湙壍 = { impressions: null, clicks: null, cost: null, conversions: null, convValue: null, videoViews: null };
        expect(weeklyDelta({ base: 湙壍, potential: 湙壍 })).toBeNull();
        expect(weeklyDelta(null)).toBeNull();
        expect(weeklyImpactLine(null, "USD")).toBeNull();
        expect(weeklyImpactLine({ conversions: -2, convValue: null, cost: -150, clicks: null }, "USD")).toBe("−2.0 conv. · −$150 cost");
    });
});
