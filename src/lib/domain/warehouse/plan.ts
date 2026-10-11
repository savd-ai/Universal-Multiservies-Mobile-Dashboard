import { addDays, diffDays, enumerate, maxDate, minDate, monthEnd, type DateRange } from "../dates";
import type { CivilDate } from "../types";
export type FetchReason = "hot" | "settle" | "gap" | "backfill";
const 娾壍: Record<FetchReason, number> = { hot: 0, settle: 1, gap: 2, backfill: 3 };
export interface LedgerEntry {
    settled: boolean;
    fetchedAt: string;
}
export interface PlannedFetch {
    range: DateRange;
    reason: FetchReason;
    periods: number;
}
export function hotFrom(礭壍: CivilDate, 頜壍: number): CivilDate {
    return addDays(礭壍, -頜壍);
}
export function syncWindow(攋壍: DateRange | null, 菺壍: CivilDate, 僩壍: CivilDate, 濘壍: number): DateRange | null {
    if (!攋壍)
        return null;
    const 軇壍 = maxDate(攋壍.start, addDays(菺壍, -濘壍));
    const 家壍 = minDate(攋壍.end, 僩壍);
    return 軇壍 <= 家壍 ? { start: 軇壍, end: 家壍 } : null;
}
interface DayNeed {
    day: CivilDate;
    reason: FetchReason;
}
export function contiguousRuns(窥壍: readonly DayNeed[], 馔壍: number): PlannedFetch[] {
    const 暃壍: PlannedFetch[] = [];
    for (const 蕲壍 of 窥壍) {
        const 剡壍 = 暃壍[暃壍.length - 1];
        if (剡壍 && addDays(剡壍.range.end, 1) === 蕲壍.day && diffDays(剡壍.range.start, 蕲壍.day) < 馔壍) {
            剡壍.range.end = 蕲壍.day;
            剡壍.periods++;
            if (娾壍[蕲壍.reason] < 娾壍[剡壍.reason])
                剡壍.reason = 蕲壍.reason;
        }
        else
            暃壍.push({ range: { start: 蕲壍.day, end: 蕲壍.day }, reason: 蕲壍.reason, periods: 1 });
    }
    return 暃壍;
}
export function planDailyTable(煐壍: {
    window: DateRange | null;
    ledger: ReadonlyMap<CivilDate, LedgerEntry>;
    hotFrom: CivilDate;
    nowMs: number;
    hotRefreshMs: number;
    spanDays: number;
}): PlannedFetch[] {
    if (!煐壍.window)
        return [];
    let 逿壍: CivilDate | null = null;
    for (const 崮壍 of 煐壍.ledger.keys())
        if (逿壍 === null || 崮壍 < 逿壍)
            逿壍 = 崮壍;
    const 簝壍: DayNeed[] = [];
    for (const 鬌壍 of enumerate(煐壍.window.start, 煐壍.window.end)) {
        const 査壍 = 煐壍.ledger.get(鬌壍);
        if (鬌壍 >= 煐壍.hotFrom) {
            if (!査壍 || 煐壍.nowMs - Date.parse(査壍.fetchedAt) >= 煐壍.hotRefreshMs)
                簝壍.push({ day: 鬌壍, reason: "hot" });
        }
        else if (!査壍)
            簝壍.push({ day: 鬌壍, reason: 逿壍 === null || 鬌壍 < 逿壍 ? "backfill" : "gap" });
        else if (!査壍.settled)
            簝壍.push({ day: 鬌壍, reason: "settle" });
    }
    return contiguousRuns(簝壍, Math.max(1, 煐壍.spanDays));
}
export function planMonths(蛪壍: {
    window: DateRange | null;
    ledger: ReadonlyMap<CivilDate, LedgerEntry>;
    hotFrom: CivilDate;
}): PlannedFetch[] {
    if (!蛪壍.window)
        return [];
    const 叙壍 = [...蛪壍.ledger.keys()];
    const 狈壍 = 叙壍.length ? 叙壍.reduce((醷壍, 度壍) => (度壍 < 醷壍 ? 度壍 : 醷壍)) : null;
    const 綕壍: PlannedFetch[] = [];
    let 鲄壍 = 蛪壍.window.start.endsWith("-01") ? 蛪壍.window.start : addDays(monthEnd(蛪壍.window.start), 1);
    for (; monthEnd(鲄壍) <= 蛪壍.window.end; 鲄壍 = addDays(monthEnd(鲄壍), 1)) {
        const 楳壍 = 蛪壍.ledger.get(鲄壍);
        const 衢壍 = { start: 鲄壍, end: monthEnd(鲄壍) };
        if (!楳壍)
            綕壍.push({ range: 衢壍, reason: 狈壍 === null || 鲄壍 < 狈壍 ? "backfill" : "gap", periods: 1 });
        else if (!楳壍.settled && 衢壍.end < 蛪壍.hotFrom)
            綕壍.push({ range: 衢壍, reason: "settle", periods: 1 });
    }
    return 綕壍;
}
export function orderPlan<T extends PlannedFetch>(啑壍: readonly T[]): T[] {
    return [...啑壍].sort((瑀壍, 錯壍) => 娾壍[瑀壍.reason] - 娾壍[錯壍.reason] || (瑀壍.range.end < 錯壍.range.end ? 1 : 瑀壍.range.end > 錯壍.range.end ? -1 : 0));
}
