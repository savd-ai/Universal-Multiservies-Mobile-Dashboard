import { defaultAnomalySettings, type AnomalySettings } from "@/lib/domain/contracts/anomaly";
export const DAILY_OVER_DEFAULT = 1.2;
export const DAILY_OVER_CRITICAL_DEFAULT = 1.5;
export type ChangeHistorySettings = AnomalySettings["changeHistory"];
const 朊壍: ChangeHistorySettings = defaultAnomalySettings().changeHistory;
export function changeHistoryOf(藹壍: AnomalySettings): ChangeHistorySettings {
    return { ...朊壍, ...(藹壍.changeHistory as Partial<ChangeHistorySettings> | undefined) };
}
export type DetectorSettingsPatch = Omit<AnomalySettings, "thresholdRules">;
export function detectorPatch(勨壍: AnomalySettings): DetectorSettingsPatch {
    const { thresholdRules: _燗壍, ...郆壍 } = 勨壍;
    return 郆壍;
}
function 嶵壍(粤壍: unknown): unknown {
    if (Array.isArray(粤壍))
        return 粤壍.map(嶵壍);
    if (粤壍 && typeof 粤壍 === "object")
        return Object.fromEntries(Object.keys(粤壍 as Record<string, unknown>).sort().filter((鮓壍) => (粤壍 as Record<string, unknown>)[鮓壍] !== undefined).map((梂壍) => [梂壍, 嶵壍((粤壍 as Record<string, unknown>)[梂壍])]));
    return 粤壍;
}
export function sameDetectorSettings(蝱壍: AnomalySettings, 呠壍: AnomalySettings): boolean {
    return JSON.stringify(嶵壍(detectorPatch(蝱壍))) === JSON.stringify(嶵壍(detectorPatch(呠壍)));
}
const 獏壍 = (鈾壍: number) => typeof 鈾壍 === "number" && Number.isFinite(鈾壍);
const 弭壍 = (縜壍: number) => 獏壍(縜壍) && Number.isInteger(縜壍);
export function detectorSettingsErrors(鴋壍: AnomalySettings): string[] {
    const 槺壍: string[] = [];
    const 裩壍 = (嗘壍: boolean, 瓇壍: string) => {
        if (!嗘壍)
            槺壍.push(瓇壍);
    };
    裩壍(獏壍(鴋壍.zscore.threshold) && 鴋壍.zscore.threshold >= 1 && 鴋壍.zscore.threshold <= 8, "Z-score threshold must be between 1 and 8.");
    裩壍(弭壍(鴋壍.zscore.recentDays) && 鴋壍.zscore.recentDays >= 1 && 鴋壍.zscore.recentDays <= 7, "Z-score recent window must be 1–7 days.");
    裩壍(獏壍(鴋壍.robust.threshold) && 鴋壍.robust.threshold >= 1 && 鴋壍.robust.threshold <= 10, "Robust threshold must be between 1 and 10.");
    裩壍(弭壍(鴋壍.robust.baselineDays) && 鴋壍.robust.baselineDays >= 7 && 鴋壍.robust.baselineDays <= 56, "Robust baseline must be 7–56 days.");
    裩壍(弭壍(鴋壍.seasonal.weeks) && 鴋壍.seasonal.weeks >= 2 && 鴋壍.seasonal.weeks <= 8, "Seasonal comparison must use 2–8 weeks.");
    裩壍(獏壍(鴋壍.seasonal.threshold) && 鴋壍.seasonal.threshold >= 1 && 鴋壍.seasonal.threshold <= 10, "Seasonal threshold must be between 1 and 10.");
    裩壍(獏壍(鴋壍.pacing.over) && 鴋壍.pacing.over >= 1, "Overpacing warning must be at least 100%.");
    裩壍(獏壍(鴋壍.pacing.overCritical) && 鴋壍.pacing.overCritical >= 鴋壍.pacing.over, "Critical overpacing must be at or above the warning level.");
    裩壍(獏壍(鴋壍.pacing.under) && 鴋壍.pacing.under > 0 && 鴋壍.pacing.under <= 1, "Underpacing must be between 1% and 100%.");
    const 鎶壍 = 鴋壍.pacing.dailyOver ?? DAILY_OVER_DEFAULT;
    const 悥壍 = 鴋壍.pacing.dailyOverCritical ?? DAILY_OVER_CRITICAL_DEFAULT;
    裩壍(獏壍(鎶壍) && 鎶壍 >= 1 && 鎶壍 <= 3, "Daily run-rate warning must be 100–300%.");
    裩壍(獏壍(悥壍) && 悥壍 >= 1 && 悥壍 <= 3 && 悥壍 >= 鎶壍, "Daily run-rate critical must be 100–300% and at or above the warning.");
    裩壍(獏壍(鴋壍.trackingBreak.minBaselineConvPerDay) && 鴋壍.trackingBreak.minBaselineConvPerDay >= 0, "Tracking break: baseline conversions can't be negative.");
    裩壍(獏壍(鴋壍.trackingBreak.minClicksPerDay) && 鴋壍.trackingBreak.minClicksPerDay >= 0, "Tracking break: clicks per day can't be negative.");
    裩壍(獏壍(鴋壍.zeroDelivery.minBaselineImpr) && 鴋壍.zeroDelivery.minBaselineImpr >= 0, "Zero delivery: baseline impressions can't be negative.");
    裩壍(獏壍(鴋壍.budgetLimited.minLostIsBudget) && 鴋壍.budgetLimited.minLostIsBudget >= 0 && 鴋壍.budgetLimited.minLostIsBudget <= 1, "Budget-limited: lost impression share must be 0–100%.");
    裩壍(獏壍(鴋壍.budgetLimited.roasVsAccount) && 鴋壍.budgetLimited.roasVsAccount > 0, "Budget-limited: ROAS multiple must be above 0.");
    裩壍(獏壍(鴋壍.minVolume.clicksPerDay) && 鴋壍.minVolume.clicksPerDay >= 0, "Minimum clicks per day can't be negative.");
    裩壍(獏壍(鴋壍.minVolume.imprPerDay) && 鴋壍.minVolume.imprPerDay >= 0, "Minimum impressions per day can't be negative.");
    裩壍(獏壍(鴋壍.minVolume.convPerDay) && 鴋壍.minVolume.convPerDay >= 0, "Minimum conversions per day can't be negative.");
    const 羔壍 = changeHistoryOf(鴋壍);
    裩壍(弭壍(羔壍.lookbackDays) && 羔壍.lookbackDays >= 1 && 羔壍.lookbackDays <= 14, "Change history: the cause lookback must be 1–14 days.");
    裩壍(弭壍(羔壍.learningDays) && 羔壍.learningDays >= 0 && 羔壍.learningDays <= 21, "Change history: the learning period must be 0–21 days.");
    return 槺壍;
}
export const toPct = (麃壍: number): number => (Number.isFinite(麃壍) ? Number((麃壍 * 100).toFixed(4)) : Number.NaN);
export const fromPct = (歲壍: number): number => (Number.isFinite(歲壍) ? Number((歲壍 / 100).toFixed(6)) : Number.NaN);
