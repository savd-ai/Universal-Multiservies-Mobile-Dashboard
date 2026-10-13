import { z } from "zod";
export interface DemoAccountRow {
    id: string;
    name: string;
    currency: string;
    timezone: string;
}
export interface DemoCampaignRow {
    id: string;
    name: string;
    type: string;
    status: string;
    bidding_strategy: string;
    budget_daily: number | null;
}
export interface DemoDailyRow {
    date: string;
    campaign_id: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conv_value: number;
}
export interface DemoDataset {
    account: DemoAccountRow;
    campaigns: DemoCampaignRow[];
    daily: DemoDailyRow[];
}
export const DEMO_DAYS = 90;
export const demoQuerySchema = z.object({
    account: z.string().regex(/^\d{1,20}$/).optional(),
});
export interface DemoResponse {
    accounts: { id: string; name: string }[];
    dataset: DemoDataset;
}
