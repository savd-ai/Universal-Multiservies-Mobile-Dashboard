import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type PacingReport, type PacingRow, type PacingStatus } from "@/lib/domain/contracts/budget";
import { pausedNote } from "@/lib/domain/budget/pacing";
import { formatShort } from "@/lib/domain/dates";
import { money, moneyExact } from "./money";
import { monthName } from "./months";
export interface Thresholds {
    over: number;
    under: number;
}
export const DEFAULT_THRESHOLDS: Thresholds = { over: 1.05, under: 0.9 };
export interface PacingView extends PacingRow {
    target: number;
    savedTarget: number;
    edited: boolean;
    lockedNow: boolean;
    lockEdited: boolean;
    shared: boolean;
    spentShare: number;
    projectedShare: number;
}
export function paceStatus(row: Pick<PacingRow, "status" | "paused">, target: number, projected: number, t: Thresholds): PacingStatus {
    if (row.status === "unsupported_period")
        return "unsupported_period";
    if (row.paused)
        return "paused";
    if (target <= 0)
        return "no_budget";
    const ratio = projected / target;
    if (ratio > t.over)
        return "overpacing";
    if (ratio < t.under)
        return "underpacing";
    return "on_track";
}
export function draftNote(row: PacingRow, target: number, status: PacingStatus, recommendedDaily: number | null, remainingDays: number, currency: string): string {
    const m = (v: number) => moneyExact(v, currency);
    let note: string;
    if (status === "unsupported_period")
        return row.recommendationNote;
    if (status === "paused")
        return pausedNote(row.mtdSpend, target, remainingDays, m);
    if (status === "no_budget")
        note = "No budget set — add a monthly target to track pacing.";
    else if (remainingDays === 0)
        note = `Month complete — spent ${m(row.mtdSpend)} of ${m(target)} (${Math.round((row.projected / target) * 100)}%).`;
    else if (status === "overpacing")
        note = `Lower the daily budget to ${m(recommendedDaily ?? 0)} to land on ${m(target)}.`;
    else if (status === "underpacing")
        note = row.budgetLimited
            ? `Raise the daily budget to ${m(recommendedDaily ?? 0)} to use the full ${m(target)}.`
            : `Spending below target: ${m(recommendedDaily ?? 0)}/day would use the full budget, but a higher budget alone won't add volume unless the campaign is budget-limited.`;
    else
        note = `On track — ${m(recommendedDaily ?? 0)}/day lands on ${m(target)}.`;
    if (row.capped && remainingDays > 0)
        note += ` Expected spend is limited by Google's caps (${DAILY_OVERDELIVERY_FACTOR}× the daily budget per day, ${MONTHLY_CAP_FACTOR}× per month).`;
    return note;
}
export function derivePacingRow(row: PacingRow, report: Pick<PacingReport, "daysInMonth" | "elapsedDays" | "remainingDays">, opts: {
    target: number;
    savedTarget: number;
    locked: boolean;
    savedLocked: boolean;
    thresholds: Thresholds;
    currency: string;
}): PacingView {
    const { target, savedTarget } = opts;
    const edited = Math.abs(target - savedTarget) >= 0.005;
    const shared = row.type === "Shared" || row.campaignIds.length > 1;
    const base = { ...row, target, savedTarget, edited, lockedNow: opts.locked, lockEdited: opts.locked !== opts.savedLocked, shared };
    const shares = (t: number) => ({ spentShare: t > 0 ? Math.min(1, row.mtdSpend / t) : 0, projectedShare: t > 0 ? Math.min(1, row.projected / t) : 0 });
    if (!edited && Math.abs(row.monthlyTarget - target) < 0.005)
        return { ...base, ...shares(target) };
    const status = paceStatus(row, target, row.projected, opts.thresholds);
    const remaining = report.remainingDays;
    const recommendedDaily = remaining > 0 && target > 0 && status !== "unsupported_period" && status !== "paused" ? Math.round(Math.max(0, (target - row.mtdSpend) / remaining) * 100) / 100 : null;
    const idealToDate = Math.round(((target * report.elapsedDays) / report.daysInMonth) * 100) / 100;
    return {
        ...base,
        ...shares(target),
        monthlyTarget: target,
        paceRatio: target > 0 ? Math.round((row.projected / target) * 10000) / 10000 : 0,
        status,
        idealToDate,
        utilization: idealToDate > 0 ? Math.round((row.mtdSpend / idealToDate) * 10000) / 10000 : 0,
        recommendedDaily,
        recommendationNote: draftNote(row, target, status, recommendedDaily, remaining, opts.currency),
    };
}
export interface PacingTotals {
    target: number;
    mtd: number;
    projected: number;
    paceRatio: number;
    overCount: number;
    underCount: number;
    campaigns: number;
    sharedBudgets: number;
}
export function pacingTotals(views: readonly PacingView[]): PacingTotals {
    const target = views.reduce((s, v) => s + v.target, 0);
    const mtd = views.reduce((s, v) => s + v.mtdSpend, 0);
    const projected = views.reduce((s, v) => s + v.projected, 0);
    return {
        target,
        mtd,
        projected,
        paceRatio: target > 0 ? projected / target : 0,
        overCount: views.filter((v) => v.status === "overpacing").length,
        underCount: views.filter((v) => v.status === "underpacing").length,
        campaigns: views.reduce((s, v) => s + v.campaignIds.length, 0),
        sharedBudgets: views.filter((v) => v.shared).length,
    };
}
export interface StatCardModel {
    label: string;
    value: string;
    caption: string;
    tone?: "accent" | "warn";
}
export function budgetStats(report: Pick<PacingReport, "month" | "daysInMonth" | "elapsedDays" | "remainingDays">, totals: PacingTotals, t: Thresholds, currency: string): StatCardModel[] {
    const { daysInMonth: dim, elapsedDays: elapsed, remainingDays: remaining } = report;
    const pct = totals.target > 0 ? Math.round((totals.mtd / totals.target) * 100) : 0;
    const campaignsCaption = `${totals.campaigns} campaign${totals.campaigns === 1 ? "" : "s"}${totals.sharedBudgets ? ` · ${totals.sharedBudgets} shared budget${totals.sharedBudgets === 1 ? "" : "s"}` : ""}`;
    const spentCaption = elapsed === 0 ? `Starts ${formatShort(`${report.month}-01`)} · ${dim} days` : remaining === 0 ? `${pct}% used · month complete` : `${pct}% used · ${elapsed} of ${dim} days`;
    const over = totals.projected > totals.target;
    const gap = Math.abs(totals.projected - totals.target);
    return [
        { label: `${monthName(report.month)} budget`, value: money(totals.target, currency), caption: campaignsCaption },
        { label: "Spent to date", value: money(totals.mtd, currency), caption: spentCaption },
        {
            label: remaining === 0 ? "Month-end spend" : "Projected month-end",
            value: money(totals.projected, currency),
            caption: over ? `${money(gap, currency)} over budget` : `${money(gap, currency)} ${remaining === 0 ? "unspent" : "headroom"}`,
            tone: totals.paceRatio > t.over ? "warn" : "accent",
        },
        { label: "Overpacing campaigns", value: String(totals.overCount), caption: `Projected above ${Math.round(t.over * 100)}% of budget` },
    ];
}
export function todayMarker(report: Pick<PacingReport, "daysInMonth" | "elapsedDays">): number | undefined {
    return report.elapsedDays > 0 && report.elapsedDays < report.daysInMonth ? report.elapsedDays / report.daysInMonth : undefined;
}
export interface CumulativeSeries {
    dates: string[];
    actual: (number | null)[];
    projected: (number | null)[];
    ideal: number[];
    total: number;
    max: number;
}
export function cumulativeSeries(report: Pick<PacingReport, "cumulative" | "daysInMonth">, total: number, projectedTotal: number): CumulativeSeries {
    const dim = report.daysInMonth || report.cumulative.length || 1;
    return {
        dates: report.cumulative.map((c) => c.date),
        actual: report.cumulative.map((c) => c.actual),
        projected: report.cumulative.map((c) => c.projected),
        ideal: report.cumulative.map((_, i) => Math.round(((total * (i + 1)) / dim) * 100) / 100),
        total,
        max: Math.max(total, projectedTotal, 1) * 1.1,
    };
}
export function weeklyTicks(n: number): Set<number> {
    const out = new Set<number>();
    for (let i = 0; i < n; i += 7)
        if (n - 1 - i >= 4 || i === 0)
            out.add(i);
    if (n > 0)
        out.add(n - 1);
    return out;
}
export function evenTicks(n: number, count = 6): Set<number> {
    if (n <= count)
        return new Set(Array.from({ length: n }, (_, i) => i));
    return new Set(Array.from({ length: count }, (_, j) => Math.round(((n - 1) * j) / (count - 1))));
}
export interface BudgetChange {
    unitId: string;
    campaignId: string;
    name: string;
    from: number | null;
    to: number;
}
export interface SkippedChange {
    name: string;
    reason: string;
}
export function recommendedChanges(views: readonly PacingView[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const changes: BudgetChange[] = [];
    const skipped: SkippedChange[] = [];
    for (const v of views) {
        const campaignId = v.campaignIds[0];
        if (v.shared || !campaignId || v.campaignIds.length !== 1)
            skipped.push({ name: v.name, reason: "Shared budget — edit it in Google Ads (Shared library)" });
        else if (v.status === "unsupported_period")
            skipped.push({ name: v.name, reason: "Custom-period budget" });
        else if (v.paused)
            skipped.push({ name: v.name, reason: "Paused" });
        else if (v.recommendedDaily === null || v.recommendedDaily <= 0)
            skipped.push({ name: v.name, reason: "No recommendation" });
        else if (v.dailyBudget !== null && Math.abs(v.recommendedDaily - v.dailyBudget) < 0.01)
            skipped.push({ name: v.name, reason: "Already at the recommended budget" });
        else
            changes.push({ unitId: v.unitId, campaignId, name: v.name, from: v.dailyBudget, to: Math.round(v.recommendedDaily * 100) / 100 });
    }
    return { changes, skipped };
}
