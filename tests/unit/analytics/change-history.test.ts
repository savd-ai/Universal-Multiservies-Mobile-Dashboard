import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectSignals, type DetectionInput } from "@/lib/domain/anomaly";
import { changeCategory, changeClient, parseChange } from "@/lib/domain/anomaly/changes";
import { changeCopy, EXTERNAL_RECOMMENDATIONS, lagPhrase, RECOMMENDATIONS } from "@/lib/domain/anomaly/recommendations";
import { buildPacingReport } from "@/lib/domain/budget/pacing";
import { anomalySettingsSchema, defaultAnomalySettings, type AnomalySettings, type Signal, type SignalKind, type ThresholdRule } from "@/lib/domain/contracts/anomaly";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import type { CampaignDailyRow, CampaignDim, ChangeEvent } from "@/lib/domain/schema/facts";
import { getAnomalyFeed, getAnomalySettings, updateAnomalySettings } from "@/lib/server/anomaly/service";
import { loadChangeHistory } from "@/lib/server/budget/data";
import { requestContext, type RequestContext } from "@/lib/server/context";
import { getStore } from "@/lib/server/store";
import { ANCHOR, campaign, NOW_ISO, resetServerState, restoreServerState, rows, settings, steady, type DayShape } from "./helpers";
const registry = new MetricRegistry();
let seq = 0;
function change(over: Partial<ChangeEvent> & Pick<ChangeEvent, "date">): ChangeEvent {
    seq += 1;
    return { id: `e${seq}`, ts: `${over.date} 09:00:00`, resource_type: "CAMPAIGN", operation: "update", campaign_id: "x1", changed_fields: [], diffs: [], summary: "Campaign updated", client_type: "GOOGLE_ADS_WEB_CLIENT", ...over };
}
const budget = (date: string, before: number, after: number, campaignId = "x1") => change({ date, resource_type: "CAMPAIGN_BUDGET", campaign_id: campaignId, changed_fields: ["amount_micros"], diffs: [{ field: "amount", before, after }], summary: `Budget changed from $${before}.00 to $${after}.00` });
const strategySwitch = (date: string) => change({
    date,
    changed_fields: ["bidding_strategy_type", "target_cpa.target_cpa_micros"],
    diffs: [
        { field: "bidding_strategy_type", before: "TARGET_CPA", after: "MAXIMIZE_CONVERSIONS" },
        { field: "target_cpa.target_cpa", before: 28, after: null },
    ],
    summary: "Bid strategy changed from Target CPA ($28) to Maximize conversions",
});
const finalUrl = (date: string) => change({ date, resource_type: "ASSET", changed_fields: ["final_urls"], diffs: [{ field: "final_urls", before: "https://x.example/a", after: "https://x.example/b" }], summary: "Final URL changed" });
const keywordAdded = (date: string) => change({ date, resource_type: "AD_GROUP_CRITERION", operation: "create", changed_fields: ["ad_group", "status", "keyword.text", "keyword.match_type"], diffs: [{ field: "status", before: null, after: "ENABLED" }], summary: "Keyword “trail shoes” added (Broad match)" });
const negativeAdded = (date: string) => change({ date, resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["keyword.text", "keyword.match_type", "negative"], diffs: [{ field: "negative", before: null, after: "true" }], summary: "Negative keyword “free” added" });
const status = (date: string, resource: ChangeEvent["resource_type"], text: string, to: string, summary: string) => change({ date, resource_type: resource, changed_fields: ["status"], diffs: [{ field: "status", before: text, after: to }], summary });
const targetCpa = (date: string, before: number, after: number) => change({ date, changed_fields: ["target_cpa.target_cpa_micros"], diffs: [{ field: "target_cpa.target_cpa", before, after }], summary: `Target CPA changed from $${before}.00 to $${after}.00` });
const targetRoas = (date: string, before: number, after: number) => change({ date, changed_fields: ["maximize_conversion_value.target_roas"], diffs: [{ field: "maximize_conversion_value.target_roas", before, after }], summary: `Target ROAS changed from ${before * 100}% to ${after * 100}%` });
function scaled(d: DayShape, k: number | Partial<Record<"cost" | "clicks" | "impressions" | "conversions", number>>): DayShape {
    const f = typeof k === "number" ? { cost: k, clicks: k, impressions: k, conversions: k } : k;
    return { ...d, cost: d.cost * (f.cost ?? 1), clicks: Math.round(d.clicks * (f.clicks ?? 1)), impressions: Math.round(d.impressions * (f.impressions ?? 1)), conversions: d.conversions * (f.conversions ?? 1) };
}
const series = (shape: (i: number) => DayShape) => rows("x1", ANCHOR, 40, shape);
const handler = (first: number, k: Parameters<typeof scaled>[1]) => series((i) => (i >= first ? scaled(steady(i), k) : steady(i)));
function detect(data: CampaignDailyRow[], events: ChangeEvent[] | undefined, patch: Partial<DetectionInput> = {}, campaigns: CampaignDim[] = [campaign("x1")]): Signal[] {
    return detectSignals({ accountId: "acct", accountName: "Test account", mode: "live", currency: "USD", dataThrough: ANCHOR, now: NOW_ISO, settings: settings(), campaigns, rows: data, changeEvents: events, registry, ...patch }).signals;
}
const withSettings = (patch: (s: AnomalySettings) => void): Partial<DetectionInput> => ({ settings: settings(patch) });
const metric = (signals: Signal[], m: string) => signals.find((s) => s.kind === "metric_deviation" && s.metric === m);
describe("change classification (resource type first, then fields)", () => {
    const cat = (over: Partial<ChangeEvent>) => changeCategory(change({ date: ANCHOR, ...over }));
    it("classifies campaign, budget and ad-group changes", () => {
        expect(cat({ resource_type: "CAMPAIGN_BUDGET", changed_fields: ["amount_micros"] })).toBe("budget");
        expect(cat({ changed_fields: ["bidding_strategy_type"] })).toBe("bidding");
        expect(cat({ changed_fields: ["maximize_conversion_value.target_roas"] })).toBe("bid_target");
        expect(cat({ changed_fields: ["status"] })).toBe("status");
        expect(cat({ changed_fields: ["end_date_time"] })).toBe("status");
        expect(cat({ changed_fields: ["campaign_budget"] })).toBe("budget");
        expect(cat({ changed_fields: ["final_url_suffix"] })).toBe("landing");
        expect(cat({ changed_fields: ["network_settings.target_content_network"] })).toBe("targeting");
        expect(cat({ changed_fields: ["name"] })).toBe("other");
        expect(cat({ resource_type: "AD_GROUP", changed_fields: ["cpc_bid_micros"] })).toBe("bid_target");
        expect(cat({ resource_type: "AD_GROUP", changed_fields: ["status"] })).toBe("status");
    });
    it("files ad and asset edits under creative unless only URLs changed", () => {
        expect(cat({ resource_type: "AD_GROUP_AD", changed_fields: ["status"] })).toBe("creative");
        expect(cat({ resource_type: "AD_GROUP_AD", operation: "create", changed_fields: ["ad.video_ad"] })).toBe("creative");
        expect(cat({ resource_type: "AD_GROUP_AD", changed_fields: ["ad.responsive_search_ad.headlines"] })).toBe("creative");
        expect(cat({ resource_type: "AD_GROUP_AD", changed_fields: ["final_urls"] })).toBe("landing");
        expect(cat({ resource_type: "ASSET", changed_fields: ["final_urls"] })).toBe("landing");
        expect(cat({ resource_type: "ASSET", changed_fields: ["sitelink"] })).toBe("creative");
    });
    it("a keyword created with a status field is a keyword change, not a status change (old quirk)", () => {
        expect(changeCategory(keywordAdded(ANCHOR))).toBe("keywords");
        expect(cat({ resource_type: "AD_GROUP_CRITERION", changed_fields: ["status"], summary: "Keyword paused" })).toBe("keywords");
        expect(cat({ resource_type: "AD_GROUP_CRITERION", changed_fields: ["cpc_bid_micros"], summary: "Keyword bid changed from $1.20 to $1.40" })).toBe("bid_target");
    });
    it("separates negatives from other criteria", () => {
        expect(changeCategory(negativeAdded(ANCHOR))).toBe("negatives");
        expect(cat({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["negative_keyword"], summary: "5 negative keywords added" })).toBe("negatives");
        expect(cat({ resource_type: "AD_GROUP_CRITERION", operation: "create", changed_fields: ["keyword.text", "negative"], diffs: [{ field: "negative", before: null, after: "false" }], summary: "Keyword “x” added" })).toBe("keywords");
        expect(cat({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["audience"], summary: "Audience segment added (observation)" })).toBe("targeting");
        expect(cat({ resource_type: "CAMPAIGN_CRITERION", changed_fields: ["bid_modifier"], summary: "Bid adjustment changed" })).toBe("bid_target");
    });
    it("falls back to the fields for other resources and reads simulated demo events", () => {
        expect(cat({ resource_type: "OTHER", changed_fields: ["bid_modifier", "device.type"] })).toBe("bid_target");
        expect(cat({ resource_type: "OTHER", changed_fields: ["foo"] })).toBe("other");
        expect(cat({ changed_fields: ["campaign.pause"], diffs: [{ field: "status", before: "ENABLED", after: "PAUSED" }] })).toBe("status");
        expect(cat({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["keywords.add_negatives"] })).toBe("negatives");
    });
});
describe("change direction parsing", () => {
    it("budget raised / lowered with before → after", () => {
        expect(parseChange(budget(ANCHOR, 780, 1092))).toMatchObject({ category: "budget", subject: "budget", action: "raised", before: 780, after: 1092, effect: "Budget +40% ($780 → $1,092)" });
        expect(parseChange(budget(ANCHOR, 780, 1092)).pct).toBeCloseTo(0.4, 9);
        expect(parseChange(budget(ANCHOR, 400, 300))).toMatchObject({ action: "lowered", effect: "Budget −25% ($400 → $300)" });
        expect(parseChange(budget(ANCHOR, 12000, 15000))).toMatchObject({ effect: "Budget +25% ($12,000 → $15,000)" });
    });
    it("target CPA / ROAS raised or lowered", () => {
        expect(parseChange(targetCpa(ANCHOR, 28, 35))).toMatchObject({ category: "bid_target", subject: "target_cpa", action: "raised", effect: "Target CPA +25% ($28 → $35)" });
        expect(parseChange(targetCpa(ANCHOR, 40, 30))).toMatchObject({ action: "lowered" });
        expect(parseChange(targetRoas(ANCHOR, 3.5, 4))).toMatchObject({ subject: "target_roas", action: "raised", effect: "Target ROAS +14% (350% → 400%)" });
    });
    it("strategy switches carry the target they dropped", () => {
        expect(parseChange(strategySwitch(ANCHOR))).toMatchObject({ category: "bidding", subject: "strategy", action: "switched", before: "TARGET_CPA", after: "MAXIMIZE_CONVERSIONS", target: { kind: "target_cpa", before: 28, after: null }, effect: "Target CPA ($28) → Maximize conversions" });
        const plain = change({ date: ANCHOR, changed_fields: ["bidding_strategy_type"], diffs: [{ field: "bidding_strategy_type", before: "MANUAL_CPC", after: "TARGET_SPEND" }] });
        expect(parseChange(plain).effect).toBe("Manual CPC → Maximize clicks");
    });
    it("paused / enabled / removed / added / updated", () => {
        expect(parseChange(status(ANCHOR, "CAMPAIGN", "ENABLED", "PAUSED", "Campaign paused"))).toMatchObject({ category: "status", action: "paused", effect: "Paused" });
        expect(parseChange(status(ANCHOR, "AD_GROUP", "PAUSED", "ENABLED", "Ad group enabled"))).toMatchObject({ action: "enabled", effect: "Enabled" });
        expect(parseChange(status(ANCHOR, "CAMPAIGN", "ENABLED", "REMOVED", "Campaign removed"))).toMatchObject({ action: "removed" });
        expect(parseChange(keywordAdded(ANCHOR))).toMatchObject({ category: "keywords", action: "added" });
        expect(parseChange(change({ date: ANCHOR, resource_type: "AD_GROUP_AD", operation: "remove" }))).toMatchObject({ action: "removed" });
        expect(parseChange(finalUrl(ANCHOR))).toMatchObject({ category: "landing", action: "updated", effect: "Final URL changed" });
    });
});
describe("change clients", () => {
    it("labels who made the change and whether it was automated", () => {
        expect(changeClient("GOOGLE_ADS_WEB_CLIENT")).toEqual({ label: "Google Ads web", automated: false });
        expect(changeClient("GOOGLE_ADS_EDITOR")).toEqual({ label: "Editor", automated: false });
        expect(changeClient("GOOGLE_ADS_MOBILE_APP")).toEqual({ label: "Mobile app", automated: false });
        expect(changeClient("SAVD_DASHBOARD_SIMULATION")).toEqual({ label: "SAVD simulation", automated: false });
        expect(changeClient("GOOGLE_ADS_API")).toMatchObject({ label: "API", automated: true });
        expect(changeClient("GOOGLE_ADS_SCRIPTS")).toMatchObject({ label: "Script", automated: true });
        expect(changeClient("GOOGLE_ADS_AUTOMATED_RULE")).toMatchObject({ label: "Automated rule", automated: true });
        expect(changeClient("GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION")).toMatchObject({ label: "Google recommendations (auto-applied)", automated: true });
        expect(changeClient("GOOGLE_ADS_RECOMMENDATIONS")).toMatchObject({ label: "Google recommendations", automated: false });
        expect(changeClient("INTERNAL_TOOL")).toMatchObject({ automated: true });
        expect(changeClient(undefined)).toEqual({ label: "Other", automated: false });
        expect(changeClient("SOMETHING_NEW")).toEqual({ label: "Other", automated: false });
    });
});
describe("expected: the shift is the intended effect of a change", () => {
    it("budget raised → spend up is info, with the change named in the copy", () => {
        const s = metric(detect(handler(37, 1.4), [budget("2026-09-26", 100, 140)]), "spend");
        expect(s).toMatchObject({ severity: "info", polarity: "bad", changeContext: { verdict: "expected", lagDays: 0, severityBefore: "critical", note: "Budget +40% ($100 → $140) on Sep 26 — the rise in spend is expected." } });
        expect(s?.recommendation).toMatch(/^Spend is up \d+% because the daily budget was raised 40% \(\$100 → \$140\) on Sep 26 — the expected effect of the change, not an anomaly\. Check over the next week that CPA and ROAS hold/);
        expect(s?.summary).toContain("Expected after the change on Sep 26 (the day the shift began): Budget changed from $100.00 to $140.00.");
        expect(s?.relatedChanges[0]).toMatchObject({ category: "budget", effect: "Budget +40% ($100 → $140)", clientLabel: "Google Ads web", campaignId: "x1", lagDays: 0 });
        const off = metric(detect(handler(37, 1.4), [budget("2026-09-26", 100, 140)], withSettings((x) => (x.changeHistory.enabled = false))), "spend");
        expect(s?.score).toBeCloseTo((off?.score ?? 0) / 3, 3);
    });
    it("keeps the severity when downgrading is off", () => {
        const s = metric(detect(handler(37, 1.4), [budget("2026-09-26", 100, 140)], withSettings((x) => (x.changeHistory.downgradeExpected = false))), "spend");
        expect(s).toMatchObject({ severity: "critical", changeContext: { verdict: "expected" } });
        expect(s?.changeContext?.severityBefore).toBeUndefined();
    });
    it("a shift much larger than the change explains is a likely cause, not expected", () => {
        const s = metric(detect(handler(37, 1.8), [budget("2026-09-26", 100, 110)]), "spend");
        expect(s).toMatchObject({ severity: "critical", changeContext: { verdict: "likely_cause" } });
        expect(s?.recommendation).toContain("That's more than the budget change explains");
    });
    it("pausing an ad group → zero delivery expected; pausing one ad is only a possible cause", () => {
        const dark = series((i) => (i >= 38 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(i)));
        const s = detect(dark, [status("2026-09-27", "AD_GROUP", "ENABLED", "PAUSED", "Ad group paused")]).find((x) => x.kind === "zero_delivery");
        expect(s).toMatchObject({ severity: "info", changeContext: { verdict: "expected", severityBefore: "critical" } });
        expect(s?.recommendation).toBe("The campaign stopped serving because an ad group was paused on Sep 27 — the expected effect of the change, not an anomaly. Enable it again if the pause wasn't intended.");
        const ad = detect(dark, [status("2026-09-27", "AD_GROUP_AD", "ENABLED", "PAUSED", "Ad paused")]).find((x) => x.kind === "zero_delivery");
        expect(ad).toMatchObject({ severity: "critical", changeContext: { verdict: "possible_cause" } });
    });
    it("negatives added → CTR up is expected", () => {
        const data = handler(37, { impressions: 0.5, clicks: 0.8, cost: 0.8, conversions: 0.97 });
        const s = metric(detect(data, [negativeAdded("2026-09-26")]), "ctr");
        expect(s).toMatchObject({ severity: "info", polarity: "good", direction: "up", changeContext: { verdict: "expected" } });
        expect(s?.recommendation).toContain("the expected effect of the change, not an anomaly. Check that conversions held");
    });
    it("target CPA raised → CPA (and spend) up; target ROAS raised → conversions down; ad group enabled → spend up", () => {
        const cpa = detect(handler(37, { cost: 1.2 }), [targetCpa("2026-09-26", 30, 36)]);
        expect(metric(cpa, "cpa")).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
        expect(metric(cpa, "cpa")?.recommendation).toMatch(/^CPA is up \d+% because the target CPA was raised 20% \(\$30 → \$36\) on Sep 26 — .*A higher target lets Smart Bidding pay more per conversion/);
        expect(metric(cpa, "spend")?.changeContext?.verdict).toBe("expected");
        const roas = metric(detect(handler(37, 0.6), [targetRoas("2026-09-26", 3, 4)]), "conversions");
        expect(roas).toMatchObject({ severity: "info", direction: "down", changeContext: { verdict: "expected" } });
        const enabled = metric(detect(handler(37, 1.5), [status("2026-09-26", "AD_GROUP", "PAUSED", "ENABLED", "Ad group enabled")]), "spend");
        expect(enabled).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
    });
});
describe("learning: a bid-strategy or target change is still being learned", () => {
    const cvrDrop = handler(37, { conversions: 0.5 });
    it("caps efficiency signals at warning and says how far into learning the campaign is", () => {
        const signals = detect(cvrDrop, [strategySwitch("2026-09-25")]);
        for (const m of ["cpa", "conversions"]) {
            expect(metric(signals, m)).toMatchObject({ severity: "warning", changeContext: { verdict: "learning", learning: { day: 4, days: 7 }, severityBefore: "critical", lagDays: 1 } });
            expect(metric(signals, m)?.summary).toContain("The campaign is in its learning period (day 4 of 7) after the change on Sep 25 (1 day before the shift)");
            expect(metric(signals, m)?.summary).toContain("Severity is capped at warning while the campaign re-learns.");
        }
        expect(metric(signals, "cpa")?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, while the campaign re-learns after the bid strategy changed from Target CPA \(\$28\) to Maximize conversions on Sep 25 — day 4 of about 7\. Give Smart Bidding until about Oct 1/);
        expect(metric(signals, "cpa")?.changeContext?.note).toBe("The bid strategy changed from Target CPA ($28) to Maximize conversions on Sep 25 — CPA swings are expected while Smart Bidding re-learns (until about Oct 1).");
    });
    it("respects capDuringLearning and learningDays", () => {
        const kept = metric(detect(cvrDrop, [strategySwitch("2026-09-25")], withSettings((x) => (x.changeHistory.capDuringLearning = false))), "cpa");
        expect(kept).toMatchObject({ severity: "critical", changeContext: { verdict: "learning" } });
        expect(kept?.changeContext?.severityBefore).toBeUndefined();
        const off = metric(detect(cvrDrop, [strategySwitch("2026-09-25")], withSettings((x) => (x.changeHistory.learningDays = 0))), "cpa");
        expect(off).toMatchObject({ severity: "critical", changeContext: { verdict: "possible_cause" } });
        const old = metric(detect(cvrDrop, [strategySwitch("2026-09-12")]), "cpa");
        expect(old).toMatchObject({ severity: "critical", changeContext: { verdict: "none" } });
    });
    it("lists the learning change even when it is older than the cause lookback", () => {
        const s = metric(detect(cvrDrop, [strategySwitch("2026-09-21")], withSettings((x) => (x.changeHistory.learningDays = 10))), "cpa");
        expect(s?.changeContext).toMatchObject({ verdict: "learning", learning: { day: 8, days: 10 }, lagDays: 5 });
        expect(s?.relatedChanges.map((r) => r.eventId)).toContain(s?.changeContext?.eventId);
    });
    it("never downgrades spend, pacing, overdelivery, delivery, tracking or budget-limited signals", () => {
        const run = (data: CampaignDailyRow[], events: ChangeEvent[], enabled: boolean) => {
            const campaigns = [campaign("x1", { budget_daily: 100 })];
            const pacing = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns, rows: data, currency: "USD" });
            return detect(data, events, { pacing, settings: settings((x) => (x.changeHistory.enabled = enabled)) }, campaigns);
        };
        const guarded: SignalKind[] = ["pacing", "overdelivery", "tracking_break", "zero_delivery", "budget_limited"];
        const cases: CampaignDailyRow[][] = [
            handler(37, 1.6),
            series((i) => (i >= 38 ? { ...steady(i), conversions: 0 } : steady(i))),
            series((i) => (i >= 38 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(i))),
        ];
        let checked = 0;
        for (const data of cases) {
            const events = [strategySwitch("2026-09-25"), targetCpa("2026-09-25", 30, 20)];
            const before = run(data, events, false);
            for (const s of run(data, events, true)) {
                if (!guarded.includes(s.kind) && !(s.kind === "metric_deviation" && s.metric === "spend"))
                    continue;
                expect(s.severity, s.id).toBe(before.find((b) => b.id === s.id)?.severity);
                expect(s.changeContext?.verdict).not.toBe("learning");
                checked++;
            }
        }
        expect(checked).toBeGreaterThanOrEqual(4);
        const spend = metric(run(handler(37, 1.6), [strategySwitch("2026-09-25")], true), "spend");
        expect(spend).toMatchObject({ severity: "critical", changeContext: { verdict: "likely_cause", learning: { day: 4, days: 7 } } });
        expect(spend?.recommendation).toContain("Maximize conversions has no CPA target, so it spends the full daily budget");
        expect(spend?.recommendation).toContain("until about Oct 1");
    });
});
describe("likely / possible cause and timing", () => {
    const convDrop = handler(38, { conversions: 0.4 });
    it("a highly relevant change on or before the onset is the likely cause", () => {
        const signals = detect(convDrop, [finalUrl("2026-09-26")]);
        const conv = metric(signals, "conversions");
        expect(conv).toMatchObject({ severity: "critical", onsetDate: "2026-09-27", changeContext: { verdict: "likely_cause", lagDays: 1 } });
        expect(conv?.recommendation).toMatch(/^Conversions fell \d+% right after this change on Sep 26 \(1 day before the shift\): Final URL changed\. Open the new page on mobile and desktop/);
        expect(conv?.summary).toContain("Likely cause: Final URL changed (Sep 26, 1 day before the shift).");
        expect(metric(signals, "cpa")?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, right after this change on Sep 26/);
    });
    it("a moderately relevant change is a possible cause appended to the detector's advice", () => {
        const conv = metric(detect(convDrop, [keywordAdded("2026-09-26")]), "conversions");
        expect(conv?.changeContext).toMatchObject({ verdict: "possible_cause", note: "Keyword “trail shoes” added (Broad match) (Sep 26, 1 day before the shift) — may be related." });
        expect(conv?.recommendation).toBe(`${RECOMMENDATIONS.conversions} A recent change may be related: Keyword “trail shoes” added (Broad match) (Sep 26, 1 day before the shift) — compare before and after with Analyze impact.`);
    });
    it("changes after the onset are context, never causes", () => {
        const conv = metric(detect(convDrop, [finalUrl("2026-09-28")]), "conversions");
        expect(conv?.changeContext).toMatchObject({ verdict: "none", lagDays: -1, note: "Final URL changed happened after the shift began (Sep 28), so it can't explain its start." });
        expect(conv?.summary).toContain("Changed after the shift began: Final URL changed (Sep 28, 1 day after the shift began).");
        expect(conv?.recommendation).toBe(RECOMMENDATIONS.conversions);
        expect(conv?.relatedChanges[0]).toMatchObject({ lagDays: -1, relevance: "medium" });
    });
    it("names automated changes", () => {
        const conv = metric(detect(convDrop, [{ ...finalUrl("2026-09-26"), client_type: "GOOGLE_ADS_AUTOMATED_RULE" }]), "conversions");
        expect(conv?.recommendation).toContain("It was made by an automated rule, not a person — check that automation's settings.");
        expect(conv?.relatedChanges[0]).toMatchObject({ clientLabel: "Automated rule", automated: true });
    });
    it("account-level signals see every change at lower relevance, never get expected / learning, and a quiet account is named as such", () => {
        const rule: ThresholdRule = { id: "r1", name: "Account spend", enabled: true, scope: { level: "account" }, metric: "cost", op: "gt", value: 120, window: { kind: "last_n_days", days: 3 }, severity: "warning" };
        const patch = withSettings((x) => (x.thresholdRules = [rule]));
        const acct = detect(handler(37, 1.4), [budget("2026-09-26", 100, 140)], patch).find((s) => s.scope === "account");
        expect(acct).toMatchObject({ severity: "warning", changeContext: { verdict: "possible_cause" } });
        const quiet = detect(handler(37, 1.4), [], { ...patch, changeHistoryAvailable: true }).find((s) => s.scope === "account");
        expect(quiet?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringMatching(/^Nothing changed in this account in the 14 days/) });
        const unknown = detect(handler(37, 1.4), undefined, patch).find((s) => s.scope === "account");
        expect(unknown?.changeContext?.verdict ?? "none").toBe("none");
    });
    it("leaves budget-limited opportunities alone", () => {
        const strong = series((i) => ({ ...steady(i), conv_value: steady(i).conversions * 200, is_eligible: 10000, is_lost_budget: 3000, is_search_impr: 6000 }));
        const weak = rows("x2", ANCHOR, 40, (i) => ({ ...steady(i), conv_value: steady(i).conversions * 10 }));
        const bl = detect([...strong, ...weak], [budget("2026-09-26", 100, 140)], {}, [campaign("x1"), campaign("x2", { type: "Display" })]).find((s) => s.kind === "budget_limited");
        expect(bl?.changeContext).toBeUndefined();
        expect(bl?.recommendation).toMatch(/^Raise the daily budget by about/);
    });
});
describe("no recent changes → likely external", () => {
    const cpcSpike = handler(37, { cost: 1.9 });
    it("claims it only with a readable change log covering the 14 days before the onset", () => {
        const quiet = detect(cpcSpike, [], { changeHistoryAvailable: true });
        expect(metric(quiet, "cpa")).toMatchObject({ severity: "critical", changeContext: { verdict: "no_recent_changes" }, recommendation: EXTERNAL_RECOMMENDATIONS.cpc });
        expect(metric(quiet, "spend")?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.spend);
        expect(metric(quiet, "cpa")?.summary).toContain("No account changes in the 14 days before the shift — likely external.");
        expect(metric(detect(cpcSpike, [finalUrl("2026-09-05")]), "cpa")?.changeContext?.verdict).toBe("no_recent_changes");
        expect(metric(detect(cpcSpike, [finalUrl("2026-09-16")]), "cpa")?.changeContext?.verdict).toBe("none");
        expect(metric(detect(cpcSpike, [finalUrl("2026-09-05")], { changeHistoryAvailable: false }), "cpa")?.changeContext?.verdict).toBe("none");
        expect(metric(detect(cpcSpike, [], { changeHistoryAvailable: true, changeHistoryFrom: "2026-09-20" }), "cpa")?.changeContext?.verdict).toBe("none");
    });
    it("without any change log the signal keeps its detector copy", () => {
        for (const events of [undefined, []]) {
            const s = metric(detect(cpcSpike, events, { changeHistoryAvailable: events ? false : undefined }), "cpa");
            expect(s?.changeContext).toBeUndefined();
            expect(s?.recommendation).toBe(RECOMMENDATIONS.cpa);
        }
    });
    it("CVR-driven CPA gets the site/tag copy", () => {
        const s = metric(detect(handler(37, { conversions: 0.5 }), [], { changeHistoryAvailable: true }), "cpa");
        expect(s?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.cvr);
    });
});
describe("change copy", () => {
    it("describes the lag", () => {
        expect(lagPhrase(2)).toBe("2 days before the shift");
        expect(lagPhrase(1)).toBe("1 day before the shift");
        expect(lagPhrase(0)).toBe("the day the shift began");
        expect(lagPhrase(-1)).toBe("1 day after the shift began");
    });
    it("points auto-applied recommendations to the auto-apply settings and lists same-day ad changes", () => {
        const fact = (e: ChangeEvent, lag: number) => ({ summary: e.summary, date: e.date, ts: e.ts, lag, resource: e.resource_type, parsed: parseChange(e) });
        const created = change({ date: "2026-09-25", ts: "2026-09-25 09:05:00", resource_type: "AD_GROUP_AD", operation: "create", changed_fields: ["ad.video_ad"], summary: "New video ad “Fall drop 15s” created", client_type: "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION" });
        const paused = change({ date: "2026-09-25", ts: "2026-09-25 09:07:00", resource_type: "AD_GROUP_AD", changed_fields: ["status"], diffs: [{ field: "status", before: "ENABLED", after: "PAUSED" }], summary: "Video ad “Summer hero 30s” paused" });
        const copy = changeCopy("likely_cause", { kind: "metric_deviation", metric: "ctr", direction: "down", polarity: "bad", changePct: -0.56, base: RECOMMENDATIONS.ctr, change: fact(created, 1), companions: [fact(paused, 1)], currency: "USD" });
        expect(copy.recommendation).toBe("CTR fell 56% after the ads changed on Sep 25 (1 day before the shift): New video ad “Fall drop 15s” created; Video ad “Summer hero 30s” paused. Compare the new ad's CTR with the previous one and consider re-enabling the paused ad while you test new creative. It was applied automatically by Google recommendations — review the auto-apply settings on the Recommendations page.");
        expect(copy.note).toBe("New video ad “Fall drop 15s” created (Sep 25, 1 day before the shift).");
        expect(changeCopy("likely_cause", { kind: "metric_deviation", metric: "ctr", direction: "up", polarity: "good", changePct: 0.3, base: RECOMMENDATIONS.good, change: fact(created, 1), currency: "USD" }).recommendation).toBe(RECOMMENDATIONS.good);
    });
});
describe("change-history settings", () => {
    const defaults = { enabled: true, lookbackDays: 3, learningDays: 7, downgradeExpected: true, capDuringLearning: true };
    it("defaults, parses settings saved before the option existed and fills partial objects", () => {
        expect(defaultAnomalySettings().changeHistory).toEqual(defaults);
        const { changeHistory: _omit, ...old } = defaultAnomalySettings();
        expect(anomalySettingsSchema.parse(old).changeHistory).toEqual(defaults);
        expect(anomalySettingsSchema.parse({ changeHistory: { enabled: false } }).changeHistory).toEqual({ ...defaults, enabled: false });
    });
    it("validates the ranges", () => {
        for (const bad of [{ lookbackDays: 0 }, { lookbackDays: 15 }, { lookbackDays: 2.5 }, { learningDays: -1 }, { learningDays: 22 }])
            expect(anomalySettingsSchema.safeParse({ changeHistory: bad }).success, JSON.stringify(bad)).toBe(false);
        expect(anomalySettingsSchema.safeParse({ changeHistory: { lookbackDays: 14, learningDays: 0 } }).success).toBe(true);
    });
    describe("through the service", () => {
        beforeEach(() => resetServerState());
        afterEach(() => restoreServerState());
        it("deep-merges a partial patch and reads old stored settings", async () => {
            const { changeHistory: _omit, ...old } = defaultAnomalySettings();
            await getStore().anomalySettings.set(old as AnomalySettings);
            expect((await getAnomalySettings()).changeHistory).toEqual(defaults);
            expect((await updateAnomalySettings({ changeHistory: { learningDays: 10 } })).changeHistory).toEqual({ ...defaults, learningDays: 10 });
            await expect(updateAnomalySettings({ changeHistory: { lookbackDays: 30 } })).rejects.toThrow();
        });
    });
});
describe("anomaly service with change history (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => {
        vi.restoreAllMocks();
        restoreServerState();
    });
    it("explains the demo signals from the change log", async () => {
        const ctx = await requestContext();
        const feed = await getAnomalyFeed(ctx);
        expect(feed.warnings).toEqual([]);
        expect(feed.settings.changeHistory).toEqual(defaultAnomalySettings().changeHistory);
        const c2 = feed.signals.find((s) => s.id === "c2:spend:zscore:2026-09-28");
        expect(c2).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
        expect(feed.signals.find((s) => s.id === "c8:cpa:zscore:2026-09-28")?.changeContext?.verdict).toBe("no_recent_changes");
    });
    it("degrades when the change log can't be read: a warning, no verdicts, no 'no recent changes'", async () => {
        const ctx = await requestContext();
        vi.spyOn(ctx.source, "getChangeEvents").mockRejectedValue(new Error("change_event unavailable"));
        const feed = await getAnomalyFeed(ctx);
        expect(feed.warnings).toContain("Change history is unavailable right now; related changes are not shown.");
        const c8 = feed.signals.find((s) => s.id === "c8:cpa:zscore:2026-09-28");
        expect(c8?.changeContext).toBeUndefined();
        expect(c8?.recommendation).toBe(RECOMMENDATIONS.cpa);
        expect(feed.signals.find((s) => s.id === "c2:spend:zscore:2026-09-28")?.severity).not.toBe("info");
    });
    it("reports how far back the live change log reaches (30 days)", async () => {
        const ctx = await requestContext();
        const live = { ...ctx, today: "2026-09-29", source: Object.assign(Object.create(ctx.source) as RequestContext["source"], { mode: "live" as const, getChangeEvents: async () => [] }) };
        expect(await loadChangeHistory(live, { start: "2026-08-15", end: "2026-09-28" })).toEqual({ events: [], available: true, from: "2026-08-31" });
        expect((await loadChangeHistory(ctx, { start: "2026-08-15", end: "2026-09-28" })).from).toBe("2026-08-31");
    });
});
