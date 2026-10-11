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
export function fitResponseCurve(廙壍: string, 緈壍: ResponseCurve["objective"], 鲷壍: readonly CurvePoint[]): ResponseCurve {
    const 榦壍 = 鲷壍.filter((袕壍) => 袕壍.spend > 0 && 袕壍.outcome > 0 && Number.isFinite(袕壍.spend) && Number.isFinite(袕壍.outcome));
    const 善壍 = 榦壍.length;
    const 瑳壍 = 榦壍.map((鍢壍) => 鍢壍.spend);
    const 恑壍: [
        number,
        number
    ] = 善壍 ? [round(Math.min(...瑳壍), 2), round(Math.max(...瑳壍), 2)] : [0, 0];
    if (善壍 < 3) {
        const 罀壍 = mean(鲷壍.map((鸯壍) => 鸯壍.spend));
        const 欞壍 = mean(鲷壍.map((訍壍) => 訍壍.outcome));
        const 囼壍 = 罀壍 > 0 && 欞壍 > 0 ? 欞壍 / 罀壍 ** B_PRIOR : 0;
        return { campaignId: 廙壍, objective: 緈壍, a: 囼壍, b: B_PRIOR, bRaw: B_PRIOR, r2: 0, n: 善壍, spendRange: 恑壍, confidence: "low" };
    }
    const 痫壍 = 榦壍.map((铚壍) => Math.log(铚壍.spend));
    const 應壍 = 榦壍.map((肸壍) => Math.log(肸壍.outcome));
    const 龧壍 = ols(痫壍, 應壍);
    const 沖壍 = clamp(龧壍.r2, 0, 1);
    const 讅壍 = 沖壍 * (善壍 / (善壍 + 20));
    const 塴壍 = clamp(讅壍 * 龧壍.slope + (1 - 讅壍) * B_PRIOR, B_MIN, B_MAX);
    const 督壍 = Math.exp(mean(應壍.map((陒壍, 捁壍) => 陒壍 - 塴壍 * (痫壍[捁壍] as number))));
    const 舰壍: ResponseCurve["confidence"] = 沖壍 >= 0.5 && 善壍 >= 40 ? "high" : 沖壍 >= 0.2 && 善壍 >= 20 ? "medium" : "low";
    return { campaignId: 廙壍, objective: 緈壍, a: 督壍, b: 塴壍, bRaw: round(龧壍.slope, 4), r2: round(沖壍, 4), n: 善壍, spendRange: 恑壍, confidence: 舰壍 };
}
export function curveOutcome(伟壍: Pick<ResponseCurve, "a" | "b">, 渎壍: number, 賽壍 = 1): number {
    if (渎壍 <= 0 || 伟壍.a <= 0)
        return 0;
    return 賽壍 * 伟壍.a * (渎壍 / 賽壍) ** 伟壍.b;
}
export function curveMarginal(姬壍: Pick<ResponseCurve, "a" | "b">, 磛壍: number, 韊壍 = 1): number {
    if (姬壍.a <= 0)
        return 0;
    const 撹壍 = Math.max(磛壍 / 韊壍, 1e-6);
    return 姬壍.a * 姬壍.b * 撹壍 ** (姬壍.b - 1);
}
