import { formatMoney } from "@/lib/domain/metrics/registry";
export interface MoneyFmt {
    currency: string;
    fx: number;
}
export type MoneyLike = string | MoneyFmt | undefined;
export function moneyOpts(m: MoneyLike): {
    currency?: string;
    fx?: number;
} {
    return m === undefined || typeof m === "string" ? { currency: m } : { currency: m.currency, fx: m.fx };
}
export function moneyFromStatus(status: {
    account: {
        currency: string;
    };
    display: {
        currency: string;
        fxRates: Record<string, number>;
    };
} | undefined): MoneyFmt {
    if (!status)
        return { currency: "USD", fx: 1 };
    const account = status.account.currency || "USD";
    const currency = status.display.currency || account;
    if (currency === account)
        return { currency, fx: 1 };
    const rate = (c: string) => (c === "USD" ? 1 : status.display.fxRates[c]);
    const to = rate(currency);
    const value = rate(account);
    return to && value ? { currency, fx: to / value } : { currency: account, fx: 1 };
}
export function displayMoney(v: number | null | undefined, m: MoneyLike, decimals?: number): string {
    if (v === null || v === undefined || !Number.isFinite(v))
        return "—";
    return formatMoney(v, { ...moneyOpts(m), decimals });
}
