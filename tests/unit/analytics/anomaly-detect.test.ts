import { describe, expect, it } from "vitest";
import { detectSignals, type DetectionInput } from "@/lib/domain/anomaly";
import { isSignalId, seriesKey } from "@/lib/domain/anomaly/ids";
import { absorbSymptoms } from "@/lib/domain/anomaly/merge";
import { EXTERNAL_RECOMMENDATIONS, RECOMMENDATIONS } from "@/lib/domain/anomaly/recommendations";
import { buildPacingReport } from "@/lib/domain/budget/pacing";
import type { AnomalySettings, Signal, ThresholdRule } from "@/lib/domain/contracts/anomaly";
import { addDays } from "@/lib/domain/dates";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import type { CampaignDailyRow, CampaignDim } from "@/lib/domain/schema/facts";
import { mean, std } from "@/lib/domain/stats";
import { ANCHOR, campaign, demoDataset, NOW_ISO, outletDataset, rows, settings, steady } from "./helpers";
const registry = new MetricRegistry();
function detectDemo(ds = demoDataset(), patch?: (s: AnomalySettings) => void) {
    const campaigns = [...ds.dims.campaigns.values()];
    const pacing = buildPacingReport({ month: ds.anchor.slice(0, 7), dataThrough: ds.anchor, campaigns, rows: ds.tables.campaign_daily, currency: "USD" });
    return detectSignals({
        accountId: ds.account.id,
        accountName: ds.account.name,
        mode: "live",
        currency: "USD",
        dataThrough: ds.anchor,
        now: NOW_ISO,
        settings: settings(patch),
        campaigns,
        rows: ds.tables.campaign_daily.filter((r) => r.date >= addDays(ds.anchor, -99)),
        changeEvents: ds.changeEvents,
        pacing,
        registry,
    });
}
function input(campaigns: CampaignDim[], data: CampaignDailyRow[], patch: Partial<DetectionInput> = {}): DetectionInput {
    return { accountId: "acct", accountName: "Test account", mode: "live", currency: "USD", dataThrough: ANCHOR, now: NOW_ISO, settings: settings(), campaigns, rows: data, registry, ...patch };
}
const find = (signals: Signal[], entity: string, pred: (s: Signal) => boolean) => signals.find((s) => s.entity.id === entity && pred(s));
describe("golden demo signal set (anchor 2026-09-28, extended scenarios)", () => {
    const { signals, warnings } = detectDemo();
    it("flags c8 CPA critical (CPC ×1.9) with no account changes before it → likely external", () => {
        const s = find(signals, "c8", (x) => x.kind === "metric_deviation" && x.metric === "cpa");
        expect(s).toMatchObject({ severity: "critical", polarity: "bad", direction: "up", title: expect.stringMatching(/^CPA up \d+%$/) });
        expect(s?.cpaDrivers?.cpc).toBeGreaterThan(0.5);
        expect(s?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringContaining("likely external") });
        expect(s?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.cpc);
        expect(s?.summary).toContain("No account changes in the 14 days before the shift — likely external.");
    });
    it("flags c3 conversions down (warning or critical) with the final-URL change as the likely cause", () => {
        const s = find(signals, "c3", (x) => x.kind === "metric_deviation" && x.metric === "conversions");
        expect(s?.direction).toBe("down");
        expect(["warning", "critical"]).toContain(s?.severity);
        expect(s?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c3-url"), relevance: "high", category: "landing", clientLabel: "Google Ads web", campaignId: "c3" });
        expect(s?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c3-url"), lagDays: 1 });
        expect(s?.recommendation).toMatch(/^Conversions fell \d+% right after this change on Sep 26 \(1 day before the shift\): Final URL changed.*confirm the conversion tag fires on it.*revert the URL/);
        const cpa = find(signals, "c3", (x) => x.kind === "metric_deviation" && x.metric === "cpa");
        expect(cpa?.changeContext?.verdict).toBe("likely_cause");
        expect(cpa?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, right after this change on Sep 26/);
    });
    it("flags c6 spend up critical with the bid-strategy change as the likely cause (never downgraded), plus overpacing", () => {
        const s = find(signals, "c6", (x) => x.kind === "metric_deviation" && x.metric === "spend");
        expect(s).toMatchObject({ severity: "critical", direction: "up", polarity: "bad", onsetDate: "2026-09-25" });
        expect(s?.window.baselineEnd).toBe("2026-09-24");
        expect(s?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c6-bid"), relevance: "high", lagDays: 1, category: "bidding", effect: "Target CPA ($28) → Maximize conversions" });
        expect(s?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c6-bid"), lagDays: 1, learning: { day: 5, days: 7 } });
        expect(s?.changeContext?.severityBefore).toBeUndefined();
        expect(s?.summary).toContain("Likely cause: Bid strategy changed from Target CPA ($28) to Maximize conversions (Sep 24, 1 day before the shift).");
        expect(s?.recommendation).toContain("after the bid strategy changed from Target CPA ($28) to Maximize conversions on Sep 24 (1 day before the shift)");
        expect(s?.recommendation).toContain("spends the full daily budget — up to 2× on some days");
        expect(s?.recommendation).toContain("Set a target CPA");
        expect(s?.recommendation).toContain("learning period (day 5 of about 7, until about Sep 30)");
        const pacing = find(signals, "c6", (x) => x.kind === "pacing" || x.kind === "overdelivery");
        expect(pacing?.detectors[0]).toBe("pacing");
        expect(pacing?.title).toMatch(/^Over(pacing|delivering) — \d+% of (daily )?budget$/);
        expect(pacing?.severity).toBe("warning");
        expect(pacing?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c6-bid") });
    });
    it("flags c5 CTR critical with the ad swap as the likely cause", () => {
        const s = find(signals, "c5", (x) => x.kind === "metric_deviation" && x.metric === "ctr");
        expect(s).toMatchObject({ severity: "critical", direction: "down", format: "percent" });
        expect(s?.relatedChanges.some((r) => r.relevance === "high" && r.eventId.includes("c5-ad"))).toBe(true);
        expect(s?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c5-ad") });
        expect(s?.recommendation).toContain("New video ad “Fall drop 15s” created; Video ad “Summer hero 30s” paused");
        expect(s?.recommendation).toContain("consider re-enabling the paused ad");
    });
    it("marks c2's spend increase after its +40% budget raise as expected (info, still listed)", () => {
        const s = find(signals, "c2", (x) => x.kind === "metric_deviation" && x.metric === "spend");
        expect(s).toMatchObject({ severity: "info", polarity: "bad", direction: "up", onsetDate: "2026-09-26" });
        expect(s?.changeContext).toMatchObject({ verdict: "expected", eventId: expect.stringContaining("c2-budget"), lagDays: 0, note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." });
        expect(["warning", "critical"]).toContain(s?.changeContext?.severityBefore);
        expect(s?.recommendation).toMatch(/^Spend is up \d+% because the daily budget was raised 40% \(\$780 → \$1,092\) on Sep 26 — the expected effect of the change, not an anomaly\./);
        expect(s?.relatedChanges[0]).toMatchObject({ category: "budget", effect: "Budget +40% ($780 → $1,092)" });
        expect(find(signals, "c2", (x) => x.kind === "overdelivery" || x.kind === "pacing")).toBeUndefined();
    });
    it("reports the c1 conversion lift as an opportunity", () => {
        const s = find(signals, "c1", (x) => x.kind === "metric_deviation" && x.metric === "conversions");
        expect(s).toMatchObject({ severity: "info", polarity: "good", direction: "up", recommendation: RECOMMENDATIONS.good });
    });
    it("detects the c7 tracking break and folds its symptoms into it", () => {
        const s = find(signals, "c7", (x) => x.kind === "tracking_break");
        expect(s).toMatchObject({ severity: "critical", metric: "conversions", polarity: "bad", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(s?.detectors).toEqual(expect.arrayContaining(["tracking_break", "zscore"]));
        expect(signals.filter((x) => x.entity.id === "c7" && x.kind === "metric_deviation" && ["conversions", "cpa"].includes(x.metric ?? ""))).toHaveLength(0);
        expect(s?.changeContext?.verdict).toBe("none");
    });
    it("finds c1 budget-limited as an opportunity", () => {
        const s = find(signals, "c1", (x) => x.kind === "budget_limited");
        expect(s).toMatchObject({ severity: "info", polarity: "good", format: "percent" });
        expect(s?.observed).toBeGreaterThanOrEqual(0.2);
        expect(s?.recommendation).toMatch(/Raise the daily budget by about \d+%/);
    });
    it("produces stable, unique, well-formed ids sorted by severity", () => {
        const ids = signals.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of signals) {
            expect(isSignalId(s.id)).toBe(true);
            expect(s.id.endsWith(`:${ANCHOR}`)).toBe(true);
            expect(seriesKey(s.id)).toBe(s.id.slice(0, -(ANCHOR.length + 1)));
            expect(s.series.length).toBeLessThanOrEqual(24);
            expect(s.evidence.slice(0, 2).map((e) => e.label)).toEqual(["Observed", "Expected"]);
        }
        const rank = { critical: 3, warning: 2, info: 1 };
        for (let i = 1; i < signals.length; i++)
            expect(rank[signals[i - 1]!.severity]).toBeGreaterThanOrEqual(rank[signals[i]!.severity]);
        expect(detectDemo().signals.map((s) => s.id)).toEqual(ids);
        expect(warnings).toEqual([]);
    });
    it("does not flag a conversions opportunity that is only a spend spike (c6)", () => {
        expect(find(signals, "c6", (x) => x.metric === "conversions" && x.polarity === "good")).toBeUndefined();
    });
    it("stays quiet on the account without planted anomalies", () => {
        const { signals: other } = detectDemo(outletDataset());
        expect(other.filter((s) => s.severity !== "info")).toEqual([]);
    });
    it("with change history turned off, signals keep the detector copy and only list related changes", () => {
        const off = detectDemo(demoDataset(), (s) => (s.changeHistory.enabled = false)).signals;
        expect(off.every((s) => s.changeContext === undefined)).toBe(true);
        expect(find(off, "c8", (x) => x.metric === "cpa" && x.kind === "metric_deviation")?.recommendation).toBe(RECOMMENDATIONS.cpa);
        const c6 = find(off, "c6", (x) => x.metric === "spend" && x.kind === "metric_deviation");
        expect(c6?.summary).toContain("Possibly related: Bid strategy changed from Target CPA ($28) to Maximize conversions (Sep 24, 1 day before the shift).");
        expect(c6?.recommendation).toBe(RECOMMENDATIONS.spend);
        expect(c6?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c6-bid"), category: "bidding" });
        expect(["warning", "critical"]).toContain(find(off, "c2", (x) => x.metric === "spend")?.severity);
    });
    it("keeps an expected signal's severity when downgrading is turned off", () => {
        const kept = detectDemo(demoDataset(), (s2) => (s2.changeHistory.downgradeExpected = false)).signals;
        const s = find(kept, "c2", (x) => x.metric === "spend");
        expect(s?.changeContext?.verdict).toBe("expected");
        expect(s?.changeContext?.severityBefore).toBeUndefined();
        expect(["warning", "critical"]).toContain(s?.severity);
    });
});
describe("z-score math", () => {
    const c = campaign("x1");
    const base = (i: number) => steady(i);
    it("matches the prototype formula for an additive metric", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...base(i), cost: 180 } : base(i)));
        const { signals } = detectSignals(input([c], data));
        const s = signals.find((x) => x.metric === "spend");
        const baseline = data.slice(40 - 3 - 14, 40 - 3).map((r) => r.cost);
        const z = (180 - mean(baseline)) / std(baseline);
        expect(s?.z).toBeCloseTo(z, 9);
        expect(s?.expected).toBeCloseTo(mean(baseline), 9);
        expect(s?.observed).toBeCloseTo(180, 9);
        expect(s?.severity).toBe(Math.abs(z) >= 2.5 * 1.8 ? "critical" : "warning");
        expect(s?.band?.hi).toBeCloseTo(mean(baseline) + 2.5 * std(baseline), 9);
        expect(s?.window).toEqual({ recentStart: "2026-09-26", recentEnd: ANCHOR, baselineStart: "2026-09-12", baselineEnd: "2026-09-25" });
    });
    it("uses ratio of sums for derived metrics (CPA = Σcost / Σconv)", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...base(i), cost: base(i).cost * 2 } : base(i)));
        const { signals } = detectSignals(input([c], data));
        const s = signals.find((x) => x.metric === "cpa");
        const recent = data.slice(-3);
        expect(s?.observed).toBeCloseTo(recent.reduce((a, r) => a + r.cost, 0) / recent.reduce((a, r) => a + r.conversions, 0), 9);
        expect(s?.severity).toBe("critical");
    });
    it("treats a zero σ as ε instead of dividing by zero", () => {
        const flat = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { cost: 120, clicks: 200, impressions: 5000, conversions: 10 } : { cost: 100, clicks: 200, impressions: 5000, conversions: 10 }));
        const s = detectSignals(input([c], flat)).signals.find((x) => x.metric === "spend");
        expect(Number.isFinite(s?.z)).toBe(true);
        expect(s?.severity).toBe("critical");
    });
    it("ignores spend below baseline and respects the threshold", () => {
        const down = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...base(i), cost: 40 } : base(i)));
        expect(detectSignals(input([c], down)).signals.find((x) => x.metric === "spend")).toBeUndefined();
        const small = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...base(i), cost: 104 } : base(i)));
        expect(detectSignals(input([c], small)).signals.find((x) => x.metric === "spend")).toBeUndefined();
    });
    it("skips anomalous days before the window when building the baseline (onset)", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i >= 36 ? { ...base(i), cost: 200 } : base(i)));
        const s = detectSignals(input([c], data)).signals.find((x) => x.metric === "spend");
        expect(s?.onsetDate).toBe("2026-09-25");
        expect(s?.window.baselineEnd).toBe("2026-09-24");
        const clean = data.slice(40 - 4 - 14, 40 - 4).map((r) => r.cost);
        expect(s?.z).toBeCloseTo((200 - mean(clean)) / std(clean), 9);
    });
    it("applies minimum-volume guards and skips paused or excluded campaigns", () => {
        const tiny = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { cost: 9, clicks: 2, impressions: 20, conversions: 0.1 } : { cost: 3, clicks: 2, impressions: 20, conversions: 0.1 }));
        expect(detectSignals(input([c], tiny)).signals).toEqual([]);
        const spike = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...base(i), cost: 300 } : base(i)));
        expect(detectSignals(input([campaign("x1", { status: "Paused" })], spike)).signals).toEqual([]);
        expect(detectSignals(input([c], spike, { settings: settings((s) => (s.excludeCampaignIds = ["x1"])) })).signals).toEqual([]);
    });
    it("robust and weekday detectors run only when enabled", () => {
        const data = rows("x1", ANCHOR, 70, (i) => (i >= 67 ? { ...base(i), cost: 260 } : base(i)));
        const plain = detectSignals(input([c], data)).signals.find((x) => x.metric === "spend");
        expect(plain?.detectors).toEqual(["zscore"]);
        const all = detectSignals(input([c], data, { settings: settings((s) => ((s.robust.enabled = true), (s.seasonal.enabled = true))) })).signals.filter((x) => x.metric === "spend");
        expect(all).toHaveLength(1);
        expect(all[0]?.detectors).toEqual(expect.arrayContaining(["zscore", "robust", "seasonal"]));
    });
    it("reduces severity for conversion drops that are only on the freshest day in live mode", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i === 39 ? { ...base(i), conversions: 0.5 } : base(i)));
        const demo = detectSignals(input([c], data)).signals.find((x) => x.metric === "conversions");
        const live = detectSignals(input([c], data, { mode: "live", conversionLag: true })).signals.find((x) => x.metric === "conversions");
        expect(demo?.severity).toBe("critical");
        expect(live?.severity).toBe("warning");
        expect(live?.summary).toContain("may still be arriving");
    });
});
describe("rule-based detectors", () => {
    it("tracking break: clicks continue, conversions stop", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i >= 38 ? { ...steady(i), conversions: 0 } : steady(i)));
        const { signals } = detectSignals(input([campaign("x1")], data));
        const tb = signals.find((s) => s.kind === "tracking_break");
        expect(tb).toMatchObject({ severity: "critical", onsetDate: "2026-09-27", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(signals.filter((s) => s.kind === "metric_deviation" && s.metric === "conversions")).toHaveLength(0);
        expect(signals.filter((s) => s.kind === "tracking_break")).toHaveLength(1);
    });
    it("tracking break across the whole account when no single campaign clears the guards", () => {
        const ids = Array.from({ length: 10 }, (_, k) => `s${k}`);
        const data = ids.flatMap((id) => rows(id, ANCHOR, 40, (i) => (i >= 37 ? { ...steady(i, 0.1), conversions: 0 } : steady(i, 0.1))));
        const { signals } = detectSignals(input(ids.map((id) => campaign(id)), data));
        const tb = signals.filter((s) => s.kind === "tracking_break");
        expect(tb).toHaveLength(1);
        expect(tb[0]).toMatchObject({ entity: { id: "acct", name: "Test account" }, scope: "account", severity: "critical", metric: "conversions", onsetDate: "2026-09-26", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(signals.filter((s) => s.kind === "metric_deviation" && ["conversions", "cpa", "cvr", "roas"].includes(s.metric ?? ""))).toHaveLength(0);
        const healthy = ids.flatMap((id) => rows(id, ANCHOR, 40, (i) => steady(i, 0.1)));
        expect(detectSignals(input(ids.map((id) => campaign(id)), healthy)).signals.filter((s) => s.kind === "tracking_break")).toHaveLength(0);
        const quiet = detectSignals(input(ids.map((id) => campaign(id)), data, { changeEvents: [], changeHistoryAvailable: true })).signals.find((s) => s.kind === "tracking_break");
        expect(quiet?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringMatching(/^Nothing changed in this account in the 14 days before the shift, so look outside Google Ads \(the conversion tag/) });
        const edit = { id: "e1", ts: "2026-09-20 10:00:00", date: "2026-09-20", resource_type: "AD_GROUP_AD" as const, operation: "update" as const, campaign_id: "s3", changed_fields: ["status"], diffs: [], summary: "Ad updated", client_type: "GOOGLE_ADS_WEB_CLIENT" };
        const edited = detectSignals(input(ids.map((id) => campaign(id)), data, { changeEvents: [edit], changeHistoryAvailable: true })).signals.find((s) => s.kind === "tracking_break");
        expect(edited?.changeContext?.verdict).not.toBe("no_recent_changes");
    });
    it("an account-level break names the campaigns whose symptoms it absorbs", () => {
        const sig = (over: Partial<Signal>): Signal => ({ id: "x", accountId: "acct", mode: "live", scope: "campaign", entity: { id: "acct", name: "Test account" }, kind: "metric_deviation", detectors: ["zscore"], metric: "cpa", direction: "up", polarity: "bad", severity: "warning", score: 1, observed: 2, expected: 1, changePct: 1, window: { recentStart: "2026-09-26", recentEnd: "2026-09-28", baselineStart: "2026-09-12", baselineEnd: "2026-09-25" }, series: [], title: "CPA up 100%", summary: "", recommendation: "", evidence: [], relatedChanges: [], format: "money", ...over }) as Signal;
        const account = sig({ id: "tb", scope: "account", kind: "tracking_break", detectors: ["tracking_break"], metric: "conversions", severity: "critical", title: "Tracking break" });
        const symptom = sig({ id: "c1cpa", entity: { id: "c1", name: "Brand — Core" }, z: 4.2 });
        const [merged] = absorbSymptoms([account, symptom], "acct");
        expect(merged?.evidence.at(-1)).toEqual({ label: "Also flagged", value: "Brand — Core: CPA up 100% (z 4.2)" });
    });
    it("overdelivery needs the calendar average over budget too: weekday-only schedules make up for their weekends", () => {
        const weekday = (d: string) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
        const shape = (i: number) => ({ ...steady(i), cost: 140, conversions: 10 });
        const scheduled = rows("wk", ANCHOR, 40, shape).filter((r) => weekday(r.date));
        const daily = rows("dd", ANCHOR, 40, shape);
        const campaigns = [campaign("wk", { budget_daily: 100 }), campaign("dd", { budget_daily: 100 })];
        const data = [...scheduled, ...daily];
        const pacing = buildPacingReport({ month: ANCHOR.slice(0, 7), dataThrough: ANCHOR, campaigns, rows: data, currency: "USD" });
        const { signals } = detectSignals(input(campaigns, data, { pacing }));
        const over = signals.filter((s) => s.kind === "overdelivery");
        expect(over.map((s) => s.entity.id)).toEqual(["dd"]);
        expect(over[0]?.evidence).toContainEqual({ label: "7-day calendar average", value: "$140/day" });
    });
    it("zero delivery: enabled campaign served nothing on the last day", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i === 39 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(i)));
        const { signals } = detectSignals(input([campaign("x1")], data));
        const z = signals.find((s) => s.kind === "zero_delivery");
        expect(z).toMatchObject({ severity: "critical", observed: 0, metric: "impressions" });
        expect(signals.filter((s) => s.entity.id === "x1" && s.kind === "metric_deviation")).toHaveLength(0);
        expect(detectSignals(input([campaign("x1")], data.slice(0, -1))).signals.some((s) => s.kind === "zero_delivery")).toBe(true);
        expect(detectSignals(input([campaign("x1", { status: "Paused" })], data)).signals).toEqual([]);
    });
    it("budget-limited: Search campaign losing budget share with ROAS above the account", () => {
        const strong = rows("x1", ANCHOR, 40, (i) => ({ ...steady(i), conv_value: steady(i).conversions * 200, is_eligible: 10000, is_lost_budget: 3000, is_search_impr: 6000 }));
        const weak = rows("x2", ANCHOR, 40, (i) => ({ ...steady(i), conv_value: steady(i).conversions * 10 }));
        const { signals } = detectSignals(input([campaign("x1"), campaign("x2", { type: "Display" })], [...strong, ...weak]));
        const bl = signals.find((s) => s.kind === "budget_limited");
        expect(bl).toMatchObject({ entity: { id: "x1" }, severity: "info", polarity: "good" });
        expect(bl?.observed).toBeCloseTo(0.3, 9);
        expect(bl?.recommendation).toContain("50%");
    });
    it("threshold rules: last N days, consecutive days, change %, account scope", () => {
        const data = rows("x1", ANCHOR, 40, (i) => (i >= 37 ? { ...steady(i), cost: 300 } : steady(i)));
        const rule = (over: Partial<ThresholdRule>): ThresholdRule => ({ id: "r1", name: "High CPA", enabled: true, scope: { level: "campaign" }, metric: "cpa", op: "gt", value: 20, window: { kind: "last_n_days", days: 3 }, severity: "warning", ...over });
        const run = (r: ThresholdRule) => detectSignals(input([campaign("x1")], data, { settings: settings((s) => (s.thresholdRules = [r])) })).signals.filter((s) => s.kind === "threshold");
        const hit = run(rule({}));
        expect(hit).toHaveLength(1);
        expect(hit[0]).toMatchObject({ id: `x1:rule-r1:threshold:${ANCHOR}`, severity: "warning", ruleId: "r1", title: "High CPA" });
        expect(run(rule({ value: 40 }))).toHaveLength(0);
        expect(run(rule({ window: { kind: "consecutive_days", days: 3 } }))).toHaveLength(1);
        expect(run(rule({ window: { kind: "consecutive_days", days: 5 } }))).toHaveLength(0);
        expect(run(rule({ metric: "cost", op: "change_pct_gt", value: 0.5 }))).toHaveLength(1);
        expect(run(rule({ metric: "cost", op: "change_pct_gt", value: 3 }))).toHaveLength(0);
        const acct = run(rule({ scope: { level: "account" }, metric: "cost", value: 500 }));
        expect(acct[0]).toMatchObject({ scope: "account", entity: { id: "acct", name: "Test account" } });
        expect(run(rule({ scope: { level: "campaign", campaignTypes: ["Display"] } }))).toHaveLength(0);
    });
});
