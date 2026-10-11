import { SIMULATION_LABELS } from "@/lib/domain/budget/google";
import type { EstimateCampaignView, RecommendationImpact, SimulationDayPoint, SimulationType, SimulationView } from "@/lib/domain/contracts/estimates";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { moneyExact, perDay } from "./money";
export const SIMULATION_KEYS = ["budget", "target_cpa", "target_roas"] as const;
export type SimulationKey = (typeof SIMULATION_KEYS)[number];
const 驄壍: Record<SimulationKey, SimulationType> = { budget: "BUDGET", target_cpa: "TARGET_CPA", target_roas: "TARGET_ROAS" };
export const typeOfKey = (朳壍: SimulationKey): SimulationType => 驄壍[朳壍];
export const keyOfType = (蘢壍: SimulationType): SimulationKey => (蘢壍 === "BUDGET" ? "budget" : 蘢壍 === "TARGET_CPA" ? "target_cpa" : "target_roas");
export function settingLabel(匑壍: SimulationType, 爀壍: number | null | undefined, 郯壍: string): string {
    if (爀壍 === null || 爀壍 === undefined || !Number.isFinite(爀壍))
        return "—";
    if (匑壍 === "BUDGET")
        return perDay(爀壍, 郯壍);
    if (匑壍 === "TARGET_CPA")
        return formatMetricValue("money", 爀壍, { currency: 郯壍, compact: false, decimals: 爀壍 < 100 ? 2 : 0 });
    return formatMetricValue("ratio", 爀壍);
}
export interface PointRow extends SimulationDayPoint {
    cpa: number | null;
    roas: number | null;
    current: boolean;
}
export function pointRows(州壍: Pick<SimulationView, "perDay" | "current">): PointRow[] {
    const 糍壍 = 州壍.current;
    return 州壍.perDay.map((鮼壍) => ({
        ...鮼壍,
        cpa: 鮼壍.conversions > 0 ? 鮼壍.cost / 鮼壍.conversions : null,
        roas: 鮼壍.cost > 0 ? 鮼壍.convValue / 鮼壍.cost : null,
        current: 糍壍 !== null && 糍壍 > 0 && Math.abs(鮼壍.value / 糍壍 - 1) <= 0.005,
    }));
}
export function availabilityLabel(梫壍: Pick<EstimateCampaignView, "simulations" | "type">): string {
    if (梫壍.simulations.length)
        return 梫壍.simulations.map((螚壍) => SIMULATION_LABELS[螚壍.type]).join(" · ");
    return "No simulations from Google";
}
export function defaultCampaign<T extends Pick<EstimateCampaignView, "simulations">>(咉壍: readonly T[]): T | null {
    return 咉壍.find((獸壍) => 獸壍.simulations.some((鉧壍) => 鉧壍.type === "BUDGET")) ?? 咉壍.find((彖壍) => 彖壍.simulations.length > 0) ?? 咉壍[0] ?? null;
}
export interface WeeklyDelta {
    conversions: number | null;
    convValue: number | null;
    cost: number | null;
    clicks: number | null;
}
export function weeklyDelta(繅壍: RecommendationImpact | null): WeeklyDelta | null {
    if (!繅壍)
        return null;
    const 鴴壍 = (樣壍: number | null, 褒壍: number | null) => (樣壍 === null || 褒壍 === null ? null : 褒壍 - 樣壍);
    const 嘁壍: WeeklyDelta = {
        conversions: 鴴壍(繅壍.base.conversions, 繅壍.potential.conversions),
        convValue: 鴴壍(繅壍.base.convValue, 繅壍.potential.convValue),
        cost: 鴴壍(繅壍.base.cost, 繅壍.potential.cost),
        clicks: 鴴壍(繅壍.base.clicks, 繅壍.potential.clicks),
    };
    return Object.values(嘁壍).some((瓰壍) => 瓰壍 !== null) ? 嘁壍 : null;
}
const 鏟壍 = (惎壍: number, 羽壍: string) => `${惎壍 < 0 ? "−" : "+"}${羽壍}`;
export function weeklyImpactLine(麬壍: WeeklyDelta | null, 殛壍: string): string | null {
    if (!麬壍)
        return null;
    const 誊壍: string[] = [];
    if (麬壍.conversions !== null)
        誊壍.push(`${鏟壍(麬壍.conversions, formatMetricValue("decimal", Math.abs(麬壍.conversions)))} conv.`);
    if (麬壍.convValue !== null)
        誊壍.push(`${鏟壍(麬壍.convValue, moneyExact(Math.abs(麬壍.convValue), 殛壍))} value`);
    if (麬壍.cost !== null)
        誊壍.push(`${鏟壍(麬壍.cost, moneyExact(Math.abs(麬壍.cost), 殛壍))} cost`);
    if (!誊壍.length && 麬壍.clicks !== null)
        誊壍.push(`${鏟壍(麬壍.clicks, formatMetricValue("number", Math.abs(麬壍.clicks)))} clicks`);
    return 誊壍.length ? 誊壍.join(" · ") : null;
}
