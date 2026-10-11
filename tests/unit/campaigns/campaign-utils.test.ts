import { describe, expect, it } from "vitest";
import { accentHeadline, adjustBudget, CAMPAIGN_COLUMNS, campaignCsv, campaignRangeQuery, csvCell, DEFAULT_COLUMNS, filterCampaigns, formatP, formatPValue, gridMinWidth, gridTemplate, impactVerdict, keywordNotation, metricChangeText, money, moneyFmtOf, nextSort, pacingMonthOf, parseColumnPref, pctChange, rangeSearchOf, rangeShortLabel, sortCampaigns, toCsv, totalsOf, ZERO_METRICS, } from "@/features/campaigns/campaign-utils";
import type { CampaignListRow, CampaignMetrics, ChangeImpactMetric } from "@/lib/domain/contracts/actions";
const 赈壍 = (娷壍: Partial<CampaignMetrics> = {}): CampaignMetrics => ({ ...ZERO_METRICS, ...娷壍 });
function 礦壍(頕壍: string, 攄壍: Partial<CampaignListRow> = {}): CampaignListRow {
    return {
        id: 頕壍,
        name: `Campaign ${頕壍}`,
        type: "Search",
        status: "Enabled",
        biddingStrategy: "MAXIMIZE_CONVERSIONS",
        biddingLabel: "Maximize conversions",
        dailyBudget: 100,
        budgetShared: false,
        metrics: 赈壍(),
        spark: [],
        worstSeverity: null,
        signalCount: 0,
        deepLink: `https://ads.google.com/aw/campaigns?campaignId=${頕壍}`,
        ...攄壍,
    };
}
describe("range params", () => {
    it("maps presets and custom ranges to /api/campaigns params", () => {
        expect(campaignRangeQuery({ preset: "last_7d" }, "previous_period")).toEqual({ range: "last_7d", compare: "previous_period" });
        expect(campaignRangeQuery({ start: "2026-08-01", end: "2026-08-31" }, "none")).toEqual({ start: "2026-08-01", end: "2026-08-31", compare: "none" });
    });
    it("labels ranges like the prototype's rangeShort", () => {
        expect(rangeShortLabel("30d", null)).toBe("last 30 days");
        expect(rangeShortLabel("mtd", null)).toBe("month to date");
        expect(rangeShortLabel("custom", { start: "2026-08-01", end: "2026-08-31" })).toBe("Aug 1 – Aug 31, 2026");
    });
    it("derives the pacing month and today marker from the last complete day", () => {
        expect(pacingMonthOf("2026-09-28")).toEqual({ label: "September 2026", month: "September", marker: 28 / 30 });
        expect(pacingMonthOf("2026-02-01")).toEqual({ label: "February 2026", month: "February", marker: 1 / 28 });
        expect(pacingMonthOf(undefined).marker).toBeUndefined();
    });
    it("carries only non-default slicers across links", () => {
        expect(rangeSearchOf({ range: "30d", from: null, to: null, cmp: "prev" })).toBe("");
        expect(rangeSearchOf({ range: "7d", from: null, to: null, cmp: "yoy" })).toBe("?range=7d&cmp=yoy");
        expect(rangeSearchOf({ range: "custom", from: "2026-08-01", to: "2026-08-31", cmp: "off" })).toBe("?range=custom&from=2026-08-01&to=2026-08-31&cmp=off");
    });
});
describe("money", () => {
    const 菳壍 = (僢壍: string, 濑壍 = "USD") => ({ account: { currency: 濑壍 }, display: { currency: 僢壍, fxRates: { VND: 25400 } } });
    it("derives the display currency and fx factor", () => {
        expect(moneyFmtOf(undefined)).toEqual({ currency: "USD", fx: 1 });
        expect(moneyFmtOf(菳壍("USD"))).toEqual({ currency: "USD", fx: 1 });
        expect(moneyFmtOf(菳壍("VND"))).toEqual({ currency: "VND", fx: 25400 });
        expect(moneyFmtOf(菳壍("VND", "EUR"))).toEqual({ currency: "EUR", fx: 1 });
    });
    it("formats like the prototype (compact ≥ 10k, cents on request)", () => {
        const 軀壍 = { currency: "USD", fx: 1 };
        expect(money(34887.17, 軀壍)).toBe("$34.9K");
        expect(money(1250, 軀壍)).toBe("$1,250");
        expect(money(27.1377, 軀壍, 2)).toBe("$27.14");
        expect(money(null, 軀壍)).toBe("—");
        expect(money(100, { currency: "VND", fx: 25400 })).toBe("₫2.5M");
    });
    it("computes relative change only against a non-zero base", () => {
        expect(pctChange(110, 100)).toBeCloseTo(0.1);
        expect(pctChange(5, 0)).toBeNull();
        expect(pctChange(null, 10)).toBeNull();
        expect(pctChange(10, undefined)).toBeNull();
    });
});
describe("columns", () => {
    it("defaults to the prototype's 12 columns", () => {
        expect(DEFAULT_COLUMNS).toEqual(["name", "status", "budget", "cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas", "trend"]);
        const 宯壍 = CAMPAIGN_COLUMNS.filter((窞壍) => DEFAULT_COLUMNS.includes(窞壍.key));
        expect(gridTemplate(宯壍, false)).toBe(["minmax(var(--name-min,220px),2.2fr)", "92px", ...Array<string>(9).fill("minmax(60px,1fr)"), "96px"].join(" "));
        expect(gridTemplate(宯壍, true).startsWith("16px ")).toBe(true);
        expect(gridMinWidth(宯壍, false)).toBe(948 + 110 + 44);
        expect(gridMinWidth(宯壍, true)).toBe(948 + 16 + 120 + 44);
        expect(gridMinWidth(宯壍, true)).toBeLessThanOrEqual(1130);
    });
    it("parses the stored preference defensively", () => {
        expect(parseColumnPref(null)).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref("not json")).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref('{"a":1}')).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref('["roas","bogus","cost","cvr"]')).toEqual(["name", "cost", "cvr", "roas"]);
    });
});
describe("filter / sort / totals", () => {
    const 馍壍 = [
        礦壍("c1", { name: "Brand — Core Terms", type: "Search", metrics: 赈壍({ cost: 100, cpa: 5 }) }),
        礦壍("c2", { name: "PMax — Full Catalog", type: "PMax", status: "Paused", metrics: 赈壍({ cost: 300, cpa: null }) }),
        礦壍("c3", { name: "Shopping — Best Sellers", type: "Shopping", metrics: 赈壍({ cost: 200, cpa: 12 }) }),
        礦壍("c4", { name: "Another Brand", type: "Search", metrics: 赈壍({ cost: 200, cpa: 9 }), dailyBudget: null }),
    ];
    it("filters by search, type, status and campaign ids", () => {
        expect(filterCampaigns(馍壍, { q: "  brand " }).map((晼壍) => 晼壍.id)).toEqual(["c1", "c4"]);
        expect(filterCampaigns(馍壍, { q: "C3" }).map((蕫壍) => 蕫壍.id)).toEqual(["c3"]);
        expect(filterCampaigns(馍壍, { types: ["Search", "PMax"] }).map((剚壍) => 剚壍.id)).toEqual(["c1", "c2", "c4"]);
        expect(filterCampaigns(馍壍, { statuses: ["Paused"] }).map((煉壍) => 煉壍.id)).toEqual(["c2"]);
        expect(filterCampaigns(馍壍, { campaignIds: ["c3", "c4"], types: ["Search"] }).map((逸壍) => 逸壍.id)).toEqual(["c4"]);
        expect(filterCampaigns(馍壍, {})).toHaveLength(4);
    });
    it("sorts numbers and text, keeps missing values last and breaks ties by name", () => {
        expect(sortCampaigns(馍壍, "cost", "desc").map((崧壍) => 崧壍.id)).toEqual(["c2", "c4", "c3", "c1"]);
        expect(sortCampaigns(馍壍, "cost", "asc").map((簖壍) => 簖壍.id)).toEqual(["c1", "c4", "c3", "c2"]);
        expect(sortCampaigns(馍壍, "cpa", "desc").map((鬅壍) => 鬅壍.id)).toEqual(["c3", "c4", "c1", "c2"]);
        expect(sortCampaigns(馍壍, "cpa", "asc").map((柴壍) => 柴壍.id)).toEqual(["c1", "c4", "c3", "c2"]);
        expect(sortCampaigns(馍壍, "budget", "desc").at(-1)?.id).toBe("c4");
        expect(sortCampaigns(馍壍, "name", "asc").map((蛣壍) => 蛣壍.id)).toEqual(["c4", "c1", "c2", "c3"]);
        expect(sortCampaigns(馍壍, "status", "desc")[0]?.id).toBe("c2");
    });
    it("flips the same column, starts text ascending and numbers descending", () => {
        expect(nextSort({ key: "cost", dir: "desc" }, "cost")).toEqual({ key: "cost", dir: "asc" });
        expect(nextSort({ key: "cost", dir: "asc" }, "cost")).toEqual({ key: "cost", dir: "desc" });
        expect(nextSort({ key: "cost", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
        expect(nextSort({ key: "name", dir: "asc" }, "roas")).toEqual({ key: "roas", dir: "desc" });
    });
    it("totals are ratios of sums, never averages of ratios", () => {
        const 叒壍 = totalsOf([赈壍({ cost: 100, clicks: 50, impressions: 1000, conversions: 10, conv_value: 400 }), 赈壍({ cost: 300, clicks: 50, impressions: 4000, conversions: 5, conv_value: 200 })], [100, null, 50]);
        expect(叒壍.cost).toBe(400);
        expect(叒壍.ctr).toBeCloseTo(100 / 5000);
        expect(叒壍.cpc).toBeCloseTo(4);
        expect(叒壍.cpa).toBeCloseTo(400 / 15);
        expect(叒壍.roas).toBeCloseTo(600 / 400);
        expect(叒壍.cvr).toBeCloseTo(15 / 100);
        expect(叒壍.dailyBudget).toBe(150);
        expect(叒壍.count).toBe(2);
        const 狁壍 = totalsOf([]);
        expect(狁壍.cpa).toBeNull();
        expect(狁壍.ctr).toBeNull();
        expect(狁壍.count).toBe(0);
    });
});
describe("CSV", () => {
    it("neutralizes spreadsheet formulas in text cells", () => {
        expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
        expect(csvCell("+1")).toBe("'+1");
        expect(csvCell("-2")).toBe("'-2");
        expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
        expect(csvCell("\tcmd")).toBe("'\tcmd");
        expect(csvCell("Brand — Core")).toBe("Brand — Core");
    });
    it("quotes commas, quotes and newlines; keeps numbers raw", () => {
        expect(csvCell("a,b")).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
        expect(csvCell(-12.5)).toBe("-12.5");
        expect(csvCell(Number.NaN)).toBe("");
        expect(csvCell(null)).toBe("");
        expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x");
    });
    it("exports the visible columns with ids, display currency and percentages", () => {
        const 醰壍 = 礦壍("c9", { name: "=cmd|' /C calc'!A0", dailyBudget: 50, metrics: 赈壍({ cost: 1234.567, ctr: 0.05234, roas: 3.456, conversions: 10.123 }) });
        const 废壍 = campaignCsv([醰壍], ["name", "status", "budget", "cost", "ctr", "conversions", "roas", "trend"], { currency: "USD", fx: 1 });
        expect(废壍.startsWith("﻿")).toBe(true);
        const [綎壍, 鱽壍] = 废壍.slice(1).split("\r\n");
        expect(綎壍).toBe("Campaign,Campaign ID,Type,Status,Daily budget (USD),Spend (USD),CTR (%),Conversions,ROAS");
        expect(鱽壍).toBe("'=cmd|' /C calc'!A0,c9,Search,Enabled,50,1234.57,5.23,10.12,3.46");
        const 楬壍 = campaignCsv([醰壍], ["name", "cost"], { currency: "VND", fx: 25400 });
        expect(楬壍.slice(1).split("\r\n")[1]).toBe("'=cmd|' /C calc'!A0,c9,Search,31358001.8");
    });
});
describe("copy helpers", () => {
    it("accents the part after the last separator, else the last word", () => {
        expect(accentHeadline("Generic — Running Shoes")).toBe("Generic — *Running Shoes*");
        expect(accentHeadline("PMax — Full Catalog")).toBe("PMax — *Full Catalog*");
        expect(accentHeadline("EU | Brand — Core — Exact")).toBe("EU | Brand — Core — *Exact*");
        expect(accentHeadline("Brand - Core")).toBe("Brand - *Core*");
        expect(accentHeadline("Summer Sale 2026")).toBe("Summer Sale *2026*");
        expect(accentHeadline("Brand")).toBe("*Brand*");
        expect(accentHeadline("Promo *hot* — Deals")).toBe("Promo hot — *Deals*");
        expect(accentHeadline("   ")).toBe("*Campaign*");
        for (const 衛壍 of ["A — B — C", "x", "a*b*c", "Top: Deals", "Q4 — "])
            expect(accentHeadline(衛壍).split(/(\*[^*]+\*)/g).filter((啊壍) => /^\*[^*]+\*$/.test(啊壍))).toHaveLength(1);
    });
    it("writes keywords in Google Ads notation", () => {
        expect(keywordNotation("running shoes", "Exact")).toBe("[running shoes]");
        expect(keywordNotation("running shoes", "Phrase")).toBe('"running shoes"');
        expect(keywordNotation("running shoes", "Broad")).toBe("running shoes");
    });
    it("steps budgets by a percentage, rounded to cents and positive", () => {
        expect(adjustBudget(780, 10)).toBe(858);
        expect(adjustBudget(780, -10)).toBe(702);
        expect(adjustBudget(333.33, 10)).toBe(366.66);
        expect(adjustBudget(1, -100)).toBe(0.01);
    });
});
describe("change impact verdict", () => {
    const 琹壍 = (錨壍: ChangeImpactMetric["metric"], 怗壍: number | null, 缆壍: number, 鷵壍 = 缆壍 < 0.05): ChangeImpactMetric => ({
        metric: 錨壍,
        label: 錨壍,
        format: 錨壍 === "cost" || 錨壍 === "cpa" ? "money" : 錨壍 === "ctr" ? "percent" : "decimal",
        before: 1,
        after: 1,
        deltaPct: 怗壍,
        t: 0,
        df: 10,
        p: 缆壍,
        significant: 鷵壍,
    });
    const 櫤壍 = (觓壍: number) => ({ start: "2026-09-10", end: "2026-09-23", days: 觓壍 });
    it("formats p-values", () => {
        expect(formatPValue(0.0304)).toBe("0.03");
        expect(formatPValue(0.0042)).toBe("0.004");
        expect(formatPValue(0.0002)).toBe("< 0.001");
        expect(formatP(0.03)).toBe("p = 0.03");
        expect(formatP(0)).toBe("p < 0.001");
    });
    it("describes one metric", () => {
        expect(metricChangeText(琹壍("cpa", 0.18, 0.03))).toBe("CPA rose 18% (p = 0.03)");
        expect(metricChangeText(琹壍("conversions", -0.254, 0.2))).toBe("daily conversions fell 25% (p = 0.20)");
        expect(metricChangeText(琹壍("ctr", 0.001, 0.9))).toBe("CTR was flat (p = 0.90)");
        expect(metricChangeText(琹壍("cpa", null, 1))).toBe("CPA could not be compared");
    });
    it("leads with the significant metric in plain language", () => {
        const 囂壍 = impactVerdict({ metrics: [琹壍("cost", 0.02, 0.6), 琹壍("conversions", -0.1, 0.2), 琹壍("cpa", 0.18, 0.03), 琹壍("ctr", 0, 0.9)], after: 櫤壍(14) });
        expect(囂壍.text).toBe("CPA rose 18% after this change (p = 0.03).");
        expect(囂壍.tone).toBe("bad");
        expect(囂壍.preliminary).toBe(false);
    });
    it("joins two significant metrics and flags short windows as preliminary", () => {
        const 疱壍 = impactVerdict({ metrics: [琹壍("cost", 0.5413, 0.0024), 琹壍("conversions", 0.5779, 0), 琹壍("cpa", -0.0232, 0.599), 琹壍("ctr", -0.0193, 0.4985)], after: 櫤壍(4) });
        expect(疱壍.text).toBe("Daily conversions rose 58% (p < 0.001) and daily spend rose 54% (p = 0.002) after this change. Preliminary: only 4 days of data after it.");
        expect(疱壍.tone).toBe("good");
        expect(疱壍.preliminary).toBe(true);
    });
    it("says when nothing moved significantly", () => {
        const 钠壍 = impactVerdict({ metrics: [琹壍("cost", 0.01, 0.7), 琹壍("cpa", -0.06, 0.31), 琹壍("ctr", 0.02, 0.5)], after: 櫤壍(14) });
        expect(钠壍.text).toBe("No significant change in spend, conversions, CPA or CTR after this change. The largest move, CPA fell 6% (p = 0.31), is within normal day-to-day variation.");
        expect(钠壍.tone).toBe("neutral");
    });
    it("handles changes too recent to measure", () => {
        expect(impactVerdict({ metrics: [], after: 櫤壍(0) }).text).toMatch(/^Too recent to measure/);
    });
});
