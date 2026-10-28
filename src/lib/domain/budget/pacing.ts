import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type PacingReport, type PacingRow, type PacingStatus } from "../contracts/budget";
import { addDays, daysInMonth, diffDays, dow, enumerate, formatMonth, formatShort, isCivilDate, minDate, monthEnd, monthKey } from "../dates";
import { formatMoney } from "../metrics/registry";
import type { CampaignDailyRow, CampaignDim } from "../schema/facts";
import { round, roundTo } from "../stats";
import type { CivilDate } from "../types";
import { budgetUnits, DailyIndex, weekdayFactors, type BudgetUnit } from "./units";
export const PACE_OVER = 1.05;
export const PACE_UNDER = 0.9;
const BUDGET_LIMITED_LOST_IS = 0.2;
export interface PacingInput {
    month: string;
    dataThrough: CivilDate;
    campaigns: readonly CampaignDim[];
    rows: readonly CampaignDailyRow[];
    targets?: Record<string, number>;
    locks?: Record<string, boolean>;
    currency?: string;
    thresholds?: {
        over?: number;
        under?: number;
    };
}
export const isMonthKey = (m: string) => /^\d{4}-\d{2}$/.test(m) && isCivilDate(`${m}-01`);
export function defaultMonthlyTarget(daily: number | null, month: string): number {
    return daily ? round(daily * daysInMonth(`${month}-01`), 2) : 0;
}
export function defaultUnitTarget(unit: Pick<BudgetUnit, "dailyBudget" | "paused">, month: string, mtdSpend: number): number {
    return unit.paused ? round(mtdSpend, 2) : defaultMonthlyTarget(unit.dailyBudget, month);
}
export function pausedNote(mtdSpend: number, target: number, remainingDays: number, money: (v: number) => string): string {
    const spent = mtdSpend > 0 ? `spent ${money(mtdSpend)}` : "nothing spent";
    let note = remainingDays > 0 ? `Paused — ${spent} so far this month; no further spend expected.` : `Paused — ${spent} in the month.`;
    if (target - mtdSpend >= 1)
        note += ` ${money(target - mtdSpend)} of the ${money(target)} target stays unused.`;
    return note;
}
export interface UnitPacing {
    row: PacingRow;
    unit: BudgetUnit;
    defaultTarget: number;
    expectedByDate: Map<CivilDate, number>;
}
export function buildPacingReport(input: PacingInput): PacingReport {
    return pacingDetail(input).report;
}
export function pacingDetail(input: PacingInput): {
    report: PacingReport;
    units: UnitPacing[];
} {
    const over = input.thresholds?.over ?? PACE_OVER;
    const under = input.thresholds?.under ?? PACE_UNDER;
    const currency = input.currency ?? "USD";
    const money = (v: number) => formatMoney(v, { currency, compact: false, decimals: 0 });
    const mStart = `${input.month}-01`;
    const mEnd = monthEnd(mStart);
    const dim = daysInMonth(mStart);
    const elapsedEnd = minDate(mEnd, input.dataThrough);
    const elapsed = input.dataThrough < mStart ? 0 : diffDays(mStart, elapsedEnd) + 1;
    const remaining = dim - elapsed;
    const idx = new DailyIndex(input.rows);
    const futureDates = remaining > 0 ? enumerate(elapsed > 0 ? addDays(elapsedEnd, 1) : mStart, mEnd) : [];
    const rateEnd = elapsed > 0 ? elapsedEnd : input.dataThrough;
    const spentThisMonth = new Set<string>();
    if (elapsed > 0)
        for (const id of idx.campaigns())
            if (idx.sum([id], mStart, elapsedEnd).cost > 0)
                spentThisMonth.add(id);
    const units = budgetUnits(input.campaigns, spentThisMonth);
    const allIds = units.flatMap((u) => u.campaignIds);
    const out: UnitPacing[] = [];
    for (const unit of units) {
        const ids = unit.campaignIds;
        const mtdFacts = elapsed > 0 ? idx.sum(ids, mStart, elapsedEnd) : idx.sum(ids, mStart, addDays(mStart, -1));
        const mtd = round(mtdFacts.cost, 2);
        const last7 = idx.sum(ids, addDays(rateEnd, -6), rateEnd);
        const avg7 = last7.cost / 7;
        const factors = weekdayFactors((d) => idx.day(ids, d).cost, rateEnd);
        const daily = unit.dailyBudget;
        const perDayCap = daily ? daily * DAILY_OVERDELIVERY_FACTOR : Number.POSITIVE_INFINITY;
        const raw = futureDates.map((d) => (unit.paused ? 0 : Math.min(perDayCap, avg7 * (factors[dow(d)] ?? 1))));
        const projected = round(mtd + raw.reduce((a, b) => a + b, 0), 2);
        const expectedByDate = new Map(futureDates.map((d, i) => [d, raw[i] ?? 0] as const));
        let capHit: CivilDate | null = null;
        if (daily && unit.period === "daily" && remaining > 0 && !unit.paused) {
            const monthCap = daily * MONTHLY_CAP_FACTOR;
            let run = mtd;
            for (let i = 0; i < futureDates.length - 1 && !capHit; i++) {
                run += raw[i] ?? 0;
                if (run >= monthCap)
                    capHit = futureDates[i] as CivilDate;
            }
        }
        const capped = capHit !== null || raw.some((v) => v >= perDayCap);
        const defaultTarget = defaultUnitTarget(unit, input.month, mtd);
        const target = round(input.targets?.[unit.unitId] ?? defaultTarget, 2);
        const paceRatio = target > 0 ? projected / target : 0;
        let status: PacingStatus;
        if (unit.period === "custom")
            status = "unsupported_period";
        else if (unit.paused)
            status = "paused";
        else if (target <= 0)
            status = "no_budget";
        else if (paceRatio > over)
            status = "overpacing";
        else if (paceRatio < under)
            status = "underpacing";
        else
            status = "on_track";
        const idealToDate = round((target * elapsed) / dim, 2);
        const recommendedDaily = remaining > 0 && target > 0 && status !== "unsupported_period" && status !== "paused" ? round(Math.max(0, (target - mtd) / remaining), 2) : null;
        const lostShare = last7.is_eligible > 0 ? last7.is_lost_budget / last7.is_eligible : 0;
        const budgetLimited = lostShare > BUDGET_LIMITED_LOST_IS;
        const expectedDaily = futureDates.length ? round((projected - mtd) / futureDates.length, 2) : round(avg7, 2);
        const defaultMonthly = daily ? daily * dim : target;
        let note: string;
        if (status === "unsupported_period")
            note = "Custom-period budget — pacing isn't supported; manage it in Google Ads.";
        else if (status === "paused")
            note = pausedNote(mtd, target, remaining, money);
        else if (status === "no_budget")
            note = "No budget set — add a monthly target to track pacing.";
        else if (remaining === 0)
            note = `Month complete — spent ${money(mtd)} of ${money(target)} (${Math.round(paceRatio * 100)}%).`;
        else if (status === "overpacing")
            note = `Lower the daily budget to ${money(recommendedDaily ?? 0)} to land on ${money(target)}.`;
        else if (status === "underpacing")
            note = budgetLimited
                ? `Raise the daily budget to ${money(recommendedDaily ?? 0)} to use the full ${money(target)}.`
                : `Spending below target: ${money(recommendedDaily ?? 0)}/day would use the full budget, but a higher budget alone won't add volume unless the campaign is budget-limited.`;
        else
            note = `On track — ${money(recommendedDaily ?? 0)}/day lands on ${money(target)}.`;
        if (capHit && daily)
            note += ` At this rate spend reaches Google's monthly charging limit (${money(daily * MONTHLY_CAP_FACTOR)} = ${MONTHLY_CAP_FACTOR} × daily) around ${formatShort(capHit)}, after which ads stop for the month.`;
        else if (capped && remaining > 0)
            note += ` Expected spend is limited to ${DAILY_OVERDELIVERY_FACTOR}× the daily budget per day.`;
        out.push({
            unit,
            defaultTarget,
            expectedByDate,
            row: {
                unitId: unit.unitId,
                campaignIds: ids,
                name: unit.name,
                type: unit.type,
                dailyBudget: daily,
                monthlyTarget: target,
                mtdSpend: mtd,
                avg7: round(avg7, 2),
                expectedDaily,
                projected,
                paceRatio: round(paceRatio, 4),
                status,
                idealToDate,
                utilization: idealToDate > 0 ? round(mtd / idealToDate, 4) : 0,
                budgetLimited,
                recommendedDaily,
                recommendationNote: note,
                roasMtd: mtdFacts.cost > 0 ? round(mtdFacts.conv_value / mtdFacts.cost, 4) : null,
                cpaMtd: mtdFacts.conversions > 0 ? round(mtdFacts.cost / mtdFacts.conversions, 2) : null,
                sliderMin: roundTo(defaultMonthly * 0.3, 50),
                sliderMax: Math.max(roundTo(defaultMonthly * 2, 50), roundTo(target, 50)),
                locked: input.locks?.[unit.unitId] ? true : undefined,
                paused: unit.paused || undefined,
                capped: capped || undefined,
            },
        });
    }
    out.sort((a, b) => Number(a.row.status === "paused") - Number(b.row.status === "paused"));
    const rows = out.map((u) => u.row);
    const totalTarget = rows.reduce((s, r) => s + r.monthlyTarget, 0);
    const totalMtd = rows.reduce((s, r) => s + r.mtdSpend, 0);
    const totalProjected = rows.reduce((s, r) => s + r.projected, 0);
    const cumulative: PacingReport["cumulative"] = [];
    let actual = 0;
    let projectedRun = 0;
    enumerate(mStart, mEnd).forEach((d, i) => {
        const ideal = round((totalTarget * (i + 1)) / dim, 2);
        if (elapsed > 0 && d <= elapsedEnd) {
            actual += idx.day(allIds, d).cost;
            projectedRun = actual;
            cumulative.push({ date: d, actual: round(actual, 2), ideal, projected: d === elapsedEnd ? round(actual, 2) : null });
            return;
        }
        projectedRun += out.reduce((s, u) => s + (u.expectedByDate.get(d) ?? 0), 0);
        cumulative.push({ date: d, actual: null, ideal, projected: round(projectedRun, 2) });
    });
    return {
        report: {
            month: input.month,
            monthLabel: formatMonth(mStart),
            daysInMonth: dim,
            elapsedDays: elapsed,
            remainingDays: remaining,
            anchor: input.dataThrough,
            rows,
            totals: {
                monthlyTarget: round(totalTarget, 2),
                mtdSpend: round(totalMtd, 2),
                projected: round(totalProjected, 2),
                paceRatio: totalTarget > 0 ? round(totalProjected / totalTarget, 4) : 0,
                idealToDate: round(rows.reduce((s, r) => s + r.idealToDate, 0), 2),
                overpacingCount: rows.filter((r) => r.status === "overpacing").length,
                underpacingCount: rows.filter((r) => r.status === "underpacing").length,
            },
            cumulative,
        },
        units: out,
    };
}
export function suggestionMonth(month: string, dataThrough: CivilDate): string | null {
    const before = monthKey(addDays(`${month}-01`, -1));
    const lastComplete = monthEnd(dataThrough) === dataThrough ? monthKey(dataThrough) : monthKey(addDays(`${monthKey(dataThrough)}-01`, -1));
    const source = before < lastComplete ? before : lastComplete;
    return source < month ? source : null;
}
export function spendTargets(units: readonly BudgetUnit[], rows: readonly CampaignDailyRow[], source: string, month: string): {
    month: string;
    targets: Record<string, number>;
    total: number;
} | null {
    const idx = new DailyIndex(rows);
    const start = `${source}-01`;
    const scale = daysInMonth(`${month}-01`) / daysInMonth(start);
    const targets: Record<string, number> = {};
    for (const u of units) {
        if (u.paused || u.period === "custom")
            continue;
        const spent = idx.sum(u.campaignIds, start, monthEnd(start)).cost;
        if (spent > 0)
            targets[u.unitId] = Math.max(1, Math.round(spent * scale));
    }
    const total = Object.values(targets).reduce((a, b) => a + b, 0);
    return total > 0 ? { month: source, targets, total } : null;
}
export function pacingFetchRange(month: string, dataThrough: CivilDate): {
    start: CivilDate;
    end: CivilDate;
} {
    const mStart = `${month}-01`;
    const rateEnd = dataThrough < mStart ? dataThrough : minDate(monthEnd(mStart), dataThrough);
    const start = minDate(mStart, addDays(rateEnd, -27));
    return { start, end: rateEnd < mStart ? dataThrough : rateEnd };
}
