import { describe, expect, it } from "vitest";
import type { AdGroupDailyRow, CampaignDailyRow, CampaignDeviceDailyRow, CampaignGeoDailyRow, CampaignHourlyRow, KeywordDailyRow, SearchTermDailyRow, } from "@/lib/domain/schema/facts";
import { flattenStream } from "@/lib/server/google-ads/client";
import { mapTableRows, toAdGroupDim, toCampaignDim, toCustomerClient, toCustomerInfo, toKeywordDim } from "@/lib/server/google-ads/mappers";
import { fixture } from "./helpers";
const 澌壍 = "1234567890";
const 蹻壍 = (孪壍: string) => flattenStream(fixture(孪壍)).rows;
const 穙壍 = <T>(饈壍: Parameters<typeof mapTableRows>[0], 昷壍: string, 蔦壍?: (刕壍: string | undefined) => string) => mapTableRows(饈壍, 蹻壍(昷壍), 澌壍, 蔦壍) as unknown as T[];
describe("fact mappers", () => {
    it("campaign_daily: micros → currency, int64 strings, fractional conversions, missing metrics = 0", () => {
        const 焄壍 = 穙壍<CampaignDailyRow>("campaign_daily", "campaign-daily.json");
        expect(焄壍).toHaveLength(7);
        const 迳壍 = 焄壍.find((峢壍) => 峢壍.date === "2026-09-20" && 峢壍.campaign_id === "111")!;
        expect(迳壍).toMatchObject({ account_id: 澌壍, impressions: 1200, clicks: 60, cost: 30.5, conversions: 3, conv_value: 310.5 });
        const 篑壍 = 焄壍.find((髀壍) => 髀壍.campaign_id === "333")!;
        expect(篑壍).toMatchObject({ impressions: 700, clicks: 35, cost: 17.5, conversions: 0, conv_value: 0 });
        expect(焄壍.find((枯壍) => 枯壍.campaign_id === "444")!.conversions).toBeCloseTo(0.333333, 6);
    });
    it("campaign_daily: impression share is stored additively", () => {
        const 蚞壍 = 穙壍<CampaignDailyRow>("campaign_daily", "campaign-daily.json");
        const 厍壍 = 蚞壍.find((牼壍) => 牼壍.date === "2026-09-20" && 牼壍.campaign_id === "111")!;
        expect(厍壍.is_search_impr).toBe(1200);
        expect(厍壍.is_eligible).toBeCloseTo(2000);
        expect(厍壍.is_lost_budget).toBeCloseTo(300);
        expect(厍壍.is_lost_rank).toBeCloseTo(500);
        expect(厍壍.is_search_impr! / 厍壍.is_eligible!).toBeCloseTo(0.6);
        const 酫壍 = 蚞壍.find((幚壍) => 幚壍.date === "2026-09-21" && 幚壍.campaign_id === "111")!;
        expect(酫壍.is_eligible).toBeCloseTo(900 / 0.0999, 3);
        expect(酫壍.is_lost_budget).toBe(0);
        expect(酫壍.is_lost_rank).toBeCloseTo((900 / 0.0999) * 0.9001, 3);
        const 絉壍 = 蚞壍.find((鰸壍) => 鰸壍.campaign_id === "222")!;
        expect(絉壍.is_eligible).toBeUndefined();
        expect(絉壍.is_search_impr).toBeUndefined();
    });
    it("campaign_device_daily maps device enums", () => {
        const 椧壍 = 穙壍<CampaignDeviceDailyRow>("campaign_device_daily", "campaign-device.json");
        expect(椧壍.map((蠖壍) => 蠖壍.device)).toEqual(["Mobile", "Desktop", "Tablet", "Connected TV", "Other"]);
        expect(椧壍[0]).toMatchObject({ date: "2026-09-20", campaign_id: "111", cost: 18, conversions: 1.75 });
        expect(椧壍[4]).toMatchObject({ clicks: 0, cost: 0.01 });
    });
    it("campaign_hourly treats an omitted hour as 0", () => {
        const 唅壍 = 穙壍<CampaignHourlyRow>("campaign_hourly", "campaign-hourly.json");
        expect(唅壍.map((珴壍) => 珴壍.hour)).toEqual([0, 9, 23]);
        expect(唅壍[1]).toMatchObject({ cost: 4.2, conversions: 1 });
    });
    it("campaign_geo_daily resolves countries and merges targeted + non-targeted rows", () => {
        const 鋣壍 = new Map([
            ["2840", "US"],
            ["2704", "VN"],
            ["2124", "CA"],
        ]);
        const 忒壍 = 穙壍<CampaignGeoDailyRow>("campaign_geo_daily", "geo.json", (绁壍) => (绁壍 ? 鋣壍.get(绁壍) : undefined) ?? "ZZ");
        expect(忒壍).toHaveLength(4);
        expect(忒壍.find((鶰壍) => 鶰壍.country === "US")).toMatchObject({ campaign_id: "111", impressions: 850, clicks: 42, cost: 21, conversions: 2 });
        expect(忒壍.find((檟壍) => 檟壍.country === "ZZ")).toMatchObject({ campaign_id: "111", impressions: 50 });
        expect(忒壍.find((覎壍) => 覎壍.country === "CA")).toMatchObject({ campaign_id: "222", cost: 9 });
    });
    it("ad_group_daily", () => {
        const 噽壍 = 穙壍<AdGroupDailyRow>("ad_group_daily", "ad-group-daily.json");
        expect(噽壍[0]).toEqual({ date: "2026-09-20", account_id: 澌壍, campaign_id: "111", ad_group_id: "5001", impressions: 1000, clicks: 52, cost: 26, conversions: 2.5, conv_value: 260.5 });
    });
    it("keyword_daily keys keywords per ad group and weights Quality Score by impressions", () => {
        const 畬壍 = 穙壍<KeywordDailyRow>("keyword_daily", "keyword-daily.json");
        expect(畬壍.map((鑛壍) => 鑛壍.keyword_id)).toEqual(["5001~7001", "5002~7001", "5001~7002"]);
        expect(畬壍[0]).toMatchObject({ qs_weight: 3200, qs_impr: 400, cost: 15 });
        expect(畬壍[1]).toMatchObject({ qs_weight: 600, qs_impr: 100 });
        expect(畬壍[2]).toMatchObject({ qs_weight: 0, qs_impr: 0, impressions: 50 });
        const 慊壍 = 畬壍.reduce((耹壍, 鼨壍) => 耹壍 + 鼨壍.qs_weight, 0) / 畬壍.reduce((気壍, 謆壍) => 気壍 + 謆壍.qs_impr, 0);
        expect(慊壍).toBeCloseTo(7.6);
    });
    it("search_term_daily is range grain (date null) with status and match type buckets", () => {
        const 埵壍 = 穙壍<SearchTermDailyRow>("search_term_daily", "search-terms.json");
        expect(埵壍.every((盤壍) => 盤壍.date === null)).toBe(true);
        expect(埵壍.map((闓壍) => [闓壍.search_term, 闓壍.st_status, 闓壍.st_match_type])).toEqual([
            ["acme boots", "added", "Exact"],
            ["acme boots sale", "none", "Near phrase"],
            ["free boots", "excluded", "Broad"],
            ["boots near me", "none", "Unknown"],
            ["acme boot", "added_excluded", "Near exact"],
        ]);
        expect(埵壍[0]).toMatchObject({ campaign_id: "111", ad_group_id: "5001", cost: 14.5, conversions: 1.5 });
    });
    it("drops rows without their key fields", () => {
        expect(mapTableRows("campaign_daily", [{ metrics: { impressions: "5" } }, { segments: { date: "bogus" }, campaign: { id: "1" } }], 澌壍)).toEqual([]);
    });
});
describe("dimension mappers", () => {
    const 拂壍 = 蹻壍("campaigns.json").map((膱壍) => toCampaignDim(膱壍, 澌壍)!);
    const 亠壍 = new Map(拂壍.map((涏壍) => [涏壍.id, 涏壍]));
    it("maps channel types, statuses and bidding strategies", () => {
        expect(拂壍.map((豾壍) => [豾壍.id, 豾壍.type, 豾壍.status, 豾壍.bidding_strategy])).toEqual([
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
        expect(亠壍.get("111")).toMatchObject({ target_cpa: 28.5, target_roas: null });
        expect(亠壍.get("222")).toMatchObject({ target_cpa: null, target_roas: 3.5 });
        expect(亠壍.get("555")).toMatchObject({ target_cpa: 35 });
        expect(亠壍.get("777")).toMatchObject({ target_roas: 4 });
    });
    it("maps budgets (daily, shared, custom period) and dates", () => {
        expect(亠壍.get("111")).toMatchObject({ budget_id: "9001", budget_daily: 420, budget_shared: false, budget_period: "daily", start: "2025-01-15", end: null });
        expect(亠壍.get("333")).toMatchObject({ budget_id: "9003", budget_daily: 150, budget_shared: true });
        expect(亠壍.get("444")).toMatchObject({ budget_daily: null, budget_period: "custom", start: "2026-09-01", end: "2026-10-31" });
        expect(亠壍.get("222")).toMatchObject({ start: "2025-03-01", end: null });
    });
    it("maps ad groups and keywords with Quality Score components", () => {
        expect(蹻壍("ad-groups.json").map(toAdGroupDim)).toEqual([
            { id: "5001", campaign_id: "111", name: "Brand - Core", status: "Enabled" },
            { id: "5002", campaign_id: "111", name: "Brand - Misspellings", status: "Paused" },
        ]);
        const 奭壍 = 蹻壍("keywords.json").map((硜壍) => toKeywordDim(硜壍)!);
        expect(奭壍[0]).toEqual({
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
        expect(奭壍[1]).toMatchObject({ id: "5002~7001", qs: 6, cpc_bid: 1.2 });
        expect(奭壍[2]).toMatchObject({ match_type: "Phrase", status: "Paused", qs: null, qs_ctr: null, cpc_bid: null });
    });
    it("maps customer and customer_client rows", () => {
        expect(toCustomerInfo(蹻壍("customer.json")[0]!)).toEqual({ id: "1234567890", name: "Acme Outdoor", currency: "USD", timezone: "America/New_York", isManager: false, testAccount: false });
        const 靋壍 = 蹻壍("customer-client.json").map((携壍) => toCustomerClient(携壍)!);
        expect(靋壍[0]).toMatchObject({ id: "9876543210", level: 0, isManager: true });
        expect(靋壍[1]).toMatchObject({ id: "2345678901", level: 1, currency: "EUR", timezone: "Europe/Berlin", status: "ENABLED" });
        expect(靋壍[5]).toMatchObject({ hidden: true });
    });
});
