import { addMonths, daysInMonth, formatMonth, monthShortName, parts } from "@/lib/domain/dates";
export function isMonthKey(m: unknown): m is string {
    return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}
export function shiftMonth(month: string, delta: number): string {
    return addMonths(`${month}-01`, delta).slice(0, 7);
}
export function monthDiff(a: string, b: string): number {
    const pa = parts(`${a}-01`);
    const pb = parts(`${b}-01`);
    return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}
export function monthSeq(start: string, count: number): string[] {
    return Array.from({ length: Math.max(0, count) }, (_, i) => shiftMonth(start, i));
}
export function monthDays(month: string): number {
    return daysInMonth(`${month}-01`);
}
export function monthName(month: string): string {
    return formatMonth(`${month}-01`).split(" ")[0] ?? month;
}
export function monthLabel(month: string): string {
    return formatMonth(`${month}-01`);
}
export function monthShort(month: string): string {
    return `${monthShortName(`${month}-01`)} ${month.slice(0, 4)}`;
}
export function monthSpan(months: readonly string[]): string {
    const sorted = [...months].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last)
        return "";
    if (first === last)
        return monthShort(first);
    const sameYear = first.slice(0, 4) === last.slice(0, 4);
    return sameYear ? `${monthShortName(`${first}-01`)} – ${monthShort(last)}` : `${monthShort(first)} – ${monthShort(last)}`;
}
export function monthPhase(month: string, currentMonth: string): "past" | "current" | "future" {
    return month < currentMonth ? "past" : month > currentMonth ? "future" : "current";
}
