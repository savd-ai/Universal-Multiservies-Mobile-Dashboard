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
const RISKY = /^[=+\-@]/;
export function editorBudgetCsv(rows: readonly EditorBudgetRow[]): CsvExport {
    const warnings: string[] = [];
    for (const r of rows) {
        if (RISKY.test(r.campaign))
            warnings.push(`“${r.campaign}” starts with ${r.campaign[0]}; spreadsheet apps may treat it as a formula — import the CSV straight into Google Ads Editor.`);
    }
    const csv = toCsv([...EDITOR_BUDGET_HEADER], rows.map((r) => [r.campaign, r.campaignId, round(r.dailyBudget, 2).toFixed(2), "Daily", r.status]), false);
    return { csv, warnings };
}
export interface BudgetChange {
    name: string;
    from: number | null;
    to: number;
}
export function changeListLine(c: BudgetChange, currency = "USD"): string {
    const money = (v: number) => formatMoney(v, { currency, decimals: 2, compact: false });
    if (c.from === null || c.from === 0)
        return `Set daily budget of '${c.name}' to ${money(c.to)}`;
    const pct = c.to / c.from - 1;
    const sign = pct >= 0 ? "+" : "−";
    return `Set daily budget of '${c.name}' from ${money(c.from)} to ${money(c.to)} (${sign}${Math.abs(pct * 100).toFixed(1)}%)`;
}
export function changeList(changes: readonly BudgetChange[], currency = "USD"): string[] {
    return changes.filter((c) => c.from === null || Math.abs(c.to - c.from) >= 0.005).map((c) => changeListLine(c, currency));
}
export function planCsv(plan: Pick<BudgetPlan, "name" | "months" | "lines">): string {
    const monthLabels = plan.months.map((m) => `${monthShortName(`${m}-01`)} ${m.slice(0, 4)}`);
    const header = ["Line", "Kind", "Reference", "Type", "Flighting", "Origin", ...monthLabels, "Total"];
    const rows = plan.lines.map((l) => {
        const values = plan.months.map((m) => round(l.monthly[m] ?? 0, 2));
        return [l.name, l.kind, l.refId, l.campaignType ?? "", l.flighting.pattern, l.origin, ...values.map((v) => v.toFixed(2)), round(values.reduce((a, b) => a + b, 0), 2).toFixed(2)];
    });
    const totals = plan.months.map((m) => round(plan.lines.reduce((s, l) => s + (l.monthly[m] ?? 0), 0), 2));
    rows.push(["Total", "", "", "", "", "", ...totals.map((v) => v.toFixed(2)), round(totals.reduce((a, b) => a + b, 0), 2).toFixed(2)]);
    return toCsv(header, rows, true);
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
export function budgetCsv(rows: readonly BudgetCsvRow[]): string {
    const header = ["Campaign", "Unit ID", "Current daily budget", "New daily budget", "Change %", "Monthly target", "Spent to date", "Projected", "Pacing status"];
    return toCsv(header, rows.map((r) => [
        r.name,
        r.unitId,
        r.currentDaily === null ? "" : r.currentDaily.toFixed(2),
        r.newDaily.toFixed(2),
        r.currentDaily ? round((r.newDaily / r.currentDaily - 1) * 100, 1) : "",
        r.monthlyTarget.toFixed(2),
        r.mtdSpend.toFixed(2),
        r.projected.toFixed(2),
        r.status,
    ]), true);
}
