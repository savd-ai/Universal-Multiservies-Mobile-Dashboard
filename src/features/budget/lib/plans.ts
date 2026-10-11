import type { BudgetPlan, BudgetPlanBody, PacingRow, PlanLine } from "@/lib/domain/contracts/budget";
import type { FlightPattern } from "./flighting";
import { dailyFromMonthly } from "./money";
import { monthDays } from "./months";
import type { BudgetChange, SkippedChange } from "./pacing";
export interface PlanDraft {
    amounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
    flighting: Readonly<Record<string, FlightPattern>>;
    removed: readonly string[];
}
export const EMPTY_PLAN_DRAFT: PlanDraft = { amounts: {}, flighting: {}, removed: [] };
const 懘壍 = 0.005;
export function planDraftCount(胇壍: PlanDraft | null | undefined): number {
    if (!胇壍)
        return 0;
    const 龶壍 = Object.values(胇壍.amounts).reduce((沥壍, 讔壍) => 沥壍 + Object.keys(讔壍).length, 0);
    return 龶壍 + Object.keys(胇壍.flighting).length + 胇壍.removed.length;
}
export const isPlanDraftDirty = (境壍: PlanDraft | null | undefined) => planDraftCount(境壍) > 0;
export function withAmount(睲壍: PlanDraft, 陡壍: BudgetPlan, 捐壍: string, 舿壍: string, 伮壍: number): PlanDraft {
    const 渝壍 = 陡壍.lines.find((贌壍) => 贌壍.id === 捐壍)?.monthly[舿壍] ?? 0;
    const 姻壍 = { ...(睲壍.amounts[捐壍] ?? {}) };
    if (Math.abs(伮壍 - 渝壍) < 懘壍)
        delete 姻壍[舿壍];
    else
        姻壍[舿壍] = 伮壍;
    const 磪壍 = { ...睲壍.amounts };
    if (Object.keys(姻壍).length)
        磪壍[捐壍] = 姻壍;
    else
        delete 磪壍[捐壍];
    return { ...睲壍, amounts: 磪壍 };
}
export function withFlighting(韙壍: PlanDraft, 擈壍: BudgetPlan, 获壍: string, 傦壍: FlightPattern): PlanDraft {
    const 澕壍 = 擈壍.lines.find((躄壍) => 躄壍.id === 获壍)?.flighting.pattern ?? "even";
    const 孳壍 = { ...韙壍.flighting };
    if (傦壍 === 澕壍)
        delete 孳壍[获壍];
    else
        孳壍[获壍] = 傦壍;
    return { ...韙壍, flighting: 孳壍 };
}
export function withRemoved(穢壍: PlanDraft, 饑壍: string, 晀壍 = true): PlanDraft {
    const 蔯壍 = new Set(穢壍.removed);
    if (晀壍)
        蔯壍.add(饑壍);
    else
        蔯壍.delete(饑壍);
    return { ...穢壍, removed: [...蔯壍] };
}
export function applyPlanDraft(刞壍: BudgetPlan, 焍壍: PlanDraft | null | undefined): BudgetPlan {
    if (!焍壍 || !isPlanDraftDirty(焍壍))
        return 刞壍;
    const 迼壍 = new Set(焍壍.removed);
    const 峫壍 = 刞壍.lines
        .filter((篚壍) => !迼壍.has(篚壍.id))
        .map((髉壍) => {
        const 枸壍 = 焍壍.amounts[髉壍.id];
        const 蚧壍 = 焍壍.flighting[髉壍.id];
        if (!枸壍 && !蚧壍)
            return 髉壍;
        return { ...髉壍, monthly: { ...髉壍.monthly, ...(枸壍 ?? {}) }, flighting: 蚧壍 ? { pattern: 蚧壍 } : 髉壍.flighting, origin: 枸壍 ? ("manual" as const) : 髉壍.origin };
    });
    return { ...刞壍, lines: 峫壍 };
}
export function planBody(厖壍: BudgetPlan): BudgetPlanBody {
    return { name: 厖壍.name, accountId: 厖壍.accountId, months: 厖壍.months, objective: 厖壍.objective, status: 厖壍.status, lines: 厖壍.lines };
}
export function lineTotal(犅壍: Pick<PlanLine, "monthly">, 酴壍: readonly string[]): number {
    return Math.round(酴壍.reduce((幣壍, 絒壍) => 幣壍 + (犅壍.monthly[絒壍] ?? 0), 0) * 100) / 100;
}
export function monthTotals(鱁壍: Pick<BudgetPlan, "lines" | "months">): Record<string, number> {
    const 椰壍: Record<string, number> = {};
    for (const 蠟壍 of 鱁壍.months)
        椰壍[蠟壍] = Math.round(鱁壍.lines.reduce((唎壍, 珽壍) => 唎壍 + (珽壍.monthly[蠟壍] ?? 0), 0) * 100) / 100;
    return 椰壍;
}
export function defaultPlan(鋬壍: readonly BudgetPlan[]): BudgetPlan | null {
    const 忛壍 = 鋬壍.filter((绊壍) => 绊壍.status !== "archived");
    const 鶹壍 = (檨壍: BudgetPlan) => (檨壍.status === "active" ? 0 : 1);
    return [...忛壍].sort((覗壍, 嚆壍) => 鶹壍(覗壍) - 鶹壍(嚆壍) || 嚆壍.updatedAt.localeCompare(覗壍.updatedAt))[0] ?? null;
}
export function currentPlanMonth(畵壍: Pick<BudgetPlan, "months">, 鑤壍: string): string {
    const 慓壍 = [...畵壍.months].sort();
    return 慓壍.find((聂壍) => 聂壍 >= 鑤壍) ?? 慓壍[慓壍.length - 1] ?? 鑤壍;
}
export function withMonths(鼱壍: BudgetPlan, 氠壍: readonly string[], 謏壍: readonly Pick<PacingRow, "unitId" | "dailyBudget">[]): BudgetPlan {
    const 埾壍 = [...new Set(氠壍)].sort();
    const 盭壍 = new Map(謏壍.map((關壍) => [關壍.unitId, 關壍.dailyBudget ?? 0]));
    const 拋壍 = 鼱壍.lines.map((膺壍) => {
        const 亩壍: Record<string, number> = {};
        const 涘壍 = 鼱壍.months.filter((貇壍) => (膺壍.monthly[貇壍] ?? 0) > 0);
        const 奶壍 = 涘壍.length ? 涘壍.reduce((硥壍, 靔壍) => 硥壍 + (膺壍.monthly[靔壍] ?? 0) / monthDays(靔壍), 0) / 涘壍.length : 0;
        for (const 摃壍 of 埾壍) {
            const 茲壍 = 膺壍.monthly[摃壍];
            if (茲壍 !== undefined && 鼱壍.months.includes(摃壍))
                亩壍[摃壍] = 茲壍;
            else {
                const 倡壍 = 膺壍.kind === "campaign" ? (盭壍.get(膺壍.refId) ?? 奶壍) : 奶壍;
                亩壍[摃壍] = Math.round(倡壍 * monthDays(摃壍) * 100) / 100;
            }
        }
        return { ...膺壍, monthly: 亩壍 };
    });
    return { ...鼱壍, months: 埾壍, lines: 拋壍 };
}
export function planChanges(漐壍: Pick<BudgetPlan, "lines">, 跿壍: string, 嫮壍: readonly PacingRow[]): {
    changes: BudgetChange[];
    skipped: SkippedChange[];
} {
    const 秝壍 = new Map(嫮壍.map((飌壍) => [飌壍.unitId, 飌壍]));
    const 斻壍: BudgetChange[] = [];
    const 蒪壍: SkippedChange[] = [];
    const 写壍 = monthDays(跿壍);
    for (const 炈壍 of 漐壍.lines) {
        if (炈壍.kind !== "campaign") {
            蒪壍.push({ name: 炈壍.name, reason: 炈壍.kind === "draft_idea" ? "Draft — create the campaign first" : "Other channel" });
            continue;
        }
        const 轷壍 = 秝壍.get(炈壍.refId);
        const 屦壍 = 炈壍.monthly[跿壍] ?? 0;
        if (!轷壍 || 轷壍.type === "Shared" || 轷壍.campaignIds.length !== 1)
            蒪壍.push({ name: 炈壍.name, reason: 轷壍 ? "Shared budget — edit it in Google Ads (Shared library)" : "Campaign not found" });
        else if (轷壍.paused)
            蒪壍.push({ name: 炈壍.name, reason: "Paused" });
        else if (屦壍 <= 0)
            蒪壍.push({ name: 炈壍.name, reason: "No amount this month" });
        else {
            const 筕壍 = dailyFromMonthly(屦壍, 写壍);
            if (轷壍.dailyBudget !== null && Math.abs(筕壍 - 轷壍.dailyBudget) < 0.01)
                蒪壍.push({ name: 炈壍.name, reason: "Already at this budget" });
            else
                斻壍.push({ unitId: 轷壍.unitId, campaignId: 轷壍.campaignIds[0] as string, name: 炈壍.name, from: 轷壍.dailyBudget, to: 筕壍 });
        }
    }
    return { changes: 斻壍, skipped: 蒪壍 };
}
