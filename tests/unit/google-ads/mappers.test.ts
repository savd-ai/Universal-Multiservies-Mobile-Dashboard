import { describe, expect, it } from "vitest";
import type { AdGroupDailyRow, CampaignDailyRow, CampaignDeviceDailyRow, CampaignGeoDailyRow, CampaignHourlyRow, KeywordDailyRow, SearchTermDailyRow, } from "@/lib/domain/schema/facts";
import { flattenStream } from "@/lib/server/google-ads/client";
import { mapTableRows, toAdGroupDim, toCampaignDim, toCustomerClient, toCustomerInfo, toKeywordDim } from "@/lib/server/google-ads/mappers";
import { fixture } from "./helpers";
const ACCOUNT = "1234567890";
const rows = (name: string) => flattenStream(fixture(name)).rows;
const map = <T>(table: Parameters<typeof mapTableRows>[0], name: string, countryOf?: (id: string | undefined) => string) => mapTableRows(table, rows(name), ACCOUNT, countryOf) as unknown as T[];
describe("fact mappers", () => {
    it("campaign_daily: micros → currency, int64 strings, fractional conversions, missing metrics = 0", () => {
        const out = map<CampaignDailyRow>("campaign_daily", "campaign-daily.json");
        expect(out).toHaveLength(7);
        const brand = out.find((r) => r.date === "2026-09-20" && r.campaign_id === "111")!;
        expect(brand).toMatchObject({ account_id: ACCOUNT, impressions: 1200, clicks: 60, cost: 30.5, conversions: 3, conv_value: 310.5 });
        const shopping = out.find((r) => r.campaign_id === "333")!;
        expect(shopping).toMatchObject({ impressions: 700, clicks: 35, cost: 17.5, conversions: 0, conv_value: 0 });
        expect(out.find((r) => r.campaign_id === "444")!.conversions).toBeCloseTo(0.333333, 6);
    });
    it("campaign_daily: impression share is stored additively", () => {
        const out = map<CampaignDailyRow>("campaign_daily", "campaign-daily.json");
        const brand = out.find((r) => r.date === "2026-09-20" && r.campaign_id === "111")!;
        expect(brand.is_search_impr).toBe(1200);
        expect(brand.is_eligible).toBeCloseTo(2000);
        expect(brand.is_lost_budget).toBeCloseTo(300);
        expect(brand.is_lost_rank).toBeCloseTo(500);
        expect(brand.is_search_impr! / brand.is_eligible!).toBeCloseTo(0.6);
        const capped = out.find((r) => r.date === "2026-09-21" && r.campaign_id === "111")!;
        expect(capped.is_eligible).toBeCloseTo(900 / 0.0999, 3);
        expect(capped.is_lost_budget).toBe(0);
        expect(capped.is_lost_rank).toBeCloseTo((900 / 0.0999) * 0.9001, 3);
        const pmax = out.find((r) => r.campaign_id === "222")!;
        expect(pmax.is_eligible).toBeUndefined();
        expect(pmax.is_search_impr).toBeUndefined();
    });
    it("campaign_device_daily maps device enums", () => {
        const out = map<CampaignDeviceDailyRow>("campaign_device_daily", "campaign-device.json");
        expect(out.map((r) => r.device)).toEqual(["Mobile", "Desktop", "Tablet", "Connected TV", "Other"]);
        expect(out[0]).toMatchObject({ date: "2026-09-20", campaign_id: "111", cost: 18, conversions: 1.75 });
        expect(out[4]).toMatchObject({ clicks: 0, cost: 0.01 });
    });
    it("campaign_hourly treats an omitted hour as 0", () => {
        const out = map<CampaignHourlyRow>("campaign_hourly", "campaign-hourly.json");
        expect(out.map((r) => r.hour)).toEqual([0, 9, 23]);
        expect(out[1]).toMatchObject({ cost: 4.2, conversions: 1 });
    });
    it("campaign_geo_daily resolves countries and merges targeted + non-targeted rows", () => {
        const codes = new Map([
            ["2840", "US"],
            ["2704", "VN"],
            ["2124", "CA"],
        ]);
        const out = map<CampaignGeoDailyRow>("campaign_geo_daily", "geo.json", (id) => (id ? codes.get(id) : undefined) ?? "ZZ");
        expect(out).toHaveLength(4);
        expect(out.find((r) => r.country === "US")).toMatchObject({ campaign_id: "111", impressions: 850, clicks: 42, cost: 21, conversions: 2 });
        expect(out.find((r) => r.country === "ZZ")).toMatchObject({ campaign_id: "111", impressions: 50 });
        expect(out.find((r) => r.country === "CA")).toMatchObject({ campaign_id: "222", cost: 9 });
    });
    it("ad_group_daily", () => {
        const out = map<AdGroupDailyRow>("ad_group_daily", "ad-group-daily.json");
        expect(out[0]).toEqual({ date: "2026-09-20", account_id: ACCOUNT, campaign_id: "111", ad_group_id: "5001", impressions: 1000, clicks: 52, cost: 26, conversions: 2.5, conv_value: 260.5 });
    });
    it("keyword_daily keys keywords per ad group and weights Quality Score by impressions", () => {
        const out = map<KeywordDailyRow>("keyword_daily", "keyword-daily.json");
        expect(out.map((r) => r.keyword_id)).toEqual(["5001~7001", "5002~7001", "5001~7002"]);
        expect(out[0]).toMatchObject({ qs_weight: 3200, qs_impr: 400, cost: 15 });
        expect(out[1]).toMatchObject({ qs_weight: 600, qs_impr: 100 });
        expect(out[2]).toMatchObject({ qs_weight: 0, qs_impr: 0, impressions: 50 });
        const avgQs = out.reduce((s, r) => s + r.qs_weight, 0) / out.reduce((s, r) => s + r.qs_impr, 0);
        expect(avgQs).toBeCloseTo(7.6);
    });
    it("search_term_daily is range grain (date null) with status and match type buckets", () => {
        const out = map<SearchTermDailyRow>("search_term_daily", "search-terms.json");
        expect(out.every((r) => r.date === null)).toBe(true);
        expect(out.map((r) => [r.search_term, r.st_status, r.st_match_type])).toEqual([
            ["acme boots", "added", "Exact"],
            ["acme boots sale", "none", "Near phrase"],
            ["free boots", "excluded", "Broad"],
            ["boots near me", "none", "Unknown"],
            ["acme boot", "added_excluded", "Near exact"],
        ]);
        expect(out[0]).toMatchObject({ campaign_id: "111", ad_group_id: "5001", cost: 14.5, conversions: 1.5 });
    });
    it("drops rows without their key fields", () => {
        expect(mapTableRows("campaign_daily", [{ metrics: { impressions: "5" } }, { segments: { date: "bogus" }, campaign: { id: "1" } }], ACCOUNT)).toEqual([]);
    });
});
describe("dimension mappers", () => {
    const campaigns = rows("campaigns.json").map((r) => toCampaignDim(r, ACCOUNT)!);
    const byId = new Map(campaigns.map((c) => [c.id, c]));
    it("maps channel types, statuses and bidding strategies", () => {
        expect(campaigns.map((c) => [c.id, c.type, c.status, c.bidding_strategy])).toEqual([
            ["111", "Search", "Enabled", "TARGET_CPA"],
            ["222", "PMax", "Enabled", "MAXIMIZE_CONVERSION_VALUE"],
            ["333", "Shopping", "Paused", "MAXIMIZE_CLICKS"],
            ["444", "Video", "Enabled", "OTHER"],
            ["555", "Demand Gen", "Enabled", "MAXIMIZE_CONVERSIONS"],
            ["666", "App", "Enabled", "MANUAL_CPC"],
            ["777", "Other", "Enabled", "TARGET_ROAS"],
        ]);
    });
    it("reads targets from whichever bidding scheme is set", () => {
        expect(byId.get("111")).toMatchObject({ target_cpa: 28.5, target_roas: null });
        expect(byId.get("222")).toMatchObject({ target_cpa: null, target_roas: 3.5 });
        expect(byId.get("555")).toMatchObject({ target_cpa: 35 });
        expect(byId.get("777")).toMatchObject({ target_roas: 4 });
    });
    it("maps budgets (daily, shared, custom period) and dates", () => {
        expect(byId.get("111")).toMatchObject({ budget_id: "9001", budget_daily: 420, budget_shared: false, budget_period: "daily", start: "2025-01-15", end: null });
        expect(byId.get("333")).toMatchObject({ budget_id: "9003", budget_daily: 150, budget_shared: true });
        expect(byId.get("444")).toMatchObject({ budget_daily: null, budget_period: "custom", start: "2026-09-01", end: "2026-10-31" });
        expect(byId.get("222")).toMatchObject({ start: "2025-03-01", end: null });
    });
    it("maps ad groups and keywords with Quality Score components", () => {
        expect(rows("ad-groups.json").map(toAdGroupDim)).toEqual([
            { id: "5001", campaign_id: "111", name: "Brand - Core", status: "Enabled" },
            { id: "5002", campaign_id: "111", name: "Brand - Misspellings", status: "Paused" },
        ]);
        const kws = rows("keywords.json").map((r) => toKeywordDim(r)!);
        expect(kws[0]).toEqual({
            id: "5001~7001",
            ad_group_id: "5001",
            campaign_id: "111",
            text: "acme boots",
            match_type: "Exact",
            status: "Enabled",
            qs: 8,
            qs_ctr: "Below",
            qs_relevance: "Above",
            qs_landing: "Average",
            cpc_bid: 1.5,
        });
        expect(kws[1]).toMatchObject({ id: "5002~7001", qs: 6, cpc_bid: 1.2 });
        expect(kws[2]).toMatchObject({ match_type: "Phrase", status: "Paused", qs: null, qs_ctr: null, cpc_bid: null });
    });
    it("maps customer and customer_client rows", () => {
        expect(toCustomerInfo(rows("customer.json")[0]!)).toEqual({ id: "1234567890", name: "Acme Outdoor", currency: "USD", timezone: "America/New_York", isManager: false, testAccount: false });
        const clients = rows("customer-client.json").map((r) => toCustomerClient(r)!);
        expect(clients[0]).toMatchObject({ id: "9876543210", level: 0, isManager: true });
        expect(clients[1]).toMatchObject({ id: "2345678901", level: 1, currency: "EUR", timezone: "Europe/Berlin", status: "ENABLED" });
        expect(clients[5]).toMatchObject({ hidden: true });
    });
});
