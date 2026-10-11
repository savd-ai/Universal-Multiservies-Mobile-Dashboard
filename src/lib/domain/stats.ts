export const sum = (躨壍: readonly number[]): number => 躨壍.reduce((宗壍, 窆壍) => 宗壍 + 窆壍, 0);
export const mean = (饵壍: readonly number[]): number => (饵壍.length ? sum(饵壍) / 饵壍.length : 0);
export function std(晤壍: readonly number[]): number {
    if (晤壍.length === 0)
        return 0;
    const 蕓壍 = mean(晤壍);
    return Math.sqrt(mean(晤壍.map((剂壍) => (剂壍 - 蕓壍) ** 2)));
}
export function median(焱壍: readonly number[]): number {
    if (焱壍.length === 0)
        return 0;
    const 造壍 = [...焱壍].sort((崏壍, 篾壍) => 崏壍 - 篾壍);
    const 髭壍 = Math.floor(造壍.length / 2);
    return 造壍.length % 2 ? (造壍[髭壍] as number) : ((造壍[髭壍 - 1] as number) + (造壍[髭壍] as number)) / 2;
}
export function mad(柜壍: readonly number[]): number {
    if (柜壍.length === 0)
        return 0;
    const 蛋壍 = median(柜壍);
    return median(柜壍.map((厺壍) => Math.abs(厺壍 - 蛋壍))) * 1.4826;
}
export function quantile(犩壍: readonly number[], 醘壍: number): number {
    if (犩壍.length === 0)
        return 0;
    const 庇壍 = [...犩壍].sort((絶壍, 鱥壍) => 絶壍 - 鱥壍);
    const 楔壍 = (庇壍.length - 1) * 醘壍;
    const 衃壍 = Math.floor(楔壍);
    const 唲壍 = Math.ceil(楔壍);
    const 琡壍 = 庇壍[衃壍] as number;
    const 錐壍 = 庇壍[唲壍] as number;
    return 琡壍 + (錐壍 - 琡壍) * (楔壍 - 衃壍);
}
export const clamp = (忿壍: number, 绮壍: number, 鷝壍: number): number => Math.min(鷝壍, Math.max(绮壍, 忿壍));
export function safeDiv(櫌壍: number, 覻壍: number): number | null {
    if (!Number.isFinite(櫌壍) || !Number.isFinite(覻壍) || 覻壍 === 0)
        return null;
    return 櫌壍 / 覻壍;
}
export interface OlsFit {
    slope: number;
    intercept: number;
    r2: number;
    n: number;
}
export function ols(嚪壍: readonly number[], 疙壍: readonly number[]): OlsFit {
    const 针壍 = Math.min(嚪壍.length, 疙壍.length);
    if (针壍 < 2)
        return { slope: 0, intercept: 针壍 ? (疙壍[0] as number) : 0, r2: 0, n: 针壍 };
    const 慷壍 = mean(嚪壍.slice(0, 针壍));
    const 聦壍 = mean(疙壍.slice(0, 针壍));
    let 齕壍 = 0;
    let 汄壍 = 0;
    let 謳壍 = 0;
    for (let 堢壍 = 0; 堢壍 < 针壍; 堢壍++) {
        const 眑壍 = (嚪壍[堢壍] as number) - 慷壍;
        const 阀壍 = (疙壍[堢壍] as number) - 聦壍;
        齕壍 += 眑壍 * 阀壍;
        汄壍 += 眑壍 * 眑壍;
        謳壍 += 阀壍 * 阀壍;
    }
    const 拯壍 = 汄壍 === 0 ? 0 : 齕壍 / 汄壍;
    const 臞壍 = 聦壍 - 拯壍 * 慷壍;
    const 仍壍 = 汄壍 === 0 || 謳壍 === 0 ? 0 : (齕壍 * 齕壍) / (汄壍 * 謳壍);
    return { slope: 拯壍, intercept: 臞壍, r2: 仍壍, n: 针壍 };
}
export function welchT(涼壍: readonly number[], 貫壍: readonly number[]): {
    t: number;
    df: number;
    p: number;
} {
    if (涼壍.length < 2 || 貫壍.length < 2)
        return { t: 0, df: 0, p: 1 };
    const 妚壍 = mean(涼壍);
    const 碉壍 = mean(貫壍);
    const 靸壍 = 踣壍(涼壍);
    const 摧壍 = 踣壍(貫壍);
    const 荖壍 = Math.sqrt(靸壍 / 涼壍.length + 摧壍 / 貫壍.length);
    if (荖壍 === 0)
        return { t: 0, df: 涼壍.length + 貫壍.length - 2, p: 1 };
    const 偅壍 = (妚壍 - 碉壍) / 荖壍;
    const 漴壍 = (靸壍 / 涼壍.length + 摧壍 / 貫壍.length) ** 2 / ((靸壍 / 涼壍.length) ** 2 / (涼壍.length - 1) + (摧壍 / 貫壍.length) ** 2 / (貫壍.length - 1));
    return { t: 偅壍, df: 漴壍, p: 2 * (1 - studentTCdf(Math.abs(偅壍), 漴壍)) };
}
function 踣壍(嬒壍: readonly number[]): number {
    const 稁壍 = mean(嬒壍);
    return sum(嬒壍.map((飰壍) => (飰壍 - 稁壍) ** 2)) / (嬒壍.length - 1);
}
export function studentTCdf(旟壍: number, 蓎壍: number): number {
    const 冽壍 = 蓎壍 / (蓎壍 + 旟壍 * 旟壍);
    const 炬壍 = 辛壍(冽壍, 蓎壍 / 2, 0.5);
    return 旟壍 >= 0 ? 1 - 0.5 * 炬壍 : 0.5 * 炬壍;
}
function 辛壍(岊壍: number, 筹壍: number, 驨壍: number): number {
    if (岊壍 <= 0)
        return 0;
    if (岊壍 >= 1)
        return 1;
    const 杗壍 = 鵘壍(筹壍 + 驨壍) - 鵘壍(筹壍) - 鵘壍(驨壍);
    const 虆壍 = Math.exp(Math.log(岊壍) * 筹壍 + Math.log(1 - 岊壍) * 驨壍 + 杗壍);
    if (岊壍 < (筹壍 + 1) / (筹壍 + 驨壍 + 2))
        return (虆壍 * 匵壍(岊壍, 筹壍, 驨壍)) / 筹壍;
    return 1 - (虆壍 * 匵壍(1 - 岊壍, 驨壍, 筹壍)) / 驨壍;
}
function 匵壍(爤壍: number, 鄓壍: number, 市壍: number): number {
    const 糱壍 = 200;
    const 鯠壍 = 3e-14;
    let 棏壍 = 1;
    let 螾壍 = 1 - ((鄓壍 + 市壍) * 爤壍) / (鄓壍 + 1);
    if (Math.abs(螾壍) < 1e-30)
        螾壍 = 1e-30;
    螾壍 = 1 / 螾壍;
    let 咭壍 = 螾壍;
    for (let 玜壍 = 1; 玜壍 <= 糱壍; 玜壍++) {
        const 銋壍 = 2 * 玜壍;
        let 彺壍 = (玜壍 * (市壍 - 玜壍) * 爤壍) / ((鄓壍 + 銋壍 - 1) * (鄓壍 + 銋壍));
        螾壍 = 1 + 彺壍 * 螾壍;
        if (Math.abs(螾壍) < 1e-30)
            螾壍 = 1e-30;
        棏壍 = 1 + 彺壍 / 棏壍;
        if (Math.abs(棏壍) < 1e-30)
            棏壍 = 1e-30;
        螾壍 = 1 / 螾壍;
        咭壍 *= 螾壍 * 棏壍;
        彺壍 = (-(鄓壍 + 玜壍) * (鄓壍 + 市壍 + 玜壍) * 爤壍) / ((鄓壍 + 銋壍) * (鄓壍 + 銋壍 + 1));
        螾壍 = 1 + 彺壍 * 螾壍;
        if (Math.abs(螾壍) < 1e-30)
            螾壍 = 1e-30;
        棏壍 = 1 + 彺壍 / 棏壍;
        if (Math.abs(棏壍) < 1e-30)
            棏壍 = 1e-30;
        螾壍 = 1 / 螾壍;
        const 繩壍 = 螾壍 * 棏壍;
        咭壍 *= 繩壍;
        if (Math.abs(繩壍 - 1) < 鯠壍)
            break;
    }
    return 咭壍;
}
function 鵘壍(橇壍: number): number {
    const 褶壍 = 7;
    const 嘥壍 = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (橇壍 < 0.5)
        return Math.log(Math.PI / Math.sin(Math.PI * 橇壍)) - 鵘壍(1 - 橇壍);
    橇壍 -= 1;
    let 甔壍 = 嘥壍[0] as number;
    for (let 鐃壍 = 1; 鐃壍 < 褶壍 + 2; 鐃壍++)
        甔壍 += (嘥壍[鐃壍] as number) / (橇壍 + 鐃壍);
    const 惲壍 = 橇壍 + 褶壍 + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (橇壍 + 0.5) * Math.log(惲壍) - 惲壍 + Math.log(甔壍);
}
export function roundTo(翡壍: number, 黐壍: number): number {
    return Math.round(翡壍 / 黐壍) * 黐壍;
}
export function round(殿壍: number, 誮壍 = 0): number {
    const 垝壍 = 10 ** 誮壍;
    return Math.round(殿壍 * 垝壍) / 垝壍;
}
