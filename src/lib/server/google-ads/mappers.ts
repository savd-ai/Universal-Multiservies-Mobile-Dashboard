import "server-only";
import { isCivilDate } from "@/lib/domain/dates";
import { BASE_MEASURES, type AdGroupDailyRow, type AdGroupDim, type BaseMeasures, type CampaignDailyRow, type CampaignDeviceDailyRow, type CampaignDim, type CampaignGeoDailyRow, type CampaignHourlyRow, type IsMeasures, type KeywordDailyRow, type KeywordDim, type SearchTermDailyRow, } from "@/lib/domain/schema/facts";
import type { CivilDate } from "@/lib/domain/types";
import type { GoogleTableId } from "../datasource/types";
import { biddingStrategy, campaignType, deviceName, entityStatus, matchType, qsComponent, searchTermMatchType, searchTermStatus } from "./enums";
import { flag, fromMicros, num, numOrNull, text, type GoogleAdsRow } from "./json";
export interface CustomerInfo {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    isManager: boolean;
    testAccount: boolean;
}
export interface CustomerClientInfo extends CustomerInfo {
    level: number;
    status: string;
    hidden: boolean;
}
export const keywordId = (adGroupId: string, criterionId: string): string => `${adGroupId}~${criterionId}`;
function measures(row: GoogleAdsRow): BaseMeasures {
    return {
        impressions: num(row, "metrics.impressions"),
        clicks: num(row, "metrics.clicks"),
        cost: fromMicros(num(row, "metrics.costMicros")),
        conversions: num(row, "metrics.conversions"),
        conv_value: num(row, "metrics.conversionsValue"),
    };
}
function impressionShare(row: GoogleAdsRow, impressions: number): Partial<IsMeasures> {
    const share = numOrNull(row, "metrics.searchImpressionShare");
    if (share === null || share <= 0 || impressions <= 0)
        return {};
    const eligible = impressions / share;
    return {
        is_search_impr: impressions,
        is_eligible: eligible,
        is_lost_budget: eligible * (numOrNull(row, "metrics.searchBudgetLostImpressionShare") ?? 0),
        is_lost_rank: eligible * (numOrNull(row, "metrics.searchRankLostImpressionShare") ?? 0),
    };
}
function dateOf(row: GoogleAdsRow): CivilDate | undefined {
    const d = text(row, "segments.date");
    return d && isCivilDate(d) ? d : undefined;
}
export function toCampaignDaily(row: GoogleAdsRow, accountId: string): CampaignDailyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    if (!date || !campaignId)
        return null;
    const m = measures(row);
    return { date, account_id: accountId, campaign_id: campaignId, ...m, ...impressionShare(row, m.impressions) };
}
export function toCampaignDevice(row: GoogleAdsRow, accountId: string): CampaignDeviceDailyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    if (!date || !campaignId)
        return null;
    return { date, account_id: accountId, campaign_id: campaignId, device: deviceName(text(row, "segments.device")), ...measures(row) };
}
export function toCampaignHourly(row: GoogleAdsRow, accountId: string): CampaignHourlyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    const hour = num(row, "segments.hour");
    if (!date || !campaignId || !Number.isInteger(hour) || hour < 0 || hour > 23)
        return null;
    return { date, account_id: accountId, campaign_id: campaignId, hour, ...measures(row) };
}
export function toCampaignGeo(row: GoogleAdsRow, accountId: string, countryOf: (criterionId: string | undefined) => string): CampaignGeoDailyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    if (!date || !campaignId)
        return null;
    return { date, account_id: accountId, campaign_id: campaignId, country: countryOf(text(row, "userLocationView.countryCriterionId")), ...measures(row) };
}
export function toAdGroupDaily(row: GoogleAdsRow, accountId: string): AdGroupDailyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    const adGroupId = text(row, "adGroup.id");
    if (!date || !campaignId || !adGroupId)
        return null;
    return { date, account_id: accountId, campaign_id: campaignId, ad_group_id: adGroupId, ...measures(row) };
}
export function toKeywordDaily(row: GoogleAdsRow, accountId: string): KeywordDailyRow | null {
    const date = dateOf(row);
    const campaignId = text(row, "campaign.id");
    const adGroupId = text(row, "adGroup.id");
    const criterionId = text(row, "adGroupCriterion.criterionId");
    if (!date || !campaignId || !adGroupId || !criterionId)
        return null;
    const m = measures(row);
    const qs = numOrNull(row, "adGroupCriterion.qualityInfo.qualityScore");
    const scored = qs !== null && qs > 0;
    return {
        date,
        account_id: accountId,
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        keyword_id: keywordId(adGroupId, criterionId),
        ...m,
        qs_weight: scored ? qs * m.impressions : 0,
        qs_impr: scored ? m.impressions : 0,
    };
}
export function toSearchTerm(row: GoogleAdsRow, accountId: string): SearchTermDailyRow | null {
    const term = text(row, "searchTermView.searchTerm");
    const campaignId = text(row, "campaign.id");
    if (!term || !campaignId)
        return null;
    return {
        date: null,
        account_id: accountId,
        campaign_id: campaignId,
        ad_group_id: text(row, "adGroup.id") ?? "",
        search_term: term,
        st_match_type: searchTermMatchType(text(row, "segments.searchTermMatchType")),
        st_status: searchTermStatus(text(row, "searchTermView.status")),
        ...measures(row),
    };
}
export function sumByKey<T extends BaseMeasures>(rows: readonly T[], keyOf: (row: T) => string): T[] {
    const out = new Map<string, T>();
    for (const r of rows) {
        const k = keyOf(r);
        const cur = out.get(k);
        if (!cur) {
            out.set(k, { ...r });
            continue;
        }
        const acc = cur as BaseMeasures;
        for (const m of BASE_MEASURES)
            acc[m] += r[m];
    }
    return [...out.values()];
}
export type MappedRow = {
    date: CivilDate | null;
    campaign_id: string;
    ad_group_id?: string;
    keyword_id?: string;
};
export function mapTableRows(table: GoogleTableId, rows: readonly GoogleAdsRow[], accountId: string, countryOf: (criterionId: string | undefined) => string = () => "ZZ"): MappedRow[] {
    const keep = <T>(list: (T | null)[]): T[] => list.filter((r): r is T => r !== null);
    switch (table) {
        case "campaign_daily":
            return keep(rows.map((r) => toCampaignDaily(r, accountId)));
        case "campaign_device_daily":
            return keep(rows.map((r) => toCampaignDevice(r, accountId)));
        case "campaign_hourly":
            return keep(rows.map((r) => toCampaignHourly(r, accountId)));
        case "campaign_geo_daily":
            return sumByKey(keep(rows.map((r) => toCampaignGeo(r, accountId, countryOf))), (r) => `${r.date}|${r.campaign_id}|${r.country}`);
        case "ad_group_daily":
            return keep(rows.map((r) => toAdGroupDaily(r, accountId)));
        case "keyword_daily":
            return keep(rows.map((r) => toKeywordDaily(r, accountId)));
        case "search_term_daily":
            return keep(rows.map((r) => toSearchTerm(r, accountId)));
    }
}
const dayOf = (dateTime: string | undefined): CivilDate | null => {
    const d = dateTime?.slice(0, 10);
    return d && isCivilDate(d) ? d : null;
};
export function toCampaignDim(row: GoogleAdsRow, accountId: string): CampaignDim | null {
    const id = text(row, "campaign.id");
    if (!id)
        return null;
    const custom = text(row, "campaignBudget.period") === "CUSTOM_PERIOD";
    const amount = numOrNull(row, "campaignBudget.amountMicros");
    const cpaMicros = numOrNull(row, "campaign.targetCpa.targetCpaMicros") ?? numOrNull(row, "campaign.maximizeConversions.targetCpaMicros");
    const roas = numOrNull(row, "campaign.targetRoas.targetRoas") ?? numOrNull(row, "campaign.maximizeConversionValue.targetRoas");
    const end = dayOf(text(row, "campaign.endDateTime"));
    return {
        id,
        account_id: accountId,
        name: text(row, "campaign.name") ?? id,
        type: campaignType(text(row, "campaign.advertisingChannelType")),
        status: entityStatus(text(row, "campaign.status")),
        bidding_strategy: biddingStrategy(text(row, "campaign.biddingStrategyType")),
        target_cpa: cpaMicros !== null && cpaMicros > 0 ? fromMicros(cpaMicros) : null,
        target_roas: roas !== null && roas > 0 ? roas : null,
        budget_id: text(row, "campaignBudget.id") ?? null,
        budget_daily: !custom && amount !== null && amount > 0 ? fromMicros(amount) : null,
        budget_shared: flag(row, "campaignBudget.explicitlyShared"),
        budget_period: custom ? "custom" : "daily",
        start: dayOf(text(row, "campaign.startDateTime")),
        end: end && end < "2037-12-30" ? end : null,
    };
}
export function toAdGroupDim(row: GoogleAdsRow): AdGroupDim | null {
    const id = text(row, "adGroup.id");
    if (!id)
        return null;
    return { id, campaign_id: text(row, "campaign.id") ?? "", name: text(row, "adGroup.name") ?? id, status: entityStatus(text(row, "adGroup.status")) };
}
export function toKeywordDim(row: GoogleAdsRow): KeywordDim | null {
    const adGroupId = text(row, "adGroup.id");
    const criterionId = text(row, "adGroupCriterion.criterionId");
    if (!adGroupId || !criterionId)
        return null;
    const qs = numOrNull(row, "adGroupCriterion.qualityInfo.qualityScore");
    const bid = numOrNull(row, "adGroupCriterion.cpcBidMicros") ?? numOrNull(row, "adGroupCriterion.effectiveCpcBidMicros");
    return {
        id: keywordId(adGroupId, criterionId),
        ad_group_id: adGroupId,
        campaign_id: text(row, "campaign.id") ?? "",
        text: text(row, "adGroupCriterion.keyword.text") ?? criterionId,
        match_type: matchType(text(row, "adGroupCriterion.keyword.matchType")),
        status: entityStatus(text(row, "adGroupCriterion.status")),
        qs: qs !== null && qs > 0 ? qs : null,
        qs_ctr: qsComponent(text(row, "adGroupCriterion.qualityInfo.searchPredictedCtr")),
        qs_relevance: qsComponent(text(row, "adGroupCriterion.qualityInfo.creativeQualityScore")),
        qs_landing: qsComponent(text(row, "adGroupCriterion.qualityInfo.postClickQualityScore")),
        cpc_bid: bid !== null && bid > 0 ? fromMicros(bid) : null,
    };
}
export function toCustomerInfo(row: GoogleAdsRow): CustomerInfo | null {
    const id = text(row, "customer.id");
    if (!id)
        return null;
    return {
        id,
        name: text(row, "customer.descriptiveName") ?? id,
        currency: text(row, "customer.currencyCode") ?? "USD",
        timezone: text(row, "customer.timeZone") ?? "UTC",
        isManager: flag(row, "customer.manager"),
        testAccount: flag(row, "customer.testAccount"),
    };
}
export function toCustomerClient(row: GoogleAdsRow): CustomerClientInfo | null {
    const id = text(row, "customerClient.id");
    if (!id)
        return null;
    return {
        id,
        name: text(row, "customerClient.descriptiveName") ?? id,
        currency: text(row, "customerClient.currencyCode") ?? "USD",
        timezone: text(row, "customerClient.timeZone") ?? "UTC",
        isManager: flag(row, "customerClient.manager"),
        testAccount: flag(row, "customerClient.testAccount"),
        level: num(row, "customerClient.level"),
        status: text(row, "customerClient.status") ?? "UNKNOWN",
        hidden: flag(row, "customerClient.hidden"),
    };
}
