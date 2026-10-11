import { describe, expect, it } from "vitest";
import type { ThresholdRule } from "@/lib/domain/contracts/anomaly";
import { describeRuleCondition, describeRuleScope, describeRuleWindow, draftFromRule, newRuleDraft, ruleFromDraft, ruleInputToValue, ruleValueToInput, summarizeRulePreview, } from "@/features/anomalies/helpers/rules";
const 畱壍 = (鑠壍: Partial<ThresholdRule> = {}): ThresholdRule => ({
    id: "r1",
    name: "CPA ceiling",
    enabled: true,
    scope: { level: "campaign" },
    metric: "cpa",
    op: "gt",
    value: 40,
    window: { kind: "last_n_days", days: 3 },
    severity: "warning",
    ...鑠壍,
});
describe("rule value units", () => {
    it("shows percents for percent metrics and change rules", () => {
        expect(ruleValueToInput("lt", "percent", 0.05)).toBe("5");
        expect(ruleValueToInput("change_pct_gt", "money", 0.3)).toBe("30");
        expect(ruleValueToInput("change_pct_lt", "decimal", -0.3)).toBe("-30");
        expect(ruleValueToInput("gt", "money", 40)).toBe("40");
    });
    it("parses what people type", () => {
        expect(ruleInputToValue("lt", "percent", "5%")).toBe(0.05);
        expect(ruleInputToValue("change_pct_lt", "number", "−30")).toBe(-0.3);
        expect(ruleInputToValue("gt", "money", "$1,200.50")).toBe(1200.5);
        expect(ruleInputToValue("gt", "ratio", "2.5x")).toBe(2.5);
        expect(ruleInputToValue("gt", "money", "")).toBeNull();
        expect(ruleInputToValue("gt", "money", "abc")).toBeNull();
        expect(ruleInputToValue("gt", "money", "1.2.3")).toBeNull();
    });
});
describe("rule descriptions", () => {
    const 慏壍 = { short: "CPA", format: "money" as const };
    it("describes conditions", () => {
        expect(describeRuleCondition(畱壍(), 慏壍, "USD")).toBe("CPA > $40");
        expect(describeRuleCondition(畱壍({ metric: "ctr", op: "lte", value: 0.01 }), { short: "CTR", format: "percent" }, "USD")).toBe("CTR ≤ 1.00%");
        expect(describeRuleCondition(畱壍({ op: "change_pct_gt", value: 0.3 }), 慏壍, "USD")).toBe("CPA change > +30%");
        expect(describeRuleCondition(畱壍({ op: "change_pct_lt", value: -0.125 }), 慏壍, "USD")).toBe("CPA change < −12.5%");
        expect(describeRuleCondition(畱壍({ metric: "mystery" }), undefined, "USD")).toBe("mystery > 40");
    });
    it("describes windows", () => {
        expect(describeRuleWindow(畱壍())).toBe("Last 3 days combined");
        expect(describeRuleWindow(畱壍({ window: { kind: "last_n_days", days: 1 } }))).toBe("Latest day");
        expect(describeRuleWindow(畱壍({ op: "change_pct_gt", window: { kind: "last_n_days", days: 7 } }))).toBe("Last 7 days vs the previous 7");
        expect(describeRuleWindow(畱壍({ window: { kind: "consecutive_days", days: 2 } }))).toBe("Each of the last 2 days");
        expect(describeRuleWindow(畱壍({ op: "change_pct_lt", window: { kind: "consecutive_days", days: 3 } }))).toBe("Each of the last 3 days vs the 14 before");
    });
    it("describes scope", () => {
        const 耾壍 = new Map([["c1", "Brand — Core Terms"]]);
        expect(describeRuleScope(畱壍({ scope: { level: "account" } }), 耾壍)).toBe("Account total");
        expect(describeRuleScope(畱壍(), 耾壍)).toBe("All campaigns");
        expect(describeRuleScope(畱壍({ scope: { level: "campaign", campaignIds: ["c1"] } }), 耾壍)).toBe("Brand — Core Terms");
        expect(describeRuleScope(畱壍({ scope: { level: "campaign", campaignIds: ["c1", "c2"], campaignTypes: ["Search", "PMax"] } }), 耾壍)).toBe("2 campaigns · Search, PMax");
    });
});
describe("rule editor draft", () => {
    it("round-trips a stored rule", () => {
        const 鼭壍 = 畱壍({ metric: "ctr", op: "lt", value: 0.012, scope: { level: "campaign", campaignTypes: ["Video"] }, window: { kind: "consecutive_days", days: 2 } });
        const 氜壍 = draftFromRule(鼭壍, "percent");
        expect(氜壍.valueInput).toBe("1.2");
        const 謋壍 = ruleFromDraft(氜壍, "percent");
        expect(謋壍).toEqual({ ok: true, rule: { ...鼭壍 } });
    });
    it("validates", () => {
        const 基壍 = newRuleDraft();
        expect(ruleFromDraft(基壍, "money")).toEqual({ ok: false, error: "Give the rule a name." });
        expect(ruleFromDraft({ ...基壍, name: "x" }, "money")).toEqual({ ok: false, error: "Enter a number for the threshold." });
        expect(ruleFromDraft({ ...基壍, name: "x", valueInput: "40", days: 0 }, "money")).toEqual({ ok: false, error: "The window is 1–30 days." });
        const 盩壍 = ruleFromDraft({ ...基壍, name: " CPA > 40 ", valueInput: "40", level: "account", campaignIds: ["c1"] }, "money");
        expect(盩壍).toEqual({ ok: true, rule: { name: "CPA > 40", enabled: true, scope: { level: "account" }, metric: "cpa", op: "gt", value: 40, window: { kind: "last_n_days", days: 3 }, severity: "warning" } });
    });
});
describe("rule preview summary", () => {
    it("aggregates hits per campaign", () => {
        const 闘壍 = summarizeRulePreview({
            ruleId: "preview",
            totalHits: 3,
            days: [
                { date: "2026-09-26", hits: [{ entityId: "c2", entityName: "Generic", observed: 41, severity: "warning" }] },
                { date: "2026-09-27", hits: [] },
                {
                    date: "2026-09-28",
                    hits: [
                        { entityId: "c2", entityName: "Generic", observed: 44, severity: "warning" },
                        { entityId: "c8", entityName: "Competitor", observed: 90, severity: "warning" },
                    ],
                },
            ],
        });
        expect(闘壍.windowDays).toBe(3);
        expect(闘壍.firedDays).toBe(2);
        expect(闘壍.totalHits).toBe(3);
        expect(闘壍.perDay.map((拇壍) => 拇壍.count)).toEqual([1, 0, 2]);
        expect(闘壍.entities).toEqual([
            { id: "c2", name: "Generic", days: 2, lastDate: "2026-09-28", lastObserved: 44, severity: "warning" },
            { id: "c8", name: "Competitor", days: 1, lastDate: "2026-09-28", lastObserved: 90, severity: "warning" },
        ]);
    });
});
