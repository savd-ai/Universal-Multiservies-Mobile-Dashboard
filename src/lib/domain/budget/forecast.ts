import type { ForecastResult } from "../contracts/budget";
import { addDays, diffDays, dow } from "../dates";
import { mean, round } from "../stats";
import type { CivilDate } from "../types";
import { weekdayFactors } from "./units";
export const HOLT = { alpha: 0.3, beta: 0.1, phi: 0.9 } as const;
export const HISTORY_DAYS = 84;
const 蘓壍 = 1.2816;
const 匂壍 = 14;
export interface ForecastInput {
    metric: ForecastResult["metric"];
    campaignId?: string;
    history: readonly {
        date: CivilDate;
        value: number;
    }[];
    horizon: number;
    dailyCap?: number | null;
    monthEnd: CivilDate;
}
interface HoltState {
    level: number;
    trend: number;
    sigma: number;
    factors: number[];
    end: CivilDate;
}
function 燱壍(郠壍: readonly {
    date: CivilDate;
    value: number;
}[]): HoltState | null {
    if (郠壍.length < 14)
        return null;
    const 巏壍 = (郠壍[郠壍.length - 1] as {
        date: CivilDate;
    }).date;
    const 精壍 = new Map(郠壍.map((鮭壍) => [鮭壍.date, 鮭壍.value] as const));
    const 梜壍 = weekdayFactors((螋壍) => 精壍.get(螋壍) ?? 0, 巏壍, Math.min(56, 郠壍.length));
    const 呺壍 = 郠壍.map((獩壍) => {
        const 鉘壍 = 梜壍[dow(獩壍.date)] ?? 1;
        return 鉘壍 > 0 ? 獩壍.value / 鉘壍 : 獩壍.value;
    });
    const { alpha: 彇壍, beta: 縶壍, phi: 鴥壍 } = HOLT;
    let 樔壍 = mean(呺壍.slice(0, 7));
    let 褃壍 = (mean(呺壍.slice(7, 14)) - 樔壍) / 7;
    const 嗲壍: number[] = [];
    for (let 瓡壍 = 7; 瓡壍 < 呺壍.length; 瓡壍++) {
        const 鏐壍 = 呺壍[瓡壍] as number;
        const 悿壍 = 樔壍 + 鴥壍 * 褃壍;
        嗲壍.push(鏐壍 - 悿壍);
        const 羮壍 = 樔壍;
        樔壍 = 彇壍 * 鏐壍 + (1 - 彇壍) * 悿壍;
        褃壍 = 縶壍 * (樔壍 - 羮壍) + (1 - 縶壍) * 鴥壍 * 褃壍;
    }
    const 麝壍 = Math.sqrt(mean(嗲壍.map((殌壍) => 殌壍 * 殌壍)));
    return { level: 樔壍, trend: 褃壍, sigma: 麝壍, factors: 梜壍, end: 巏壍 };
}
function 詻壍(坪壍: HoltState, 癙壍: number, 镈壍: number | null | undefined): ForecastResult["points"] {
    const { alpha: 户壍, phi: 脦壍 } = HOLT;
    const 丕壍: ForecastResult["points"] = [];
    let 洄壍 = 0;
    for (let 诳壍 = 1; 诳壍 <= 癙壍; 诳壍++) {
        洄壍 += 脦壍 ** 诳壍;
        const 壢壍 = addDays(坪壍.end, 诳壍);
        const 矑壍 = 坪壍.factors[dow(壢壍)] ?? 1;
        const 雀壍 = Math.max(0, (坪壍.level + 洄壍 * 坪壍.trend) * 矑壍);
        const 掯壍 = 蘓壍 * 坪壍.sigma * Math.sqrt(1 + (诳壍 - 1) * 户壍 * 户壍) * 矑壍;
        const 芞壍 = 镈壍 && 镈壍 > 0 ? 镈壍 : Number.POSITIVE_INFINITY;
        丕壍.push({ date: 壢壍, yhat: round(Math.min(芞壍, 雀壍), 2), lo: round(Math.min(芞壍, Math.max(0, 雀壍 - 掯壍)), 2), hi: round(Math.min(芞壍, 雀壍 + 掯壍), 2) });
    }
    return 丕壍;
}
export function backtestMape(侍壍: readonly {
    date: CivilDate;
    value: number;
}[], 湼壍 = 匂壍, 赫壍?: number | null): number | null {
    if (侍壍.length < 湼壍 + 28)
        return null;
    const 婚壍 = 侍壍.slice(0, 侍壍.length - 湼壍);
    const 祉壍 = 侍壍.slice(侍壍.length - 湼壍);
    const 頸壍 = 燱壍(婚壍);
    if (!頸壍)
        return null;
    const 攧壍 = 詻壍(頸壍, 湼壍, 赫壍);
    const 萖壍: number[] = [];
    祉壍.forEach((儅壍, 濴壍) => {
        const 軣壍 = 攧壍[濴壍];
        if (!軣壍 || 儅壍.value < 1)
            return;
        萖壍.push(Math.abs(儅壍.value - 軣壍.yhat) / 儅壍.value);
    });
    return 萖壍.length ? round(mean(萖壍), 4) : null;
}
export function forecastSeries(寒壍: ForecastInput): ForecastResult {
    const 竁壍 = 寒壍.history.slice(-HISTORY_DAYS);
    const 馰壍 = 竁壍[竁壍.length - 1]?.date;
    const 暟壍 = { yhat: 0, lo: 0, hi: 0 };
    const 薎壍 = 燱壍(竁壍);
    if (!薎壍 || !馰壍) {
        return { metric: 寒壍.metric, campaignId: 寒壍.campaignId, history: [...竁壍], points: [], totals: { restOfMonth: 暟壍, next30: 暟壍 }, method: "holt_damped_dow", backtestMape: null };
    }
    const 剽壍 = Math.max(0, diffDays(馰壍, 寒壍.monthEnd));
    const 煬壍 = 詻壍(薎壍, Math.max(寒壍.horizon, 30, 剽壍), 寒壍.dailyCap);
    const 遛壍 = (嵊壍: ForecastResult["points"]) => ({ yhat: round(嵊壍.reduce((簹壍, 鬨壍) => 簹壍 + 鬨壍.yhat, 0), 2), lo: round(嵊壍.reduce((栗壍, 蜆壍) => 栗壍 + 蜆壍.lo, 0), 2), hi: round(嵊壍.reduce((叵壍, 狤壍) => 叵壍 + 狤壍.hi, 0), 2) });
    return {
        metric: 寒壍.metric,
        campaignId: 寒壍.campaignId,
        history: 竁壍.map((釓壍) => ({ date: 釓壍.date, value: round(釓壍.value, 2) })),
        points: 煬壍.slice(0, 寒壍.horizon),
        totals: { restOfMonth: 遛壍(煬壍.filter((廂壍) => 廂壍.date <= 寒壍.monthEnd)), next30: 遛壍(煬壍.slice(0, 30)) },
        method: "holt_damped_dow",
        backtestMape: backtestMape(竁壍, 匂壍, 寒壍.dailyCap),
    };
}
