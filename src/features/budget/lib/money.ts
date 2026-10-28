import { formatMoney } from "@/lib/domain/metrics/registry";
export const MONEY_STEP = 50;
export function roundMoney(value: number, step = MONEY_STEP): number {
    if (!Number.isFinite(value) || value <= 0)
        return 0;
    const s = step > 0 ? step : 1;
    return Math.round(Math.round(value / s) * s * 100) / 100;
}
export function snapToRange(value: number, min: number, max: number, step = MONEY_STEP): number {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.min(hi, Math.max(lo, roundMoney(value, step)));
}
export function parseMoney(input: string): number | null {
    const s = input.trim().toLowerCase().replace(/[\s,_]/g, "").replace(/^[^\d.\-−]+/, "");
    const m = /^([\d.]+)([km])?$/.exec(s);
    if (!m?.[1])
        return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 0)
        return null;
    const mult = m[2] === "k" ? 1000 : m[2] === "m" ? 1000000 : 1;
    return Math.round(n * mult * 100) / 100;
}
export function dailyFromMonthly(monthly: number, days: number): number {
    if (!(days > 0) || !Number.isFinite(monthly))
        return 0;
    return Math.round((monthly / days) * 100) / 100;
}
export function money(v: number | null | undefined, currency: string, opts: {
    compact?: boolean;
    decimals?: number;
} = {}): string {
    if (v === null || v === undefined || !Number.isFinite(v))
        return "—";
    return formatMoney(v, { currency, compact: opts.compact, decimals: opts.decimals });
}
export function moneyExact(v: number | null | undefined, currency: string): string {
    return money(v, currency, { compact: false, decimals: 0 });
}
export function perDay(v: number | null | undefined, currency: string): string {
    return v === null || v === undefined || !Number.isFinite(v) ? "—" : `${moneyExact(v, currency)}/day`;
}
