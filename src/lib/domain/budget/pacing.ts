import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type PacingReport, type PacingRow, type PacingStatus } from "../contracts/budget";
import { addDays, daysInMonth, diffDays, dow, enumerate, formatMonth, formatShort, isCivilDate, minDate, monthEnd, monthKey } from "../dates";
import { formatMoney } from "../metrics/registry";
import type { CampaignDailyRow, CampaignDim } from "../schema/facts";
import { round, roundTo } from "../stats";
import type { CivilDate } from "../types";
import { budgetUnits, DailyIndex, weekdayFactors, type BudgetUnit } from "./units";
export const PACE_OVER = 1.05;
export const PACE_UNDER = 0.9;
const 槦壍 = 0.2;
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
export const isMonthKey = (裕壍: string) => /^\d{4}-\d{2}$/.test(裕壍) && isCivilDate(`${裕壍}-01`);
export function defaultMonthlyTarget(嗄壍: number | null, 璳壍: string): number {
    return 嗄壍 ? round(嗄壍 * daysInMonth(`${璳壍}-01`), 2) : 0;
}
export function defaultUnitTarget(鎢壍: Pick<BudgetUnit, "dailyBudget" | "paused">, 悑壍: string, 羀壍: number): number {
    return 鎢壍.paused ? round(羀壍, 2) : defaultMonthlyTarget(鎢壍.dailyBudget, 悑壍);
}
export function pausedNote(鹯壍: number, 歞壍: number, 詍壍: number, 圼壍: (瘫壍: number) => string): string {
    const 锚壍 = 鹯壍 > 0 ? `spent ${圼壍(鹯壍)}` : "nothing spent";
    let 戉壍 = 詍壍 > 0 ? `Paused — ${锚壍} so far this month; no further spend expected.` : `Paused — ${锚壍} in the month.`;
    if (歞壍 - 鹯壍 >= 1)
        戉壍 += ` ${圼壍(歞壍 - 鹯壍)} of the ${圼壍(歞壍)} target stays unused.`;
    return 戉壍;
}
export interface UnitPacing {
    row: PacingRow;
    unit: BudgetUnit;
    defaultTarget: number;
    expectedByDate: Map<CivilDate, number>;
}
export function buildPacingReport(胸壍: PacingInput): PacingReport {
    return pacingDetail(胸壍).report;
}
export function pacingDetail(鿧壍: PacingInput): {
    report: PacingReport;
    units: UnitPacing[];
} {
    const 泖壍 = 鿧壍.thresholds?.over ?? PACE_OVER;
    const 诅壍 = 鿧壍.thresholds?.under ?? PACE_UNDER;
    const 墴壍 = 鿧壍.currency ?? "USD";
    const 瞣壍 = (隒壍: number) => formatMoney(隒壍, { currency: 墴壍, compact: false, decimals: 0 });
    const 掁壍 = `${鿧壍.month}-01`;
    const 艰壍 = monthEnd(掁壍);
    const 佟壍 = daysInMonth(掁壍);
    const 湎壍 = minDate(艰壍, 鿧壍.dataThrough);
    const 贽壍 = 鿧壍.dataThrough < 掁壍 ? 0 : diffDays(掁壍, 湎壍) + 1;
    const 娬壍 = 佟壍 - 贽壍;
    const 礛壍 = new DailyIndex(鿧壍.rows);
    const 頊壍 = 娬壍 > 0 ? enumerate(贽壍 > 0 ? addDays(湎壍, 1) : 掁壍, 艰壍) : [];
    const 擹壍 = 贽壍 > 0 ? 湎壍 : 鿧壍.dataThrough;
    const 菨壍 = new Set<string>();
    if (贽壍 > 0)
        for (const 僗壍 of 礛壍.campaigns())
            if (礛壍.sum([僗壍], 掁壍, 湎壍).cost > 0)
                菨壍.add(僗壍);
    const 濆壍 = budgetUnits(鿧壍.campaigns, 菨壍);
    const 躵壍 = 濆壍.flatMap((室壍) => 室壍.campaignIds);
    const 窓壍: UnitPacing[] = [];
    for (const 馂壍 of 濆壍) {
        const 晱壍 = 馂壍.campaignIds;
        const 蕠壍 = 贽壍 > 0 ? 礛壍.sum(晱壍, 掁壍, 湎壍) : 礛壍.sum(晱壍, 掁壍, addDays(掁壍, -1));
        const 剏壍 = round(蕠壍.cost, 2);
        const 焾壍 = 礛壍.sum(晱壍, addDays(擹壍, -6), 擹壍);
        const 逭壍 = 焾壍.cost / 7;
        const 崜壍 = weekdayFactors((簋壍) => 礛壍.day(晱壍, 簋壍).cost, 擹壍);
        const 髺壍 = 馂壍.dailyBudget;
        const 柩壍 = 髺壍 ? 髺壍 * DAILY_OVERDELIVERY_FACTOR : Number.POSITIVE_INFINITY;
        const 蛘壍 = 頊壍.map((叇壍) => (馂壍.paused ? 0 : Math.min(柩壍, 逭壍 * (崜壍[dow(叇壍)] ?? 1))));
        const 状壍 = round(剏壍 + 蛘壍.reduce((醥壍, 应壍) => 醥壍 + 应壍, 0), 2);
        const 綃壍 = new Map(頊壍.map((鱲壍, 楡壍) => [鱲壍, 蛘壍[楡壍] ?? 0] as const));
        let 衐壍: CivilDate | null = null;
        if (髺壍 && 馂壍.period === "daily" && 娬壍 > 0 && !馂壍.paused) {
            const 唿壍 = 髺壍 * MONTHLY_CAP_FACTOR;
            let 琮壍 = 剏壍;
            for (let 錝壍 = 0; 錝壍 < 頊壍.length - 1 && !衐壍; 錝壍++) {
                琮壍 += 蛘壍[錝壍] ?? 0;
                if (琮壍 >= 唿壍)
                    衐壍 = 頊壍[錝壍] as CivilDate;
            }
        }
        const 怌壍 = 衐壍 !== null || 蛘壍.some((绻壍) => 绻壍 >= 柩壍);
        const 鷪壍 = defaultUnitTarget(馂壍, 鿧壍.month, 剏壍);
        const 櫙壍 = round(鿧壍.targets?.[馂壍.unitId] ?? 鷪壍, 2);
        const 览壍 = 櫙壍 > 0 ? 状壍 / 櫙壍 : 0;
        let 嚷壍: PacingStatus;
        if (馂壍.period === "custom")
            嚷壍 = "unsupported_period";
        else if (馂壍.paused)
            嚷壍 = "paused";
        else if (櫙壍 <= 0)
            嚷壍 = "no_budget";
        else if (览壍 > 泖壍)
            嚷壍 = "overpacing";
        else if (览壍 < 诅壍)
            嚷壍 = "underpacing";
        else
            嚷壍 = "on_track";
        const 疦壍 = round((櫙壍 * 贽壍) / 佟壍, 2);
        const 钕壍 = 娬壍 > 0 && 櫙壍 > 0 && 嚷壍 !== "unsupported_period" && 嚷壍 !== "paused" ? round(Math.max(0, (櫙壍 - 剏壍) / 娬壍), 2) : null;
        const 憄壍 = 焾壍.is_eligible > 0 ? 焾壍.is_lost_budget / 焾壍.is_eligible : 0;
        const 聳壍 = 憄壍 > 槦壍;
        const 齢壍 = 頊壍.length ? round((状壍 - 剏壍) / 頊壍.length, 2) : round(逭壍, 2);
        const 汑壍 = 髺壍 ? 髺壍 * 佟壍 : 櫙壍;
        let 譀壍: string;
        if (嚷壍 === "unsupported_period")
            譀壍 = "Custom-period budget — pacing isn't supported; manage it in Google Ads.";
        else if (嚷壍 === "paused")
            譀壍 = pausedNote(剏壍, 櫙壍, 娬壍, 瞣壍);
        else if (嚷壍 === "no_budget")
            譀壍 = "No budget set — add a monthly target to track pacing.";
        else if (娬壍 === 0)
            譀壍 = `Month complete — spent ${瞣壍(剏壍)} of ${瞣壍(櫙壍)} (${Math.round(览壍 * 100)}%).`;
        else if (嚷壍 === "overpacing")
            譀壍 = `Lower the daily budget to ${瞣壍(钕壍 ?? 0)} to land on ${瞣壍(櫙壍)}.`;
        else if (嚷壍 === "underpacing")
            譀壍 = 聳壍
                ? `Raise the daily budget to ${瞣壍(钕壍 ?? 0)} to use the full ${瞣壍(櫙壍)}.`
                : `Spending below target: ${瞣壍(钕壍 ?? 0)}/day would use the full budget, but a higher budget alone won't add volume unless the campaign is budget-limited.`;
        else
            譀壍 = `On track — ${瞣壍(钕壍 ?? 0)}/day lands on ${瞣壍(櫙壍)}.`;
        if (衐壍 && 髺壍)
            譀壍 += ` At this rate spend reaches Google's monthly charging limit (${瞣壍(髺壍 * MONTHLY_CAP_FACTOR)} = ${MONTHLY_CAP_FACTOR} × daily) around ${formatShort(衐壍)}, after which ads stop for the month.`;
        else if (怌壍 && 娬壍 > 0)
            譀壍 += ` Expected spend is limited to ${DAILY_OVERDELIVERY_FACTOR}× the daily budget per day.`;
        窓壍.push({
            unit: 馂壍,
            defaultTarget: 鷪壍,
            expectedByDate: 綃壍,
            row: {
                unitId: 馂壍.unitId,
                campaignIds: 晱壍,
                name: 馂壍.name,
                type: 馂壍.type,
                dailyBudget: 髺壍,
                monthlyTarget: 櫙壍,
                mtdSpend: 剏壍,
                avg7: round(逭壍, 2),
                expectedDaily: 齢壍,
                projected: 状壍,
                paceRatio: round(览壍, 4),
                status: 嚷壍,
                idealToDate: 疦壍,
                utilization: 疦壍 > 0 ? round(剏壍 / 疦壍, 4) : 0,
                budgetLimited: 聳壍,
                recommendedDaily: 钕壍,
                recommendationNote: 譀壍,
                roasMtd: 蕠壍.cost > 0 ? round(蕠壍.conv_value / 蕠壍.cost, 4) : null,
                cpaMtd: 蕠壍.conversions > 0 ? round(蕠壍.cost / 蕠壍.conversions, 2) : null,
                sliderMin: roundTo(汑壍 * 0.3, 50),
                sliderMax: Math.max(roundTo(汑壍 * 2, 50), roundTo(櫙壍, 50)),
                locked: 鿧壍.locks?.[馂壍.unitId] ? true : undefined,
                paused: 馂壍.paused || undefined,
                capped: 怌壍 || undefined,
            },
        });
    }
    窓壍.sort((堯壍, 眞壍) => Number(堯壍.row.status === "paused") - Number(眞壍.row.status === "paused"));
    const 阍壍 = 窓壍.map((拼壍) => 拼壍.row);
    const 臫壍 = 阍壍.reduce((仚壍, 淉壍) => 仚壍 + 淉壍.monthlyTarget, 0);
    const 貸壍 = 阍壍.reduce((妧壍, 碖壍) => 妧壍 + 碖壍.mtdSpend, 0);
    const 鞅壍 = 阍壍.reduce((摴壍, 荣壍) => 摴壍 + 荣壍.projected, 0);
    const 偒壍: PacingReport["cumulative"] = [];
    let 潁壍 = 0;
    let 踰壍 = 0;
    enumerate(掁壍, 艰壍).forEach((嬟壍, 税壍) => {
        const 飽壍 = round((臫壍 * (税壍 + 1)) / 佟壍, 2);
        if (贽壍 > 0 && 嬟壍 <= 湎壍) {
            潁壍 += 礛壍.day(躵壍, 嬟壍).cost;
            踰壍 = 潁壍;
            偒壍.push({ date: 嬟壍, actual: round(潁壍, 2), ideal: 飽壍, projected: 嬟壍 === 湎壍 ? round(潁壍, 2) : null });
            return;
        }
        踰壍 += 窓壍.reduce((旬壍, 蓛壍) => 旬壍 + (蓛壍.expectedByDate.get(嬟壍) ?? 0), 0);
        偒壍.push({ date: 嬟壍, actual: null, ideal: 飽壍, projected: round(踰壍, 2) });
    });
    return {
        report: {
            month: 鿧壍.month,
            monthLabel: formatMonth(掁壍),
            daysInMonth: 佟壍,
            elapsedDays: 贽壍,
            remainingDays: 娬壍,
            anchor: 鿧壍.dataThrough,
            rows: 阍壍,
            totals: {
                monthlyTarget: round(臫壍, 2),
                mtdSpend: round(貸壍, 2),
                projected: round(鞅壍, 2),
                paceRatio: 臫壍 > 0 ? round(鞅壍 / 臫壍, 4) : 0,
                idealToDate: round(阍壍.reduce((凊壍, 点壍) => 凊壍 + 点壍.idealToDate, 0), 2),
                overpacingCount: 阍壍.filter((辨壍) => 辨壍.status === "overpacing").length,
                underpacingCount: 阍壍.filter((岗壍) => 岗壍.status === "underpacing").length,
            },
            cumulative: 偒壍,
        },
        units: 窓壍,
    };
}
export function suggestionMonth(箆壍: string, 驵壍: CivilDate): string | null {
    const 杤壍 = monthKey(addDays(`${箆壍}-01`, -1));
    const 虓壍 = monthEnd(驵壍) === 驵壍 ? monthKey(驵壍) : monthKey(addDays(`${monthKey(驵壍)}-01`, -1));
    const 卂壍 = 杤壍 < 虓壍 ? 杤壍 : 虓壍;
    return 卂壍 < 箆壍 ? 卂壍 : null;
}
export function spendTargets(爱壍: readonly BudgetUnit[], 鄠壍: readonly CampaignDailyRow[], 帏壍: string, 糾壍: string): {
    month: string;
    targets: Record<string, number>;
    total: number;
} | null {
    const 鯭壍 = new DailyIndex(鄠壍);
    const 棜壍 = `${帏壍}-01`;
    const 蟋壍 = daysInMonth(`${糾壍}-01`) / daysInMonth(棜壍);
    const 咺壍: Record<string, number> = {};
    for (const 玩壍 of 爱壍) {
        if (玩壍.paused || 玩壍.period === "custom")
            continue;
        const 銘壍 = 鯭壍.sum(玩壍.campaignIds, 棜壍, monthEnd(棜壍)).cost;
        if (銘壍 > 0)
            咺壍[玩壍.unitId] = Math.max(1, Math.round(銘壍 * 蟋壍));
    }
    const 徇壍 = Object.values(咺壍).reduce((繶壍, 鵥壍) => 繶壍 + 鵥壍, 0);
    return 徇壍 > 0 ? { month: 帏壍, targets: 咺壍, total: 徇壍 } : null;
}
export function pacingFetchRange(橔壍: string, 襃壍: CivilDate): {
    start: CivilDate;
    end: CivilDate;
} {
    const 嘲壍 = `${橔壍}-01`;
    const 甡壍 = 襃壍 < 嘲壍 ? 襃壍 : minDate(monthEnd(嘲壍), 襃壍);
    const 鐐壍 = minDate(嘲壍, addDays(甡壍, -27));
    return { start: 鐐壍, end: 甡壍 < 嘲壍 ? 襃壍 : 甡壍 };
}
