import type { ResponseCurve } from "../contracts/budget";
import { clamp, mean, ols, round } from "../stats";
export const CURVE_DAYS = 60;
export const B_PRIOR = 0.7;
export const B_MIN = 0.3;
export const B_MAX = 0.95;
export interface CurvePoint {
    spend: number;
    outcome: number;
}
export function fitResponseCurve(unitId: string, objective: ResponseCurve["objective"], points: readonly CurvePoint[]): ResponseCurve {
    const usable = points.filter((p) => p.spend > 0 && p.outcome > 0 && Number.isFinite(p.spend) && Number.isFinite(p.outcome));
    const n = usable.length;
    const spends = usable.map((p) => p.spend);
    const spendRange: [
        number,
        number
    ] = n ? [round(Math.min(...spends), 2), round(Math.max(...spends), 2)] : [0, 0];
    if (n < 3) {
        const s = mean(points.map((p) => p.spend));
        const y = mean(points.map((p) => p.outcome));
        const a2 = s > 0 && y > 0 ? y / s ** B_PRIOR : 0;
        return { campaignId: unitId, objective, a: a2, b: B_PRIOR, bRaw: B_PRIOR, r2: 0, n, spendRange, confidence: "low" };
    }
    const lx = usable.map((p) => Math.log(p.spend));
    const ly = usable.map((p) => Math.log(p.outcome));
    const fit = ols(lx, ly);
    const r2 = clamp(fit.r2, 0, 1);
    const w = r2 * (n / (n + 20));
    const b = clamp(w * fit.slope + (1 - w) * B_PRIOR, B_MIN, B_MAX);
    const a = Math.exp(mean(ly.map((v, i) => v - b * (lx[i] as number))));
    const confidence: ResponseCurve["confidence"] = r2 >= 0.5 && n >= 40 ? "high" : r2 >= 0.2 && n >= 20 ? "medium" : "low";
    return { campaignId: unitId, objective, a, b, bRaw: round(fit.slope, 4), r2: round(r2, 4), n, spendRange, confidence };
}
export function curveOutcome(curve: Pick<ResponseCurve, "a" | "b">, amount: number, days = 1): number {
    if (amount <= 0 || curve.a <= 0)
        return 0;
    return days * curve.a * (amount / days) ** curve.b;
}
export function curveMarginal(curve: Pick<ResponseCurve, "a" | "b">, amount: number, days = 1): number {
    if (curve.a <= 0)
        return 0;
    const perDay = Math.max(amount / days, 1e-6);
    return curve.a * curve.b * perDay ** (curve.b - 1);
}
