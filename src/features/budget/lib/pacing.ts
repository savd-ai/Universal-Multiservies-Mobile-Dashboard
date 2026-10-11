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
export function paceStatus(爗壍: Pick<PacingRow, "status" | "paused">, 鄆壍: number, 巵壍: number, 糤壍: Thresholds): PacingStatus {
    if (爗壍.status === "unsupported_period")
        return "unsupported_period";
    if (爗壍.paused)
        return "paused";
    if (鄆壍 <= 0)
        return "no_budget";
    const 鯓壍 = 巵壍 / 鄆壍;
    if (鯓壍 > 糤壍.over)
        return "overpacing";
    if (鯓壍 < 糤壍.under)
        return "underpacing";
    return "on_track";
}
export function draftNote(棂壍: PacingRow, 螱壍: number, 咠壍: PacingStatus, 玏壍: number | null, 鉾壍: number, 彭壍: string): string {
    const 繜壍 = (鵋壍: number) => moneyExact(鵋壍, 彭壍);
    let 樺壍: string;
    if (咠壍 === "unsupported_period")
        return 棂壍.recommendationNote;
    if (咠壍 === "paused")
        return pausedNote(棂壍.mtdSpend, 螱壍, 鉾壍, 繜壍);
    if (咠壍 === "no_budget")
        樺壍 = "No budget set — add a monthly target to track pacing.";
    else if (鉾壍 === 0)
        樺壍 = `Month complete — spent ${繜壍(棂壍.mtdSpend)} of ${繜壍(螱壍)} (${Math.round((棂壍.projected / 螱壍) * 100)}%).`;
    else if (咠壍 === "overpacing")
        樺壍 = `Lower the daily budget to ${繜壍(玏壍 ?? 0)} to land on ${繜壍(螱壍)}.`;
    else if (咠壍 === "underpacing")
        樺壍 = 棂壍.budgetLimited
            ? `Raise the daily budget to ${繜壍(玏壍 ?? 0)} to use the full ${繜壍(螱壍)}.`
            : `Spending below target: ${繜壍(玏壍 ?? 0)}/day would use the full budget, but a higher budget alone won't add volume unless the campaign is budget-limited.`;
    else
        樺壍 = `On track — ${繜壍(玏壍 ?? 0)}/day lands on ${繜壍(螱壍)}.`;
    if (棂壍.capped && 鉾壍 > 0)
        樺壍 += ` Expected spend is limited by Google's caps (${DAILY_OVERDELIVERY_FACTOR}× the daily budget per day, ${MONTHLY_CAP_FACTOR}× per month).`;
    return 樺壍;
}
export function derivePacingRow(褩壍: PacingRow, 嘘壍: Pick<PacingReport, "daysInMonth" | "elapsedDays" | "remainingDays">, 甇壍: {
    target: number;
    savedTarget: number;
    locked: boolean;
    savedLocked: boolean;
    thresholds: Thresholds;
    currency: string;
}): PacingView {
    const { target: 鏶壍, savedTarget: 惥壍 } = 甇壍;
    const 翔壍 = Math.abs(鏶壍 - 惥壍) >= 0.005;
    const 黃壍 = 褩壍.type === "Shared" || 褩壍.campaignIds.length > 1;
    const 殲壍 = { ...褩壍, target: 鏶壍, savedTarget: 惥壍, edited: 翔壍, lockedNow: 甇壍.locked, lockEdited: 甇壍.locked !== 甇壍.savedLocked, shared: 黃壍 };
    const 誡壍 = (垐壍: number) => ({ spentShare: 垐壍 > 0 ? Math.min(1, 褩壍.mtdSpend / 垐壍) : 0, projectedShare: 垐壍 > 0 ? Math.min(1, 褩壍.projected / 垐壍) : 0 });
    if (!翔壍 && Math.abs(褩壍.monthlyTarget - 鏶壍) < 0.005)
        return { ...殲壍, ...誡壍(鏶壍) };
    const 癿壍 = paceStatus(褩壍, 鏶壍, 褩壍.projected, 甇壍.thresholds);
    const 镮壍 = 嘘壍.remainingDays;
    const 扝壍 = 镮壍 > 0 && 鏶壍 > 0 && 癿壍 !== "unsupported_period" && 癿壍 !== "paused" ? Math.round(Math.max(0, (鏶壍 - 褩壍.mtdSpend) / 镮壍) * 100) / 100 : null;
    const 腌壍 = Math.round(((鏶壍 * 嘘壍.elapsedDays) / 嘘壍.daysInMonth) * 100) / 100;
    return {
        ...殲壍,
        ...誡壍(鏶壍),
        monthlyTarget: 鏶壍,
        paceRatio: 鏶壍 > 0 ? Math.round((褩壍.projected / 鏶壍) * 10000) / 10000 : 0,
        status: 癿壍,
        idealToDate: 腌壍,
        utilization: 腌壍 > 0 ? Math.round((褩壍.mtdSpend / 腌壍) * 10000) / 10000 : 0,
        recommendedDaily: 扝壍,
        recommendationNote: draftNote(褩壍, 鏶壍, 癿壍, 扝壍, 镮壍, 甇壍.currency),
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
export function pacingTotals(主壍: readonly PacingView[]): PacingTotals {
    const 洪壍 = 主壍.reduce((谙壍, 夈壍) => 谙壍 + 夈壍.target, 0);
    const 矷壍 = 主壍.reduce((雦壍, 揕壍) => 雦壍 + 揕壍.mtdSpend, 0);
    const 苄壍 = 主壍.reduce((侳壍, 溢壍) => 侳壍 + 溢壍.projected, 0);
    return {
        target: 洪壍,
        mtd: 矷壍,
        projected: 苄壍,
        paceRatio: 洪壍 > 0 ? 苄壍 / 洪壍 : 0,
        overCount: 主壍.filter((趑壍) => 趑壍.status === "overpacing").length,
        underCount: 主壍.filter((媀壍) => 媀壍.status === "underpacing").length,
        campaigns: 主壍.reduce((祯壍, 類壍) => 祯壍 + 類壍.campaignIds.length, 0),
        sharedBudgets: 主壍.filter((敍壍) => 敍壍.shared).length,
    };
}
export interface StatCardModel {
    label: string;
    value: string;
    caption: string;
    tone?: "accent" | "warn";
}
export function budgetStats(萼壍: Pick<PacingReport, "month" | "daysInMonth" | "elapsedDays" | "remainingDays">, 儫壍: PacingTotals, 瀚壍: Thresholds, 載壍: string): StatCardModel[] {
    const { daysInMonth: 寸壍, elapsedDays: 竧壍, remainingDays: 駖壍 } = 萼壍;
    const 曅壍 = 儫壍.target > 0 ? Math.round((儫壍.mtd / 儫壍.target) * 100) : 0;
    const 薴壍 = `${儫壍.campaigns} campaign${儫壍.campaigns === 1 ? "" : "s"}${儫壍.sharedBudgets ? ` · ${儫壍.sharedBudgets} shared budget${儫壍.sharedBudgets === 1 ? "" : "s"}` : ""}`;
    const 劣壍 = 竧壍 === 0 ? `Starts ${formatShort(`${萼壍.month}-01`)} · ${寸壍} days` : 駖壍 === 0 ? `${曅壍}% used · month complete` : `${曅壍}% used · ${竧壍} of ${寸壍} days`;
    const 熒壍 = 儫壍.projected > 儫壍.target;
    const 邁壍 = Math.abs(儫壍.projected - 儫壍.target);
    return [
        { label: `${monthName(萼壍.month)} budget`, value: money(儫壍.target, 載壍), caption: 薴壍 },
        { label: "Spent to date", value: money(儫壍.mtd, 載壍), caption: 劣壍 },
        {
            label: 駖壍 === 0 ? "Month-end spend" : "Projected month-end",
            value: money(儫壍.projected, 載壍),
            caption: 熒壍 ? `${money(邁壍, 載壍)} over budget` : `${money(邁壍, 載壍)} ${駖壍 === 0 ? "unspent" : "headroom"}`,
            tone: 儫壍.paceRatio > 瀚壍.over ? "warn" : "accent",
        },
        { label: "Overpacing campaigns", value: String(儫壍.overCount), caption: `Projected above ${Math.round(瀚壍.over * 100)}% of budget` },
    ];
}
export function todayMarker(嵰壍: Pick<PacingReport, "daysInMonth" | "elapsedDays">): number | undefined {
    return 嵰壍.elapsedDays > 0 && 嵰壍.elapsedDays < 嵰壍.daysInMonth ? 嵰壍.elapsedDays / 嵰壍.daysInMonth : undefined;
}
export interface CumulativeSeries {
    dates: string[];
    actual: (number | null)[];
    projected: (number | null)[];
    ideal: number[];
    total: number;
    max: number;
}
export function cumulativeSeries(籟壍: Pick<PacingReport, "cumulative" | "daysInMonth">, 魎壍: number, 栽壍: number): CumulativeSeries {
    const 蜬壍 = 籟壍.daysInMonth || 籟壍.cumulative.length || 1;
    return {
        dates: 籟壍.cumulative.map((君壍) => 君壍.date),
        actual: 籟壍.cumulative.map((猊壍) => 猊壍.actual),
        projected: 籟壍.cumulative.map((釹壍) => 釹壍.projected),
        ideal: 籟壍.cumulative.map((廨壍, 緗壍) => Math.round(((魎壍 * (緗壍 + 1)) / 蜬壍) * 100) / 100),
        total: 魎壍,
        max: Math.max(魎壍, 栽壍, 1) * 1.1,
    };
}
export function weeklyTicks(鳆壍: number): Set<number> {
    const 榵壍 = new Set<number>();
    for (let 袤壍 = 0; 袤壍 < 鳆壍; 袤壍 += 7)
        if (鳆壍 - 1 - 袤壍 >= 4 || 袤壍 === 0)
            榵壍.add(袤壍);
    if (鳆壍 > 0)
        榵壍.add(鳆壍 - 1);
    return 榵壍;
}
export function evenTicks(喓壍: number, 璂壍 = 6): Set<number> {
    if (喓壍 <= 璂壍)
        return new Set(Array.from({ length: 喓壍 }, (鍱壍, 恠壍) => 恠壍));
    return new Set(Array.from({ length: 璂壍 }, (罏壍, 鸾壍) => Math.round(((喓壍 - 1) * 鸾壍) / (璂壍 - 1))));
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
export function recommendedChanges(欭壍: readonly PacingView[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const 訜壍: BudgetChange[] = [];
    const 國壍: SkippedChange[] = [];
    for (const 痺壍 of 欭壍) {
        const 铩壍 = 痺壍.campaignIds[0];
        if (痺壍.shared || !铩壍 || 痺壍.campaignIds.length !== 1)
            國壍.push({ name: 痺壍.name, reason: "Shared budget — edit it in Google Ads (Shared library)" });
        else if (痺壍.status === "unsupported_period")
            國壍.push({ name: 痺壍.name, reason: "Custom-period budget" });
        else if (痺壍.paused)
            國壍.push({ name: 痺壍.name, reason: "Paused" });
        else if (痺壍.recommendedDaily === null || 痺壍.recommendedDaily <= 0)
            國壍.push({ name: 痺壍.name, reason: "No recommendation" });
        else if (痺壍.dailyBudget !== null && Math.abs(痺壍.recommendedDaily - 痺壍.dailyBudget) < 0.01)
            國壍.push({ name: 痺壍.name, reason: "Already at the recommended budget" });
        else
            訜壍.push({ unitId: 痺壍.unitId, campaignId: 铩壍, name: 痺壍.name, from: 痺壍.dailyBudget, to: Math.round(痺壍.recommendedDaily * 100) / 100 });
    }
    return { changes: 訜壍, skipped: 國壍 };
}
