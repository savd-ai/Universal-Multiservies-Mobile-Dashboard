import { roundPreservingTotal } from "../allocate";
import type { OptimizeRequest, OptimizeResult, OptimizeResultRow, ResponseCurve } from "../contracts/budget";
import { formatMetricValue } from "../metrics/registry";
import { round } from "../stats";
import { curveMarginal, curveOutcome } from "./curves";
export const DEFAULT_MIN_FACTOR = 0.5;
export const EXTRAPOLATION_MARK = "above the highest daily spend";
export const DEFAULT_MAX_FACTOR = 1.6;
export interface OptimizerUnit {
    unitId: string;
    name: string;
    current: number;
    curve: ResponseCurve | null;
    fixed?: {
        value: number;
        reason: "locked" | "excluded" | "paused" | "unsupported";
    };
    min?: number;
    max?: number;
    boundsBase?: number;
    roas?: number | null;
}
export interface OptimizerInput {
    units: OptimizerUnit[];
    total: number;
    step: number;
    days: number;
    objective: OptimizeRequest["objective"];
    strategy: OptimizeRequest["strategy"];
    period: OptimizeRequest["period"];
    currency?: string;
}
interface Bounds {
    lo: number;
    hi: number;
}
function boundsOf(u: OptimizerUnit): Bounds {
    const base = u.boundsBase ?? u.current;
    const lo = Math.max(0, u.min ?? base * DEFAULT_MIN_FACTOR);
    const hi = Math.max(lo, u.max ?? base * DEFAULT_MAX_FACTOR);
    return { lo, hi };
}
const outcome = (u: OptimizerUnit, x: number, days: number) => (u.curve ? curveOutcome(u.curve, x, days) : 0);
export function allocateMarginal(units: readonly OptimizerUnit[], bounds: readonly Bounds[], available: number, step: number, days: number, warnings: string[]): number[] {
    const n = units.length;
    if (!n)
        return [];
    const lo = bounds.map((b) => b.lo);
    const sumLo = lo.reduce((a, b) => a + b, 0);
    if (sumLo > available + 1e-9) {
        warnings.push("The total is below the sum of the minimum amounts; minimums were scaled down proportionally.");
        const scaled = sumLo > 0 ? lo.map((v) => (v * available) / sumLo) : lo.map(() => available / n);
        return fixRemainder(roundPreservingTotal(scaled, step, available), available, bounds.map(() => ({ lo: 0, hi: Number.POSITIVE_INFINITY })));
    }
    const gLo = bounds.map((b) => {
        const v = Math.ceil(b.lo / step - 1e-9) * step;
        return v <= b.hi + 1e-9 ? v : b.lo;
    });
    const gHi = bounds.map((b, i) => {
        const v = Math.floor(b.hi / step + 1e-9) * step;
        return v >= (gLo[i] as number) ? v : (gLo[i] as number);
    });
    const x = [...gLo];
    let rest = available - x.reduce((a, b) => a + b, 0);
    if (rest < -1e-9) {
        for (let i = 0; i < n; i++)
            x[i] = lo[i] as number;
        rest = available - sumLo;
    }
    const hiOf = (i: number) => Math.max(gHi[i] as number, x[i] as number);
    const gain = (i: number, dx: number) => outcome(units[i] as OptimizerUnit, (x[i] as number) + dx, days) - outcome(units[i] as OptimizerUnit, x[i] as number, days);
    const fill = (i: number) => {
        const b = bounds[i] as Bounds;
        return b.hi > b.lo ? ((x[i] as number) - b.lo) / (b.hi - b.lo) : 1;
    };
    while (rest >= step - 1e-9) {
        let best = -1;
        let bestGain = -Infinity;
        for (let i = 0; i < n; i++) {
            if ((x[i] as number) + step > hiOf(i) + 1e-9)
                continue;
            const g = gain(i, step);
            if (g > bestGain + 1e-12 || (Math.abs(g - bestGain) <= 1e-12 && best >= 0 && fill(i) < fill(best))) {
                best = i;
                bestGain = g;
            }
        }
        if (best < 0)
            break;
        x[best] = (x[best] as number) + step;
        rest -= step;
    }
    if (rest > 1e-9) {
        let best = -1;
        let bestGain = -Infinity;
        for (let i = 0; i < n; i++) {
            const room = (bounds[i] as Bounds).hi - (x[i] as number);
            if (room + 1e-9 < rest)
                continue;
            const g = gain(i, rest);
            if (g > bestGain) {
                best = i;
                bestGain = g;
            }
        }
        if (best >= 0) {
            x[best] = (x[best] as number) + rest;
            rest = 0;
        }
        else {
            for (let i = 0; i < n && rest > 1e-9; i++) {
                const room = Math.max(0, (bounds[i] as Bounds).hi - (x[i] as number));
                const add = Math.min(room, rest);
                x[i] = (x[i] as number) + add;
                rest -= add;
            }
            if (rest > 0.005)
                warnings.push(`Maximum limits cap the allocation; ${formatMetricValue("money", rest, {})} could not be placed.`);
        }
    }
    return x.map((v) => round(v, 2));
}
function fixRemainder(values: number[], total: number, bounds: readonly Bounds[]): number[] {
    const diff = round(total - values.reduce((a, b) => a + b, 0), 2);
    if (Math.abs(diff) < 0.005 || !values.length)
        return values.map((v) => round(v, 2));
    const order = values.map((v, i2) => i2).sort((a, b) => (values[b] as number) - (values[a] as number));
    const out = [...values];
    for (const i2 of order) {
        const next = (out[i2] as number) + diff;
        const b = bounds[i2] as Bounds;
        if (next >= b.lo - 1e-9 && next <= b.hi + 1e-9 && next >= 0) {
            out[i2] = next;
            return out.map((v) => round(v, 2));
        }
    }
    const i = order[0] as number;
    out[i] = Math.max(0, (out[i] as number) + diff);
    return out.map((v) => round(v, 2));
}
export function allocateHeuristic(units: readonly OptimizerUnit[], bounds: readonly Bounds[], available: number, step: number, warnings: string[]): number[] {
    const n = units.length;
    if (!n)
        return [];
    const w = units.map((u) => Math.max(0, u.roas ?? 0) ** 0.7);
    const at = (lambda: number) => bounds.map((b, i) => Math.min(b.hi, Math.max(b.lo, lambda * (w[i] as number))));
    const sumAt = (lambda: number) => at(lambda).reduce((a, b) => a + b, 0);
    const sumLo = bounds.reduce((s, b) => s + b.lo, 0);
    const sumHi = bounds.reduce((s, b) => s + b.hi, 0);
    let x: number[];
    let target = available;
    if (available <= sumLo) {
        if (available < sumLo - 0.01)
            warnings.push("The total is below the sum of the minimum amounts; minimums were scaled down proportionally.");
        x = sumLo > 0 ? bounds.map((b) => (b.lo * available) / sumLo) : bounds.map(() => available / n);
    }
    else if (available >= sumHi || w.every((v) => v === 0)) {
        x = available >= sumHi ? bounds.map((b) => b.hi) : bounds.map((b) => b.lo + ((b.hi - b.lo) * (available - sumLo)) / Math.max(1e-9, sumHi - sumLo));
        if (available > sumHi + 0.01) {
            warnings.push("Maximum limits cap the ROAS rebalance below the requested total.");
            target = sumHi;
        }
    }
    else {
        let lo = 0;
        let hi = Math.max(...bounds.map((b, i) => ((w[i] as number) > 0 ? b.hi / (w[i] as number) : 0)), 1);
        for (let iter = 0; iter < 200 && hi - lo > 1e-9 * hi; iter++) {
            const mid = (lo + hi) / 2;
            if (sumAt(mid) < available)
                lo = mid;
            else
                hi = mid;
        }
        x = at((lo + hi) / 2);
    }
    return fixRemainder(roundPreservingTotal(x, step, target), target, bounds);
}
export function optimizeBudget(input: OptimizerInput): OptimizeResult {
    const warnings: string[] = [];
    const money = (v: number) => formatMetricValue("money", v, { currency: input.currency ?? "USD" });
    const freeIdx: number[] = [];
    const fixedTotal = input.units.reduce((s, u, i) => {
        if (u.fixed)
            return s + u.fixed.value;
        freeIdx.push(i);
        return s;
    }, 0);
    const free = freeIdx.map((i) => input.units[i] as OptimizerUnit);
    const bounds = free.map(boundsOf);
    let available = input.total - fixedTotal;
    if (available < 0) {
        warnings.push(`Locked and excluded amounts (${money(fixedTotal)}) exceed the total; nothing is left to allocate.`);
        available = 0;
    }
    const alloc = input.strategy === "roas_heuristic" ? allocateHeuristic(free, bounds, available, input.step, warnings) : allocateMarginal(free, bounds, available, input.step, input.days, warnings);
    const recommended = new Map<number, number>();
    freeIdx.forEach((ui, k) => recommended.set(ui, alloc[k] ?? 0));
    const rows: OptimizeResultRow[] = input.units.map((u, i) => {
        const rec = u.fixed ? u.fixed.value : (recommended.get(i) ?? 0);
        const k = freeIdx.indexOf(i);
        const b = k >= 0 ? (bounds[k] as Bounds) : null;
        const marginal = u.curve ? curveMarginal(u.curve, rec, input.days) : 0;
        const tol = Math.max(0.01, input.step / 2);
        const bound: OptimizeResultRow["bound"] = u.fixed ? "locked" : b && rec <= b.lo + tol && b.hi > b.lo ? "min" : b && rec >= b.hi - tol ? "max" : null;
        return {
            unitId: u.unitId,
            name: u.name,
            current: round(u.current, 2),
            recommended: round(rec, 2),
            delta: round(rec - u.current, 2),
            deltaPct: u.current > 0 ? round(rec / u.current - 1, 4) : 0,
            expected: { current: round(outcome(u, u.current, input.days), 2), recommended: round(outcome(u, rec, input.days), 2) },
            marginalCost: marginal > 0 ? round(1 / marginal, 4) : null,
            bound,
            curveConfidence: u.curve?.confidence ?? "low",
            curveSource: u.curve?.source ?? "model",
            ...(u.curve?.calibration !== undefined ? { curveCalibration: u.curve.calibration } : {}),
        };
    });
    const low = input.units.filter((u) => !u.fixed && (!u.curve || u.curve.confidence === "low"));
    if (low.length)
        warnings.push(`${low.length === 1 ? "1 campaign has" : `${low.length} campaigns have`} a low-confidence response curve (${low.map((u) => u.name).slice(0, 4).join(", ")}${low.length > 4 ? ", …" : ""}); treat its expected outcome as a rough guide.`);
    for (const r of rows) {
        const u = input.units.find((x) => x.unitId === r.unitId);
        const maxSeen = u?.curve?.spendRange[1] ?? 0;
        if (u && !u.fixed && maxSeen > 0 && r.recommended / input.days > maxSeen * 1.3) {
            const seen = u.curve?.source === "google_simulator" ? "Google simulated" : "observed";
            warnings.push(`${r.name}: ${money(r.recommended / input.days)}/day is ${EXTRAPOLATION_MARK} ${seen} (${money(maxSeen)}); the expected outcome is an extrapolation.`);
        }
    }
    const current = round(rows.reduce((s, r) => s + r.current, 0), 2);
    const recTotal = round(rows.reduce((s, r) => s + r.recommended, 0), 2);
    const expectedCurrent = round(rows.reduce((s, r) => s + r.expected.current, 0), 2);
    const expectedRecommended = round(rows.reduce((s, r) => s + r.expected.recommended, 0), 2);
    return {
        objective: input.objective,
        strategy: input.strategy,
        period: input.period,
        rows,
        totals: { current, recommended: recTotal, expectedCurrent, expectedRecommended, liftPct: expectedCurrent > 0 ? round(expectedRecommended / expectedCurrent - 1, 4) : 0 },
        warnings,
    };
}
export function allocationOutcome(units: readonly OptimizerUnit[], amounts: readonly number[], days: number): number {
    return units.reduce((s, u, i) => s + outcome(u, amounts[i] ?? 0, days), 0);
}
