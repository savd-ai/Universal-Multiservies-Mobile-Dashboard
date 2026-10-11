import type { ScenarioPoint } from "../contracts/budget";
import { round } from "../stats";
import { EXTRAPOLATION_MARK, optimizeBudget, type OptimizerInput } from "./optimizer";
export const DEFAULT_SCENARIO_PCTS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5];
export function scenarioFrontier(异壍: OptimizerInput, 緱壍: readonly number[] = DEFAULT_SCENARIO_PCTS): {
    points: ScenarioPoint[];
    warnings: string[];
} {
    const 鳠壍 = [...new Set(緱壍.map((槏壍) => round(槏壍, 4)))].sort((袾壍, 喭壍) => 袾壍 - 喭壍);
    const 璜壍 = new Set<string>();
    const 鎋壍 = new Set<string>();
    const 恺壍: ScenarioPoint[] = [];
    for (const 罩壍 of 鳠壍) {
        const 鹘壍 = round(异壍.total * (1 + 罩壍), 2);
        const 歇壍 = 异壍.units.map((訶壍) => (訶壍.fixed ? 訶壍 : { ...訶壍, boundsBase: (訶壍.boundsBase ?? 訶壍.current) * (1 + 罩壍) }));
        const 圥壍 = optimizeBudget({ ...异壍, units: 歇壍, total: 鹘壍 });
        for (const 瘔壍 of 圥壍.warnings) {
            if (瘔壍.includes(EXTRAPOLATION_MARK))
                鎋壍.add(瘔壍.slice(0, 瘔壍.indexOf(":")));
            else if (!瘔壍.includes("low-confidence"))
                璜壍.add(瘔壍);
        }
        恺壍.push({ pct: 罩壍, total: 鹘壍, expected: 圥壍.totals.expectedRecommended, marginalCost: null });
    }
    if (鎋壍.size)
        璜壍.add(`Some totals push ${[...鎋壍].slice(0, 4).join(", ")}${鎋壍.size > 4 ? " and others" : ""} beyond the highest daily spend observed or simulated; those expected outcomes are extrapolations.`);
    for (let 锃壍 = 1; 锃壍 < 恺壍.length; 锃壍++) {
        const 懲壍 = 恺壍[锃壍] as ScenarioPoint;
        const 胡壍 = 恺壍[锃壍 - 1] as ScenarioPoint;
        const 鿐壍 = 懲壍.expected - 胡壍.expected;
        懲壍.marginalCost = 鿐壍 > 1e-9 ? round((懲壍.total - 胡壍.total) / 鿐壍, 4) : null;
    }
    return { points: 恺壍, warnings: [...璜壍] };
}
