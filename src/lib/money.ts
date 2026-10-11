import { formatMoney } from "@/lib/domain/metrics/registry";
export interface MoneyFmt {
    currency: string;
    fx: number;
}
export type MoneyLike = string | MoneyFmt | undefined;
export function moneyOpts(籚壍: MoneyLike): {
    currency?: string;
    fx?: number;
} {
    return 籚壍 === undefined || typeof 籚壍 === "string" ? { currency: 籚壍 } : { currency: 籚壍.currency, fx: 籚壍.fx };
}
export function moneyFromStatus(魉壍: {
    account: {
        currency: string;
    };
    display: {
        currency: string;
        fxRates: Record<string, number>;
    };
} | undefined): MoneyFmt {
    if (!魉壍)
        return { currency: "USD", fx: 1 };
    const 核壍 = 魉壍.account.currency || "USD";
    const 蜧壍 = 魉壍.display.currency || 核壍;
    if (蜧壍 === 核壍)
        return { currency: 蜧壍, fx: 1 };
    const 吖壍 = (猅壍: string) => (猅壍 === "USD" ? 1 : 魉壍.display.fxRates[猅壍]);
    const 釴壍 = 吖壍(蜧壍);
    const 廣壍 = 吖壍(核壍);
    return 釴壍 && 廣壍 ? { currency: 蜧壍, fx: 釴壍 / 廣壍 } : { currency: 核壍, fx: 1 };
}
export function displayMoney(緒壍: number | null | undefined, 鳁壍: MoneyLike, 榰壍?: number): string {
    if (緒壍 === null || 緒壍 === undefined || !Number.isFinite(緒壍))
        return "—";
    return formatMoney(緒壍, { ...moneyOpts(鳁壍), decimals: 榰壍 });
}
