import type { ScenarioPoint } from "../contracts/budget";
import { round } from "../stats";
import { EXTRAPOLATION_MARK, optimizeBudget, type OptimizerInput } from "./optimizer";
export const DEFAULT_SCENARIO_PCTS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5];
export function scenarioFrontier(base: OptimizerInput, pcts: readonly number[] = DEFAULT_SCENARIO_PCTS): {
    points: ScenarioPoint[];
    warnings: string[];
} {
    const sorted = [...new Set(pcts.map((p) => round(p, 4)))].sort((a, b) => a - b);
    const warnings = new Set<string>();
    const extrapolated = new Set<string>();
    const points: ScenarioPoint[] = [];
    for (const pct of sorted) {
        const total = round(base.total * (1 + pct), 2);
        const units = base.units.map((u) => (u.fixed ? u : { ...u, boundsBase: (u.boundsBase ?? u.current) * (1 + pct) }));
        const res = optimizeBudget({ ...base, units, total });
        for (const w of res.warnings) {
            if (w.includes(EXTRAPOLATION_MARK))
                extrapolated.add(w.slice(0, w.indexOf(":")));
            else if (!w.includes("low-confidence"))
                warnings.add(w);
        }
        points.push({ pct, total, expected: res.totals.expectedRecommended, marginalCost: null });
    }
    if (extrapolated.size)
        warnings.add(`Some totals push ${[...extrapolated].slice(0, 4).join(", ")}${extrapolated.size > 4 ? " and others" : ""} beyond the highest daily spend observed or simulated; those expected outcomes are extrapolations.`);
    for (let i = 1; i < points.length; i++) {
        const p = points[i] as ScenarioPoint;
        const prev = points[i - 1] as ScenarioPoint;
        const dy = p.expected - prev.expected;
        p.marginalCost = dy > 1e-9 ? round((p.total - prev.total) / dy, 4) : null;
    }
    return { points, warnings: [...warnings] };
}
