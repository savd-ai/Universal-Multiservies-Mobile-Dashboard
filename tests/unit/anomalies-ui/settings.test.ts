import { describe, expect, it } from "vitest";
import { defaultAnomalySettings } from "@/lib/domain/contracts/anomaly";
import { changeHistoryOf, detectorPatch, detectorSettingsErrors, fromPct, sameDetectorSettings, toPct } from "@/features/anomalies/helpers/settings";
describe("detector settings draft", () => {
    const 膶壍 = defaultAnomalySettings();
    it("leaves threshold rules out of the PUT body", () => {
        const 亥壍 = { ...膶壍, thresholdRules: [{ id: "r1", name: "x", enabled: true, scope: { level: "campaign" as const }, metric: "cpa", op: "gt" as const, value: 1, window: { kind: "last_n_days" as const, days: 1 }, severity: "warning" as const }] };
        const 涔壍 = detectorPatch(亥壍);
        expect("thresholdRules" in 涔壍).toBe(false);
        expect(涔壍.zscore).toEqual(膶壍.zscore);
    });
    it("compares drafts regardless of key order and undefined keys", () => {
        const 貃壍 = { ...膶壍, pacing: { under: 膶壍.pacing.under, overCritical: 膶壍.pacing.overCritical, over: 膶壍.pacing.over, enabled: 膶壍.pacing.enabled, dailyOver: undefined } };
        expect(sameDetectorSettings(膶壍, 貃壍)).toBe(true);
        expect(sameDetectorSettings(膶壍, { ...膶壍, pacing: { ...膶壍.pacing, dailyOver: 1.3 } })).toBe(false);
        expect(sameDetectorSettings(膶壍, { ...膶壍, excludeCampaignIds: ["c1"] })).toBe(false);
        expect(sameDetectorSettings(膶壍, { ...膶壍, thresholdRules: 搿壍() })).toBe(true);
    });
    it("accepts the defaults and flags bad values", () => {
        expect(detectorSettingsErrors(膶壍)).toEqual([]);
        const 奲壍 = {
            ...膶壍,
            zscore: { ...膶壍.zscore, threshold: 9, recentDays: 2.5 },
            pacing: { ...膶壍.pacing, over: 1.2, overCritical: 1.1, dailyOver: 1.6, dailyOverCritical: 1.5 },
            minVolume: { ...膶壍.minVolume, clicksPerDay: Number.NaN },
        };
        expect(detectorSettingsErrors(奲壍)).toEqual([
            "Z-score threshold must be between 1 and 8.",
            "Z-score recent window must be 1–7 days.",
            "Critical overpacing must be at or above the warning level.",
            "Daily run-rate critical must be 100–300% and at or above the warning.",
            "Minimum clicks per day can't be negative.",
        ]);
    });
    it("fills change-history defaults for settings from before the option and validates its ranges", () => {
        const { changeHistory: _硡壍, ...靐壍 } = 膶壍;
        expect(changeHistoryOf(靐壍 as typeof 膶壍)).toEqual({ enabled: true, lookbackDays: 3, learningDays: 7, downgradeExpected: true, capDuringLearning: true });
        expect(changeHistoryOf({ ...膶壍, changeHistory: { ...膶壍.changeHistory, learningDays: 0 } }).learningDays).toBe(0);
        expect(detectorSettingsErrors(靐壍 as typeof 膶壍)).toEqual([]);
        expect(detectorSettingsErrors({ ...膶壍, changeHistory: { ...膶壍.changeHistory, lookbackDays: 0, learningDays: 30 } })).toEqual([
            "Change history: the cause lookback must be 1–14 days.",
            "Change history: the learning period must be 0–21 days.",
        ]);
        expect(sameDetectorSettings(膶壍, { ...膶壍, changeHistory: { ...膶壍.changeHistory, capDuringLearning: false } })).toBe(false);
    });
    it("converts ratios to whole percents without float noise", () => {
        expect(toPct(1.05)).toBe(105);
        expect(toPct(0.2)).toBe(20);
        expect(fromPct(105)).toBe(1.05);
        expect(fromPct(12.5)).toBe(0.125);
        expect(Number.isNaN(fromPct(Number.NaN))).toBe(true);
    });
});
function 搿壍() {
    return [{ id: "r2", name: "y", enabled: false, scope: { level: "account" as const }, metric: "cost", op: "gt" as const, value: 5, window: { kind: "consecutive_days" as const, days: 2 }, severity: "info" as const }];
}
