import { defaultAnomalySettings, type AnomalySettings } from "@/lib/domain/contracts/anomaly";
export const DAILY_OVER_DEFAULT = 1.2;
export const DAILY_OVER_CRITICAL_DEFAULT = 1.5;
export type ChangeHistorySettings = AnomalySettings["changeHistory"];
const CHANGE_HISTORY_DEFAULTS: ChangeHistorySettings = defaultAnomalySettings().changeHistory;
export function changeHistoryOf(s: AnomalySettings): ChangeHistorySettings {
    return { ...CHANGE_HISTORY_DEFAULTS, ...(s.changeHistory as Partial<ChangeHistorySettings> | undefined) };
}
export type DetectorSettingsPatch = Omit<AnomalySettings, "thresholdRules">;
export function detectorPatch(s: AnomalySettings): DetectorSettingsPatch {
    const { thresholdRules: _rules, ...rest } = s;
    return rest;
}
function stable(v: unknown): unknown {
    if (Array.isArray(v))
        return v.map(stable);
    if (v && typeof v === "object")
        return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, stable((v as Record<string, unknown>)[k])]));
    return v;
}
export function sameDetectorSettings(a: AnomalySettings, b: AnomalySettings): boolean {
    return JSON.stringify(stable(detectorPatch(a))) === JSON.stringify(stable(detectorPatch(b)));
}
const finite = (v: number) => typeof v === "number" && Number.isFinite(v);
const int = (v: number) => finite(v) && Number.isInteger(v);
export function detectorSettingsErrors(s: AnomalySettings): string[] {
    const out: string[] = [];
    const need = (ok: boolean, msg: string) => {
        if (!ok)
            out.push(msg);
    };
    need(finite(s.zscore.threshold) && s.zscore.threshold >= 1 && s.zscore.threshold <= 8, "Z-score threshold must be between 1 and 8.");
    need(int(s.zscore.recentDays) && s.zscore.recentDays >= 1 && s.zscore.recentDays <= 7, "Z-score recent window must be 1–7 days.");
    need(finite(s.robust.threshold) && s.robust.threshold >= 1 && s.robust.threshold <= 10, "Robust threshold must be between 1 and 10.");
    need(int(s.robust.baselineDays) && s.robust.baselineDays >= 7 && s.robust.baselineDays <= 56, "Robust baseline must be 7–56 days.");
    need(int(s.seasonal.weeks) && s.seasonal.weeks >= 2 && s.seasonal.weeks <= 8, "Seasonal comparison must use 2–8 weeks.");
    need(finite(s.seasonal.threshold) && s.seasonal.threshold >= 1 && s.seasonal.threshold <= 10, "Seasonal threshold must be between 1 and 10.");
    need(finite(s.pacing.over) && s.pacing.over >= 1, "Overpacing warning must be at least 100%.");
    need(finite(s.pacing.overCritical) && s.pacing.overCritical >= s.pacing.over, "Critical overpacing must be at or above the warning level.");
    need(finite(s.pacing.under) && s.pacing.under > 0 && s.pacing.under <= 1, "Underpacing must be between 1% and 100%.");
    const dOver = s.pacing.dailyOver ?? DAILY_OVER_DEFAULT;
    const dCrit = s.pacing.dailyOverCritical ?? DAILY_OVER_CRITICAL_DEFAULT;
    need(finite(dOver) && dOver >= 1 && dOver <= 3, "Daily run-rate warning must be 100–300%.");
    need(finite(dCrit) && dCrit >= 1 && dCrit <= 3 && dCrit >= dOver, "Daily run-rate critical must be 100–300% and at or above the warning.");
    need(finite(s.trackingBreak.minBaselineConvPerDay) && s.trackingBreak.minBaselineConvPerDay >= 0, "Tracking break: baseline conversions can't be negative.");
    need(finite(s.trackingBreak.minClicksPerDay) && s.trackingBreak.minClicksPerDay >= 0, "Tracking break: clicks per day can't be negative.");
    need(finite(s.zeroDelivery.minBaselineImpr) && s.zeroDelivery.minBaselineImpr >= 0, "Zero delivery: baseline impressions can't be negative.");
    need(finite(s.budgetLimited.minLostIsBudget) && s.budgetLimited.minLostIsBudget >= 0 && s.budgetLimited.minLostIsBudget <= 1, "Budget-limited: lost impression share must be 0–100%.");
    need(finite(s.budgetLimited.roasVsAccount) && s.budgetLimited.roasVsAccount > 0, "Budget-limited: ROAS multiple must be above 0.");
    need(finite(s.minVolume.clicksPerDay) && s.minVolume.clicksPerDay >= 0, "Minimum clicks per day can't be negative.");
    need(finite(s.minVolume.imprPerDay) && s.minVolume.imprPerDay >= 0, "Minimum impressions per day can't be negative.");
    need(finite(s.minVolume.convPerDay) && s.minVolume.convPerDay >= 0, "Minimum conversions per day can't be negative.");
    const ch = changeHistoryOf(s);
    need(int(ch.lookbackDays) && ch.lookbackDays >= 1 && ch.lookbackDays <= 14, "Change history: the cause lookback must be 1–14 days.");
    need(int(ch.learningDays) && ch.learningDays >= 0 && ch.learningDays <= 21, "Change history: the learning period must be 0–21 days.");
    return out;
}
export const toPct = (ratio: number): number => (Number.isFinite(ratio) ? Number((ratio * 100).toFixed(4)) : Number.NaN);
export const fromPct = (pct: number): number => (Number.isFinite(pct) ? Number((pct / 100).toFixed(6)) : Number.NaN);
