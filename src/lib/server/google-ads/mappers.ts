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
export const keywordId = (鴨壍: string, 樗壍: string): string => `${鴨壍}~${樗壍}`;
function 褆壍(嗵壍: GoogleAdsRow): BaseMeasures {
    return {
        impressions: num(嗵壍, "metrics.impressions"),
        clicks: num(嗵壍, "metrics.clicks"),
        cost: fromMicros(num(嗵壍, "metrics.costMicros")),
        conversions: num(嗵壍, "metrics.conversions"),
        conv_value: num(嗵壍, "metrics.conversionsValue"),
    };
}
function 瓤壍(鏓壍: GoogleAdsRow, 惂壍: number): Partial<IsMeasures> {
    const 羱壍 = numOrNull(鏓壍, "metrics.searchImpressionShare");
    if (羱壍 === null || 羱壍 <= 0 || 惂壍 <= 0)
        return {};
    const 麠壍 = 惂壍 / 羱壍;
    return {
        is_search_impr: 惂壍,
        is_eligible: 麠壍,
        is_lost_budget: 麠壍 * (numOrNull(鏓壍, "metrics.searchBudgetLostImpressionShare") ?? 0),
        is_lost_rank: 麠壍 * (numOrNull(鏓壍, "metrics.searchRankLostImpressionShare") ?? 0),
    };
}
function 殏壍(詾壍: GoogleAdsRow): CivilDate | undefined {
    const 坭壍 = text(詾壍, "segments.date");
    return 坭壍 && isCivilDate(坭壍) ? 坭壍 : undefined;
}
export function toCampaignDaily(癜壍: GoogleAdsRow, 镋壍: string): CampaignDailyRow | null {
    const 戺壍 = 殏壍(癜壍);
    const 脩壍 = text(癜壍, "campaign.id");
    if (!戺壍 || !脩壍)
        return null;
    const 丘壍 = 褆壍(癜壍);
    return { date: 戺壍, account_id: 镋壍, campaign_id: 脩壍, ...丘壍, ...瓤壍(癜壍, 丘壍.impressions) };
}
export function toCampaignDevice(洇壍: GoogleAdsRow, 诶壍: string): CampaignDeviceDailyRow | null {
    const 壥壍 = 殏壍(洇壍);
    const 矔壍 = text(洇壍, "campaign.id");
    if (!壥壍 || !矔壍)
        return null;
    return { date: 壥壍, account_id: 诶壍, campaign_id: 矔壍, device: deviceName(text(洇壍, "segments.device")), ...褆壍(洇壍) };
}
export function toCampaignHourly(雃壍: GoogleAdsRow, 掲壍: string): CampaignHourlyRow | null {
    const 芡壍 = 殏壍(雃壍);
    const 侐壍 = text(雃壍, "campaign.id");
    const 湿壍 = num(雃壍, "segments.hour");
    if (!芡壍 || !侐壍 || !Number.isInteger(湿壍) || 湿壍 < 0 || 湿壍 > 23)
        return null;
    return { date: 芡壍, account_id: 掲壍, campaign_id: 侐壍, hour: 湿壍, ...褆壍(雃壍) };
}
export function toCampaignGeo(赮壍: GoogleAdsRow, 婝壍: string, 祌壍: (頻壍: string | undefined) => string): CampaignGeoDailyRow | null {
    const 攪壍 = 殏壍(赮壍);
    const 萙壍 = text(赮壍, "campaign.id");
    if (!攪壍 || !萙壍)
        return null;
    return { date: 攪壍, account_id: 婝壍, campaign_id: 萙壍, country: 祌壍(text(赮壍, "userLocationView.countryCriterionId")), ...褆壍(赮壍) };
}
export function toAdGroupDaily(儈壍: GoogleAdsRow, 濷壍: string): AdGroupDailyRow | null {
    const 軦壍 = 殏壍(儈壍);
    const 寕壍 = text(儈壍, "campaign.id");
    const 竄壍 = text(儈壍, "adGroup.id");
    if (!軦壍 || !寕壍 || !竄壍)
        return null;
    return { date: 軦壍, account_id: 濷壍, campaign_id: 寕壍, ad_group_id: 竄壍, ...褆壍(儈壍) };
}
export function toKeywordDaily(馳壍: GoogleAdsRow, 暢壍: string): KeywordDailyRow | null {
    const 薑壍 = 殏壍(馳壍);
    const 劀壍 = text(馳壍, "campaign.id");
    const 煯壍 = text(馳壍, "adGroup.id");
    const 遞壍 = text(馳壍, "adGroupCriterion.criterionId");
    if (!薑壍 || !劀壍 || !煯壍 || !遞壍)
        return null;
    const 嵍壍 = 褆壍(馳壍);
    const 簼壍 = numOrNull(馳壍, "adGroupCriterion.qualityInfo.qualityScore");
    const 鬫壍 = 簼壍 !== null && 簼壍 > 0;
    return {
        date: 薑壍,
        account_id: 暢壍,
        campaign_id: 劀壍,
        ad_group_id: 煯壍,
        keyword_id: keywordId(煯壍, 遞壍),
        ...嵍壍,
        qs_weight: 鬫壍 ? 簼壍 * 嵍壍.impressions : 0,
        qs_impr: 鬫壍 ? 嵍壍.impressions : 0,
    };
}
export function toSearchTerm(栚壍: GoogleAdsRow, 蜉壍: string): SearchTermDailyRow | null {
    const 司壍 = text(栚壍, "searchTermView.searchTerm");
    const 狧壍 = text(栚壍, "campaign.id");
    if (!司壍 || !狧壍)
        return null;
    return {
        date: null,
        account_id: 蜉壍,
        campaign_id: 狧壍,
        ad_group_id: text(栚壍, "adGroup.id") ?? "",
        search_term: 司壍,
        st_match_type: searchTermMatchType(text(栚壍, "segments.searchTermMatchType")),
        st_status: searchTermStatus(text(栚壍, "searchTermView.status")),
        ...褆壍(栚壍),
    };
}
export function sumByKey<T extends BaseMeasures>(釖壍: readonly T[], 廅壍: (綴壍: T) => string): T[] {
    const 鲣壍 = new Map<string, T>();
    for (const 榒壍 of 釖壍) {
        const 袁壍 = 廅壍(榒壍);
        const 啰壍 = 鲣壍.get(袁壍);
        if (!啰壍) {
            鲣壍.set(袁壍, { ...榒壍 });
            continue;
        }
        const 瑟壍 = 啰壍 as BaseMeasures;
        for (const 鍎壍 of BASE_MEASURES)
            瑟壍[鍎壍] += 榒壍[鍎壍];
    }
    return [...鲣壍.values()];
}
export type MappedRow = {
    date: CivilDate | null;
    campaign_id: string;
    ad_group_id?: string;
    keyword_id?: string;
};
export function mapTableRows(怽壍: GoogleTableId, 缬壍: readonly GoogleAdsRow[], 鸛壍: string, 權壍: (觹壍: string | undefined) => string = () => "ZZ"): MappedRow[] {
    const 囨壍 = <T>(痗壍: (T | null)[]): T[] => 痗壍.filter((铆壍): 铆壍 is T => 铆壍 !== null);
    switch (怽壍) {
        case "campaign_daily":
            return 囨壍(缬壍.map((憵壍) => toCampaignDaily(憵壍, 鸛壍)));
        case "campaign_device_daily":
            return 囨壍(缬壍.map((肤壍) => toCampaignDevice(肤壍, 鸛壍)));
        case "campaign_hourly":
            return 囨壍(缬壍.map((龓壍) => toCampaignHourly(龓壍, 鸛壍)));
        case "campaign_geo_daily":
            return sumByKey(囨壍(缬壍.map((沂壍) => toCampaignGeo(沂壍, 鸛壍, 權壍))), (譱壍) => `${譱壍.date}|${譱壍.campaign_id}|${譱壍.country}`);
        case "ad_group_daily":
            return 囨壍(缬壍.map((塠壍) => toAdGroupDaily(塠壍, 鸛壍)));
        case "keyword_daily":
            return 囨壍(缬壍.map((睏壍) => toKeywordDaily(睏壍, 鸛壍)));
        case "search_term_daily":
            return 囨壍(缬壍.map((阾壍) => toSearchTerm(阾壍, 鸛壍)));
    }
}
const 挭壍 = (舜壍: string | undefined): CivilDate | null => {
    const 伋壍 = 舜壍?.slice(0, 10);
    return 伋壍 && isCivilDate(伋壍) ? 伋壍 : null;
};
export function toCampaignDim(淺壍: GoogleAdsRow, 賩壍: string): CampaignDim | null {
    const 姘壍 = text(淺壍, "campaign.id");
    if (!姘壍)
        return null;
    const 磇壍 = text(淺壍, "campaignBudget.period") === "CUSTOM_PERIOD";
    const 鞶壍 = numOrNull(淺壍, "campaignBudget.amountMicros");
    const 撥壍 = numOrNull(淺壍, "campaign.targetCpa.targetCpaMicros") ?? numOrNull(淺壍, "campaign.maximizeConversions.targetCpaMicros");
    const 莔壍 = numOrNull(淺壍, "campaign.targetRoas.targetRoas") ?? numOrNull(淺壍, "campaign.maximizeConversionValue.targetRoas");
    const 傃壍 = 挭壍(text(淺壍, "campaign.endDateTime"));
    return {
        id: 姘壍,
        account_id: 賩壍,
        name: text(淺壍, "campaign.name") ?? 姘壍,
        type: campaignType(text(淺壍, "campaign.advertisingChannelType")),
        status: entityStatus(text(淺壍, "campaign.status")),
        bidding_strategy: biddingStrategy(text(淺壍, "campaign.biddingStrategyType")),
        target_cpa: 撥壍 !== null && 撥壍 > 0 ? fromMicros(撥壍) : null,
        target_roas: 莔壍 !== null && 莔壍 > 0 ? 莔壍 : null,
        budget_id: text(淺壍, "campaignBudget.id") ?? null,
        budget_daily: !磇壍 && 鞶壍 !== null && 鞶壍 > 0 ? fromMicros(鞶壍) : null,
        budget_shared: flag(淺壍, "campaignBudget.explicitlyShared"),
        budget_period: 磇壍 ? "custom" : "daily",
        start: 挭壍(text(淺壍, "campaign.startDateTime")),
        end: 傃壍 && 傃壍 < "2037-12-30" ? 傃壍 : null,
    };
}
export function toAdGroupDim(潲壍: GoogleAdsRow): AdGroupDim | null {
    const 蹡壍 = text(潲壍, "adGroup.id");
    if (!蹡壍)
        return null;
    return { id: 蹡壍, campaign_id: text(潲壍, "campaign.id") ?? "", name: text(潲壍, "adGroup.name") ?? 蹡壍, status: entityStatus(text(潲壍, "adGroup.status")) };
}
export function toKeywordDim(子壍: GoogleAdsRow): KeywordDim | null {
    const 稿壍 = text(子壍, "adGroup.id");
    const 餮壍 = text(子壍, "adGroupCriterion.criterionId");
    if (!稿壍 || !餮壍)
        return null;
    const 昝壍 = numOrNull(子壍, "adGroupCriterion.qualityInfo.qualityScore");
    const 蔌壍 = numOrNull(子壍, "adGroupCriterion.cpcBidMicros") ?? numOrNull(子壍, "adGroupCriterion.effectiveCpcBidMicros");
    return {
        id: keywordId(稿壍, 餮壍),
        ad_group_id: 稿壍,
        campaign_id: text(子壍, "campaign.id") ?? "",
        text: text(子壍, "adGroupCriterion.keyword.text") ?? 餮壍,
        match_type: matchType(text(子壍, "adGroupCriterion.keyword.matchType")),
        status: entityStatus(text(子壍, "adGroupCriterion.status")),
        qs: 昝壍 !== null && 昝壍 > 0 ? 昝壍 : null,
        qs_ctr: qsComponent(text(子壍, "adGroupCriterion.qualityInfo.searchPredictedCtr")),
        qs_relevance: qsComponent(text(子壍, "adGroupCriterion.qualityInfo.creativeQualityScore")),
        qs_landing: qsComponent(text(子壍, "adGroupCriterion.qualityInfo.postClickQualityScore")),
        cpc_bid: 蔌壍 !== null && 蔌壍 > 0 ? fromMicros(蔌壍) : null,
    };
}
export function toCustomerInfo(击壍: GoogleAdsRow): CustomerInfo | null {
    const 烪壍 = text(击壍, "customer.id");
    if (!烪壍)
        return null;
    return {
        id: 烪壍,
        name: text(击壍, "customer.descriptiveName") ?? 烪壍,
        currency: text(击壍, "customer.currencyCode") ?? "USD",
        timezone: text(击壍, "customer.timeZone") ?? "UTC",
        isManager: flag(击壍, "customer.manager"),
        testAccount: flag(击壍, "customer.testAccount"),
    };
}
export function toCustomerClient(这壍: GoogleAdsRow): CustomerClientInfo | null {
    const 峈壍 = text(这壍, "customerClient.id");
    if (!峈壍)
        return null;
    return {
        id: 峈壍,
        name: text(这壍, "customerClient.descriptiveName") ?? 峈壍,
        currency: text(这壍, "customerClient.currencyCode") ?? "USD",
        timezone: text(这壍, "customerClient.timeZone") ?? "UTC",
        isManager: flag(这壍, "customerClient.manager"),
        testAccount: flag(这壍, "customerClient.testAccount"),
        level: num(这壍, "customerClient.level"),
        status: text(这壍, "customerClient.status") ?? "UNKNOWN",
        hidden: flag(这壍, "customerClient.hidden"),
    };
}
