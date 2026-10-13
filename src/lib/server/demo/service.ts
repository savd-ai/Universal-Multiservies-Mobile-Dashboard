import "server-only";
import { DEMO_DAYS, type DemoResponse } from "@/lib/domain/contracts/demo";
import { addDays } from "@/lib/domain/dates";
import { DEMO_ACCOUNTS } from "@/lib/domain/demo-data/scenario";
import { accountYesterday } from "../clock";
import { DEMO_TIMEZONE, demoDataset } from "../datasource/demo-source";
const r2 = (value: number) => Math.round(value * 100) / 100;
export function openDemo(accountId?: string): DemoResponse {
    const spec = DEMO_ACCOUNTS.find((account) => account.id === accountId) ?? DEMO_ACCOUNTS[0]!;
    const data = demoDataset(spec.id, accountYesterday(DEMO_TIMEZONE));
    const from = addDays(data.anchor, -(DEMO_DAYS - 1));
    return {
        accounts: DEMO_ACCOUNTS.map((account) => ({ id: account.id, name: account.name })),
        dataset: {
            account: { id: data.account.id, name: data.account.name, currency: data.account.currency, timezone: data.account.timezone },
            campaigns: [...data.dims.campaigns.values()].map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status, bidding_strategy: c.bidding_strategy, budget_daily: c.budget_daily })),
            daily: data.tables.campaign_daily
                .filter((row) => row.date >= from && row.date <= data.anchor)
                .map((row) => ({ date: row.date, campaign_id: row.campaign_id, impressions: row.impressions, clicks: row.clicks, cost: r2(row.cost), conversions: r2(row.conversions), conv_value: r2(row.conv_value) })),
        },
    };
}
