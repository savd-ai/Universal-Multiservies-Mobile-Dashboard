import { addDays, diffDays, enumerate, maxDate, minDate, monthEnd, type DateRange } from "../dates";
import type { CivilDate } from "../types";
export type FetchReason = "hot" | "settle" | "gap" | "backfill";
const PRIORITY: Record<FetchReason, number> = { hot: 0, settle: 1, gap: 2, backfill: 3 };
export interface LedgerEntry {
    settled: boolean;
    fetchedAt: string;
}
export interface PlannedFetch {
    range: DateRange;
    reason: FetchReason;
    periods: number;
}
export function hotFrom(today: CivilDate, restatementDays: number): CivilDate {
    return addDays(today, -restatementDays);
}
export function syncWindow(coverage: DateRange | null, today: CivilDate, dataThrough: CivilDate, backfillDays: number): DateRange | null {
    if (!coverage)
        return null;
    const start = maxDate(coverage.start, addDays(today, -backfillDays));
    const end = minDate(coverage.end, dataThrough);
    return start <= end ? { start, end } : null;
}
interface DayNeed {
    day: CivilDate;
    reason: FetchReason;
}
export function contiguousRuns(needs: readonly DayNeed[], maxSpan: number): PlannedFetch[] {
    const runs: PlannedFetch[] = [];
    for (const n of needs) {
        const last = runs[runs.length - 1];
        if (last && addDays(last.range.end, 1) === n.day && diffDays(last.range.start, n.day) < maxSpan) {
            last.range.end = n.day;
            last.periods++;
            if (PRIORITY[n.reason] < PRIORITY[last.reason])
                last.reason = n.reason;
        }
        else
            runs.push({ range: { start: n.day, end: n.day }, reason: n.reason, periods: 1 });
    }
    return runs;
}
export function planDailyTable(p: {
    window: DateRange | null;
    ledger: ReadonlyMap<CivilDate, LedgerEntry>;
    hotFrom: CivilDate;
    nowMs: number;
    hotRefreshMs: number;
    spanDays: number;
}): PlannedFetch[] {
    if (!p.window)
        return [];
    let oldestStored: CivilDate | null = null;
    for (const d of p.ledger.keys())
        if (oldestStored === null || d < oldestStored)
            oldestStored = d;
    const needs: DayNeed[] = [];
    for (const day of enumerate(p.window.start, p.window.end)) {
        const entry = p.ledger.get(day);
        if (day >= p.hotFrom) {
            if (!entry || p.nowMs - Date.parse(entry.fetchedAt) >= p.hotRefreshMs)
                needs.push({ day, reason: "hot" });
        }
        else if (!entry)
            needs.push({ day, reason: oldestStored === null || day < oldestStored ? "backfill" : "gap" });
        else if (!entry.settled)
            needs.push({ day, reason: "settle" });
    }
    return contiguousRuns(needs, Math.max(1, p.spanDays));
}
export function planMonths(p: {
    window: DateRange | null;
    ledger: ReadonlyMap<CivilDate, LedgerEntry>;
    hotFrom: CivilDate;
}): PlannedFetch[] {
    if (!p.window)
        return [];
    const keys = [...p.ledger.keys()];
    const oldestStored = keys.length ? keys.reduce((a, b) => (b < a ? b : a)) : null;
    const out: PlannedFetch[] = [];
    let m = p.window.start.endsWith("-01") ? p.window.start : addDays(monthEnd(p.window.start), 1);
    for (; monthEnd(m) <= p.window.end; m = addDays(monthEnd(m), 1)) {
        const entry = p.ledger.get(m);
        const range = { start: m, end: monthEnd(m) };
        if (!entry)
            out.push({ range, reason: oldestStored === null || m < oldestStored ? "backfill" : "gap", periods: 1 });
        else if (!entry.settled && range.end < p.hotFrom)
            out.push({ range, reason: "settle", periods: 1 });
    }
    return out;
}
export function orderPlan<T extends PlannedFetch>(fetches: readonly T[]): T[] {
    return [...fetches].sort((a, b) => PRIORITY[a.reason] - PRIORITY[b.reason] || (a.range.end < b.range.end ? 1 : a.range.end > b.range.end ? -1 : 0));
}
