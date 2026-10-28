import { vi } from "vitest";
import { defaultAnomalySettings, type AnomalySettings } from "@/lib/domain/contracts/anomaly";
import { addDays, enumerate } from "@/lib/domain/dates";
import { generateDemoDataset, type DemoDataset } from "../../support/synthetic/generator";
import { DEMO_ACCOUNTS } from "../../support/synthetic/scenario";
import type { CampaignDailyRow, CampaignDim } from "@/lib/domain/schema/facts";
import type { CampaignType, CivilDate } from "@/lib/domain/types";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { setClockForTests } from "@/lib/server/clock";
export const ANCHOR = "2026-09-28";
export const NOW_ISO = "2026-09-29T12:00:00.000Z";
let demo: DemoDataset | null = null;
export function demoDataset(): DemoDataset {
    demo ??= generateDemoDataset(DEMO_ACCOUNTS[0]!, { profile: "realistic", seed: "savd-demo-v1", anchor: ANCHOR, scenarios: "extended", timezone: "America/New_York" });
    return demo;
}
export function outletDataset(): DemoDataset {
    return generateDemoDataset(DEMO_ACCOUNTS[1]!, { profile: "realistic", seed: "savd-demo-v1", anchor: ANCHOR, scenarios: "extended", timezone: "America/New_York" });
}
export function campaign(id: string, over: Partial<CampaignDim> = {}): CampaignDim {
    return {
        id,
        account_id: "acct",
        name: `Campaign ${id}`,
        type: "Search" as CampaignType,
        status: "Enabled",
        bidding_strategy: "MAXIMIZE_CONVERSIONS",
        target_cpa: null,
        target_roas: null,
        budget_id: `b-${id}`,
        budget_daily: 100,
        budget_shared: false,
        budget_period: "daily",
        start: null,
        end: null,
        ...over,
    };
}
export interface DayShape {
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conv_value?: number;
    is_eligible?: number;
    is_lost_budget?: number;
    is_search_impr?: number;
}
export function rows(campaignId: string, end: CivilDate, days: number, shape: (i: number, date: CivilDate) => DayShape): CampaignDailyRow[] {
    return enumerate(addDays(end, -(days - 1)), end).map((date, i) => {
        const s = shape(i, date);
        return { date, account_id: "acct", campaign_id: campaignId, conv_value: s.conversions * 50, ...s };
    });
}
export function steady(i: number, scale = 1): DayShape {
    const w = [1, 1.04, 0.97, 1.02, 0.95, 1.03, 0.99][i % 7] ?? 1;
    return { cost: 100 * w * scale, clicks: Math.round(200 * w * scale), impressions: Math.round(5000 * w * scale), conversions: 10 * w * scale };
}
export function settings(patch: (s: AnomalySettings) => void = () => undefined): AnomalySettings {
    const s = defaultAnomalySettings();
    patch(s);
    return s;
}
export function resetServerState(nowIso = NOW_ISO): void {
    vi.stubEnv("DASHBOARD_FORCE_DEMO", "true");
    vi.stubEnv("STORE_DRIVER", "memory");
    resetSingletonsForTests("store:");
    resetSingletonsForTests("resolver:");
    resetSingletonsForTests("query:");
    resetSingletonsForTests("anomaly:");
    setClockForTests(() => new Date(nowIso));
}
export function restoreServerState(): void {
    setClockForTests(undefined);
    vi.unstubAllEnvs();
}
