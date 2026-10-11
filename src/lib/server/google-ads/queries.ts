import "server-only";
import { SIMULATION_TYPES } from "@/lib/domain/contracts/estimates";
import { addDays, addMonths, type DateRange } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import type { GoogleTableId } from "../datasource/types";
import { dateLiteral, gaql, where, type GaqlSpec } from "./gaql";
const 益壍 = ["metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions", "metrics.conversions_value"] as const;
const 閹壍 = ["metrics.search_impression_share", "metrics.search_budget_lost_impression_share", "metrics.search_rank_lost_impression_share"] as const;
export const CUSTOMER_FIELDS = ["customer.id", "customer.descriptive_name", "customer.currency_code", "customer.time_zone", "customer.manager", "customer.test_account"] as const;
export const CUSTOMER_CLIENT_FIELDS = [
    "customer_client.id",
    "customer_client.descriptive_name",
    "customer_client.currency_code",
    "customer_client.time_zone",
    "customer_client.manager",
    "customer_client.level",
    "customer_client.status",
    "customer_client.hidden",
    "customer_client.test_account",
] as const;
export const CAMPAIGN_DIM_FIELDS = [
    "campaign.id",
    "campaign.name",
    "campaign.status",
    "campaign.advertising_channel_type",
    "campaign.bidding_strategy_type",
    "campaign.target_cpa.target_cpa_micros",
    "campaign.maximize_conversions.target_cpa_micros",
    "campaign.target_roas.target_roas",
    "campaign.maximize_conversion_value.target_roas",
    "campaign.start_date_time",
    "campaign.end_date_time",
    "campaign_budget.id",
    "campaign_budget.amount_micros",
    "campaign_budget.explicitly_shared",
    "campaign_budget.period",
] as const;
export const AD_GROUP_DIM_FIELDS = ["ad_group.id", "ad_group.name", "ad_group.status", "campaign.id"] as const;
export const KEYWORD_DIM_FIELDS = [
    "campaign.id",
    "ad_group.id",
    "ad_group_criterion.criterion_id",
    "ad_group_criterion.keyword.text",
    "ad_group_criterion.keyword.match_type",
    "ad_group_criterion.status",
    "ad_group_criterion.quality_info.quality_score",
    "ad_group_criterion.quality_info.creative_quality_score",
    "ad_group_criterion.quality_info.post_click_quality_score",
    "ad_group_criterion.quality_info.search_predicted_ctr",
    "ad_group_criterion.cpc_bid_micros",
    "ad_group_criterion.effective_cpc_bid_micros",
] as const;
export const CHANGE_EVENT_FIELDS = [
    "change_event.resource_name",
    "change_event.change_date_time",
    "change_event.change_resource_type",
    "change_event.change_resource_name",
    "change_event.resource_change_operation",
    "change_event.changed_fields",
    "change_event.old_resource",
    "change_event.new_resource",
    "change_event.client_type",
    "change_event.campaign",
    "change_event.ad_group",
    "change_event.user_email",
] as const;
export interface TableQuery {
    from: string;
    select: readonly string[];
    spanDays: number;
    orderBy?: GaqlSpec["orderBy"];
    limit?: number;
}
export const TABLE_QUERIES: Record<GoogleTableId, TableQuery> = {
    campaign_daily: { from: "campaign", select: ["segments.date", "campaign.id", ...益壍, ...閹壍], spanDays: 366 },
    campaign_device_daily: { from: "campaign", select: ["segments.date", "segments.device", "campaign.id", ...益壍], spanDays: 184 },
    campaign_geo_daily: { from: "user_location_view", select: ["segments.date", "campaign.id", "user_location_view.country_criterion_id", ...益壍], spanDays: 184 },
    campaign_hourly: { from: "campaign", select: ["segments.date", "segments.hour", "campaign.id", ...益壍], spanDays: 31 },
    ad_group_daily: { from: "ad_group", select: ["segments.date", "campaign.id", "ad_group.id", ...益壍], spanDays: 184 },
    keyword_daily: {
        from: "keyword_view",
        select: ["segments.date", "campaign.id", "ad_group.id", "ad_group_criterion.criterion_id", "ad_group_criterion.quality_info.quality_score", ...益壍],
        spanDays: 92,
    },
    search_term_daily: {
        from: "search_term_view",
        select: ["search_term_view.search_term", "search_term_view.status", "segments.search_term_match_type", "campaign.id", "ad_group.id", ...益壍],
        spanDays: 365,
        orderBy: { field: "metrics.cost_micros", direction: "DESC" },
        limit: 5000,
    },
};
export function tableQuery(抨壍: GoogleTableId, 膗壍: DateRange): string {
    const 了壍 = TABLE_QUERIES[抨壍];
    return gaql({ select: 了壍.select, from: 了壍.from, where: [where.between("segments.date", 膗壍.start, 膗壍.end)], orderBy: 了壍.orderBy, limit: 了壍.limit });
}
export const HOURLY_DAYS = 92;
export const SEARCH_TERM_DAYS = 365;
export const CHANGE_EVENT_DAYS = 30;
export const DAILY_MONTHS = 36;
export function coverageFor(浵壍: GoogleTableId, 豤壍: CivilDate): DateRange {
    if (浵壍 === "campaign_hourly")
        return { start: addDays(豤壍, -(HOURLY_DAYS - 1)), end: 豤壍 };
    if (浵壍 === "search_term_daily")
        return { start: addDays(豤壍, -(SEARCH_TERM_DAYS - 1)), end: 豤壍 };
    return { start: addMonths(豤壍, -DAILY_MONTHS), end: 豤壍 };
}
export const customerQuery = (): string => gaql({ select: CUSTOMER_FIELDS, from: "customer", limit: 1 });
export const customerClientsQuery = (): string => gaql({ select: CUSTOMER_CLIENT_FIELDS, from: "customer_client", where: [where.atMost("customer_client.level", 1)] });
export function campaignDimsQuery(奓壍?: readonly string[]): string {
    return gaql({ select: CAMPAIGN_DIM_FIELDS, from: "campaign", where: 奓壍 ? [where.inIds("campaign.id", 奓壍)] : [where.isNot("campaign.status", "REMOVED")] });
}
export function adGroupDimsQuery(硂壍?: readonly string[]): string {
    return gaql({
        select: AD_GROUP_DIM_FIELDS,
        from: "ad_group",
        where: 硂壍 ? [where.inIds("ad_group.id", 硂壍)] : [where.isNot("ad_group.status", "REMOVED"), where.isNot("campaign.status", "REMOVED")],
    });
}
export const KEYWORD_DIMS_LIMIT = 50000;
export function keywordDimsQuery(霱壍?: {
    adGroupIds: readonly string[];
    criterionIds: readonly string[];
}): string {
    return gaql({
        select: KEYWORD_DIM_FIELDS,
        from: "keyword_view",
        where: 霱壍
            ? [where.inIds("ad_group.id", 霱壍.adGroupIds), where.inIds("ad_group_criterion.criterion_id", 霱壍.criterionIds)]
            : [
                where.isNot("ad_group_criterion.status", "REMOVED"),
                where.isNot("ad_group.status", "REMOVED"),
                where.isNot("campaign.status", "REMOVED"),
                where.isBool("ad_group_criterion.negative", false),
            ],
        limit: 霱壍 ? undefined : KEYWORD_DIMS_LIMIT,
    });
}
export const geoConstantsQuery = (搠壍: readonly string[]): string => gaql({ select: ["geo_target_constant.id", "geo_target_constant.country_code", "geo_target_constant.target_type"], from: "geo_target_constant", where: [where.inIds("geo_target_constant.id", 搠壍)] });
export const CAMPAIGN_SIMULATION_FIELDS = [
    "campaign_simulation.campaign_id",
    "campaign_simulation.type",
    "campaign_simulation.modification_method",
    "campaign_simulation.start_date",
    "campaign_simulation.end_date",
    "campaign_simulation.budget_point_list.points",
    "campaign_simulation.target_cpa_point_list.points",
    "campaign_simulation.target_roas_point_list.points",
] as const;
export const campaignSimulationsQuery = (): string => gaql({ select: CAMPAIGN_SIMULATION_FIELDS, from: "campaign_simulation", where: [where.inEnums("campaign_simulation.type", SIMULATION_TYPES)] });
export const RECOMMENDATION_FIELDS = [
    "recommendation.resource_name",
    "recommendation.type",
    "recommendation.campaign",
    "recommendation.campaigns",
    "recommendation.campaign_budget",
    "recommendation.dismissed",
    "recommendation.impact",
    "recommendation.campaign_budget_recommendation",
] as const;
export const recommendationsQuery = (): string => gaql({ select: RECOMMENDATION_FIELDS, from: "recommendation", where: [where.is("recommendation.type", "CAMPAIGN_BUDGET")] });
export function changeEventsQuery(茏壍: CivilDate, 俾壍: CivilDate): string {
    dateLiteral(俾壍);
    return gaql({
        select: CHANGE_EVENT_FIELDS,
        from: "change_event",
        where: [where.onOrAfter("change_event.change_date_time", 茏壍), where.onOrBefore("change_event.change_date_time", addDays(俾壍, 1))],
        orderBy: { field: "change_event.change_date_time", direction: "DESC" },
        limit: 10000,
    });
}
