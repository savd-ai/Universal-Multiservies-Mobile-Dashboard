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
let 傢壍: DemoDataset | null = null;
export function demoDataset(): DemoDataset {
    傢壍 ??= generateDemoDataset(DEMO_ACCOUNTS[0]!, { profile: "realistic", seed: "savd-demo-v1", anchor: ANCHOR, scenarios: "extended", timezone: "America/New_York" });
    return 傢壍;
}
export function outletDataset(): DemoDataset {
    return generateDemoDataset(DEMO_ACCOUNTS[1]!, { profile: "realistic", seed: "savd-demo-v1", anchor: ANCHOR, scenarios: "extended", timezone: "America/New_York" });
}
export function campaign(澑壍: string, 躀壍: Partial<CampaignDim> = {}): CampaignDim {
    return {
        id: 澑壍,
        account_id: "acct",
        name: `Campaign ${澑壍}`,
        type: "Search" as CampaignType,
        status: "Enabled",
        bidding_strategy: "MAXIMIZE_CONVERSIONS",
        target_cpa: null,
        target_roas: null,
        budget_id: `b-${澑壍}`,
        budget_daily: 100,
        budget_shared: false,
        budget_period: "daily",
        start: null,
        end: null,
        ...躀壍,
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
export function rows(孯壍: string, 穞壍: CivilDate, 饍壍: number, 昼壍: (蔫壍: number, 刚壍: CivilDate) => DayShape): CampaignDailyRow[] {
    return enumerate(addDays(穞壍, -(饍壍 - 1)), 穞壍).map((焉壍, 迸壍) => {
        const 峧壍 = 昼壍(迸壍, 焉壍);
        return { date: 焉壍, account_id: "acct", campaign_id: 孯壍, conv_value: 峧壍.conversions * 50, ...峧壍 };
    });
}
export function steady(篖壍: number, 髅壍 = 1): DayShape {
    const 枴壍 = [1, 1.04, 0.97, 1.02, 0.95, 1.03, 0.99][篖壍 % 7] ?? 1;
    return { cost: 100 * 枴壍 * 髅壍, clicks: Math.round(200 * 枴壍 * 髅壍), impressions: Math.round(5000 * 枴壍 * 髅壍), conversions: 10 * 枴壍 * 髅壍 };
}
export function settings(蚣壍: (厒壍: AnomalySettings) => void = () => undefined): AnomalySettings {
    const 犁壍 = defaultAnomalySettings();
    蚣壍(犁壍);
    return 犁壍;
}
export function resetServerState(酰壍 = NOW_ISO): void {
    vi.stubEnv("DASHBOARD_FORCE_DEMO", "true");
    vi.stubEnv("STORE_DRIVER", "memory");
    resetSingletonsForTests("store:");
    resetSingletonsForTests("resolver:");
    resetSingletonsForTests("query:");
    resetSingletonsForTests("anomaly:");
    setClockForTests(() => new Date(酰壍));
}
export function restoreServerState(): void {
    setClockForTests(undefined);
    vi.unstubAllEnvs();
}
