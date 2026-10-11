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
const 菡壍 = new MetricRegistry();
let 僐壍 = 0;
function 澿壍(躮壍: Partial<ChangeEvent> & Pick<ChangeEvent, "date">): ChangeEvent {
    僐壍 += 1;
    return { id: `e${僐壍}`, ts: `${躮壍.date} 09:00:00`, resource_type: "CAMPAIGN", operation: "update", campaign_id: "x1", changed_fields: [], diffs: [], summary: "Campaign updated", client_type: "GOOGLE_ADS_WEB_CLIENT", ...躮壍 };
}
const 宝壍 = (窌壍: string, 饻壍: number, 晪壍: number, 蕙壍 = "x1") => 澿壍({ date: 窌壍, resource_type: "CAMPAIGN_BUDGET", campaign_id: 蕙壍, changed_fields: ["amount_micros"], diffs: [{ field: "amount", before: 饻壍, after: 晪壍 }], summary: `Budget changed from $${饻壍}.00 to $${晪壍}.00` });
const 剈壍 = (焷壍: string) => 澿壍({
    date: 焷壍,
    changed_fields: ["bidding_strategy_type", "target_cpa.target_cpa_micros"],
    diffs: [
        { field: "bidding_strategy_type", before: "TARGET_CPA", after: "MAXIMIZE_CONVERSIONS" },
        { field: "target_cpa.target_cpa", before: 28, after: null },
    ],
    summary: "Bid strategy changed from Target CPA ($28) to Maximize conversions",
});
const 逦壍 = (崕壍: string) => 澿壍({ date: 崕壍, resource_type: "ASSET", changed_fields: ["final_urls"], diffs: [{ field: "final_urls", before: "https://x.example/a", after: "https://x.example/b" }], summary: "Final URL changed" });
const 簄壍 = (髳壍: string) => 澿壍({ date: 髳壍, resource_type: "AD_GROUP_CRITERION", operation: "create", changed_fields: ["ad_group", "status", "keyword.text", "keyword.match_type"], diffs: [{ field: "status", before: null, after: "ENABLED" }], summary: "Keyword “trail shoes” added (Broad match)" });
const 柢壍 = (蛑壍: string) => 澿壍({ date: 蛑壍, resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["keyword.text", "keyword.match_type", "negative"], diffs: [{ field: "negative", before: null, after: "true" }], summary: "Negative keyword “free” added" });
const 叀壍 = (犯壍: string, 醞壍: ChangeEvent["resource_type"], 庍壍: string, 絼壍: string, 鱫壍: string) => 澿壍({ date: 犯壍, resource_type: 醞壍, changed_fields: ["status"], diffs: [{ field: "status", before: 庍壍, after: 絼壍 }], summary: 鱫壍 });
const 楚壍 = (衉壍: string, 唸壍: number, 琧壍: number) => 澿壍({ date: 衉壍, changed_fields: ["target_cpa.target_cpa_micros"], diffs: [{ field: "target_cpa.target_cpa", before: 唸壍, after: 琧壍 }], summary: `Target CPA changed from $${唸壍}.00 to $${琧壍}.00` });
const 錖壍 = (怅壍: string, 维壍: number, 鷣壍: number) => 澿壍({ date: 怅壍, changed_fields: ["maximize_conversion_value.target_roas"], diffs: [{ field: "maximize_conversion_value.target_roas", before: 维壍, after: 鷣壍 }], summary: `Target ROAS changed from ${维壍 * 100}% to ${鷣壍 * 100}%` });
function 櫒壍(见壍: DayShape, 嚰壍: number | Partial<Record<"cost" | "clicks" | "impressions" | "conversions", number>>): DayShape {
    const 疟壍 = typeof 嚰壍 === "number" ? { cost: 嚰壍, clicks: 嚰壍, impressions: 嚰壍, conversions: 嚰壍 } : 嚰壍;
    return { ...见壍, cost: 见壍.cost * (疟壍.cost ?? 1), clicks: Math.round(见壍.clicks * (疟壍.clicks ?? 1)), impressions: Math.round(见壍.impressions * (疟壍.impressions ?? 1)), conversions: 见壍.conversions * (疟壍.conversions ?? 1) };
}
const 钎壍 = (慽壍: (聬壍: number) => DayShape) => rows("x1", ANCHOR, 40, 慽壍);
const 齛壍 = (汊壍: number, 謹壍: Parameters<typeof 櫒壍>[1]) => 钎壍((堨壍) => (堨壍 >= 汊壍 ? 櫒壍(steady(堨壍), 謹壍) : steady(堨壍)));
function 眗壍(阆壍: CampaignDailyRow[], 拵壍: ChangeEvent[] | undefined, 臤壍: Partial<DetectionInput> = {}, 仓壍: CampaignDim[] = [campaign("x1")]): Signal[] {
    return detectSignals({ accountId: "acct", accountName: "Test account", mode: "live", currency: "USD", dataThrough: ANCHOR, now: NOW_ISO, settings: settings(), campaigns: 仓壍, rows: 阆壍, changeEvents: 拵壍, registry: 菡壍, ...臤壍 }).signals;
}
const 淂壍 = (貱壍: (妠壍: AnomalySettings) => void): Partial<DetectionInput> => ({ settings: settings(貱壍) });
const 碏壍 = (靾壍: Signal[], 摭壍: string) => 靾壍.find((荜壍) => 荜壍.kind === "metric_deviation" && 荜壍.metric === 摭壍);
describe("change classification (resource type first, then fields)", () => {
    const 偋壍 = (漺壍: Partial<ChangeEvent>) => changeCategory(澿壍({ date: ANCHOR, ...漺壍 }));
    it("classifies campaign, budget and ad-group changes", () => {
        expect(偋壍({ resource_type: "CAMPAIGN_BUDGET", changed_fields: ["amount_micros"] })).toBe("budget");
        expect(偋壍({ changed_fields: ["bidding_strategy_type"] })).toBe("bidding");
        expect(偋壍({ changed_fields: ["maximize_conversion_value.target_roas"] })).toBe("bid_target");
        expect(偋壍({ changed_fields: ["status"] })).toBe("status");
        expect(偋壍({ changed_fields: ["end_date_time"] })).toBe("status");
        expect(偋壍({ changed_fields: ["campaign_budget"] })).toBe("budget");
        expect(偋壍({ changed_fields: ["final_url_suffix"] })).toBe("landing");
        expect(偋壍({ changed_fields: ["network_settings.target_content_network"] })).toBe("targeting");
        expect(偋壍({ changed_fields: ["name"] })).toBe("other");
        expect(偋壍({ resource_type: "AD_GROUP", changed_fields: ["cpc_bid_micros"] })).toBe("bid_target");
        expect(偋壍({ resource_type: "AD_GROUP", changed_fields: ["status"] })).toBe("status");
    });
    it("files ad and asset edits under creative unless only URLs changed", () => {
        expect(偋壍({ resource_type: "AD_GROUP_AD", changed_fields: ["status"] })).toBe("creative");
        expect(偋壍({ resource_type: "AD_GROUP_AD", operation: "create", changed_fields: ["ad.video_ad"] })).toBe("creative");
        expect(偋壍({ resource_type: "AD_GROUP_AD", changed_fields: ["ad.responsive_search_ad.headlines"] })).toBe("creative");
        expect(偋壍({ resource_type: "AD_GROUP_AD", changed_fields: ["final_urls"] })).toBe("landing");
        expect(偋壍({ resource_type: "ASSET", changed_fields: ["final_urls"] })).toBe("landing");
        expect(偋壍({ resource_type: "ASSET", changed_fields: ["sitelink"] })).toBe("creative");
    });
    it("a keyword created with a status field is a keyword change, not a status change (old quirk)", () => {
        expect(changeCategory(簄壍(ANCHOR))).toBe("keywords");
        expect(偋壍({ resource_type: "AD_GROUP_CRITERION", changed_fields: ["status"], summary: "Keyword paused" })).toBe("keywords");
        expect(偋壍({ resource_type: "AD_GROUP_CRITERION", changed_fields: ["cpc_bid_micros"], summary: "Keyword bid changed from $1.20 to $1.40" })).toBe("bid_target");
    });
    it("separates negatives from other criteria", () => {
        expect(changeCategory(柢壍(ANCHOR))).toBe("negatives");
        expect(偋壍({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["negative_keyword"], summary: "5 negative keywords added" })).toBe("negatives");
        expect(偋壍({ resource_type: "AD_GROUP_CRITERION", operation: "create", changed_fields: ["keyword.text", "negative"], diffs: [{ field: "negative", before: null, after: "false" }], summary: "Keyword “x” added" })).toBe("keywords");
        expect(偋壍({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["audience"], summary: "Audience segment added (observation)" })).toBe("targeting");
        expect(偋壍({ resource_type: "CAMPAIGN_CRITERION", changed_fields: ["bid_modifier"], summary: "Bid adjustment changed" })).toBe("bid_target");
    });
    it("falls back to the fields for other resources and reads simulated demo events", () => {
        expect(偋壍({ resource_type: "OTHER", changed_fields: ["bid_modifier", "device.type"] })).toBe("bid_target");
        expect(偋壍({ resource_type: "OTHER", changed_fields: ["foo"] })).toBe("other");
        expect(偋壍({ changed_fields: ["campaign.pause"], diffs: [{ field: "status", before: "ENABLED", after: "PAUSED" }] })).toBe("status");
        expect(偋壍({ resource_type: "CAMPAIGN_CRITERION", operation: "create", changed_fields: ["keywords.add_negatives"] })).toBe("negatives");
    });
});
describe("change direction parsing", () => {
    it("budget raised / lowered with before → after", () => {
        expect(parseChange(宝壍(ANCHOR, 780, 1092))).toMatchObject({ category: "budget", subject: "budget", action: "raised", before: 780, after: 1092, effect: "Budget +40% ($780 → $1,092)" });
        expect(parseChange(宝壍(ANCHOR, 780, 1092)).pct).toBeCloseTo(0.4, 9);
        expect(parseChange(宝壍(ANCHOR, 400, 300))).toMatchObject({ action: "lowered", effect: "Budget −25% ($400 → $300)" });
        expect(parseChange(宝壍(ANCHOR, 12000, 15000))).toMatchObject({ effect: "Budget +25% ($12,000 → $15,000)" });
    });
    it("target CPA / ROAS raised or lowered", () => {
        expect(parseChange(楚壍(ANCHOR, 28, 35))).toMatchObject({ category: "bid_target", subject: "target_cpa", action: "raised", effect: "Target CPA +25% ($28 → $35)" });
        expect(parseChange(楚壍(ANCHOR, 40, 30))).toMatchObject({ action: "lowered" });
        expect(parseChange(錖壍(ANCHOR, 3.5, 4))).toMatchObject({ subject: "target_roas", action: "raised", effect: "Target ROAS +14% (350% → 400%)" });
    });
    it("strategy switches carry the target they dropped", () => {
        expect(parseChange(剈壍(ANCHOR))).toMatchObject({ category: "bidding", subject: "strategy", action: "switched", before: "TARGET_CPA", after: "MAXIMIZE_CONVERSIONS", target: { kind: "target_cpa", before: 28, after: null }, effect: "Target CPA ($28) → Maximize conversions" });
        const 踩壍 = 澿壍({ date: ANCHOR, changed_fields: ["bidding_strategy_type"], diffs: [{ field: "bidding_strategy_type", before: "MANUAL_CPC", after: "TARGET_SPEND" }] });
        expect(parseChange(踩壍).effect).toBe("Manual CPC → Maximize clicks");
    });
    it("paused / enabled / removed / added / updated", () => {
        expect(parseChange(叀壍(ANCHOR, "CAMPAIGN", "ENABLED", "PAUSED", "Campaign paused"))).toMatchObject({ category: "status", action: "paused", effect: "Paused" });
        expect(parseChange(叀壍(ANCHOR, "AD_GROUP", "PAUSED", "ENABLED", "Ad group enabled"))).toMatchObject({ action: "enabled", effect: "Enabled" });
        expect(parseChange(叀壍(ANCHOR, "CAMPAIGN", "ENABLED", "REMOVED", "Campaign removed"))).toMatchObject({ action: "removed" });
        expect(parseChange(簄壍(ANCHOR))).toMatchObject({ category: "keywords", action: "added" });
        expect(parseChange(澿壍({ date: ANCHOR, resource_type: "AD_GROUP_AD", operation: "remove" }))).toMatchObject({ action: "removed" });
        expect(parseChange(逦壍(ANCHOR))).toMatchObject({ category: "landing", action: "updated", effect: "Final URL changed" });
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
        const 嬘壍 = 碏壍(眗壍(齛壍(37, 1.4), [宝壍("2026-09-26", 100, 140)]), "spend");
        expect(嬘壍).toMatchObject({ severity: "info", polarity: "bad", changeContext: { verdict: "expected", lagDays: 0, severityBefore: "critical", note: "Budget +40% ($100 → $140) on Sep 26 — the rise in spend is expected." } });
        expect(嬘壍?.recommendation).toMatch(/^Spend is up \d+% because the daily budget was raised 40% \(\$100 → \$140\) on Sep 26 — the expected effect of the change, not an anomaly\. Check over the next week that CPA and ROAS hold/);
        expect(嬘壍?.summary).toContain("Expected after the change on Sep 26 (the day the shift began): Budget changed from $100.00 to $140.00.");
        expect(嬘壍?.relatedChanges[0]).toMatchObject({ category: "budget", effect: "Budget +40% ($100 → $140)", clientLabel: "Google Ads web", campaignId: "x1", lagDays: 0 });
        const 稇壍 = 碏壍(眗壍(齛壍(37, 1.4), [宝壍("2026-09-26", 100, 140)], 淂壍((飶壍) => (飶壍.changeHistory.enabled = false))), "spend");
        expect(嬘壍?.score).toBeCloseTo((稇壍?.score ?? 0) / 3, 3);
    });
    it("keeps the severity when downgrading is off", () => {
        const 日壍 = 碏壍(眗壍(齛壍(37, 1.4), [宝壍("2026-09-26", 100, 140)], 淂壍((蓔壍) => (蓔壍.changeHistory.downgradeExpected = false))), "spend");
        expect(日壍).toMatchObject({ severity: "critical", changeContext: { verdict: "expected" } });
        expect(日壍?.changeContext?.severityBefore).toBeUndefined();
    });
    it("a shift much larger than the change explains is a likely cause, not expected", () => {
        const 凃壍 = 碏壍(眗壍(齛壍(37, 1.8), [宝壍("2026-09-26", 100, 110)]), "spend");
        expect(凃壍).toMatchObject({ severity: "critical", changeContext: { verdict: "likely_cause" } });
        expect(凃壍?.recommendation).toContain("That's more than the budget change explains");
    });
    it("pausing an ad group → zero delivery expected; pausing one ad is only a possible cause", () => {
        const 炲壍 = 钎壍((辡壍) => (辡壍 >= 38 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(辡壍)));
        const 岐壍 = 眗壍(炲壍, [叀壍("2026-09-27", "AD_GROUP", "ENABLED", "PAUSED", "Ad group paused")]).find((筿壍) => 筿壍.kind === "zero_delivery");
        expect(岐壍).toMatchObject({ severity: "info", changeContext: { verdict: "expected", severityBefore: "critical" } });
        expect(岐壍?.recommendation).toBe("The campaign stopped serving because an ad group was paused on Sep 27 — the expected effect of the change, not an anomaly. Enable it again if the pause wasn't intended.");
        const 驮壍 = 眗壍(炲壍, [叀壍("2026-09-27", "AD_GROUP_AD", "ENABLED", "PAUSED", "Ad paused")]).find((杝壍) => 杝壍.kind === "zero_delivery");
        expect(驮壍).toMatchObject({ severity: "critical", changeContext: { verdict: "possible_cause" } });
    });
    it("negatives added → CTR up is expected", () => {
        const 虌壍 = 齛壍(37, { impressions: 0.5, clicks: 0.8, cost: 0.8, conversions: 0.97 });
        const 医壍 = 碏壍(眗壍(虌壍, [柢壍("2026-09-26")]), "ctr");
        expect(医壍).toMatchObject({ severity: "info", polarity: "good", direction: "up", changeContext: { verdict: "expected" } });
        expect(医壍?.recommendation).toContain("the expected effect of the change, not an anomaly. Check that conversions held");
    });
    it("target CPA raised → CPA (and spend) up; target ROAS raised → conversions down; ad group enabled → spend up", () => {
        const 爪壍 = 眗壍(齛壍(37, { cost: 1.2 }), [楚壍("2026-09-26", 30, 36)]);
        expect(碏壍(爪壍, "cpa")).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
        expect(碏壍(爪壍, "cpa")?.recommendation).toMatch(/^CPA is up \d+% because the target CPA was raised 20% \(\$30 → \$36\) on Sep 26 — .*A higher target lets Smart Bidding pay more per conversion/);
        expect(碏壍(爪壍, "spend")?.changeContext?.verdict).toBe("expected");
        const 鄙壍 = 碏壍(眗壍(齛壍(37, 0.6), [錖壍("2026-09-26", 3, 4)]), "conversions");
        expect(鄙壍).toMatchObject({ severity: "info", direction: "down", changeContext: { verdict: "expected" } });
        const 师壍 = 碏壍(眗壍(齛壍(37, 1.5), [叀壍("2026-09-26", "AD_GROUP", "PAUSED", "ENABLED", "Ad group enabled")]), "spend");
        expect(师壍).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
    });
});
describe("learning: a bid-strategy or target change is still being learned", () => {
    const 糷壍 = 齛壍(37, { conversions: 0.5 });
    it("caps efficiency signals at warning and says how far into learning the campaign is", () => {
        const 鯦壍 = 眗壍(糷壍, [剈壍("2026-09-25")]);
        for (const 棕壍 of ["cpa", "conversions"]) {
            expect(碏壍(鯦壍, 棕壍)).toMatchObject({ severity: "warning", changeContext: { verdict: "learning", learning: { day: 4, days: 7 }, severityBefore: "critical", lagDays: 1 } });
            expect(碏壍(鯦壍, 棕壍)?.summary).toContain("The campaign is in its learning period (day 4 of 7) after the change on Sep 25 (1 day before the shift)");
            expect(碏壍(鯦壍, 棕壍)?.summary).toContain("Severity is capped at warning while the campaign re-learns.");
        }
        expect(碏壍(鯦壍, "cpa")?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, while the campaign re-learns after the bid strategy changed from Target CPA \(\$28\) to Maximize conversions on Sep 25 — day 4 of about 7\. Give Smart Bidding until about Oct 1/);
        expect(碏壍(鯦壍, "cpa")?.changeContext?.note).toBe("The bid strategy changed from Target CPA ($28) to Maximize conversions on Sep 25 — CPA swings are expected while Smart Bidding re-learns (until about Oct 1).");
    });
    it("respects capDuringLearning and learningDays", () => {
        const 蟄壍 = 碏壍(眗壍(糷壍, [剈壍("2026-09-25")], 淂壍((咳壍) => (咳壍.changeHistory.capDuringLearning = false))), "cpa");
        expect(蟄壍).toMatchObject({ severity: "critical", changeContext: { verdict: "learning" } });
        expect(蟄壍?.changeContext?.severityBefore).toBeUndefined();
        const 玢壍 = 碏壍(眗壍(糷壍, [剈壍("2026-09-25")], 淂壍((銑壍) => (銑壍.changeHistory.learningDays = 0))), "cpa");
        expect(玢壍).toMatchObject({ severity: "critical", changeContext: { verdict: "possible_cause" } });
        const 往壍 = 碏壍(眗壍(糷壍, [剈壍("2026-09-12")]), "cpa");
        expect(往壍).toMatchObject({ severity: "critical", changeContext: { verdict: "none" } });
    });
    it("lists the learning change even when it is older than the cause lookback", () => {
        const 繯壍 = 碏壍(眗壍(糷壍, [剈壍("2026-09-21")], 淂壍((鵞壍) => (鵞壍.changeHistory.learningDays = 10))), "cpa");
        expect(繯壍?.changeContext).toMatchObject({ verdict: "learning", learning: { day: 8, days: 10 }, lagDays: 5 });
        expect(繯壍?.relatedChanges.map((橍壍) => 橍壍.eventId)).toContain(繯壍?.changeContext?.eventId);
    });
    it("never downgrades spend, pacing, overdelivery, delivery, tracking or budget-limited signals", () => {
        const 褼壍 = (嘫壍: CampaignDailyRow[], 甚壍: ChangeEvent[], 鐉壍: boolean) => {
            const 惸壍 = [campaign("x1", { budget_daily: 100 })];
            const 翧壍 = buildPacingReport({ month: "2026-09", dataThrough: ANCHOR, campaigns: 惸壍, rows: 嘫壍, currency: "USD" });
            return 眗壍(嘫壍, 甚壍, { pacing: 翧壍, settings: settings((黖壍) => (黖壍.changeHistory.enabled = 鐉壍)) }, 惸壍);
        };
        const 毅壍: SignalKind[] = ["pacing", "overdelivery", "tracking_break", "zero_delivery", "budget_limited"];
        const 誴壍: CampaignDailyRow[][] = [
            齛壍(37, 1.6),
            钎壍((垣壍) => (垣壍 >= 38 ? { ...steady(垣壍), conversions: 0 } : steady(垣壍))),
            钎壍((皒壍) => (皒壍 >= 38 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(皒壍))),
        ];
        let 閁壍 = 0;
        for (const 扰壍 of 誴壍) {
            const 腟壍 = [剈壍("2026-09-25"), 楚壍("2026-09-25", 30, 20)];
            const 乎壍 = 褼壍(扰壍, 腟壍, false);
            for (const 洽壍 of 褼壍(扰壍, 腟壍, true)) {
                if (!毅壍.includes(洽壍.kind) && !(洽壍.kind === "metric_deviation" && 洽壍.metric === "spend"))
                    continue;
                expect(洽壍.severity, 洽壍.id).toBe(乎壍.find((谬壍) => 谬壍.id === 洽壍.id)?.severity);
                expect(洽壍.changeContext?.verdict).not.toBe("learning");
                閁壍++;
            }
        }
        expect(閁壍).toBeGreaterThanOrEqual(4);
        const 夛壍 = 碏壍(褼壍(齛壍(37, 1.6), [剈壍("2026-09-25")], true), "spend");
        expect(夛壍).toMatchObject({ severity: "critical", changeContext: { verdict: "likely_cause", learning: { day: 4, days: 7 } } });
        expect(夛壍?.recommendation).toContain("Maximize conversions has no CPA target, so it spends the full daily budget");
        expect(夛壍?.recommendation).toContain("until about Oct 1");
    });
});
describe("likely / possible cause and timing", () => {
    const 砊壍 = 齛壍(38, { conversions: 0.4 });
    it("a highly relevant change on or before the onset is the likely cause", () => {
        const 雹壍 = 眗壍(砊壍, [逦壍("2026-09-26")]);
        const 揨壍 = 碏壍(雹壍, "conversions");
        expect(揨壍).toMatchObject({ severity: "critical", onsetDate: "2026-09-27", changeContext: { verdict: "likely_cause", lagDays: 1 } });
        expect(揨壍?.recommendation).toMatch(/^Conversions fell \d+% right after this change on Sep 26 \(1 day before the shift\): Final URL changed\. Open the new page on mobile and desktop/);
        expect(揨壍?.summary).toContain("Likely cause: Final URL changed (Sep 26, 1 day before the shift).");
        expect(碏壍(雹壍, "cpa")?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, right after this change on Sep 26/);
    });
    it("a moderately relevant change is a possible cause appended to the detector's advice", () => {
        const 苗壍 = 碏壍(眗壍(砊壍, [簄壍("2026-09-26")]), "conversions");
        expect(苗壍?.changeContext).toMatchObject({ verdict: "possible_cause", note: "Keyword “trail shoes” added (Broad match) (Sep 26, 1 day before the shift) — may be related." });
        expect(苗壍?.recommendation).toBe(`${RECOMMENDATIONS.conversions} A recent change may be related: Keyword “trail shoes” added (Broad match) (Sep 26, 1 day before the shift) — compare before and after with Analyze impact.`);
    });
    it("changes after the onset are context, never causes", () => {
        const 俆壍 = 碏壍(眗壍(砊壍, [逦壍("2026-09-28")]), "conversions");
        expect(俆壍?.changeContext).toMatchObject({ verdict: "none", lagDays: -1, note: "Final URL changed happened after the shift began (Sep 28), so it can't explain its start." });
        expect(俆壍?.summary).toContain("Changed after the shift began: Final URL changed (Sep 28, 1 day after the shift began).");
        expect(俆壍?.recommendation).toBe(RECOMMENDATIONS.conversions);
        expect(俆壍?.relatedChanges[0]).toMatchObject({ lagDays: -1, relevance: "medium" });
    });
    it("names automated changes", () => {
        const 溵壍 = 碏壍(眗壍(砊壍, [{ ...逦壍("2026-09-26"), client_type: "GOOGLE_ADS_AUTOMATED_RULE" }]), "conversions");
        expect(溵壍?.recommendation).toContain("It was made by an automated rule, not a person — check that automation's settings.");
        expect(溵壍?.relatedChanges[0]).toMatchObject({ clientLabel: "Automated rule", automated: true });
    });
    it("account-level signals see every change at lower relevance, never get expected / learning, and a quiet account is named as such", () => {
        const 趤壍: ThresholdRule = { id: "r1", name: "Account spend", enabled: true, scope: { level: "account" }, metric: "cost", op: "gt", value: 120, window: { kind: "last_n_days", days: 3 }, severity: "warning" };
        const 媓壍 = 淂壍((禂壍) => (禂壍.thresholdRules = [趤壍]));
        const 顱壍 = 眗壍(齛壍(37, 1.4), [宝壍("2026-09-26", 100, 140)], 媓壍).find((敠壍) => 敠壍.scope === "account");
        expect(顱壍).toMatchObject({ severity: "warning", changeContext: { verdict: "possible_cause" } });
        const 葏壍 = 眗壍(齛壍(37, 1.4), [], { ...媓壍, changeHistoryAvailable: true }).find((儾壍) => 儾壍.scope === "account");
        expect(葏壍?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringMatching(/^Nothing changed in this account in the 14 days/) });
        const 瀭壍 = 眗壍(齛壍(37, 1.4), undefined, 媓壍).find((輜壍) => 輜壍.scope === "account");
        expect(瀭壍?.changeContext?.verdict ?? "none").toBe("none");
    });
    it("leaves budget-limited opportunities alone", () => {
        const 尋壍 = 钎壍((竺壍) => ({ ...steady(竺壍), conv_value: steady(竺壍).conversions * 200, is_eligible: 10000, is_lost_budget: 3000, is_search_impr: 6000 }));
        const 駩壍 = rows("x2", ANCHOR, 40, (曘壍) => ({ ...steady(曘壍), conv_value: steady(曘壍).conversions * 10 }));
        const 藇壍 = 眗壍([...尋壍, ...駩壍], [宝壍("2026-09-26", 100, 140)], {}, [campaign("x1"), campaign("x2", { type: "Display" })]).find((劶壍) => 劶壍.kind === "budget_limited");
        expect(藇壍?.changeContext).toBeUndefined();
        expect(藇壍?.recommendation).toMatch(/^Raise the daily budget by about/);
    });
});
describe("no recent changes → likely external", () => {
    const 熥壍 = 齛壍(37, { cost: 1.9 });
    it("claims it only with a readable change log covering the 14 days before the onset", () => {
        const 邔壍 = 眗壍(熥壍, [], { changeHistoryAvailable: true });
        expect(碏壍(邔壍, "cpa")).toMatchObject({ severity: "critical", changeContext: { verdict: "no_recent_changes" }, recommendation: EXTERNAL_RECOMMENDATIONS.cpc });
        expect(碏壍(邔壍, "spend")?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.spend);
        expect(碏壍(邔壍, "cpa")?.summary).toContain("No account changes in the 14 days before the shift — likely external.");
        expect(碏壍(眗壍(熥壍, [逦壍("2026-09-05")]), "cpa")?.changeContext?.verdict).toBe("no_recent_changes");
        expect(碏壍(眗壍(熥壍, [逦壍("2026-09-16")]), "cpa")?.changeContext?.verdict).toBe("none");
        expect(碏壍(眗壍(熥壍, [逦壍("2026-09-05")], { changeHistoryAvailable: false }), "cpa")?.changeContext?.verdict).toBe("none");
        expect(碏壍(眗壍(熥壍, [], { changeHistoryAvailable: true, changeHistoryFrom: "2026-09-20" }), "cpa")?.changeContext?.verdict).toBe("none");
    });
    it("without any change log the signal keeps its detector copy", () => {
        for (const 嶃壍 of [undefined, []]) {
            const 籲壍 = 碏壍(眗壍(熥壍, 嶃壍, { changeHistoryAvailable: 嶃壍 ? false : undefined }), "cpa");
            expect(籲壍?.changeContext).toBeUndefined();
            expect(籲壍?.recommendation).toBe(RECOMMENDATIONS.cpa);
        }
    });
    it("CVR-driven CPA gets the site/tag copy", () => {
        const 魡壍 = 碏壍(眗壍(齛壍(37, { conversions: 0.5 }), [], { changeHistoryAvailable: true }), "cpa");
        expect(魡壍?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.cvr);
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
        const 桐壍 = (蜿壍: ChangeEvent, 吮壍: number) => ({ summary: 蜿壍.summary, date: 蜿壍.date, ts: 蜿壍.ts, lag: 吮壍, resource: 蜿壍.resource_type, parsed: parseChange(蜿壍) });
        const 猝壍 = 澿壍({ date: "2026-09-25", ts: "2026-09-25 09:05:00", resource_type: "AD_GROUP_AD", operation: "create", changed_fields: ["ad.video_ad"], summary: "New video ad “Fall drop 15s” created", client_type: "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION" });
        const 鈌壍 = 澿壍({ date: "2026-09-25", ts: "2026-09-25 09:07:00", resource_type: "AD_GROUP_AD", changed_fields: ["status"], diffs: [{ field: "status", before: "ENABLED", after: "PAUSED" }], summary: "Video ad “Summer hero 30s” paused" });
        const 廻壍 = changeCopy("likely_cause", { kind: "metric_deviation", metric: "ctr", direction: "down", polarity: "bad", changePct: -0.56, base: RECOMMENDATIONS.ctr, change: 桐壍(猝壍, 1), companions: [桐壍(鈌壍, 1)], currency: "USD" });
        expect(廻壍.recommendation).toBe("CTR fell 56% after the ads changed on Sep 25 (1 day before the shift): New video ad “Fall drop 15s” created; Video ad “Summer hero 30s” paused. Compare the new ad's CTR with the previous one and consider re-enabling the paused ad while you test new creative. It was applied automatically by Google recommendations — review the auto-apply settings on the Recommendations page.");
        expect(廻壍.note).toBe("New video ad “Fall drop 15s” created (Sep 25, 1 day before the shift).");
        expect(changeCopy("likely_cause", { kind: "metric_deviation", metric: "ctr", direction: "up", polarity: "good", changePct: 0.3, base: RECOMMENDATIONS.good, change: 桐壍(猝壍, 1), currency: "USD" }).recommendation).toBe(RECOMMENDATIONS.good);
    });
});
describe("change-history settings", () => {
    const 緪壍 = { enabled: true, lookbackDays: 3, learningDays: 7, downgradeExpected: true, capDuringLearning: true };
    it("defaults, parses settings saved before the option existed and fills partial objects", () => {
        expect(defaultAnomalySettings().changeHistory).toEqual(緪壍);
        const { changeHistory: _鳙壍, ...槈壍 } = defaultAnomalySettings();
        expect(anomalySettingsSchema.parse(槈壍).changeHistory).toEqual(緪壍);
        expect(anomalySettingsSchema.parse({ changeHistory: { enabled: false } }).changeHistory).toEqual({ ...緪壍, enabled: false });
    });
    it("validates the ranges", () => {
        for (const 袷壍 of [{ lookbackDays: 0 }, { lookbackDays: 15 }, { lookbackDays: 2.5 }, { learningDays: -1 }, { learningDays: 22 }])
            expect(anomalySettingsSchema.safeParse({ changeHistory: 袷壍 }).success, JSON.stringify(袷壍)).toBe(false);
        expect(anomalySettingsSchema.safeParse({ changeHistory: { lookbackDays: 14, learningDays: 0 } }).success).toBe(true);
    });
    describe("through the service", () => {
        beforeEach(() => resetServerState());
        afterEach(() => restoreServerState());
        it("deep-merges a partial patch and reads old stored settings", async () => {
            const { changeHistory: _喦壍, ...璕壍 } = defaultAnomalySettings();
            await getStore().anomalySettings.set(璕壍 as AnomalySettings);
            expect((await getAnomalySettings()).changeHistory).toEqual(緪壍);
            expect((await updateAnomalySettings({ changeHistory: { learningDays: 10 } })).changeHistory).toEqual({ ...緪壍, learningDays: 10 });
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
        const 鎄壍 = await requestContext();
        const 恳壍 = await getAnomalyFeed(鎄壍);
        expect(恳壍.warnings).toEqual([]);
        expect(恳壍.settings.changeHistory).toEqual(defaultAnomalySettings().changeHistory);
        const 罢壍 = 恳壍.signals.find((鹑壍) => 鹑壍.id === "c2:spend:zscore:2026-09-28");
        expect(罢壍).toMatchObject({ severity: "info", changeContext: { verdict: "expected" } });
        expect(恳壍.signals.find((歀壍) => 歀壍.id === "c8:cpa:zscore:2026-09-28")?.changeContext?.verdict).toBe("no_recent_changes");
    });
    it("degrades when the change log can't be read: a warning, no verdicts, no 'no recent changes'", async () => {
        const 訯壍 = await requestContext();
        vi.spyOn(訯壍.source, "getChangeEvents").mockRejectedValue(new Error("change_event unavailable"));
        const 圞壍 = await getAnomalyFeed(訯壍);
        expect(圞壍.warnings).toContain("Change history is unavailable right now; related changes are not shown.");
        const 瘍壍 = 圞壍.signals.find((铼壍) => 铼壍.id === "c8:cpa:zscore:2026-09-28");
        expect(瘍壍?.changeContext).toBeUndefined();
        expect(瘍壍?.recommendation).toBe(RECOMMENDATIONS.cpa);
        expect(圞壍.signals.find((懫壍) => 懫壍.id === "c2:spend:zscore:2026-09-28")?.severity).not.toBe("info");
    });
    it("reports how far back the live change log reaches (30 days)", async () => {
        const 胚壍 = await requestContext();
        const 鿉壍 = { ...胚壍, today: "2026-09-29", source: Object.assign(Object.create(胚壍.source) as RequestContext["source"], { mode: "live" as const, getChangeEvents: async () => [] }) };
        expect(await loadChangeHistory(鿉壍, { start: "2026-08-15", end: "2026-09-28" })).toEqual({ events: [], available: true, from: "2026-08-31" });
        expect((await loadChangeHistory(胚壍, { start: "2026-08-15", end: "2026-09-28" })).from).toBe("2026-08-31");
    });
});
