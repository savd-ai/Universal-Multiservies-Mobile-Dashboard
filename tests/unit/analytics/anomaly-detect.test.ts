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
const 蜖壍 = new MetricRegistry();
function 吅壍(狴壍 = demoDataset(), 釣壍?: (廒壍: AnomalySettings) => void) {
    const 緁壍 = [...狴壍.dims.campaigns.values()];
    const 鲰壍 = buildPacingReport({ month: 狴壍.anchor.slice(0, 7), dataThrough: 狴壍.anchor, campaigns: 緁壍, rows: 狴壍.tables.campaign_daily, currency: "USD" });
    return detectSignals({
        accountId: 狴壍.account.id,
        accountName: 狴壍.account.name,
        mode: "live",
        currency: "USD",
        dataThrough: 狴壍.anchor,
        now: NOW_ISO,
        settings: settings(釣壍),
        campaigns: 緁壍,
        rows: 狴壍.tables.campaign_daily.filter((榟壍) => 榟壍.date >= addDays(狴壍.anchor, -99)),
        changeEvents: 狴壍.changeEvents,
        pacing: 鲰壍,
        registry: 蜖壍,
    });
}
function 袎壍(啽壍: CampaignDim[], 瑬壍: CampaignDailyRow[], 鍛壍: Partial<DetectionInput> = {}): DetectionInput {
    return { accountId: "acct", accountName: "Test account", mode: "live", currency: "USD", dataThrough: ANCHOR, now: NOW_ISO, settings: settings(), campaigns: 啽壍, rows: 瑬壍, registry: 蜖壍, ...鍛壍 };
}
const 恊壍 = (缹壍: Signal[], 鸨壍: string, 欗壍: (訆壍: Signal) => boolean) => 缹壍.find((囵壍) => 囵壍.entity.id === 鸨壍 && 欗壍(囵壍));
describe("golden demo signal set (anchor 2026-09-28, extended scenarios)", () => {
    const { signals: 痤壍, warnings: 铓壍 } = 吅壍();
    it("flags c8 CPA critical (CPC ×1.9) with no account changes before it → likely external", () => {
        const 懂壍 = 恊壍(痤壍, "c8", (肱壍) => 肱壍.kind === "metric_deviation" && 肱壍.metric === "cpa");
        expect(懂壍).toMatchObject({ severity: "critical", polarity: "bad", direction: "up", title: expect.stringMatching(/^CPA up \d+%$/) });
        expect(懂壍?.cpaDrivers?.cpc).toBeGreaterThan(0.5);
        expect(懂壍?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringContaining("likely external") });
        expect(懂壍?.recommendation).toBe(EXTERNAL_RECOMMENDATIONS.cpc);
        expect(懂壍?.summary).toContain("No account changes in the 14 days before the shift — likely external.");
    });
    it("flags c3 conversions down (warning or critical) with the final-URL change as the likely cause", () => {
        const 龠壍 = 恊壍(痤壍, "c3", (沏壍) => 沏壍.kind === "metric_deviation" && 沏壍.metric === "conversions");
        expect(龠壍?.direction).toBe("down");
        expect(["warning", "critical"]).toContain(龠壍?.severity);
        expect(龠壍?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c3-url"), relevance: "high", category: "landing", clientLabel: "Google Ads web", campaignId: "c3" });
        expect(龠壍?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c3-url"), lagDays: 1 });
        expect(龠壍?.recommendation).toMatch(/^Conversions fell \d+% right after this change on Sep 26 \(1 day before the shift\): Final URL changed.*confirm the conversion tag fires on it.*revert the URL/);
        const 譾壍 = 恊壍(痤壍, "c3", (塭壍) => 塭壍.kind === "metric_deviation" && 塭壍.metric === "cpa");
        expect(譾壍?.changeContext?.verdict).toBe("likely_cause");
        expect(譾壍?.recommendation).toMatch(/^CPA rose \d+% as fewer clicks convert, right after this change on Sep 26/);
    });
    it("flags c6 spend up critical with the bid-strategy change as the likely cause (never downgraded), plus overpacing", () => {
        const 睜壍 = 恊壍(痤壍, "c6", (陋壍) => 陋壍.kind === "metric_deviation" && 陋壍.metric === "spend");
        expect(睜壍).toMatchObject({ severity: "critical", direction: "up", polarity: "bad", onsetDate: "2026-09-25" });
        expect(睜壍?.window.baselineEnd).toBe("2026-09-24");
        expect(睜壍?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c6-bid"), relevance: "high", lagDays: 1, category: "bidding", effect: "Target CPA ($28) → Maximize conversions" });
        expect(睜壍?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c6-bid"), lagDays: 1, learning: { day: 5, days: 7 } });
        expect(睜壍?.changeContext?.severityBefore).toBeUndefined();
        expect(睜壍?.summary).toContain("Likely cause: Bid strategy changed from Target CPA ($28) to Maximize conversions (Sep 24, 1 day before the shift).");
        expect(睜壍?.recommendation).toContain("after the bid strategy changed from Target CPA ($28) to Maximize conversions on Sep 24 (1 day before the shift)");
        expect(睜壍?.recommendation).toContain("spends the full daily budget — up to 2× on some days");
        expect(睜壍?.recommendation).toContain("Set a target CPA");
        expect(睜壍?.recommendation).toContain("learning period (day 5 of about 7, until about Sep 30)");
        const 挺壍 = 恊壍(痤壍, "c6", (舩壍) => 舩壍.kind === "pacing" || 舩壍.kind === "overdelivery");
        expect(挺壍?.detectors[0]).toBe("pacing");
        expect(挺壍?.title).toMatch(/^Over(pacing|delivering) — \d+% of (daily )?budget$/);
        expect(挺壍?.severity).toBe("warning");
        expect(挺壍?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c6-bid") });
    });
    it("flags c5 CTR critical with the ad swap as the likely cause", () => {
        const 优壍 = 恊壍(痤壍, "c5", (渇壍) => 渇壍.kind === "metric_deviation" && 渇壍.metric === "ctr");
        expect(优壍).toMatchObject({ severity: "critical", direction: "down", format: "percent" });
        expect(优壍?.relatedChanges.some((賶壍) => 賶壍.relevance === "high" && 賶壍.eventId.includes("c5-ad"))).toBe(true);
        expect(优壍?.changeContext).toMatchObject({ verdict: "likely_cause", eventId: expect.stringContaining("c5-ad") });
        expect(优壍?.recommendation).toContain("New video ad “Fall drop 15s” created; Video ad “Summer hero 30s” paused");
        expect(优壍?.recommendation).toContain("consider re-enabling the paused ad");
    });
    it("marks c2's spend increase after its +40% budget raise as expected (info, still listed)", () => {
        const 姥壍 = 恊壍(痤壍, "c2", (磔壍) => 磔壍.kind === "metric_deviation" && 磔壍.metric === "spend");
        expect(姥壍).toMatchObject({ severity: "info", polarity: "bad", direction: "up", onsetDate: "2026-09-26" });
        expect(姥壍?.changeContext).toMatchObject({ verdict: "expected", eventId: expect.stringContaining("c2-budget"), lagDays: 0, note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." });
        expect(["warning", "critical"]).toContain(姥壍?.changeContext?.severityBefore);
        expect(姥壍?.recommendation).toMatch(/^Spend is up \d+% because the daily budget was raised 40% \(\$780 → \$1,092\) on Sep 26 — the expected effect of the change, not an anomaly\./);
        expect(姥壍?.relatedChanges[0]).toMatchObject({ category: "budget", effect: "Budget +40% ($780 → $1,092)" });
        expect(恊壍(痤壍, "c2", (韃壍) => 韃壍.kind === "overdelivery" || 韃壍.kind === "pacing")).toBeUndefined();
    });
    it("reports the c1 conversion lift as an opportunity", () => {
        const 撲壍 = 恊壍(痤壍, "c1", (莡壍) => 莡壍.kind === "metric_deviation" && 莡壍.metric === "conversions");
        expect(撲壍).toMatchObject({ severity: "info", polarity: "good", direction: "up", recommendation: RECOMMENDATIONS.good });
    });
    it("detects the c7 tracking break and folds its symptoms into it", () => {
        const 傐壍 = 恊壍(痤壍, "c7", (潿壍) => 潿壍.kind === "tracking_break");
        expect(傐壍).toMatchObject({ severity: "critical", metric: "conversions", polarity: "bad", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(傐壍?.detectors).toEqual(expect.arrayContaining(["tracking_break", "zscore"]));
        expect(痤壍.filter((蹮壍) => 蹮壍.entity.id === "c7" && 蹮壍.kind === "metric_deviation" && ["conversions", "cpa"].includes(蹮壍.metric ?? ""))).toHaveLength(0);
        expect(傐壍?.changeContext?.verdict).toBe("none");
    });
    it("finds c1 budget-limited as an opportunity", () => {
        const 孝壍 = 恊壍(痤壍, "c1", (穌壍) => 穌壍.kind === "budget_limited");
        expect(孝壍).toMatchObject({ severity: "info", polarity: "good", format: "percent" });
        expect(孝壍?.observed).toBeGreaterThanOrEqual(0.2);
        expect(孝壍?.recommendation).toMatch(/Raise the daily budget by about \d+%/);
    });
    it("produces stable, unique, well-formed ids sorted by severity", () => {
        const 餻壍 = 痤壍.map((昪壍) => 昪壍.id);
        expect(new Set(餻壍).size).toBe(餻壍.length);
        for (const 蔙壍 of 痤壍) {
            expect(isSignalId(蔙壍.id)).toBe(true);
            expect(蔙壍.id.endsWith(`:${ANCHOR}`)).toBe(true);
            expect(seriesKey(蔙壍.id)).toBe(蔙壍.id.slice(0, -(ANCHOR.length + 1)));
            expect(蔙壍.series.length).toBeLessThanOrEqual(24);
            expect(蔙壍.evidence.slice(0, 2).map((刈壍) => 刈壍.label)).toEqual(["Observed", "Expected"]);
        }
        const 烷壍 = { critical: 3, warning: 2, info: 1 };
        for (let 迦壍 = 1; 迦壍 < 痤壍.length; 迦壍++)
            expect(烷壍[痤壍[迦壍 - 1]!.severity]).toBeGreaterThanOrEqual(烷壍[痤壍[迦壍]!.severity]);
        expect(吅壍().signals.map((峕壍) => 峕壍.id)).toEqual(餻壍);
        expect(铓壍).toEqual([]);
    });
    it("does not flag a conversions opportunity that is only a spend spike (c6)", () => {
        expect(恊壍(痤壍, "c6", (範壍) => 範壍.metric === "conversions" && 範壍.polarity === "good")).toBeUndefined();
    });
    it("stays quiet on the account without planted anomalies", () => {
        const { signals: 骳壍 } = 吅壍(outletDataset());
        expect(骳壍.filter((枢壍) => 枢壍.severity !== "info")).toEqual([]);
    });
    it("with change history turned off, signals keep the detector copy and only list related changes", () => {
        const 蚑壍 = 吅壍(demoDataset(), (厀壍) => (厀壍.changeHistory.enabled = false)).signals;
        expect(蚑壍.every((牯壍) => 牯壍.changeContext === undefined)).toBe(true);
        expect(恊壍(蚑壍, "c8", (酞壍) => 酞壍.metric === "cpa" && 酞壍.kind === "metric_deviation")?.recommendation).toBe(RECOMMENDATIONS.cpa);
        const 幍壍 = 恊壍(蚑壍, "c6", (紼壍) => 紼壍.metric === "spend" && 紼壍.kind === "metric_deviation");
        expect(幍壍?.summary).toContain("Possibly related: Bid strategy changed from Target CPA ($28) to Maximize conversions (Sep 24, 1 day before the shift).");
        expect(幍壍?.recommendation).toBe(RECOMMENDATIONS.spend);
        expect(幍壍?.relatedChanges[0]).toMatchObject({ eventId: expect.stringContaining("c6-bid"), category: "bidding" });
        expect(["warning", "critical"]).toContain(恊壍(蚑壍, "c2", (鰫壍) => 鰫壍.metric === "spend")?.severity);
    });
    it("keeps an expected signal's severity when downgrading is turned off", () => {
        const 椚壍 = 吅壍(demoDataset(), (蠉壍) => (蠉壍.changeHistory.downgradeExpected = false)).signals;
        const 哸壍 = 恊壍(椚壍, "c2", (珧壍) => 珧壍.metric === "spend");
        expect(哸壍?.changeContext?.verdict).toBe("expected");
        expect(哸壍?.changeContext?.severityBefore).toBeUndefined();
        expect(["warning", "critical"]).toContain(哸壍?.severity);
    });
});
describe("z-score math", () => {
    const 鋖壍 = campaign("x1");
    const 必壍 = (纴壍: number) => steady(纴壍);
    it("matches the prototype formula for an additive metric", () => {
        const 鶣壍 = rows("x1", ANCHOR, 40, (檒壍) => (檒壍 >= 37 ? { ...必壍(檒壍), cost: 180 } : 必壍(檒壍)));
        const { signals: 要壍 } = detectSignals(袎壍([鋖壍], 鶣壍));
        const 噰壍 = 要壍.find((畟壍) => 畟壍.metric === "spend");
        const 鑎壍 = 鶣壍.slice(40 - 3 - 14, 40 - 3).map((愽壍) => 愽壍.cost);
        const 耬壍 = (180 - mean(鑎壍)) / std(鑎壍);
        expect(噰壍?.z).toBeCloseTo(耬壍, 9);
        expect(噰壍?.expected).toBeCloseTo(mean(鑎壍), 9);
        expect(噰壍?.observed).toBeCloseTo(180, 9);
        expect(噰壍?.severity).toBe(Math.abs(耬壍) >= 2.5 * 1.8 ? "critical" : "warning");
        expect(噰壍?.band?.hi).toBeCloseTo(mean(鑎壍) + 2.5 * std(鑎壍), 9);
        expect(噰壍?.window).toEqual({ recentStart: "2026-09-26", recentEnd: ANCHOR, baselineStart: "2026-09-12", baselineEnd: "2026-09-25" });
    });
    it("uses ratio of sums for derived metrics (CPA = Σcost / Σconv)", () => {
        const 鼛壍 = rows("x1", ANCHOR, 40, (氊壍) => (氊壍 >= 37 ? { ...必壍(氊壍), cost: 必壍(氊壍).cost * 2 } : 必壍(氊壍)));
        const { signals: 諹壍 } = detectSignals(袎壍([鋖壍], 鼛壍));
        const 埨壍 = 諹壍.find((盗壍) => 盗壍.metric === "cpa");
        const 闆壍 = 鼛壍.slice(-3);
        expect(埨壍?.observed).toBeCloseTo(闆壍.reduce((抵壍, 膤壍) => 抵壍 + 膤壍.cost, 0) / 闆壍.reduce((亓壍, 涂壍) => 亓壍 + 涂壍.conversions, 0), 9);
        expect(埨壍?.severity).toBe("critical");
    });
    it("treats a zero σ as ε instead of dividing by zero", () => {
        const 豱壍 = rows("x1", ANCHOR, 40, (奠壍) => (奠壍 >= 37 ? { cost: 120, clicks: 200, impressions: 5000, conversions: 10 } : { cost: 100, clicks: 200, impressions: 5000, conversions: 10 }));
        const 硏壍 = detectSignals(袎壍([鋖壍], 豱壍)).signals.find((霾壍) => 霾壍.metric === "spend");
        expect(Number.isFinite(硏壍?.z)).toBe(true);
        expect(硏壍?.severity).toBe("critical");
    });
    it("ignores spend below baseline and respects the threshold", () => {
        const 搭壍 = rows("x1", ANCHOR, 40, (茜壍) => (茜壍 >= 37 ? { ...必壍(茜壍), cost: 40 } : 必壍(茜壍)));
        expect(detectSignals(袎壍([鋖壍], 搭壍)).signals.find((個壍) => 個壍.metric === "spend")).toBeUndefined();
        const 滺壍 = rows("x1", ANCHOR, 40, (跩壍) => (跩壍 >= 37 ? { ...必壍(跩壍), cost: 104 } : 必壍(跩壍)));
        expect(detectSignals(袎壍([鋖壍], 滺壍)).signals.find((嫘壍) => 嫘壍.metric === "spend")).toBeUndefined();
    });
    it("skips anomalous days before the window when building the baseline (onset)", () => {
        const 秇壍 = rows("x1", ANCHOR, 40, (颶壍) => (颶壍 >= 36 ? { ...必壍(颶壍), cost: 200 } : 必壍(颶壍)));
        const 斥壍 = detectSignals(袎壍([鋖壍], 秇壍)).signals.find((蒔壍) => 蒔壍.metric === "spend");
        expect(斥壍?.onsetDate).toBe("2026-09-25");
        expect(斥壍?.window.baselineEnd).toBe("2026-09-24");
        const 冃壍 = 秇壍.slice(40 - 4 - 14, 40 - 4).map((灲壍) => 灲壍.cost);
        expect(斥壍?.z).toBeCloseTo((200 - mean(冃壍)) / std(冃壍), 9);
    });
    it("applies minimum-volume guards and skips paused or excluded campaigns", () => {
        const 轡壍 = rows("x1", ANCHOR, 40, (屐壍) => (屐壍 >= 37 ? { cost: 9, clicks: 2, impressions: 20, conversions: 0.1 } : { cost: 3, clicks: 2, impressions: 20, conversions: 0.1 }));
        expect(detectSignals(袎壍([鋖壍], 轡壍)).signals).toEqual([]);
        const 笿壍 = rows("x1", ANCHOR, 40, (騮壍) => (騮壍 >= 37 ? { ...必壍(騮壍), cost: 300 } : 必壍(騮壍)));
        expect(detectSignals(袎壍([campaign("x1", { status: "Paused" })], 笿壍)).signals).toEqual([]);
        expect(detectSignals(袎壍([鋖壍], 笿壍, { settings: settings((朝壍) => (朝壍.excludeCampaignIds = ["x1"])) })).signals).toEqual([]);
    });
    it("robust and weekday detectors run only when enabled", () => {
        const 蘌壍 = rows("x1", ANCHOR, 70, (勻壍) => (勻壍 >= 67 ? { ...必壍(勻壍), cost: 260 } : 必壍(勻壍)));
        const 燪壍 = detectSignals(袎壍([鋖壍], 蘌壍)).signals.find((郙壍) => 郙壍.metric === "spend");
        expect(燪壍?.detectors).toEqual(["zscore"]);
        const 巈壍 = detectSignals(袎壍([鋖壍], 蘌壍, { settings: settings((粷壍) => ((粷壍.robust.enabled = true), (粷壍.seasonal.enabled = true))) })).signals.filter((鮦壍) => 鮦壍.metric === "spend");
        expect(巈壍).toHaveLength(1);
        expect(巈壍[0]?.detectors).toEqual(expect.arrayContaining(["zscore", "robust", "seasonal"]));
    });
    it("reduces severity for conversion drops that are only on the freshest day in live mode", () => {
        const 梕壍 = rows("x1", ANCHOR, 40, (螄壍) => (螄壍 === 39 ? { ...必壍(螄壍), conversions: 0.5 } : 必壍(螄壍)));
        const 味壍 = detectSignals(袎壍([鋖壍], 梕壍)).signals.find((獢壍) => 獢壍.metric === "conversions");
        const 鉑壍 = detectSignals(袎壍([鋖壍], 梕壍, { mode: "live", conversionLag: true })).signals.find((彀壍) => 彀壍.metric === "conversions");
        expect(味壍?.severity).toBe("critical");
        expect(鉑壍?.severity).toBe("warning");
        expect(鉑壍?.summary).toContain("may still be arriving");
    });
});
describe("rule-based detectors", () => {
    it("tracking break: clicks continue, conversions stop", () => {
        const 縯壍 = rows("x1", ANCHOR, 40, (鴞壍) => (鴞壍 >= 38 ? { ...steady(鴞壍), conversions: 0 } : steady(鴞壍)));
        const { signals: 樍壍 } = detectSignals(袎壍([campaign("x1")], 縯壍));
        const 裼壍 = 樍壍.find((嗫壍) => 嗫壍.kind === "tracking_break");
        expect(裼壍).toMatchObject({ severity: "critical", onsetDate: "2026-09-27", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(樍壍.filter((瓚壍) => 瓚壍.kind === "metric_deviation" && 瓚壍.metric === "conversions")).toHaveLength(0);
        expect(樍壍.filter((鏉壍) => 鏉壍.kind === "tracking_break")).toHaveLength(1);
    });
    it("tracking break across the whole account when no single campaign clears the guards", () => {
        const 悸壍 = Array.from({ length: 10 }, (羧壍, 麖壍) => `s${麖壍}`);
        const 殅壍 = 悸壍.flatMap((詴壍) => rows(詴壍, ANCHOR, 40, (坣壍) => (坣壍 >= 37 ? { ...steady(坣壍, 0.1), conversions: 0 } : steady(坣壍, 0.1))));
        const { signals: 癒壍 } = detectSignals(袎壍(悸壍.map((镁壍) => campaign(镁壍)), 殅壍));
        const 戰壍 = 癒壍.filter((脟壍) => 脟壍.kind === "tracking_break");
        expect(戰壍).toHaveLength(1);
        expect(戰壍[0]).toMatchObject({ entity: { id: "acct", name: "Test account" }, scope: "account", severity: "critical", metric: "conversions", onsetDate: "2026-09-26", recommendation: RECOMMENDATIONS.trackingBreak });
        expect(癒壍.filter((与壍) => 与壍.kind === "metric_deviation" && ["conversions", "cpa", "cvr", "roas"].includes(与壍.metric ?? ""))).toHaveLength(0);
        const 泽壍 = 悸壍.flatMap((诬壍) => rows(诬壍, ANCHOR, 40, (壛壍) => steady(壛壍, 0.1)));
        expect(detectSignals(袎壍(悸壍.map((矊壍) => campaign(矊壍)), 泽壍)).signals.filter((隹壍) => 隹壍.kind === "tracking_break")).toHaveLength(0);
        const 推壍 = detectSignals(袎壍(悸壍.map((芗壍) => campaign(芗壍)), 殅壍, { changeEvents: [], changeHistoryAvailable: true })).signals.find((來壍) => 來壍.kind === "tracking_break");
        expect(推壍?.changeContext).toMatchObject({ verdict: "no_recent_changes", note: expect.stringMatching(/^Nothing changed in this account in the 14 days before the shift, so look outside Google Ads \(the conversion tag/) });
        const 湵壍 = { id: "e1", ts: "2026-09-20 10:00:00", date: "2026-09-20", resource_type: "AD_GROUP_AD" as const, operation: "update" as const, campaign_id: "s3", changed_fields: ["status"], diffs: [], summary: "Ad updated", client_type: "GOOGLE_ADS_WEB_CLIENT" };
        const 赤壍 = detectSignals(袎壍(悸壍.map((婓壍) => campaign(婓壍)), 殅壍, { changeEvents: [湵壍], changeHistoryAvailable: true })).signals.find((祂壍) => 祂壍.kind === "tracking_break");
        expect(赤壍?.changeContext?.verdict).not.toBe("no_recent_changes");
    });
    it("an account-level break names the campaigns whose symptoms it absorbs", () => {
        const 頱壍 = (攠壍: Partial<Signal>): Signal => ({ id: "x", accountId: "acct", mode: "live", scope: "campaign", entity: { id: "acct", name: "Test account" }, kind: "metric_deviation", detectors: ["zscore"], metric: "cpa", direction: "up", polarity: "bad", severity: "warning", score: 1, observed: 2, expected: 1, changePct: 1, window: { recentStart: "2026-09-26", recentEnd: "2026-09-28", baselineStart: "2026-09-12", baselineEnd: "2026-09-25" }, series: [], title: "CPA up 100%", summary: "", recommendation: "", evidence: [], relatedChanges: [], format: "money", ...攠壍 }) as Signal;
        const 萏壍 = 頱壍({ id: "tb", scope: "account", kind: "tracking_break", detectors: ["tracking_break"], metric: "conversions", severity: "critical", title: "Tracking break" });
        const 僾壍 = 頱壍({ id: "c1cpa", entity: { id: "c1", name: "Brand — Core" }, z: 4.2 });
        const [濭壍] = absorbSymptoms([萏壍, 僾壍], "acct");
        expect(濭壍?.evidence.at(-1)).toEqual({ label: "Also flagged", value: "Brand — Core: CPA up 100% (z 4.2)" });
    });
    it("overdelivery needs the calendar average over budget too: weekday-only schedules make up for their weekends", () => {
        const 軜壍 = (寋壍: string) => ![0, 6].includes(new Date(`${寋壍}T12:00:00Z`).getUTCDay());
        const 窺壍 = (馩壍: number) => ({ ...steady(馩壍), cost: 140, conversions: 10 });
        const 暘壍 = rows("wk", ANCHOR, 40, 窺壍).filter((薇壍) => 軜壍(薇壍.date));
        const 剶壍 = rows("dd", ANCHOR, 40, 窺壍);
        const 煥壍 = [campaign("wk", { budget_daily: 100 }), campaign("dd", { budget_daily: 100 })];
        const 達壍 = [...暘壍, ...剶壍];
        const 嵃壍 = buildPacingReport({ month: ANCHOR.slice(0, 7), dataThrough: ANCHOR, campaigns: 煥壍, rows: 達壍, currency: "USD" });
        const { signals: 簲壍 } = detectSignals(袎壍(煥壍, 達壍, { pacing: 嵃壍 }));
        const 鬡壍 = 簲壍.filter((栐壍) => 栐壍.kind === "overdelivery");
        expect(鬡壍.map((蛿壍) => 蛿壍.entity.id)).toEqual(["dd"]);
        expect(鬡壍[0]?.evidence).toContainEqual({ label: "7-day calendar average", value: "$140/day" });
    });
    it("zero delivery: enabled campaign served nothing on the last day", () => {
        const 叮壍 = rows("x1", ANCHOR, 40, (狝壍) => (狝壍 === 39 ? { cost: 0, clicks: 0, impressions: 0, conversions: 0 } : steady(狝壍)));
        const { signals: 里壍 } = detectSignals(袎壍([campaign("x1")], 叮壍));
        const 庻壍 = 里壍.find((綪壍) => 綪壍.kind === "zero_delivery");
        expect(庻壍).toMatchObject({ severity: "critical", observed: 0, metric: "impressions" });
        expect(里壍.filter((鲙壍) => 鲙壍.entity.id === "x1" && 鲙壍.kind === "metric_deviation")).toHaveLength(0);
        expect(detectSignals(袎壍([campaign("x1")], 叮壍.slice(0, -1))).signals.some((榈壍) => 榈壍.kind === "zero_delivery")).toBe(true);
        expect(detectSignals(袎壍([campaign("x1", { status: "Paused" })], 叮壍)).signals).toEqual([]);
    });
    it("budget-limited: Search campaign losing budget share with ROAS above the account", () => {
        const 衷壍 = rows("x1", ANCHOR, 40, (啦壍) => ({ ...steady(啦壍), conv_value: steady(啦壍).conversions * 200, is_eligible: 10000, is_lost_budget: 3000, is_search_impr: 6000 }));
        const 瑕壍 = rows("x2", ANCHOR, 40, (鍄壍) => ({ ...steady(鍄壍), conv_value: steady(鍄壍).conversions * 10 }));
        const { signals: 怳壍 } = detectSignals(袎壍([campaign("x1"), campaign("x2", { type: "Display" })], [...衷壍, ...瑕壍]));
        const 缢壍 = 怳壍.find((鸑壍) => 鸑壍.kind === "budget_limited");
        expect(缢壍).toMatchObject({ entity: { id: "x1" }, severity: "info", polarity: "good" });
        expect(缢壍?.observed).toBeCloseTo(0.3, 9);
        expect(缢壍?.recommendation).toContain("50%");
    });
    it("threshold rules: last N days, consecutive days, change %, account scope", () => {
        const 欀壍 = rows("x1", ANCHOR, 40, (觯壍) => (觯壍 >= 37 ? { ...steady(觯壍), cost: 300 } : steady(觯壍)));
        const 回壍 = (痍壍: Partial<ThresholdRule>): ThresholdRule => ({ id: "r1", name: "High CPA", enabled: true, scope: { level: "campaign" }, metric: "cpa", op: "gt", value: 20, window: { kind: "last_n_days", days: 3 }, severity: "warning", ...痍壍 });
        const 钼壍 = (憫壍: ThresholdRule) => detectSignals(袎壍([campaign("x1")], 欀壍, { settings: settings((肚壍) => (肚壍.thresholdRules = [憫壍])) })).signals.filter((龉壍) => 龉壍.kind === "threshold");
        const 汸壍 = 钼壍(回壍({}));
        expect(汸壍).toHaveLength(1);
        expect(汸壍[0]).toMatchObject({ id: `x1:rule-r1:threshold:${ANCHOR}`, severity: "warning", ruleId: "r1", title: "High CPA" });
        expect(钼壍(回壍({ value: 40 }))).toHaveLength(0);
        expect(钼壍(回壍({ window: { kind: "consecutive_days", days: 3 } }))).toHaveLength(1);
        expect(钼壍(回壍({ window: { kind: "consecutive_days", days: 5 } }))).toHaveLength(0);
        expect(钼壍(回壍({ metric: "cost", op: "change_pct_gt", value: 0.5 }))).toHaveLength(1);
        expect(钼壍(回壍({ metric: "cost", op: "change_pct_gt", value: 3 }))).toHaveLength(0);
        const 譧壍 = 钼壍(回壍({ scope: { level: "account" }, metric: "cost", value: 500 }));
        expect(譧壍[0]).toMatchObject({ scope: "account", entity: { id: "acct", name: "Test account" } });
        expect(钼壍(回壍({ scope: { level: "campaign", campaignTypes: ["Display"] } }))).toHaveLength(0);
    });
});
