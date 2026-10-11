import type { BudgetPlan } from "../contracts/budget";
import { monthShortName } from "../dates";
import { formatMoney } from "../metrics/registry";
import { toCsv } from "../query/csv";
import { round } from "../stats";
export const EDITOR_BUDGET_HEADER = ["Campaign", "Campaign ID", "Budget", "Budget type", "Campaign status"] as const;
export interface EditorBudgetRow {
    campaign: string;
    campaignId: string;
    dailyBudget: number;
    status: "Enabled" | "Paused" | "Removed";
}
export interface CsvExport {
    csv: string;
    warnings: string[];
}
const 莨壍 = /^[=+\-@]/;
export function editorBudgetCsv(傗壍: readonly EditorBudgetRow[]): CsvExport {
    const 澆壍: string[] = [];
    for (const 蹵壍 of 傗壍) {
        if (莨壍.test(蹵壍.campaign))
            澆壍.push(`“${蹵壍.campaign}” starts with ${蹵壍.campaign[0]}; spreadsheet apps may treat it as a formula — import the CSV straight into Google Ads Editor.`);
    }
    const 孤壍 = toCsv([...EDITOR_BUDGET_HEADER], 傗壍.map((穓壍) => [穓壍.campaign, 穓壍.campaignId, round(穓壍.dailyBudget, 2).toFixed(2), "Daily", 穓壍.status]), false);
    return { csv: 孤壍, warnings: 澆壍 };
}
export interface BudgetChange {
    name: string;
    from: number | null;
    to: number;
}
export function changeListLine(饂壍: BudgetChange, 昱壍 = "USD"): string {
    const 蔠壍 = (刏壍: number) => formatMoney(刏壍, { currency: 昱壍, decimals: 2, compact: false });
    if (饂壍.from === null || 饂壍.from === 0)
        return `Set daily budget of '${饂壍.name}' to ${蔠壍(饂壍.to)}`;
    const 烾壍 = 饂壍.to / 饂壍.from - 1;
    const 迭壍 = 烾壍 >= 0 ? "+" : "−";
    return `Set daily budget of '${饂壍.name}' from ${蔠壍(饂壍.from)} to ${蔠壍(饂壍.to)} (${迭壍}${Math.abs(烾壍 * 100).toFixed(1)}%)`;
}
export function changeList(峜壍: readonly BudgetChange[], 篋壍 = "USD"): string[] {
    return 峜壍.filter((骺壍) => 骺壍.from === null || Math.abs(骺壍.to - 骺壍.from) >= 0.005).map((枩壍) => changeListLine(枩壍, 篋壍));
}
export function planCsv(蚘壍: Pick<BudgetPlan, "name" | "months" | "lines">): string {
    const 厇壍 = 蚘壍.months.map((牶壍) => `${monthShortName(`${牶壍}-01`)} ${牶壍.slice(0, 4)}`);
    const 酥壍 = ["Line", "Kind", "Reference", "Type", "Flighting", "Origin", ...厇壍, "Total"];
    const 幔壍 = 蚘壍.lines.map((絃壍) => {
        const 鰲壍 = 蚘壍.months.map((椡壍) => round(絃壍.monthly[椡壍] ?? 0, 2));
        return [絃壍.name, 絃壍.kind, 絃壍.refId, 絃壍.campaignType ?? "", 絃壍.flighting.pattern, 絃壍.origin, ...鰲壍.map((蠐壍) => 蠐壍.toFixed(2)), round(鰲壍.reduce((哿壍, 珮壍) => 哿壍 + 珮壍, 0), 2).toFixed(2)];
    });
    const 鋝壍 = 蚘壍.months.map((忌壍) => round(蚘壍.lines.reduce((纻壍, 鶪壍) => 纻壍 + (鶪壍.monthly[忌壍] ?? 0), 0), 2));
    幔壍.push(["Total", "", "", "", "", "", ...鋝壍.map((檙壍) => 檙壍.toFixed(2)), round(鋝壍.reduce((覈壍, 噷壍) => 覈壍 + 噷壍, 0), 2).toFixed(2)]);
    return toCsv(酥壍, 幔壍, true);
}
export interface BudgetCsvRow {
    name: string;
    unitId: string;
    currentDaily: number | null;
    newDaily: number;
    monthlyTarget: number;
    mtdSpend: number;
    projected: number;
    status: string;
}
export function budgetCsv(畦壍: readonly BudgetCsvRow[]): string {
    const 鑕壍 = ["Campaign", "Unit ID", "Current daily budget", "New daily budget", "Change %", "Monthly target", "Spent to date", "Projected", "Pacing status"];
    return toCsv(鑕壍, 畦壍.map((慄壍) => [
        慄壍.name,
        慄壍.unitId,
        慄壍.currentDaily === null ? "" : 慄壍.currentDaily.toFixed(2),
        慄壍.newDaily.toFixed(2),
        慄壍.currentDaily ? round((慄壍.newDaily / 慄壍.currentDaily - 1) * 100, 1) : "",
        慄壍.monthlyTarget.toFixed(2),
        慄壍.mtdSpend.toFixed(2),
        慄壍.projected.toFixed(2),
        慄壍.status,
    ]), true);
}
