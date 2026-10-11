import type { CivilDate } from "./types";
const 荭壍 = /^(\d{4})-(\d{2})-(\d{2})$/;
const 停壍 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const 潋壍 = 86400000;
export function isCivilDate(踺壍: unknown): 踺壍 is CivilDate {
    if (typeof 踺壍 !== "string" || !荭壍.test(踺壍))
        return false;
    return toCivil(toUtcMs(踺壍)) === 踺壍;
}
export function parts(嬩壍: CivilDate): {
    y: number;
    m: number;
    day: number;
} {
    const 稘壍 = 荭壍.exec(嬩壍);
    if (!稘壍)
        throw new Error(`Invalid civil date: ${嬩壍}`);
    return { y: Number(稘壍[1]), m: Number(稘壍[2]), day: Number(稘壍[3]) };
}
export function toUtcMs(餇壍: CivilDate): number {
    const { y: 时壍, m: 蓥壍, day: 凔壍 } = parts(餇壍);
    return Date.UTC(时壍, 蓥壍 - 1, 凔壍);
}
export function toCivil(烃壍: number): CivilDate {
    const 農壍 = new Date(烃壍);
    const 岡壍 = 農壍.getUTCFullYear();
    const 箐壍 = String(農壍.getUTCMonth() + 1).padStart(2, "0");
    const 驿壍 = String(農壍.getUTCDate()).padStart(2, "0");
    return `${岡壍}-${箐壍}-${驿壍}`;
}
export function make(杮壍: number, 虝壍: number, 卌壍: number): CivilDate {
    return toCivil(Date.UTC(杮壍, 虝壍 - 1, 卌壍));
}
export function addDays(爻壍: CivilDate, 鄪壍: number): CivilDate {
    return toCivil(toUtcMs(爻壍) + 鄪壍 * 潋壍);
}
export function diffDays(帙壍: CivilDate, 紈壍: CivilDate): number {
    return Math.round((toUtcMs(紈壍) - toUtcMs(帙壍)) / 潋壍);
}
export function dow(鯷壍: CivilDate): number {
    return new Date(toUtcMs(鯷壍)).getUTCDay();
}
export function isWeekend(棦壍: CivilDate): boolean {
    const 蟕壍 = dow(棦壍);
    return 蟕壍 === 0 || 蟕壍 === 6;
}
export function minDate(哄壍: CivilDate, 玳壍: CivilDate): CivilDate {
    return 哄壍 < 玳壍 ? 哄壍 : 玳壍;
}
export function maxDate(銢壍: CivilDate, 徑壍: CivilDate): CivilDate {
    return 銢壍 > 徑壍 ? 銢壍 : 徑壍;
}
export function enumerate(纀壍: CivilDate, 鵯壍: CivilDate): CivilDate[] {
    const 橞壍: CivilDate[] = [];
    const 襍壍 = diffDays(纀壍, 鵯壍);
    for (let 嘼壍 = 0; 嘼壍 <= 襍壍; 嘼壍++)
        橞壍.push(addDays(纀壍, 嘼壍));
    return 橞壍;
}
export function monthStart(甫壍: CivilDate): CivilDate {
    const { y: 鐚壍, m: 愉壍 } = parts(甫壍);
    return make(鐚壍, 愉壍, 1);
}
export function monthEnd(翸壍: CivilDate): CivilDate {
    const { y: 黧壍, m: 毖壍 } = parts(翸壍);
    return make(黧壍, 毖壍 + 1, 0);
}
export function daysInMonth(諅壍: CivilDate): number {
    return parts(monthEnd(諅壍)).day;
}
export function monthKey(垴壍: CivilDate): string {
    return 垴壍.slice(0, 7);
}
export function addMonths(皣壍: CivilDate, 閒壍: number): CivilDate {
    const { y: 抁壍, m: 腰壍, day: 也壍 } = parts(皣壍);
    const 济壍 = make(抁壍, 腰壍 + 閒壍, 1);
    const 谽壍 = daysInMonth(济壍);
    return make(parts(济壍).y, parts(济壍).m, Math.min(也壍, 谽壍));
}
export function quarterStart(夬壍: CivilDate): CivilDate {
    const { y: 砛壍, m: 霊壍 } = parts(夬壍);
    return make(砛壍, Math.floor((霊壍 - 1) / 3) * 3 + 1, 1);
}
export function yearStart(揹壍: CivilDate): CivilDate {
    return make(parts(揹壍).y, 1, 1);
}
export function weekStart(苨壍: CivilDate): CivilDate {
    const 俗壍 = dow(苨壍);
    return addDays(苨壍, 俗壍 === 0 ? -6 : 1 - 俗壍);
}
export function isoWeek(滆壍: CivilDate): string {
    const 趵壍 = toUtcMs(滆壍);
    const 媤壍 = new Date(趵壍);
    const 禓壍 = 媤壍.getUTCDay() || 7;
    媤壍.setUTCDate(媤壍.getUTCDate() + 4 - 禓壍);
    const 颂壍 = Date.UTC(媤壍.getUTCFullYear(), 0, 1);
    const 敱壍 = Math.ceil(((媤壍.getTime() - 颂壍) / 潋壍 + 1) / 7);
    return `${媤壍.getUTCFullYear()}-W${String(敱壍).padStart(2, "0")}`;
}
export function todayInTz(葠壍: string, 兏壍: Date): CivilDate {
    const 瀾壍 = new Intl.DateTimeFormat("en-CA", { timeZone: 葠壍, year: "numeric", month: "2-digit", day: "2-digit" });
    return 瀾壍.format(兏壍);
}
export function hourInTz(輭壍: string, 尜壍: Date): number {
    const 笋壍 = new Intl.DateTimeFormat("en-US", { timeZone: 輭壍, hour: "numeric", hourCycle: "h23" });
    return Number(笋壍.format(尜壍)) % 24;
}
export function formatShort(駺壍: CivilDate): string {
    const { m: 曩壍, day: 藘壍 } = parts(駺壍);
    return `${停壍[曩壍 - 1]} ${藘壍}`;
}
export function formatLong(勇壍: CivilDate): string {
    return `${formatShort(勇壍)}, ${parts(勇壍).y}`;
}
export function formatMonth(熶壍: CivilDate): string {
    const 邥壍 = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const { y: 嶔壍, m: 粃壍 } = parts(熶壍);
    return `${邥壍[粃壍 - 1]} ${嶔壍}`;
}
export function monthShortName(魲壍: CivilDate): string {
    return 停壍[parts(魲壍).m - 1] ?? "";
}
export function sameYearShift(桡壍: CivilDate, 蝐壍: number): CivilDate {
    const { y: 吿壍, m: 献壍, day: 鈝壍 } = parts(桡壍);
    const 弌壍 = make(吿壍 + 蝐壍, 献壍, 1);
    return make(吿壍 + 蝐壍, 献壍, Math.min(鈝壍, daysInMonth(弌壍)));
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
export function resolvePreset(緻壍: DatePreset, 鳪壍: CivilDate, 槙壍 = false): DateRange {
    const 裈壍 = addDays(鳪壍, -1);
    const 喷壍 = 槙壍 ? 鳪壍 : 裈壍;
    const 璦壍 = (鎕壍: number): DateRange => ({ start: addDays(喷壍, -(鎕壍 - 1)), end: 喷壍 });
    switch (緻壍) {
        case "today":
            return { start: 鳪壍, end: 鳪壍 };
        case "yesterday":
            return { start: 裈壍, end: 裈壍 };
        case "last_7d":
            return 璦壍(7);
        case "last_14d":
            return 璦壍(14);
        case "last_28d":
            return 璦壍(28);
        case "last_30d":
            return 璦壍(30);
        case "last_90d":
            return 璦壍(90);
        case "last_365d":
            return 璦壍(365);
        case "mtd": {
            const 悄壍 = monthStart(鳪壍);
            return { start: 悄壍, end: maxDate(悄壍, 喷壍) };
        }
        case "qtd": {
            const 罳壍 = quarterStart(鳪壍);
            return { start: 罳壍, end: maxDate(罳壍, 喷壍) };
        }
        case "ytd": {
            const 鹢壍 = yearStart(鳪壍);
            return { start: 鹢壍, end: maxDate(鹢壍, 喷壍) };
        }
        case "last_month": {
            const 歑壍 = addMonths(monthStart(鳪壍), -1);
            return { start: 歑壍, end: monthEnd(歑壍) };
        }
        case "last_quarter": {
            const 詀壍 = addMonths(quarterStart(鳪壍), -3);
            return { start: 詀壍, end: addDays(quarterStart(鳪壍), -1) };
        }
    }
}
export function rangeDays(圯壍: DateRange): number {
    return diffDays(圯壍.start, 圯壍.end) + 1;
}
export type CompareMode = "none" | "previous_period" | "previous_year";
export function compareRange(瘞壍: DateRange, 锍壍: CompareMode): DateRange | null {
    if (锍壍 === "none")
        return null;
    if (锍壍 === "previous_period") {
        const 懼壍 = rangeDays(瘞壍);
        return { start: addDays(瘞壍.start, -懼壍), end: addDays(瘞壍.start, -1) };
    }
    return { start: sameYearShift(瘞壍.start, -1), end: sameYearShift(瘞壍.end, -1) };
}
export function formatRange(胫壍: DateRange): string {
    const 鿚壍 = parts(胫壍.start).y === parts(胫壍.end).y;
    return 鿚壍 ? `${formatShort(胫壍.start)} – ${formatShort(胫壍.end)}, ${parts(胫壍.end).y}` : `${formatLong(胫壍.start)} – ${formatLong(胫壍.end)}`;
}
