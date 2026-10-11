import type { CampaignStatus, CampaignType, CivilDate, Device, MatchType } from "../types";
export const BASE_MEASURES = ["impressions", "clicks", "cost", "conversions", "conv_value"] as const;
export type BaseMeasure = (typeof BASE_MEASURES)[number];
export const IS_MEASURES = ["is_search_impr", "is_eligible", "is_lost_budget", "is_lost_rank"] as const;
export const QS_MEASURES = ["qs_weight", "qs_impr"] as const;
export const PLATFORM_EXTRAS = ["store_revenue", "sessions", "orders"] as const;
export type MeasureKey = BaseMeasure | (typeof IS_MEASURES)[number] | (typeof QS_MEASURES)[number] | (typeof PLATFORM_EXTRAS)[number];
export interface BaseMeasures {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conv_value: number;
}
export interface IsMeasures {
    is_search_impr: number;
    is_eligible: number;
    is_lost_budget: number;
    is_lost_rank: number;
}
export interface CampaignDailyRow extends BaseMeasures, Partial<IsMeasures> {
    date: CivilDate;
    account_id: string;
    campaign_id: string;
}
export interface CampaignDeviceDailyRow extends BaseMeasures {
    date: CivilDate;
    account_id: string;
    campaign_id: string;
    device: Device;
}
export interface CampaignGeoDailyRow extends BaseMeasures {
    date: CivilDate;
    account_id: string;
    campaign_id: string;
    country: string;
}
export interface CampaignHourlyRow extends BaseMeasures {
    date: CivilDate;
    account_id: string;
    campaign_id: string;
    hour: number;
}
export interface AdGroupDailyRow extends BaseMeasures {
    date: CivilDate;
    account_id: string;
    campaign_id: string;
    ad_group_id: string;
}
export interface KeywordDailyRow extends BaseMeasures {
    date: CivilDate | null;
    account_id: string;
    campaign_id: string;
    ad_group_id: string;
    keyword_id: string;
    qs_weight: number;
    qs_impr: number;
}
export type SearchTermMatchType = "Exact" | "Phrase" | "Broad" | "Near exact" | "Near phrase" | "Unknown";
export type SearchTermStatus = "added" | "excluded" | "added_excluded" | "none";
export interface SearchTermDailyRow extends BaseMeasures {
    date: CivilDate | null;
    account_id: string;
    campaign_id: string;
    ad_group_id: string;
    search_term: string;
    keyword_id?: string;
    st_match_type: SearchTermMatchType;
    st_status: SearchTermStatus;
}
export interface PlatformDailyRow extends BaseMeasures {
    date: CivilDate;
    account_id: string;
    platform: string;
    platform_campaign?: string;
    currency: string;
    store_revenue?: number;
    sessions?: number;
    orders?: number;
}
export type FactRow = CampaignDailyRow | CampaignDeviceDailyRow | CampaignGeoDailyRow | CampaignHourlyRow | AdGroupDailyRow | KeywordDailyRow | SearchTermDailyRow | PlatformDailyRow;
export const FACT_TABLE_IDS = [
    "campaign_daily",
    "campaign_device_daily",
    "campaign_geo_daily",
    "ad_group_daily",
    "campaign_hourly",
    "keyword_daily",
    "search_term_daily",
    "platform_daily",
] as const;
export type FactTableId = (typeof FACT_TABLE_IDS)[number];
export interface FactTableRowMap {
    campaign_daily: CampaignDailyRow;
    campaign_device_daily: CampaignDeviceDailyRow;
    campaign_geo_daily: CampaignGeoDailyRow;
    campaign_hourly: CampaignHourlyRow;
    ad_group_daily: AdGroupDailyRow;
    keyword_daily: KeywordDailyRow;
    search_term_daily: SearchTermDailyRow;
    platform_daily: PlatformDailyRow;
}
export interface FactTableDef {
    id: FactTableId;
    label: string;
    fields: readonly string[];
    measures: readonly MeasureKey[];
    rank: number;
    sources: readonly ("google_ads" | "platform")[];
}
export const FACT_TABLES: Record<FactTableId, FactTableDef> = {
    campaign_daily: {
        id: "campaign_daily",
        label: "Campaign · daily",
        fields: ["date", "account_id", "campaign_id"],
        measures: [...BASE_MEASURES, ...IS_MEASURES],
        rank: 1,
        sources: ["google_ads"],
    },
    campaign_device_daily: {
        id: "campaign_device_daily",
        label: "Campaign × device · daily",
        fields: ["date", "account_id", "campaign_id", "device"],
        measures: [...BASE_MEASURES],
        rank: 2,
        sources: ["google_ads"],
    },
    campaign_geo_daily: {
        id: "campaign_geo_daily",
        label: "Campaign × country · daily",
        fields: ["date", "account_id", "campaign_id", "country"],
        measures: [...BASE_MEASURES],
        rank: 3,
        sources: ["google_ads"],
    },
    ad_group_daily: {
        id: "ad_group_daily",
        label: "Ad group · daily",
        fields: ["date", "account_id", "campaign_id", "ad_group_id"],
        measures: [...BASE_MEASURES],
        rank: 4,
        sources: ["google_ads"],
    },
    campaign_hourly: {
        id: "campaign_hourly",
        label: "Campaign × hour",
        fields: ["date", "account_id", "campaign_id", "hour"],
        measures: [...BASE_MEASURES],
        rank: 5,
        sources: ["google_ads"],
    },
    keyword_daily: {
        id: "keyword_daily",
        label: "Keyword · daily",
        fields: ["date", "account_id", "campaign_id", "ad_group_id", "keyword_id"],
        measures: [...BASE_MEASURES, ...QS_MEASURES],
        rank: 6,
        sources: ["google_ads"],
    },
    search_term_daily: {
        id: "search_term_daily",
        label: "Search term · daily",
        fields: ["date", "account_id", "campaign_id", "ad_group_id", "search_term", "keyword_id", "st_match_type", "st_status"],
        measures: [...BASE_MEASURES],
        rank: 7,
        sources: ["google_ads"],
    },
    platform_daily: {
        id: "platform_daily",
        label: "Platform · daily (blended)",
        fields: ["date", "account_id", "platform", "platform_campaign"],
        measures: [...BASE_MEASURES, ...PLATFORM_EXTRAS],
        rank: 1,
        sources: ["platform"],
    },
};
export type BiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE" | "TARGET_CPA" | "TARGET_ROAS" | "TARGET_IMPRESSION_SHARE" | "MAXIMIZE_CLICKS" | "MANUAL_CPC" | "TARGET_CPM" | "OTHER";
export interface CampaignDim {
    id: string;
    account_id: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    bidding_strategy: BiddingStrategy;
    target_cpa: number | null;
    target_roas: number | null;
    budget_id: string | null;
    budget_daily: number | null;
    budget_shared: boolean;
    budget_period: "daily" | "custom";
    start: CivilDate | null;
    end: CivilDate | null;
    simulated?: {
        status?: boolean;
        budget?: boolean;
    };
}
export interface AdGroupDim {
    id: string;
    campaign_id: string;
    name: string;
    status: CampaignStatus;
}
export type QsComponent = "Below" | "Average" | "Above" | null;
export interface KeywordDim {
    id: string;
    ad_group_id: string;
    campaign_id: string;
    text: string;
    match_type: MatchType;
    status: CampaignStatus;
    qs: number | null;
    qs_ctr: QsComponent;
    qs_relevance: QsComponent;
    qs_landing: QsComponent;
    cpc_bid: number | null;
}
export interface ChangeEvent {
    id: string;
    ts: string;
    date: CivilDate;
    resource_type: "CAMPAIGN" | "CAMPAIGN_BUDGET" | "AD_GROUP" | "AD_GROUP_AD" | "AD_GROUP_CRITERION" | "CAMPAIGN_CRITERION" | "ASSET" | "OTHER";
    operation: "create" | "update" | "remove";
    campaign_id?: string;
    ad_group_id?: string;
    changed_fields: string[];
    diffs: {
        field: string;
        before: string | number | null;
        after: string | number | null;
    }[];
    summary: string;
    client_type?: string;
    actor?: string;
}
export interface EntityDims {
    campaigns: Map<string, CampaignDim>;
    adGroups: Map<string, AdGroupDim>;
    keywords: Map<string, KeywordDim>;
}
export function emptyDims(): EntityDims {
    return { campaigns: new Map(), adGroups: new Map(), keywords: new Map() };
}
