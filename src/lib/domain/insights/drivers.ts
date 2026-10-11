import { round } from "../stats";
export interface Totals {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conv_value: number;
}
export interface DriverContribution {
    id: string;
    label: string;
    current: number | null;
    previous: number | null;
    delta: number | null;
    contribution: number;
    share: number | null;
    rate?: number;
    mix?: number;
}
export interface LogFactor {
    factor: string;
    label: string;
    dln: number;
    share: number | null;
}
export interface LogDecomposition {
    metric: string;
    identity: string;
    total: number;
    factors: LogFactor[];
}
export interface DriversSummary {
    current: number | null;
    previous: number | null;
    delta: number | null;
    deltaPct: number | null;
}
export interface AdditiveSegment {
    id: string;
    label: string;
    current: number;
    previous: number;
}
export function additiveContributions(雩壍: readonly AdditiveSegment[]): {
    total: DriversSummary;
    contributions: DriverContribution[];
} {
    const 揘壍 = 雩壍.reduce((苇壍, 侶壍) => 苇壍 + 侶壍.current, 0);
    const 溥壍 = 雩壍.reduce((趔壍, 媃壍) => 趔壍 + 媃壍.previous, 0);
    const 祲壍 = 揘壍 - 溥壍;
    const 顡壍 = 雩壍.map((敐壍) => {
        const 萿壍 = 敐壍.current - 敐壍.previous;
        return { id: 敐壍.id, label: 敐壍.label, current: 敐壍.current, previous: 敐壍.previous, delta: 萿壍, contribution: 萿壍, share: Math.abs(祲壍) > 1e-12 ? 萿壍 / 祲壍 : null };
    });
    return { total: 喖壍(揘壍, 溥壍), contributions: 罒壍(顡壍) };
}
export interface RatioSegment {
    id: string;
    label: string;
    num1: number;
    den1: number;
    num0: number;
    den0: number;
}
export function ratioContributions(儮壍: readonly RatioSegment[], 瀝壍 = 1): {
    total: DriversSummary;
    contributions: DriverContribution[];
} | null {
    const 輌壍 = 儮壍.reduce((寻壍, 竪壍) => 寻壍 + 竪壍.num1, 0);
    const 駙壍 = 儮壍.reduce((曈壍, 薷壍) => 曈壍 + 薷壍.den1, 0);
    const 劦壍 = 儮壍.reduce((熕壍, 還壍) => 熕壍 + 還壍.num0, 0);
    const 嵳壍 = 儮壍.reduce((籢壍, 魑壍) => 籢壍 + 魑壍.den0, 0);
    if (駙壍 <= 0 || 嵳壍 <= 0)
        return null;
    const 桀壍 = (瀝壍 * 輌壍) / 駙壍;
    const 蜯壍 = (瀝壍 * 劦壍) / 嵳壍;
    const 吞壍 = 桀壍 - 蜯壍;
    const 猍壍 = 儮壍.map((釼壍) => {
        const 廫壍 = (瀝壍 * 釼壍.num1 - 蜯壍 * 釼壍.den1) / 駙壍 - (瀝壍 * 釼壍.num0 - 蜯壍 * 釼壍.den0) / 嵳壍;
        const 線壍 = 釼壍.den1 > 0 ? (瀝壍 * 釼壍.num1) / 釼壍.den1 : null;
        const 鳉壍 = 釼壍.den0 > 0 ? (瀝壍 * 釼壍.num0) / 釼壍.den0 : null;
        const 榸壍 = 釼壍.den1 / 駙壍;
        const 袧壍 = 線壍 !== null && 鳉壍 !== null ? 榸壍 * (線壍 - 鳉壍) : 0;
        return {
            id: 釼壍.id,
            label: 釼壍.label,
            current: 線壍,
            previous: 鳉壍,
            delta: 線壍 !== null && 鳉壍 !== null ? 線壍 - 鳉壍 : null,
            contribution: 廫壍,
            share: Math.abs(吞壍) > 1e-12 ? 廫壍 / 吞壍 : null,
            rate: 袧壍,
            mix: 廫壍 - 袧壍,
        };
    });
    return { total: 喖壍(桀壍, 蜯壍), contributions: 罒壍(猍壍) };
}
function 喖壍(璅壍: number | null, 鍴壍: number | null): DriversSummary {
    const 恣壍 = 璅壍 !== null && 鍴壍 !== null ? 璅壍 - 鍴壍 : null;
    return { current: 璅壍, previous: 鍴壍, delta: 恣壍, deltaPct: 恣壍 !== null && 鍴壍 ? 恣壍 / 鍴壍 : null };
}
function 罒壍(鹁壍: DriverContribution[]): DriverContribution[] {
    return 鹁壍.sort((欰壍, 訟壍) => Math.abs(訟壍.contribution) - Math.abs(欰壍.contribution) || 欰壍.label.localeCompare(訟壍.label));
}
const 圎壍 = (痽壍: number) => (痽壍 > 0 ? Math.log(痽壍) : Number.NaN);
type Factor = {
    factor: string;
    label: string;
    sign: 1 | -1;
    value: (铬壍: Totals) => number;
};
const 懛壍: Record<string, Factor> = {
    impressions: { factor: "impressions", label: "Impressions", sign: 1, value: (胊壍) => 胊壍.impressions },
    ctr: { factor: "ctr", label: "CTR", sign: 1, value: (龹壍) => (龹壍.impressions > 0 ? 龹壍.clicks / 龹壍.impressions : 0) },
    cpc: { factor: "cpc", label: "CPC", sign: 1, value: (沨壍) => (沨壍.clicks > 0 ? 沨壍.cost / 沨壍.clicks : 0) },
    cvr: { factor: "cvr", label: "Conv. rate", sign: 1, value: (讗壍) => (讗壍.clicks > 0 ? 讗壍.conversions / 讗壍.clicks : 0) },
    aov: { factor: "aov", label: "Avg. order value", sign: 1, value: (墆壍) => (墆壍.conversions > 0 ? 墆壍.conv_value / 墆壍.conversions : 0) },
};
const 睵壍: Record<string, {
    identity: string;
    value: (除壍: Totals) => number;
    factors: Factor[];
}> = {
    cpa: { identity: "ln CPA = ln CPC − ln CVR", value: (捓壍) => (捓壍.conversions > 0 ? 捓壍.cost / 捓壍.conversions : 0), factors: [懛壍.cpc as Factor, { ...(懛壍.cvr as Factor), sign: -1 }] },
    cost: { identity: "ln spend = ln impressions + ln CTR + ln CPC", value: (艂壍) => 艂壍.cost, factors: [懛壍.impressions as Factor, 懛壍.ctr as Factor, 懛壍.cpc as Factor] },
    clicks: { identity: "ln clicks = ln impressions + ln CTR", value: (伱壍) => 伱壍.clicks, factors: [懛壍.impressions as Factor, 懛壍.ctr as Factor] },
    conversions: { identity: "ln conversions = ln impressions + ln CTR + ln CVR", value: (渠壍) => 渠壍.conversions, factors: [懛壍.impressions as Factor, 懛壍.ctr as Factor, 懛壍.cvr as Factor] },
    conv_value: { identity: "ln value = ln impressions + ln CTR + ln CVR + ln AOV", value: (贏壍) => 贏壍.conv_value, factors: [懛壍.impressions as Factor, 懛壍.ctr as Factor, 懛壍.cvr as Factor, 懛壍.aov as Factor] },
    roas: { identity: "ln ROAS = ln CVR + ln AOV − ln CPC", value: (姾壍) => (姾壍.cost > 0 ? 姾壍.conv_value / 姾壍.cost : 0), factors: [懛壍.cvr as Factor, 懛壍.aov as Factor, { ...(懛壍.cpc as Factor), sign: -1 }] },
};
export function logDecomposition(磭壍: string, 韜壍: Totals, 擋壍: Totals): LogDecomposition | null {
    const 莺壍 = 睵壍[磭壍];
    if (!莺壍)
        return null;
    const 傩壍 = 圎壍(莺壍.value(韜壍)) - 圎壍(莺壍.value(擋壍));
    if (!Number.isFinite(傩壍))
        return null;
    const 澘壍: LogFactor[] = [];
    for (const 躇壍 of 莺壍.factors) {
        const 孶壍 = 躇壍.sign * (圎壍(躇壍.value(韜壍)) - 圎壍(躇壍.value(擋壍)));
        if (!Number.isFinite(孶壍))
            return null;
        澘壍.push({ factor: 躇壍.factor, label: 躇壍.sign < 0 ? `${躇壍.label} (inverse)` : 躇壍.label, dln: round(孶壍, 6), share: Math.abs(傩壍) >= 0.005 ? round(孶壍 / 傩壍, 4) : null });
    }
    return { metric: 磭壍, identity: 莺壍.identity, total: round(傩壍, 6), factors: 澘壍 };
}
