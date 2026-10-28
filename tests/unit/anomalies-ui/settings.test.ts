import { describe, expect, it } from "vitest";
import { defaultAnomalySettings } from "@/lib/domain/contracts/anomaly";
import { changeHistoryOf, detectorPatch, detectorSettingsErrors, fromPct, sameDetectorSettings, toPct } from "@/features/anomalies/helpers/settings";
describe("detector settings draft", () => {
    const base = defaultAnomalySettings();
    it("leaves threshold rules out of the PUT body", () => {
        const withRule = { ...base, thresholdRules: [{ id: "r1", name: "x", enabled: true, scope: { level: "campaign" as const }, metric: "cpa", op: "gt" as const, value: 1, window: { kind: "last_n_days" as const, days: 1 }, severity: "warning" as const }] };
        const patch = detectorPatch(withRule);
        expect("thresholdRules" in patch).toBe(false);
        expect(patch.zscore).toEqual(base.zscore);
    });
    it("compares drafts regardless of key order and undefined keys", () => {
        const reordered = { ...base, pacing: { under: base.pacing.under, overCritical: base.pacing.overCritical, over: base.pacing.over, enabled: base.pacing.enabled, dailyOver: undefined } };
        expect(sameDetectorSettings(base, reordered)).toBe(true);
        expect(sameDetectorSettings(base, { ...base, pacing: { ...base.pacing, dailyOver: 1.3 } })).toBe(false);
        expect(sameDetectorSettings(base, { ...base, excludeCampaignIds: ["c1"] })).toBe(false);
        expect(sameDetectorSettings(base, { ...base, thresholdRules: withRules() })).toBe(true);
    });
    it("accepts the defaults and flags bad values", () => {
        expect(detectorSettingsErrors(base)).toEqual([]);
        const bad = {
            ...base,
            zscore: { ...base.zscore, threshold: 9, recentDays: 2.5 },
            pacing: { ...base.pacing, over: 1.2, overCritical: 1.1, dailyOver: 1.6, dailyOverCritical: 1.5 },
            minVolume: { ...base.minVolume, clicksPerDay: Number.NaN },
        };
        expect(detectorSettingsErrors(bad)).toEqual([
            "Z-score threshold must be between 1 and 8.",
            "Z-score recent window must be 1–7 days.",
            "Critical overpacing must be at or above the warning level.",
            "Daily run-rate critical must be 100–300% and at or above the warning.",
            "Minimum clicks per day can't be negative.",
        ]);
    });
    it("fills change-history defaults for settings from before the option and validates its ranges", () => {
        const { changeHistory: _omit, ...old } = base;
        expect(changeHistoryOf(old as typeof base)).toEqual({ enabled: true, lookbackDays: 3, learningDays: 7, downgradeExpected: true, capDuringLearning: true });
        expect(changeHistoryOf({ ...base, changeHistory: { ...base.changeHistory, learningDays: 0 } }).learningDays).toBe(0);
        expect(detectorSettingsErrors(old as typeof base)).toEqual([]);
        expect(detectorSettingsErrors({ ...base, changeHistory: { ...base.changeHistory, lookbackDays: 0, learningDays: 30 } })).toEqual([
            "Change history: the cause lookback must be 1–14 days.",
            "Change history: the learning period must be 0–21 days.",
        ]);
        expect(sameDetectorSettings(base, { ...base, changeHistory: { ...base.changeHistory, capDuringLearning: false } })).toBe(false);
    });
    it("converts ratios to whole percents without float noise", () => {
        expect(toPct(1.05)).toBe(105);
        expect(toPct(0.2)).toBe(20);
        expect(fromPct(105)).toBe(1.05);
        expect(fromPct(12.5)).toBe(0.125);
        expect(Number.isNaN(fromPct(Number.NaN))).toBe(true);
    });
});
function withRules() {
    return [{ id: "r2", name: "y", enabled: false, scope: { level: "account" as const }, metric: "cost", op: "gt" as const, value: 5, window: { kind: "consecutive_days" as const, days: 2 }, severity: "info" as const }];
}
