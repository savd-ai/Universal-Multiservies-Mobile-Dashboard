import { describe, expect, it } from "vitest";
import { accentHeadline, adjustBudget, CAMPAIGN_COLUMNS, campaignCsv, campaignRangeQuery, csvCell, DEFAULT_COLUMNS, filterCampaigns, formatP, formatPValue, gridMinWidth, gridTemplate, impactVerdict, keywordNotation, metricChangeText, money, moneyFmtOf, nextSort, pacingMonthOf, parseColumnPref, pctChange, rangeSearchOf, rangeShortLabel, sortCampaigns, toCsv, totalsOf, ZERO_METRICS, } from "@/features/campaigns/campaign-utils";
import type { CampaignListRow, CampaignMetrics, ChangeImpactMetric } from "@/lib/domain/contracts/actions";
const metrics = (over: Partial<CampaignMetrics> = {}): CampaignMetrics => ({ ...ZERO_METRICS, ...over });
function row(id: string, over: Partial<CampaignListRow> = {}): CampaignListRow {
    return {
        id,
        name: `Campaign ${id}`,
        type: "Search",
        status: "Enabled",
        biddingStrategy: "MAXIMIZE_CONVERSIONS",
        biddingLabel: "Maximize conversions",
        dailyBudget: 100,
        budgetShared: false,
        metrics: metrics(),
        spark: [],
        worstSeverity: null,
        signalCount: 0,
        deepLink: `https://ads.google.com/aw/campaigns?campaignId=${id}`,
        ...over,
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
    const status = (display: string, account = "USD") => ({ account: { currency: account }, display: { currency: display, fxRates: { VND: 25400 } } });
    it("derives the display currency and fx factor", () => {
        expect(moneyFmtOf(undefined)).toEqual({ currency: "USD", fx: 1 });
        expect(moneyFmtOf(status("USD"))).toEqual({ currency: "USD", fx: 1 });
        expect(moneyFmtOf(status("VND"))).toEqual({ currency: "VND", fx: 25400 });
        expect(moneyFmtOf(status("VND", "EUR"))).toEqual({ currency: "EUR", fx: 1 });
    });
    it("formats like the prototype (compact ≥ 10k, cents on request)", () => {
        const usd = { currency: "USD", fx: 1 };
        expect(money(34887.17, usd)).toBe("$34.9K");
        expect(money(1250, usd)).toBe("$1,250");
        expect(money(27.1377, usd, 2)).toBe("$27.14");
        expect(money(null, usd)).toBe("—");
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
        const visible = CAMPAIGN_COLUMNS.filter((c) => DEFAULT_COLUMNS.includes(c.key));
        expect(gridTemplate(visible, false)).toBe(["minmax(var(--name-min,220px),2.2fr)", "92px", ...Array<string>(9).fill("minmax(60px,1fr)"), "96px"].join(" "));
        expect(gridTemplate(visible, true).startsWith("16px ")).toBe(true);
        expect(gridMinWidth(visible, false)).toBe(948 + 110 + 44);
        expect(gridMinWidth(visible, true)).toBe(948 + 16 + 120 + 44);
        expect(gridMinWidth(visible, true)).toBeLessThanOrEqual(1130);
    });
    it("parses the stored preference defensively", () => {
        expect(parseColumnPref(null)).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref("not json")).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref('{"a":1}')).toEqual(DEFAULT_COLUMNS);
        expect(parseColumnPref('["roas","bogus","cost","cvr"]')).toEqual(["name", "cost", "cvr", "roas"]);
    });
});
describe("filter / sort / totals", () => {
    const rows = [
        row("c1", { name: "Brand — Core Terms", type: "Search", metrics: metrics({ cost: 100, cpa: 5 }) }),
        row("c2", { name: "PMax — Full Catalog", type: "PMax", status: "Paused", metrics: metrics({ cost: 300, cpa: null }) }),
        row("c3", { name: "Shopping — Best Sellers", type: "Shopping", metrics: metrics({ cost: 200, cpa: 12 }) }),
        row("c4", { name: "Another Brand", type: "Search", metrics: metrics({ cost: 200, cpa: 9 }), dailyBudget: null }),
    ];
    it("filters by search, type, status and campaign ids", () => {
        expect(filterCampaigns(rows, { q: "  brand " }).map((r) => r.id)).toEqual(["c1", "c4"]);
        expect(filterCampaigns(rows, { q: "C3" }).map((r) => r.id)).toEqual(["c3"]);
        expect(filterCampaigns(rows, { types: ["Search", "PMax"] }).map((r) => r.id)).toEqual(["c1", "c2", "c4"]);
        expect(filterCampaigns(rows, { statuses: ["Paused"] }).map((r) => r.id)).toEqual(["c2"]);
        expect(filterCampaigns(rows, { campaignIds: ["c3", "c4"], types: ["Search"] }).map((r) => r.id)).toEqual(["c4"]);
        expect(filterCampaigns(rows, {})).toHaveLength(4);
    });
    it("sorts numbers and text, keeps missing values last and breaks ties by name", () => {
        expect(sortCampaigns(rows, "cost", "desc").map((r) => r.id)).toEqual(["c2", "c4", "c3", "c1"]);
        expect(sortCampaigns(rows, "cost", "asc").map((r) => r.id)).toEqual(["c1", "c4", "c3", "c2"]);
        expect(sortCampaigns(rows, "cpa", "desc").map((r) => r.id)).toEqual(["c3", "c4", "c1", "c2"]);
        expect(sortCampaigns(rows, "cpa", "asc").map((r) => r.id)).toEqual(["c1", "c4", "c3", "c2"]);
        expect(sortCampaigns(rows, "budget", "desc").at(-1)?.id).toBe("c4");
        expect(sortCampaigns(rows, "name", "asc").map((r) => r.id)).toEqual(["c4", "c1", "c2", "c3"]);
        expect(sortCampaigns(rows, "status", "desc")[0]?.id).toBe("c2");
    });
    it("flips the same column, starts text ascending and numbers descending", () => {
        expect(nextSort({ key: "cost", dir: "desc" }, "cost")).toEqual({ key: "cost", dir: "asc" });
        expect(nextSort({ key: "cost", dir: "asc" }, "cost")).toEqual({ key: "cost", dir: "desc" });
        expect(nextSort({ key: "cost", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
        expect(nextSort({ key: "name", dir: "asc" }, "roas")).toEqual({ key: "roas", dir: "desc" });
    });
    it("totals are ratios of sums, never averages of ratios", () => {
        const t = totalsOf([metrics({ cost: 100, clicks: 50, impressions: 1000, conversions: 10, conv_value: 400 }), metrics({ cost: 300, clicks: 50, impressions: 4000, conversions: 5, conv_value: 200 })], [100, null, 50]);
        expect(t.cost).toBe(400);
        expect(t.ctr).toBeCloseTo(100 / 5000);
        expect(t.cpc).toBeCloseTo(4);
        expect(t.cpa).toBeCloseTo(400 / 15);
        expect(t.roas).toBeCloseTo(600 / 400);
        expect(t.cvr).toBeCloseTo(15 / 100);
        expect(t.dailyBudget).toBe(150);
        expect(t.count).toBe(2);
        const empty = totalsOf([]);
        expect(empty.cpa).toBeNull();
        expect(empty.ctr).toBeNull();
        expect(empty.count).toBe(0);
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
        const r = row("c9", { name: "=cmd|' /C calc'!A0", dailyBudget: 50, metrics: metrics({ cost: 1234.567, ctr: 0.05234, roas: 3.456, conversions: 10.123 }) });
        const csv = campaignCsv([r], ["name", "status", "budget", "cost", "ctr", "conversions", "roas", "trend"], { currency: "USD", fx: 1 });
        expect(csv.startsWith("﻿")).toBe(true);
        const [header, line] = csv.slice(1).split("\r\n");
        expect(header).toBe("Campaign,Campaign ID,Type,Status,Daily budget (USD),Spend (USD),CTR (%),Conversions,ROAS");
        expect(line).toBe("'=cmd|' /C calc'!A0,c9,Search,Enabled,50,1234.57,5.23,10.12,3.46");
        const vnd = campaignCsv([r], ["name", "cost"], { currency: "VND", fx: 25400 });
        expect(vnd.slice(1).split("\r\n")[1]).toBe("'=cmd|' /C calc'!A0,c9,Search,31358001.8");
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
        for (const n of ["A — B — C", "x", "a*b*c", "Top: Deals", "Q4 — "])
            expect(accentHeadline(n).split(/(\*[^*]+\*)/g).filter((p) => /^\*[^*]+\*$/.test(p))).toHaveLength(1);
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
    const m = (metric: ChangeImpactMetric["metric"], deltaPct: number | null, p: number, significant = p < 0.05): ChangeImpactMetric => ({
        metric,
        label: metric,
        format: metric === "cost" || metric === "cpa" ? "money" : metric === "ctr" ? "percent" : "decimal",
        before: 1,
        after: 1,
        deltaPct,
        t: 0,
        df: 10,
        p,
        significant,
    });
    const after = (days: number) => ({ start: "2026-09-10", end: "2026-09-23", days });
    it("formats p-values", () => {
        expect(formatPValue(0.0304)).toBe("0.03");
        expect(formatPValue(0.0042)).toBe("0.004");
        expect(formatPValue(0.0002)).toBe("< 0.001");
        expect(formatP(0.03)).toBe("p = 0.03");
        expect(formatP(0)).toBe("p < 0.001");
    });
    it("describes one metric", () => {
        expect(metricChangeText(m("cpa", 0.18, 0.03))).toBe("CPA rose 18% (p = 0.03)");
        expect(metricChangeText(m("conversions", -0.254, 0.2))).toBe("daily conversions fell 25% (p = 0.20)");
        expect(metricChangeText(m("ctr", 0.001, 0.9))).toBe("CTR was flat (p = 0.90)");
        expect(metricChangeText(m("cpa", null, 1))).toBe("CPA could not be compared");
    });
    it("leads with the significant metric in plain language", () => {
        const v = impactVerdict({ metrics: [m("cost", 0.02, 0.6), m("conversions", -0.1, 0.2), m("cpa", 0.18, 0.03), m("ctr", 0, 0.9)], after: after(14) });
        expect(v.text).toBe("CPA rose 18% after this change (p = 0.03).");
        expect(v.tone).toBe("bad");
        expect(v.preliminary).toBe(false);
    });
    it("joins two significant metrics and flags short windows as preliminary", () => {
        const v = impactVerdict({ metrics: [m("cost", 0.5413, 0.0024), m("conversions", 0.5779, 0), m("cpa", -0.0232, 0.599), m("ctr", -0.0193, 0.4985)], after: after(4) });
        expect(v.text).toBe("Daily conversions rose 58% (p < 0.001) and daily spend rose 54% (p = 0.002) after this change. Preliminary: only 4 days of data after it.");
        expect(v.tone).toBe("good");
        expect(v.preliminary).toBe(true);
    });
    it("says when nothing moved significantly", () => {
        const v = impactVerdict({ metrics: [m("cost", 0.01, 0.7), m("cpa", -0.06, 0.31), m("ctr", 0.02, 0.5)], after: after(14) });
        expect(v.text).toBe("No significant change in spend, conversions, CPA or CTR after this change. The largest move, CPA fell 6% (p = 0.31), is within normal day-to-day variation.");
        expect(v.tone).toBe("neutral");
    });
    it("handles changes too recent to measure", () => {
        expect(impactVerdict({ metrics: [], after: after(0) }).text).toMatch(/^Too recent to measure/);
    });
});
