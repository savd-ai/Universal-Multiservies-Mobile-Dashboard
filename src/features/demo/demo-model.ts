import type { DemoCampaignRow, DemoDailyRow, DemoDataset } from "@/lib/domain/contracts/demo";
export interface DemoTotals {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conv_value: number;
    ctr: number | null;
    cpa: number | null;
    roas: number | null;
}
export interface DemoCampaignSummary extends DemoTotals {
    campaign: DemoCampaignRow;
}
export interface DemoDailySeries {
    dates: string[];
    cost: number[];
    conversions: number[];
}
const ratio = (num: number, den: number) => (den === 0 ? null : num / den);
export function summarize(rows: readonly DemoDailyRow[]): DemoTotals {
    const sum = { cost: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 };
    for (const row of rows) {
        sum.cost += row.cost;
        sum.impressions += row.impressions;
        sum.clicks += row.clicks;
        sum.conversions += row.conversions;
        sum.conv_value += row.conv_value;
    }
    return { ...sum, ctr: ratio(sum.clicks, sum.impressions), cpa: ratio(sum.cost, sum.conversions), roas: ratio(sum.conv_value, sum.cost) };
}
export function campaignSummaries(data: DemoDataset): DemoCampaignSummary[] {
    const byCampaign = new Map<string, DemoDailyRow[]>();
    for (const row of data.daily)
        byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) ?? []), row]);
    return data.campaigns.map((campaign) => ({ campaign, ...summarize(byCampaign.get(campaign.id) ?? []) }));
}
export function dailySeries(rows: readonly DemoDailyRow[]): DemoDailySeries {
    const byDate = new Map<string, {
        cost: number;
        conversions: number;
    }>();
    for (const row of rows) {
        const day = byDate.get(row.date) ?? { cost: 0, conversions: 0 };
        day.cost += row.cost;
        day.conversions += row.conversions;
        byDate.set(row.date, day);
    }
    const dates = [...byDate.keys()].sort();
    return { dates, cost: dates.map((date) => byDate.get(date)!.cost), conversions: dates.map((date) => byDate.get(date)!.conversions) };
}
export function dateSpan(rows: readonly DemoDailyRow[]): {
    start: string;
    end: string;
} | null {
    if (rows.length === 0)
        return null;
    const dates = rows.map((row) => row.date).sort();
    return { start: dates[0]!, end: dates.at(-1)! };
}
