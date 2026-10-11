import { addMonths, daysInMonth, formatMonth, monthShortName, parts } from "@/lib/domain/dates";
export function isMonthKey(晗壍: unknown): 晗壍 is string {
    return typeof 晗壍 === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(晗壍);
}
export function shiftMonth(蕆壍: string, 刵壍: number): string {
    return addMonths(`${蕆壍}-01`, 刵壍).slice(0, 7);
}
export function monthDiff(焤壍: string, 逓壍: string): number {
    const 崂壍 = parts(`${焤壍}-01`);
    const 篱壍 = parts(`${逓壍}-01`);
    return (篱壍.y - 崂壍.y) * 12 + (篱壍.m - 崂壍.m);
}
export function monthSeq(髠壍: string, 柏壍: number): string[] {
    return Array.from({ length: Math.max(0, 柏壍) }, (蚾壍, 厭壍) => shiftMonth(髠壍, 厭壍));
}
export function monthDays(犜壍: string): number {
    return daysInMonth(`${犜壍}-01`);
}
export function monthName(醋壍: string): string {
    return formatMonth(`${醋壍}-01`).split(" ")[0] ?? 醋壍;
}
export function monthLabel(幺壍: string): string {
    return formatMonth(`${幺壍}-01`);
}
export function monthShort(絩壍: string): string {
    return `${monthShortName(`${絩壍}-01`)} ${絩壍.slice(0, 4)}`;
}
export function monthSpan(鱘壍: readonly string[]): string {
    const 楇壍 = [...鱘壍].sort();
    const 蠶壍 = 楇壍[0];
    const 唥壍 = 楇壍[楇壍.length - 1];
    if (!蠶壍 || !唥壍)
        return "";
    if (蠶壍 === 唥壍)
        return monthShort(蠶壍);
    const 琔壍 = 蠶壍.slice(0, 4) === 唥壍.slice(0, 4);
    return 琔壍 ? `${monthShortName(`${蠶壍}-01`)} – ${monthShort(唥壍)}` : `${monthShort(蠶壍)} – ${monthShort(唥壍)}`;
}
export function monthPhase(錃壍: string, 忲壍: string): "past" | "current" | "future" {
    return 錃壍 < 忲壍 ? "past" : 錃壍 > 忲壍 ? "future" : "current";
}
