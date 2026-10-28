import type { CivilDate } from "./types";
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86400000;
export function isCivilDate(value: unknown): value is CivilDate {
    if (typeof value !== "string" || !RE.test(value))
        return false;
    return toCivil(toUtcMs(value)) === value;
}
export function parts(d: CivilDate): {
    y: number;
    m: number;
    day: number;
} {
    const match = RE.exec(d);
    if (!match)
        throw new Error(`Invalid civil date: ${d}`);
    return { y: Number(match[1]), m: Number(match[2]), day: Number(match[3]) };
}
export function toUtcMs(d: CivilDate): number {
    const { y, m, day } = parts(d);
    return Date.UTC(y, m - 1, day);
}
export function toCivil(ms: number): CivilDate {
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
export function make(y: number, m: number, day: number): CivilDate {
    return toCivil(Date.UTC(y, m - 1, day));
}
export function addDays(d: CivilDate, n: number): CivilDate {
    return toCivil(toUtcMs(d) + n * DAY_MS);
}
export function diffDays(a: CivilDate, b: CivilDate): number {
    return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}
export function dow(d: CivilDate): number {
    return new Date(toUtcMs(d)).getUTCDay();
}
export function isWeekend(d: CivilDate): boolean {
    const w = dow(d);
    return w === 0 || w === 6;
}
export function minDate(a: CivilDate, b: CivilDate): CivilDate {
    return a < b ? a : b;
}
export function maxDate(a: CivilDate, b: CivilDate): CivilDate {
    return a > b ? a : b;
}
export function enumerate(start: CivilDate, end: CivilDate): CivilDate[] {
    const out: CivilDate[] = [];
    const n = diffDays(start, end);
    for (let i = 0; i <= n; i++)
        out.push(addDays(start, i));
    return out;
}
export function monthStart(d: CivilDate): CivilDate {
    const { y, m } = parts(d);
    return make(y, m, 1);
}
export function monthEnd(d: CivilDate): CivilDate {
    const { y, m } = parts(d);
    return make(y, m + 1, 0);
}
export function daysInMonth(d: CivilDate): number {
    return parts(monthEnd(d)).day;
}
export function monthKey(d: CivilDate): string {
    return d.slice(0, 7);
}
export function addMonths(d: CivilDate, n: number): CivilDate {
    const { y, m, day } = parts(d);
    const target = make(y, m + n, 1);
    const dim = daysInMonth(target);
    return make(parts(target).y, parts(target).m, Math.min(day, dim));
}
export function quarterStart(d: CivilDate): CivilDate {
    const { y, m } = parts(d);
    return make(y, Math.floor((m - 1) / 3) * 3 + 1, 1);
}
export function yearStart(d: CivilDate): CivilDate {
    return make(parts(d).y, 1, 1);
}
export function weekStart(d: CivilDate): CivilDate {
    const w = dow(d);
    return addDays(d, w === 0 ? -6 : 1 - w);
}
export function isoWeek(d: CivilDate): string {
    const ms = toUtcMs(d);
    const date = new Date(ms);
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStartMs = Date.UTC(date.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((date.getTime() - yearStartMs) / DAY_MS + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export function todayInTz(timeZone: string, now: Date): CivilDate {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(now);
}
export function hourInTz(timeZone: string, now: Date): number {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });
    return Number(fmt.format(now)) % 24;
}
export function formatShort(d: CivilDate): string {
    const { m, day } = parts(d);
    return `${MONTHS[m - 1]} ${day}`;
}
export function formatLong(d: CivilDate): string {
    return `${formatShort(d)}, ${parts(d).y}`;
}
export function formatMonth(d: CivilDate): string {
    const long = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const { y, m } = parts(d);
    return `${long[m - 1]} ${y}`;
}
export function monthShortName(d: CivilDate): string {
    return MONTHS[parts(d).m - 1] ?? "";
}
export function sameYearShift(d: CivilDate, years: number): CivilDate {
    const { y, m, day } = parts(d);
    const target = make(y + years, m, 1);
    return make(y + years, m, Math.min(day, daysInMonth(target)));
}
export const DATE_PRESETS = [
    "today",
    "yesterday",
    "last_7d",
    "last_14d",
    "last_28d",
    "last_30d",
    "last_90d",
    "mtd",
    "last_month",
    "qtd",
    "last_quarter",
    "ytd",
    "last_365d",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export interface DateRange {
    start: CivilDate;
    end: CivilDate;
}
export const PRESET_LABELS: Record<DatePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last_7d: "Last 7 days",
    last_14d: "Last 14 days",
    last_28d: "Last 28 days",
    last_30d: "Last 30 days",
    last_90d: "Last 90 days",
    mtd: "Month to date",
    last_month: "Last month",
    qtd: "Quarter to date",
    last_quarter: "Last quarter",
    ytd: "Year to date",
    last_365d: "Last 365 days",
};
export function resolvePreset(preset: DatePreset, today: CivilDate, includeToday = false): DateRange {
    const yesterday = addDays(today, -1);
    const end = includeToday ? today : yesterday;
    const lastN = (n: number): DateRange => ({ start: addDays(end, -(n - 1)), end });
    switch (preset) {
        case "today":
            return { start: today, end: today };
        case "yesterday":
            return { start: yesterday, end: yesterday };
        case "last_7d":
            return lastN(7);
        case "last_14d":
            return lastN(14);
        case "last_28d":
            return lastN(28);
        case "last_30d":
            return lastN(30);
        case "last_90d":
            return lastN(90);
        case "last_365d":
            return lastN(365);
        case "mtd": {
            const start = monthStart(today);
            return { start, end: maxDate(start, end) };
        }
        case "qtd": {
            const start = quarterStart(today);
            return { start, end: maxDate(start, end) };
        }
        case "ytd": {
            const start = yearStart(today);
            return { start, end: maxDate(start, end) };
        }
        case "last_month": {
            const start = addMonths(monthStart(today), -1);
            return { start, end: monthEnd(start) };
        }
        case "last_quarter": {
            const start = addMonths(quarterStart(today), -3);
            return { start, end: addDays(quarterStart(today), -1) };
        }
    }
}
export function rangeDays(r: DateRange): number {
    return diffDays(r.start, r.end) + 1;
}
export type CompareMode = "none" | "previous_period" | "previous_year";
export function compareRange(r: DateRange, mode: CompareMode): DateRange | null {
    if (mode === "none")
        return null;
    if (mode === "previous_period") {
        const n = rangeDays(r);
        return { start: addDays(r.start, -n), end: addDays(r.start, -1) };
    }
    return { start: sameYearShift(r.start, -1), end: sameYearShift(r.end, -1) };
}
export function formatRange(r: DateRange): string {
    const sameYear = parts(r.start).y === parts(r.end).y;
    return sameYear ? `${formatShort(r.start)} – ${formatShort(r.end)}, ${parts(r.end).y}` : `${formatLong(r.start)} – ${formatLong(r.end)}`;
}
