import type { CampaignDailyRow, CampaignDim } from "../schema/facts";
import { addDays, dow, enumerate } from "../dates";
import type { CampaignType, CivilDate } from "../types";
export interface BudgetUnit {
    unitId: string;
    campaignIds: string[];
    name: string;
    type: CampaignType | "Shared";
    dailyBudget: number | null;
    period: "daily" | "custom";
    paused: boolean;
    campaigns: CampaignDim[];
}
export function budgetUnits(campaigns: readonly CampaignDim[], keep: ReadonlySet<string> = new Set()): BudgetUnit[] {
    const units: BudgetUnit[] = [];
    const shared = new Map<string, CampaignDim[]>();
    for (const c of campaigns) {
        if (c.status === "Removed" && !keep.has(c.id))
            continue;
        if (c.budget_shared && c.budget_id) {
            const list = shared.get(c.budget_id) ?? [];
            list.push(c);
            shared.set(c.budget_id, list);
            continue;
        }
        units.push({ unitId: c.id, campaignIds: [c.id], name: c.name, type: c.type, dailyBudget: c.budget_daily, period: c.budget_period, paused: c.status !== "Enabled", campaigns: [c] });
    }
    for (const [budgetId, list] of shared) {
        const names = list.map((c) => c.name);
        const label = names.length <= 2 ? names.join(" + ") : `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
        units.push({
            unitId: `budget:${budgetId}`,
            campaignIds: list.map((c) => c.id),
            name: `Shared budget · ${label}`,
            type: "Shared",
            dailyBudget: list.find((c) => c.budget_daily !== null)?.budget_daily ?? null,
            period: list.some((c) => c.budget_period === "custom") ? "custom" : "daily",
            paused: list.every((c) => c.status !== "Enabled"),
            campaigns: list,
        });
    }
    return units;
}
export interface DailyFacts {
    cost: number;
    conversions: number;
    conv_value: number;
    clicks: number;
    impressions: number;
    is_eligible: number;
    is_lost_budget: number;
}
export class DailyIndex {
    private readonly byCampaign = new Map<string, Map<CivilDate, DailyFacts>>();
    constructor(rows: readonly CampaignDailyRow[]) {
        for (const r of rows) {
            let m = this.byCampaign.get(r.campaign_id);
            if (!m) {
                m = new Map();
                this.byCampaign.set(r.campaign_id, m);
            }
            const prev = m.get(r.date);
            const f: DailyFacts = prev ?? { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
            f.cost += r.cost;
            f.conversions += r.conversions;
            f.conv_value += r.conv_value;
            f.clicks += r.clicks;
            f.impressions += r.impressions;
            f.is_eligible += r.is_eligible ?? 0;
            f.is_lost_budget += r.is_lost_budget ?? 0;
            m.set(r.date, f);
        }
    }
    day(campaignIds: readonly string[], date: CivilDate): DailyFacts {
        const out: DailyFacts = { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
        for (const id of campaignIds) {
            const f = this.byCampaign.get(id)?.get(date);
            if (!f)
                continue;
            out.cost += f.cost;
            out.conversions += f.conversions;
            out.conv_value += f.conv_value;
            out.clicks += f.clicks;
            out.impressions += f.impressions;
            out.is_eligible += f.is_eligible;
            out.is_lost_budget += f.is_lost_budget;
        }
        return out;
    }
    sum(campaignIds: readonly string[], start: CivilDate, end: CivilDate): DailyFacts {
        const out: DailyFacts = { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
        if (start > end)
            return out;
        for (const d of enumerate(start, end)) {
            const f = this.day(campaignIds, d);
            out.cost += f.cost;
            out.conversions += f.conversions;
            out.conv_value += f.conv_value;
            out.clicks += f.clicks;
            out.impressions += f.impressions;
            out.is_eligible += f.is_eligible;
            out.is_lost_budget += f.is_lost_budget;
        }
        return out;
    }
    campaigns(): string[] {
        return [...this.byCampaign.keys()];
    }
}
export function weekdayFactors(value: (d: CivilDate) => number, end: CivilDate, days = 28): number[] {
    const sums = new Array<number>(7).fill(0);
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < days; i++) {
        const d = addDays(end, -i);
        const w = dow(d);
        sums[w] = (sums[w] as number) + value(d);
        counts[w] = (counts[w] as number) + 1;
    }
    const means = sums.map((s, i) => ((counts[i] as number) > 0 ? s / (counts[i] as number) : Number.NaN));
    const valid = means.filter((m) => Number.isFinite(m));
    const overall = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    if (overall <= 0)
        return new Array<number>(7).fill(1);
    return means.map((m) => (Number.isFinite(m) ? m / overall : 1));
}
