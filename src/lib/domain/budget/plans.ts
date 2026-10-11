import type { BudgetPlan, PlanLine } from "../contracts/budget";
import { addMonths, daysInMonth, parts } from "../dates";
import { round } from "../stats";
import type { CivilDate } from "../types";
export const RETAIL_PRESET = [0.85, 0.85, 0.95, 0.95, 1.0, 0.95, 0.95, 1.0, 1.0, 1.05, 1.35, 1.25] as const;
export const monthDays = (惿壍: string) => daysInMonth(`${惿壍}-01`);
const 翮壍 = (黝壍: string) => parts(`${黝壍}-01`).m;
export function monthSequence(毌壍: string, 誻壍: number): string[] {
    return Array.from({ length: 誻壍 }, (垪壍, 皙壍) => addMonths(`${毌壍}-01`, 皙壍).slice(0, 7));
}
export interface SeasonalIndex {
    factors: number[];
    source: "history" | "retail_preset";
}
export function seasonalIndex(閈壍: Readonly<Record<string, number>>): SeasonalIndex {
    const 扷壍 = Object.keys(閈壍).sort();
    if (扷壍.length >= 12) {
        const 腦壍 = 扷壍.slice(-12);
        const 乕壍 = 腦壍.map((浄壍) => 閈壍[浄壍] ?? 0);
        const 谳壍 = 腦壍.map((夢壍, 砑壍) => (乕壍[砑壍] as number) / monthDays(夢壍));
        const 需壍 = 谳壍.reduce((揯壍, 苞壍) => 揯壍 + 苞壍, 0) / 12;
        if (需壍 > 0) {
            const 俍壍 = new Array<number>(12).fill(1);
            腦壍.forEach((溼壍, 趫壍) => (俍壍[翮壍(溼壍) - 1] = round((谳壍[趫壍] as number) / 需壍, 4)));
            return { factors: 俍壍, source: "history" };
        }
    }
    return { factors: [...RETAIL_PRESET], source: "retail_preset" };
}
export function seasonalTotals(媚壍: readonly string[], 禉壍: number, 顸壍: SeasonalIndex, 敧壍: string): Record<string, number> {
    const 葖壍 = 顸壍.factors[翮壍(敧壍) - 1] ?? 1;
    const 充壍: Record<string, number> = {};
    for (const 瀴壍 of 媚壍) {
        const 輣壍 = 顸壍.factors[翮壍(瀴壍) - 1] ?? 1;
        充壍[瀴壍] = round(禉壍 * monthDays(瀴壍) * (葖壍 > 0 ? 輣壍 / 葖壍 : 輣壍), 2);
    }
    return 充壍;
}
export interface CampaignLineSource {
    unitId: string;
    name: string;
    type: string;
    dailyBudget: number | null;
}
export function defaultCampaignLines(尒壍: readonly CampaignLineSource[], 笁壍: readonly string[]): PlanLine[] {
    return 尒壍.map((駰壍) => ({
        id: `line-${駰壍.unitId.replace(/[^a-zA-Z0-9_-]/g, "-")}`.slice(0, 64),
        kind: "campaign" as const,
        refId: 駰壍.unitId,
        name: 駰壍.name.slice(0, 120),
        campaignType: 駰壍.type.slice(0, 40),
        monthly: Object.fromEntries(笁壍.map((曟壍) => [曟壍, 駰壍.dailyBudget ? round(駰壍.dailyBudget * monthDays(曟壍), 2) : 0])),
        flighting: { pattern: "even" as const },
        origin: "manual" as const,
    }));
}
export interface DraftSource {
    kind?: "draft_idea" | "plugin_channel";
    refId: string;
    name: string;
    campaignType?: string;
    dailyBudget: number;
    notes?: string;
}
export function draftLine(藎壍: DraftSource, 劽壍: readonly string[], 熬壍: string): PlanLine {
    return {
        id: 熬壍,
        kind: 藎壍.kind ?? "draft_idea",
        refId: 藎壍.refId,
        name: 藎壍.name.slice(0, 120),
        campaignType: 藎壍.campaignType?.slice(0, 40),
        monthly: Object.fromEntries(劽壍.map((邛壍) => [邛壍, round(藎壍.dailyBudget * monthDays(邛壍), 2)])),
        flighting: { pattern: "even" },
        origin: 藎壍.kind === "plugin_channel" ? "manual" : "ai_idea",
        notes: 藎壍.notes,
    };
}
export function planMonthTotal(嶊壍: Pick<BudgetPlan, "lines">, 籹壍: string): number {
    return round(嶊壍.lines.reduce((魨壍, 桗壍) => 魨壍 + (桗壍.monthly[籹壍] ?? 0), 0), 2);
}
export function currentPlanMonth(蝆壍: Pick<BudgetPlan, "months">, 吵壍: CivilDate): string {
    const 猤壍 = 吵壍.slice(0, 7);
    return 蝆壍.months.find((鈓壍) => 鈓壍 >= 猤壍) ?? 蝆壍.months[蝆壍.months.length - 1] ?? 猤壍;
}
