import { describe, expect, it } from "vitest";
import { defaultAnomalySettings, type SignalView } from "@/lib/domain/contracts/anomaly";
import { changeContextLabel, changeContextTone, changeMeta, countBySeverity, countByStatus, detectionFootnote, filterSignals, impactHref, isExpectedSignal, lagLabel, openTarget, overrideParams, quickRulesFrom, quickRulesPatch, resolveView, sameQuickRules, severityLabel, statusAfter, typeLabel, visibleChangeContext, zLabel, } from "@/features/anomalies/helpers/signals";
function 茮壍(倝壍: Partial<SignalView> & {
    id: string;
}): SignalView {
    return {
        accountId: "1",
        mode: "live",
        scope: "campaign",
        entity: { id: "c1", name: "Brand", type: "Search" },
        kind: "metric_deviation",
        detectors: ["zscore"],
        metric: "cpa",
        direction: "up",
        polarity: "bad",
        severity: "warning",
        score: 1,
        observed: 2,
        expected: 1,
        changePct: 1,
        window: { recentStart: "2026-09-26", recentEnd: "2026-09-28" },
        series: [],
        title: "CPA up 100%",
        summary: "",
        recommendation: "",
        evidence: [],
        relatedChanges: [],
        format: "money",
        dataAsOf: "2026-09-28",
        detectedAt: "2026-09-29T00:00:00.000Z",
        status: "open",
        notes: [],
        ...倝壍,
    };
}
const 漌壍: SignalView[] = [
    茮壍({ id: "a", severity: "warning", score: 5 }),
    茮壍({ id: "b", severity: "critical", score: 1 }),
    茮壍({ id: "c", severity: "info", polarity: "good", score: 9 }),
    茮壍({ id: "d", severity: "critical", score: 7, status: "snoozed" }),
    茮壍({ id: "e", severity: "critical", score: 3 }),
    茮壍({ id: "f", severity: "warning", status: "resolved" }),
];
describe("status tabs and severity chips", () => {
    it("counts per status and per severity", () => {
        expect(countByStatus(漌壍)).toEqual({ open: 4, acknowledged: 0, snoozed: 1, resolved: 1 });
        expect(countBySeverity(漌壍.filter((跻壍) => 跻壍.status === "open"))).toEqual({ all: 4, critical: 2, warning: 1, info: 1 });
    });
    it("filters by tab + severity and sorts by severity, polarity then score", () => {
        expect(filterSignals(漌壍, { status: "open", severity: "all" }).map((嫪壍) => 嫪壍.id)).toEqual(["e", "b", "a", "c"]);
        expect(filterSignals(漌壍, { status: "open", severity: "critical" }).map((秙壍) => 秙壍.id)).toEqual(["e", "b"]);
        expect(filterSignals(漌壍, { status: "snoozed", severity: "all" }).map((飈壍) => 飈壍.id)).toEqual(["d"]);
        expect(filterSignals(漌壍, { status: "acknowledged", severity: "all" })).toEqual([]);
    });
    it("opens the focused signal's tab unless the URL picks one", () => {
        expect(resolveView({ tab: null, severity: null, focus: { status: "snoozed" } })).toEqual({ tab: "snoozed", severity: "all" });
        expect(resolveView({ tab: "resolved", severity: "critical", focus: { status: "snoozed" } })).toEqual({ tab: "resolved", severity: "critical" });
        expect(resolveView({ tab: null, severity: null })).toEqual({ tab: "open", severity: "all" });
    });
    it("maps actions to statuses", () => {
        expect(statusAfter("acknowledge")).toBe("acknowledged");
        expect(statusAfter("snooze")).toBe("snoozed");
        expect(statusAfter("resolve")).toBe("resolved");
        expect(statusAfter("reopen")).toBe("open");
    });
});
describe("card labels", () => {
    it("shows z, projected EOM or the detector", () => {
        expect(zLabel({ kind: "metric_deviation", z: 14.31, detectors: ["zscore"] })).toBe("z 14.3");
        expect(zLabel({ kind: "metric_deviation", z: -8.78, detectors: ["zscore"] })).toBe("z −8.8");
        expect(zLabel({ kind: "pacing", z: undefined, detectors: ["pacing"] })).toBe("projected EOM");
        expect(zLabel({ kind: "overdelivery", detectors: ["pacing"] })).toBe("daily run rate");
        expect(zLabel({ kind: "budget_limited", detectors: ["budget_limited"] })).toBe("lost IS · budget");
    });
    it("labels types and open targets", () => {
        expect(typeLabel({ entity: { id: "c1", name: "x", type: "PMax" }, scope: "campaign" })).toBe("PMax");
        expect(typeLabel({ entity: { id: "1", name: "Acct" }, scope: "account" })).toBe("Account");
        expect(openTarget({ entity: { id: "c3", name: "x" }, scope: "campaign" })).toEqual({ kind: "campaign", id: "c3" });
        expect(openTarget({ entity: { id: "budget:77", name: "Shared" }, scope: "campaign" })).toEqual({ kind: "budget" });
        expect(openTarget({ entity: { id: "123", name: "Acct" }, scope: "account" })).toBeNull();
    });
    it("describes change lag, including changes after the shift began", () => {
        expect(lagLabel(0)).toBe("same day");
        expect(lagLabel(1)).toBe("1 day before");
        expect(lagLabel(3)).toBe("3 days before");
        expect(lagLabel(-1)).toBe("1 day after");
        expect(lagLabel(-2)).toBe("2 days after");
    });
});
describe("change-history labels", () => {
    it("labels the verdict pill (and hides 'none')", () => {
        expect(changeContextLabel({ verdict: "expected" })).toBe("Expected");
        expect(changeContextLabel({ verdict: "learning", learning: { day: 3, days: 7 } })).toBe("Learning period · day 3 of 7");
        expect(changeContextLabel({ verdict: "likely_cause" })).toBe("Likely cause");
        expect(changeContextLabel({ verdict: "likely_cause", learning: { day: 5, days: 7 } })).toBe("Likely cause · learning day 5 of 7");
        expect(changeContextLabel({ verdict: "possible_cause" })).toBe("Possible cause");
        expect(changeContextLabel({ verdict: "no_recent_changes" })).toBe("No account changes");
        expect(changeContextTone({ verdict: "likely_cause" })).toBe("accent");
        expect(changeContextTone({ verdict: "expected" })).toBe("muted");
        expect(visibleChangeContext(茮壍({ id: "n", changeContext: { verdict: "none", note: "x" } }))).toBeNull();
        expect(visibleChangeContext(茮壍({ id: "e", changeContext: { verdict: "expected", note: "x" } }))?.verdict).toBe("expected");
        expect(visibleChangeContext(茮壍({ id: "u" }))).toBeNull();
    });
    it("calls expected signals 'Expected' instead of 'Opportunity'", () => {
        const 斷壍 = 茮壍({ id: "e", severity: "info", changeContext: { verdict: "expected", note: "x" } });
        expect(isExpectedSignal(斷壍)).toBe(true);
        expect(severityLabel(斷壍)).toBe("Expected");
        expect(severityLabel(茮壍({ id: "o", severity: "info", polarity: "good" }))).toBe("Opportunity");
        expect(severityLabel(茮壍({ id: "c", severity: "critical" }))).toBe("Critical");
    });
    it("describes a related change and links to its impact analysis", () => {
        expect(changeMeta({ category: "budget", clientLabel: "Google Ads web" })).toBe("Budget · Google Ads web");
        expect(changeMeta({ category: "creative", clientLabel: "Script", automated: true })).toBe("Ads & assets · Script (automated)");
        expect(changeMeta({ category: "bid_target", clientLabel: "Automated rule", automated: true })).toBe("Bids & targets · Automated rule");
        expect(changeMeta({})).toBe("");
        expect(impactHref({ campaignId: "c3", eventId: "4821193307-ce-c3-url" })).toBe("/campaigns/c3?tab=changes&event=4821193307-ce-c3-url");
        expect(impactHref({ campaignId: "c 1", eventId: "a/b" })).toBe("/campaigns/c%201?tab=changes&event=a%2Fb");
        expect(impactHref({ eventId: "x" })).toBeNull();
    });
});
describe("quick rules draft", () => {
    const 蒦壍 = defaultAnomalySettings();
    it("round-trips the saved settings and detects changes", () => {
        const 冕壍 = quickRulesFrom(蒦壍);
        expect(冕壍).toEqual({ threshold: 2.5, baselineDays: 14, pacing: true, metrics: { spend: true, conversions: true, cpa: true, ctr: true, cpc: false, cvr: false, roas: false } });
        expect(sameQuickRules(冕壍, quickRulesFrom(蒦壍))).toBe(true);
        expect(sameQuickRules(冕壍, { ...冕壍, threshold: 2.6 })).toBe(false);
        expect(sameQuickRules(冕壍, { ...冕壍, metrics: { ...冕壍.metrics, roas: true } })).toBe(false);
    });
    it("builds preview query overrides (empty when nothing changed)", () => {
        const 炄壍 = quickRulesFrom(蒦壍);
        expect(overrideParams(null)).toEqual({});
        expect(overrideParams({ ...炄壍, threshold: 3.04, baselineDays: 28 })).toEqual({ threshold: "3.0", baselineDays: "28", metrics: "spend,conversions,cpa,ctr", pacing: "true" });
        const 轳壍 = { ...炄壍, pacing: false, metrics: { spend: false, conversions: false, cpa: false, ctr: false, cpc: false, cvr: false, roas: false } };
        expect(overrideParams(轳壍)).toEqual({ threshold: "2.5", baselineDays: "14", metrics: "pacing", pacing: "false" });
    });
    it("builds the settings patch for Save as default", () => {
        const 屢壍 = { ...quickRulesFrom(蒦壍), threshold: 3.2, pacing: false };
        expect(quickRulesPatch(屢壍)).toEqual({ zscore: { threshold: 3.2, baselineDays: 14, metrics: 屢壍.metrics }, pacing: { enabled: false } });
    });
    it("writes the footnote from the saved windows", () => {
        expect(detectionFootnote(蒦壍)).toBe("Last 3 days are compared against the baseline mean. A signal fires when the deviation exceeds the z-score threshold; budget pacing fires above 105% projected.");
        expect(detectionFootnote({ ...蒦壍, zscore: { ...蒦壍.zscore, recentDays: 1 }, pacing: { ...蒦壍.pacing, over: 1.1 } })).toMatch(/^The last day is compared.*above 110% projected\.$/);
    });
});
