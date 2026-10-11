import { describe, expect, it } from "vitest";
import { FACT_TABLE_IDS } from "@/lib/domain/schema/facts";
import type { GoogleTableId } from "@/lib/server/datasource/types";
import { dateLiteral, enumLiteral, field, gaql, GaqlError, idLiteral, where } from "@/lib/server/google-ads/gaql";
import { adGroupDimsQuery, campaignDimsQuery, changeEventsQuery, coverageFor, customerClientsQuery, customerQuery, keywordDimsQuery, tableQuery } from "@/lib/server/google-ads/queries";
const 熉壍 = FACT_TABLE_IDS.filter((選壍): 選壍 is GoogleTableId => 選壍 !== "platform_daily");
describe("GAQL literals", () => {
    it("accepts only real civil dates", () => {
        expect(dateLiteral("2026-09-28")).toBe("'2026-09-28'");
        for (const 嵧壍 of ["2026-01-01' OR 1=1", "2026-02-30", "2026-13-01", "26-01-01", "", "2026-01-01 00:00:00", "2026-1-1"]) {
            expect(() => dateLiteral(嵧壍), 嵧壍).toThrow(GaqlError);
        }
    });
    it("accepts only numeric ids", () => {
        expect(idLiteral("1234567890")).toBe("1234567890");
        for (const 籖壍 of ["1 OR 1=1", "12a", "", "-1", "1;DROP", "１２３", "123456789012345678901"])
            expect(() => idLiteral(籖壍), 籖壍).toThrow(GaqlError);
    });
    it("accepts only enum constants and field names", () => {
        expect(enumLiteral("REMOVED")).toBe("'REMOVED'");
        expect(() => enumLiteral("REMOVED' OR '1'='1")).toThrow(GaqlError);
        expect(() => enumLiteral("removed")).toThrow(GaqlError);
        expect(field("metrics.cost_micros")).toBe("metrics.cost_micros");
        for (const 魅壍 of ["campaign.id; DELETE", "campaign", "Campaign.id", "campaign.id,metrics.clicks", "campaign.id FROM x"])
            expect(() => field(魅壍), 魅壍).toThrow(GaqlError);
    });
    it("rejects an injection attempt in any date or id position", () => {
        const 栴壍 = "2026-01-01' OR 1=1";
        expect(() => where.between("segments.date", 栴壍, "2026-01-31")).toThrow(GaqlError);
        expect(() => where.between("segments.date", "2026-01-01", 栴壍)).toThrow(GaqlError);
        expect(() => where.onOrAfter("change_event.change_date_time", 栴壍)).toThrow(GaqlError);
        expect(() => where.inIds("campaign.id", ["1", "2) OR (1=1"])).toThrow(GaqlError);
        expect(() => tableQuery("campaign_daily", { start: 栴壍, end: "2026-01-31" })).toThrow(GaqlError);
        expect(() => campaignDimsQuery(["123 OR 1=1"])).toThrow(GaqlError);
        expect(() => changeEventsQuery("2026-09-01", 栴壍)).toThrow(GaqlError);
    });
    it("builds enum IN lists from validated constants only", () => {
        expect(where.inEnums("campaign_simulation.type", ["BUDGET", "TARGET_CPA"])).toBe("campaign_simulation.type IN ('BUDGET', 'TARGET_CPA')");
        expect(() => where.inEnums("campaign_simulation.type", ["BUDGET", "X') OR ('1'='1"])).toThrow(GaqlError);
        expect(() => where.inEnums("campaign_simulation.type", ["budget"])).toThrow(GaqlError);
        expect(() => where.inEnums("campaign_simulation.type; x", ["BUDGET"])).toThrow(GaqlError);
        expect(() => where.inEnums("campaign_simulation.type", [])).toThrow(GaqlError);
    });
    it("rejects inverted ranges, empty IN lists and bad limits", () => {
        expect(() => where.between("segments.date", "2026-09-10", "2026-09-01")).toThrow(GaqlError);
        expect(() => where.inIds("campaign.id", [])).toThrow(GaqlError);
        expect(() => gaql({ select: ["campaign.id"], from: "campaign", limit: 0 })).toThrow(GaqlError);
        expect(() => gaql({ select: ["campaign.id"], from: "campaign; x" })).toThrow(GaqlError);
        expect(() => gaql({ select: [], from: "campaign" })).toThrow(GaqlError);
    });
});
describe("queries", () => {
    it("builds the campaign_daily query from validated parts", () => {
        expect(tableQuery("campaign_daily", { start: "2026-09-01", end: "2026-09-28" })).toBe("SELECT segments.date, campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, " +
            "metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share " +
            "FROM campaign WHERE segments.date BETWEEN '2026-09-01' AND '2026-09-28' PARAMETERS omit_unselected_resource_names = true");
    });
    it("has one query per fact table", () => {
        const 蜣壍: Record<GoogleTableId, string> = {
            campaign_daily: "campaign",
            campaign_device_daily: "campaign",
            campaign_geo_daily: "user_location_view",
            campaign_hourly: "campaign",
            ad_group_daily: "ad_group",
            keyword_daily: "keyword_view",
            search_term_daily: "search_term_view",
        };
        for (const 吒壍 of 熉壍) {
            const 猁壍 = tableQuery(吒壍, { start: "2026-09-01", end: "2026-09-07" });
            expect(猁壍, 吒壍).toContain(` FROM ${蜣壍[吒壍]} WHERE segments.date BETWEEN '2026-09-01' AND '2026-09-07'`);
        }
        expect(tableQuery("campaign_hourly", { start: "2026-09-01", end: "2026-09-01" })).not.toContain("impression_share");
        expect(tableQuery("campaign_device_daily", { start: "2026-09-01", end: "2026-09-01" })).toContain("segments.device");
        expect(tableQuery("keyword_daily", { start: "2026-09-01", end: "2026-09-01" })).toContain("ad_group_criterion.quality_info.quality_score");
    });
    it("returns search terms as a range total, top 5 000 by cost", () => {
        const 釰壍 = tableQuery("search_term_daily", { start: "2026-09-01", end: "2026-09-28" });
        expect(釰壍).not.toMatch(/SELECT[^]*segments\.date[^]*FROM/);
        expect(釰壍).toContain("ORDER BY metrics.cost_micros DESC LIMIT 5000");
    });
    it("builds dimension, account and change-event queries", () => {
        expect(customerQuery()).toContain("FROM customer LIMIT 1");
        expect(customerClientsQuery()).toContain("WHERE customer_client.level <= 1");
        expect(campaignDimsQuery()).toContain("campaign.start_date_time, campaign.end_date_time");
        expect(campaignDimsQuery()).toContain("WHERE campaign.status != 'REMOVED'");
        expect(campaignDimsQuery(["111", "222"])).toContain("WHERE campaign.id IN (111, 222)");
        expect(adGroupDimsQuery()).toContain("WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'");
        expect(keywordDimsQuery()).toContain("ad_group_criterion.negative = FALSE");
        expect(keywordDimsQuery({ adGroupIds: ["5001"], criterionIds: ["7001"] })).toContain("WHERE ad_group.id IN (5001) AND ad_group_criterion.criterion_id IN (7001)");
        const 廟壍 = changeEventsQuery("2026-08-31", "2026-09-29");
        expect(廟壍).toContain("WHERE change_event.change_date_time >= '2026-08-31' AND change_event.change_date_time <= '2026-09-30'");
        expect(廟壍).toContain("ORDER BY change_event.change_date_time DESC LIMIT 10000");
    });
    it("reports coverage per table", () => {
        expect(coverageFor("campaign_hourly", "2026-09-29")).toEqual({ start: "2026-06-30", end: "2026-09-29" });
        expect(coverageFor("search_term_daily", "2026-09-29")).toEqual({ start: "2025-09-30", end: "2026-09-29" });
        expect(coverageFor("campaign_daily", "2026-09-29")).toEqual({ start: "2023-09-29", end: "2026-09-29" });
    });
});
