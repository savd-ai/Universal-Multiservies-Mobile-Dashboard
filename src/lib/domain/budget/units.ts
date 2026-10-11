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
export function budgetUnits(沿壍: readonly CampaignDim[], 议壍: ReadonlySet<string> = new Set()): BudgetUnit[] {
    const 墝壍: BudgetUnit[] = [];
    const 瞌壍 = new Map<string, CampaignDim[]>();
    for (const 陻壍 of 沿壍) {
        if (陻壍.status === "Removed" && !议壍.has(陻壍.id))
            continue;
        if (陻壍.budget_shared && 陻壍.budget_id) {
            const 捪壍 = 瞌壍.get(陻壍.budget_id) ?? [];
            捪壍.push(陻壍);
            瞌壍.set(陻壍.budget_id, 捪壍);
            continue;
        }
        墝壍.push({ unitId: 陻壍.id, campaignIds: [陻壍.id], name: 陻壍.name, type: 陻壍.type, dailyBudget: 陻壍.budget_daily, period: 陻壍.budget_period, paused: 陻壍.status !== "Enabled", campaigns: [陻壍] });
    }
    for (const [艙壍, 佈壍] of 瞌壍) {
        const 渷壍 = 佈壍.map((账壍) => 账壍.name);
        const 娕壍 = 渷壍.length <= 2 ? 渷壍.join(" + ") : `${渷壍.slice(0, 2).join(" + ")} + ${渷壍.length - 2} more`;
        墝壍.push({
            unitId: `budget:${艙壍}`,
            campaignIds: 佈壍.map((礄壍) => 礄壍.id),
            name: `Shared budget · ${娕壍}`,
            type: "Shared",
            dailyBudget: 佈壍.find((音壍) => 音壍.budget_daily !== null)?.budget_daily ?? null,
            period: 佈壍.some((擢壍) => 擢壍.budget_period === "custom") ? "custom" : "daily",
            paused: 佈壍.every((菑壍) => 菑壍.status !== "Enabled"),
            campaigns: 佈壍,
        });
    }
    return 墝壍;
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
    constructor(僀壍: readonly CampaignDailyRow[]) {
        for (const 澯壍 of 僀壍) {
            let 躞壍 = this.byCampaign.get(澯壍.campaign_id);
            if (!躞壍) {
                躞壍 = new Map();
                this.byCampaign.set(澯壍.campaign_id, 躞壍);
            }
            const 宍壍 = 躞壍.get(澯壍.date);
            const 穼壍: DailyFacts = 宍壍 ?? { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
            穼壍.cost += 澯壍.cost;
            穼壍.conversions += 澯壍.conversions;
            穼壍.conv_value += 澯壍.conv_value;
            穼壍.clicks += 澯壍.clicks;
            穼壍.impressions += 澯壍.impressions;
            穼壍.is_eligible += 澯壍.is_eligible ?? 0;
            穼壍.is_lost_budget += 澯壍.is_lost_budget ?? 0;
            躞壍.set(澯壍.date, 穼壍);
        }
    }
    day(饫壍: readonly string[], 晚壍: CivilDate): DailyFacts {
        const 蕉壍: DailyFacts = { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
        for (const 券壍 of 饫壍) {
            const 焧壍 = this.byCampaign.get(券壍)?.get(晚壍);
            if (!焧壍)
                continue;
            蕉壍.cost += 焧壍.cost;
            蕉壍.conversions += 焧壍.conversions;
            蕉壍.conv_value += 焧壍.conv_value;
            蕉壍.clicks += 焧壍.clicks;
            蕉壍.impressions += 焧壍.impressions;
            蕉壍.is_eligible += 焧壍.is_eligible;
            蕉壍.is_lost_budget += 焧壍.is_lost_budget;
        }
        return 蕉壍;
    }
    sum(逖壍: readonly string[], 崅壍: CivilDate, 篴壍: CivilDate): DailyFacts {
        const 髣壍: DailyFacts = { cost: 0, conversions: 0, conv_value: 0, clicks: 0, impressions: 0, is_eligible: 0, is_lost_budget: 0 };
        if (崅壍 > 篴壍)
            return 髣壍;
        for (const 柒壍 of enumerate(崅壍, 篴壍)) {
            const 蛁壍 = this.day(逖壍, 柒壍);
            髣壍.cost += 蛁壍.cost;
            髣壍.conversions += 蛁壍.conversions;
            髣壍.conv_value += 蛁壍.conv_value;
            髣壍.clicks += 蛁壍.clicks;
            髣壍.impressions += 蛁壍.impressions;
            髣壍.is_eligible += 蛁壍.is_eligible;
            髣壍.is_lost_budget += 蛁壍.is_lost_budget;
        }
        return 髣壍;
    }
    campaigns(): string[] {
        return [...this.byCampaign.keys()];
    }
}
export function weekdayFactors(厰壍: (犟壍: CivilDate) => number, 醎壍: CivilDate, 幽壍 = 28): number[] {
    const 絬壍 = new Array<number>(7).fill(0);
    const 鱛壍 = new Array<number>(7).fill(0);
    for (let 楊壍 = 0; 楊壍 < 幽壍; 楊壍++) {
        const 蠹壍 = addDays(醎壍, -楊壍);
        const 唨壍 = dow(蠹壍);
        絬壍[唨壍] = (絬壍[唨壍] as number) + 厰壍(蠹壍);
        鱛壍[唨壍] = (鱛壍[唨壍] as number) + 1;
    }
    const 琗壍 = 絬壍.map((錆壍, 念壍) => ((鱛壍[念壍] as number) > 0 ? 錆壍 / (鱛壍[念壍] as number) : Number.NaN));
    const 绤壍 = 琗壍.filter((鷓壍) => Number.isFinite(鷓壍));
    const 櫂壍 = 绤壍.length ? 绤壍.reduce((覱壍, 嚠壍) => 覱壍 + 嚠壍, 0) / 绤壍.length : 0;
    if (櫂壍 <= 0)
        return new Array<number>(7).fill(1);
    return 琗壍.map((疏壍) => (Number.isFinite(疏壍) ? 疏壍 / 櫂壍 : 1));
}
