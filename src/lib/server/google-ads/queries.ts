import "server-only";
import { SIMULATION_TYPES } from "@/lib/domain/contracts/estimates";
import { addDays, addMonths, type DateRange } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import type { GoogleTableId } from "../datasource/types";
import { dateLiteral, gaql, where, type GaqlSpec } from "./gaql";

// One GAQL query per fact table and per dimension. Every field/resource below was checked against the v25 field
// reference (developers.google.com/google-ads/api/fields/v25/…); dates and ids only enter through gaql.ts.

const BASE_METRICS = ["metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions", "metrics.conversions_value"] as const;
const IS_METRICS = ["metrics.search_impression_share", "metrics.search_budget_lost_impression_share", "metrics.search_rank_lost_impression_share"] as const;

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

// v23+ renamed campaign.start_date / end_date to start_date_time / end_date_time ("yyyy-MM-dd HH:mm:ss").
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
  /** longest date span fetched in one request (keeps single responses bounded) */
  spanDays: number;
  orderBy?: GaqlSpec["orderBy"];
  limit?: number;
}

// Fact tables. No status filter: paused and removed campaigns keep their history so totals match Google Ads.
export const TABLE_QUERIES: Record<GoogleTableId, TableQuery> = {
  campaign_daily: { from: "campaign", select: ["segments.date", "campaign.id", ...BASE_METRICS, ...IS_METRICS], spanDays: 366 },
  campaign_device_daily: { from: "campaign", select: ["segments.date", "segments.device", "campaign.id", ...BASE_METRICS], spanDays: 184 },
  // campaign is a *segmenting* resource of user_location_view (rows split per campaign × country × targeted flag).
  campaign_geo_daily: { from: "user_location_view", select: ["segments.date", "campaign.id", "user_location_view.country_criterion_id", ...BASE_METRICS], spanDays: 184 },
  // Hourly keeps base metrics only (impression share is not used by hour in the dashboard).
  campaign_hourly: { from: "campaign", select: ["segments.date", "segments.hour", "campaign.id", ...BASE_METRICS], spanDays: 31 },
  ad_group_daily: { from: "ad_group", select: ["segments.date", "campaign.id", "ad_group.id", ...BASE_METRICS], spanDays: 184 },
  keyword_daily: {
    from: "keyword_view",
    select: ["segments.date", "campaign.id", "ad_group.id", "ad_group_criterion.criterion_id", "ad_group_criterion.quality_info.quality_score", ...BASE_METRICS],
    spanDays: 92,
  },
  // Range grain: one row per term × ad group × match type for the whole period (segments.date only filters).
  search_term_daily: {
    from: "search_term_view",
    select: ["search_term_view.search_term", "search_term_view.status", "segments.search_term_match_type", "campaign.id", "ad_group.id", ...BASE_METRICS],
    spanDays: 365,
    orderBy: { field: "metrics.cost_micros", direction: "DESC" },
    limit: 5_000,
  },
};

export function tableQuery(table: GoogleTableId, range: DateRange): string {
  const q = TABLE_QUERIES[table];
  return gaql({ select: q.select, from: q.from, where: [where.between("segments.date", range.start, range.end)], orderBy: q.orderBy, limit: q.limit });
}

// ── Coverage ─────────────────────────────────────────────────────────────────────────────────────────────

export const HOURLY_DAYS = 92;
export const SEARCH_TERM_DAYS = 365;
/** change_event only serves the last 30 days */
export const CHANGE_EVENT_DAYS = 30;
/** Since June 2026 granular date segments are limited to a 37-month lookback; stay inside it. */
export const DAILY_MONTHS = 36;

export function coverageFor(table: GoogleTableId, today: CivilDate): DateRange {
  if (table === "campaign_hourly") return { start: addDays(today, -(HOURLY_DAYS - 1)), end: today };
  if (table === "search_term_daily") return { start: addDays(today, -(SEARCH_TERM_DAYS - 1)), end: today };
  return { start: addMonths(today, -DAILY_MONTHS), end: today };
}

// ── Dimensions, accounts, lookups ────────────────────────────────────────────────────────────────────────

export const customerQuery = (): string => gaql({ select: CUSTOMER_FIELDS, from: "customer", limit: 1 });

/** The manager itself (level 0) plus its direct client accounts (level 1). */
export const customerClientsQuery = (): string => gaql({ select: CUSTOMER_CLIENT_FIELDS, from: "customer_client", where: [where.atMost("customer_client.level", 1)] });

export function campaignDimsQuery(ids?: readonly string[]): string {
  return gaql({ select: CAMPAIGN_DIM_FIELDS, from: "campaign", where: ids ? [where.inIds("campaign.id", ids)] : [where.isNot("campaign.status", "REMOVED")] });
}

export function adGroupDimsQuery(ids?: readonly string[]): string {
  return gaql({
    select: AD_GROUP_DIM_FIELDS,
    from: "ad_group",
    where: ids ? [where.inIds("ad_group.id", ids)] : [where.isNot("ad_group.status", "REMOVED"), where.isNot("campaign.status", "REMOVED")],
  });
}

export const KEYWORD_DIMS_LIMIT = 50_000;

export function keywordDimsQuery(filter?: { adGroupIds: readonly string[]; criterionIds: readonly string[] }): string {
  return gaql({
    select: KEYWORD_DIM_FIELDS,
    from: "keyword_view",
    where: filter
      ? [where.inIds("ad_group.id", filter.adGroupIds), where.inIds("ad_group_criterion.criterion_id", filter.criterionIds)]
      : [
          where.isNot("ad_group_criterion.status", "REMOVED"),
          where.isNot("ad_group.status", "REMOVED"),
          where.isNot("campaign.status", "REMOVED"),
          where.isBool("ad_group_criterion.negative", false),
        ],
    limit: filter ? undefined : KEYWORD_DIMS_LIMIT,
  });
}

export const geoConstantsQuery = (ids: readonly string[]): string =>
  gaql({ select: ["geo_target_constant.id", "geo_target_constant.country_code", "geo_target_constant.target_type"], from: "geo_target_constant", where: [where.inIds("geo_target_constant.id", ids)] });

// ── Google's estimates ───────────────────────────────────────────────────────────────────────────────────
// Field names checked against the v25 protos (resources/campaign_simulation, common/simulation,
// resources/recommendation). The point lists are a oneof: each row carries the list matching its type.

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

/** What a past window would have delivered at other budgets / targets (only the types the dashboard reads). */
export const campaignSimulationsQuery = (): string =>
  gaql({ select: CAMPAIGN_SIMULATION_FIELDS, from: "campaign_simulation", where: [where.inEnums("campaign_simulation.type", SIMULATION_TYPES)] });

// CAMPAIGN_BUDGET recommendations name their campaigns in `recommendation.campaigns` (`recommendation.campaign` is
// left unset for this type) and the budget in `recommendation.campaign_budget`. Reading them is all we do: applying or
// dismissing a recommendation is a write and stays in Google Ads.
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

/**
 * change_event requires a change_date_time filter inside the last 30 days and a LIMIT ≤ 10 000. The upper bound is
 * the day *after* `end` (date literals mean midnight), as in Google's own examples.
 */
export function changeEventsQuery(start: CivilDate, end: CivilDate): string {
  dateLiteral(end); // validate before date math
  return gaql({
    select: CHANGE_EVENT_FIELDS,
    from: "change_event",
    where: [where.onOrAfter("change_event.change_date_time", start), where.onOrBefore("change_event.change_date_time", addDays(end, 1))],
    orderBy: { field: "change_event.change_date_time", direction: "DESC" },
    limit: 10_000,
  });
}
