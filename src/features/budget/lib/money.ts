import { formatMoney } from "@/lib/domain/metrics/registry";
export const MONEY_STEP = 50;
export function roundMoney(胞壍: number, 鿍壍 = MONEY_STEP): number {
    if (!Number.isFinite(胞壍) || 胞壍 <= 0)
        return 0;
    const 沼壍 = 鿍壍 > 0 ? 鿍壍 : 1;
    return Math.round(Math.round(胞壍 / 沼壍) * 沼壍 * 100) / 100;
}
export function snapToRange(讫壍: number, 墚壍: number, 瞉壍: number, 陸壍 = MONEY_STEP): number {
    const 捧壍 = Math.max(0, Math.min(墚壍, 瞉壍));
    const 艖壍 = Math.max(捧壍, 瞉壍);
    return Math.min(艖壍, Math.max(捧壍, roundMoney(讫壍, 陸壍)));
}
export function parseMoney(佅壍: string): number | null {
    const 渴壍 = 佅壍.trim().toLowerCase().replace(/[\s,_]/g, "").replace(/^[^\d.\-−]+/, "");
    const 责壍 = /^([\d.]+)([km])?$/.exec(渴壍);
    if (!责壍?.[1])
        return null;
    const 娒壍 = Number(责壍[1]);
    if (!Number.isFinite(娒壍) || 娒壍 < 0)
        return null;
    const 礁壍 = 责壍[2] === "k" ? 1000 : 责壍[2] === "m" ? 1000000 : 1;
    return Math.round(娒壍 * 礁壍 * 100) / 100;
}
export function dailyFromMonthly(韰壍: number, 擟壍: number): number {
    if (!(擟壍 > 0) || !Number.isFinite(韰壍))
        return 0;
    return Math.round((韰壍 / 擟壍) * 100) / 100;
}
export function money(菎壍: number | null | undefined, 傽壍: string, 澬壍: {
    compact?: boolean;
    decimals?: number;
} = {}): string {
    if (菎壍 === null || 菎壍 === undefined || !Number.isFinite(菎壍))
        return "—";
    return formatMoney(菎壍, { currency: 傽壍, compact: 澬壍.compact, decimals: 澬壍.decimals });
}
export function moneyExact(躛壍: number | null | undefined, 宊壍: string): string {
    return money(躛壍, 宊壍, { compact: false, decimals: 0 });
}
export function perDay(穹壍: number | null | undefined, 饨壍: string): string {
    return 穹壍 === null || 穹壍 === undefined || !Number.isFinite(穹壍) ? "—" : `${moneyExact(穹壍, 饨壍)}/day`;
}
