import "server-only";
import type { BiddingStrategy, ChangeEvent, QsComponent, SearchTermMatchType, SearchTermStatus } from "@/lib/domain/schema/facts";
import type { CampaignStatus, CampaignType, Device, MatchType } from "@/lib/domain/types";
type Lookup<T> = Partial<Record<string, T>>;
const lookup = <T>(table: Lookup<T>, value: string | undefined, fallback: T): T => (value !== undefined ? table[value] : undefined) ?? fallback;
const CHANNEL: Lookup<CampaignType> = {
    SEARCH: "Search",
    PERFORMANCE_MAX: "PMax",
    SHOPPING: "Shopping",
    VIDEO: "Video",
    DISPLAY: "Display",
    DEMAND_GEN: "Demand Gen",
    MULTI_CHANNEL: "App",
};
export const campaignType = (v?: string): CampaignType => lookup(CHANNEL, v, "Other");
const STATUS: Lookup<CampaignStatus> = { ENABLED: "Enabled", PAUSED: "Paused", REMOVED: "Removed" };
export const entityStatus = (v?: string): CampaignStatus => lookup(STATUS, v, "Enabled");
const DEVICE: Lookup<Device> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet", CONNECTED_TV: "Connected TV", OTHER: "Other" };
export const deviceName = (v?: string): Device => lookup(DEVICE, v, "Other");
const MATCH: Lookup<MatchType> = { EXACT: "Exact", PHRASE: "Phrase", BROAD: "Broad" };
export const matchType = (v?: string): MatchType => lookup(MATCH, v, "Broad");
const ST_MATCH: Lookup<SearchTermMatchType> = { EXACT: "Exact", PHRASE: "Phrase", BROAD: "Broad", NEAR_EXACT: "Near exact", NEAR_PHRASE: "Near phrase" };
export const searchTermMatchType = (v?: string): SearchTermMatchType => lookup(ST_MATCH, v, "Unknown");
const ST_STATUS: Lookup<SearchTermStatus> = { ADDED: "added", EXCLUDED: "excluded", ADDED_EXCLUDED: "added_excluded", NONE: "none" };
export const searchTermStatus = (v?: string): SearchTermStatus => lookup(ST_STATUS, v, "none");
const BIDDING: Lookup<BiddingStrategy> = {
    MAXIMIZE_CONVERSIONS: "MAXIMIZE_CONVERSIONS",
    MAXIMIZE_CONVERSION_VALUE: "MAXIMIZE_CONVERSION_VALUE",
    TARGET_CPA: "TARGET_CPA",
    TARGET_ROAS: "TARGET_ROAS",
    TARGET_IMPRESSION_SHARE: "TARGET_IMPRESSION_SHARE",
    TARGET_CPM: "TARGET_CPM",
    MANUAL_CPC: "MANUAL_CPC",
    TARGET_SPEND: "MAXIMIZE_CLICKS",
    ENHANCED_CPC: "MANUAL_CPC",
};
export const biddingStrategy = (v?: string): BiddingStrategy => lookup(BIDDING, v, "OTHER");
const QS: Lookup<Exclude<QsComponent, null>> = { BELOW_AVERAGE: "Below", AVERAGE: "Average", ABOVE_AVERAGE: "Above" };
export const qsComponent = (v?: string): QsComponent => lookup<QsComponent>(QS, v, null);
const RESOURCE_TYPE: Lookup<ChangeEvent["resource_type"]> = {
    CAMPAIGN: "CAMPAIGN",
    CAMPAIGN_BUDGET: "CAMPAIGN_BUDGET",
    AD_GROUP: "AD_GROUP",
    AD_GROUP_AD: "AD_GROUP_AD",
    AD: "AD_GROUP_AD",
    AD_GROUP_CRITERION: "AD_GROUP_CRITERION",
    CAMPAIGN_CRITERION: "CAMPAIGN_CRITERION",
    ASSET: "ASSET",
    AD_GROUP_ASSET: "ASSET",
    CAMPAIGN_ASSET: "ASSET",
    CUSTOMER_ASSET: "ASSET",
    ASSET_SET: "ASSET",
    ASSET_SET_ASSET: "ASSET",
    CAMPAIGN_ASSET_SET: "ASSET",
};
export const changeResourceType = (v?: string): ChangeEvent["resource_type"] => lookup(RESOURCE_TYPE, v, "OTHER");
const OPERATION: Lookup<ChangeEvent["operation"]> = { CREATE: "create", UPDATE: "update", REMOVE: "remove" };
export const changeOperation = (v?: string): ChangeEvent["operation"] => lookup(OPERATION, v, "update");
export const changedResourceKey = (apiType: string): string => apiType.toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
const RESOURCE_LABEL: Lookup<string> = {
    CAMPAIGN: "Campaign",
    CAMPAIGN_BUDGET: "Budget",
    AD_GROUP: "Ad group",
    AD_GROUP_AD: "Ad",
    AD: "Ad",
    AD_GROUP_CRITERION: "Ad group targeting",
    CAMPAIGN_CRITERION: "Campaign targeting",
    AD_GROUP_BID_MODIFIER: "Bid adjustment",
    ASSET: "Asset",
    AD_GROUP_ASSET: "Ad group asset",
    CAMPAIGN_ASSET: "Campaign asset",
    CUSTOMER_ASSET: "Account asset",
    ASSET_SET: "Asset set",
    ASSET_SET_ASSET: "Asset set item",
    CAMPAIGN_ASSET_SET: "Campaign asset set",
};
export const resourceLabel = (apiType: string): string => RESOURCE_LABEL[apiType] ?? humanizeEnum(apiType);
const BIDDING_LABEL: Lookup<string> = {
    TARGET_CPA: "Target CPA",
    TARGET_ROAS: "Target ROAS",
    MAXIMIZE_CONVERSIONS: "Maximize conversions",
    MAXIMIZE_CONVERSION_VALUE: "Maximize conversion value",
    TARGET_SPEND: "Maximize clicks",
    MANUAL_CPC: "Manual CPC",
    ENHANCED_CPC: "Enhanced CPC",
    TARGET_IMPRESSION_SHARE: "Target impression share",
    MANUAL_CPM: "Manual CPM",
    TARGET_CPM: "Target CPM",
    MANUAL_CPV: "Manual CPV",
    TARGET_CPV: "Target CPV",
    MANUAL_CPA: "Manual CPA",
    TARGET_CPC: "Target CPC",
    FIXED_CPM: "Fixed CPM",
    PERCENT_CPC: "Percent CPC",
    COMMISSION: "Commission",
};
export const biddingStrategyLabel = (v: string): string => BIDDING_LABEL[v] ?? humanizeEnum(v);
export function humanizeEnum(v: string): string {
    const words = v.toLowerCase().split("_").filter(Boolean);
    const s = words.join(" ");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : v;
}
