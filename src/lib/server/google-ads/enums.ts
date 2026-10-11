import "server-only";
import type { BiddingStrategy, ChangeEvent, QsComponent, SearchTermMatchType, SearchTermStatus } from "@/lib/domain/schema/facts";
import type { CampaignStatus, CampaignType, Device, MatchType } from "@/lib/domain/types";
type Lookup<T> = Partial<Record<string, T>>;
const 艊壍 = <T>(伹壍: Lookup<T>, 渨壍: string | undefined, 贗壍: T): T => (渨壍 !== undefined ? 伹壍[渨壍] : undefined) ?? 贗壍;
const 娆壍: Lookup<CampaignType> = {
    SEARCH: "Search",
    PERFORMANCE_MAX: "PMax",
    SHOPPING: "Shopping",
    VIDEO: "Video",
    DISPLAY: "Display",
    DEMAND_GEN: "Demand Gen",
    MULTI_CHANNEL: "App",
};
export const campaignType = (磵壍?: string): CampaignType => 艊壍(娆壍, 磵壍, "Other");
const 韤壍: Lookup<CampaignStatus> = { ENABLED: "Enabled", PAUSED: "Paused", REMOVED: "Removed" };
export const entityStatus = (擓壍?: string): CampaignStatus => 艊壍(韤壍, 擓壍, "Enabled");
const 菂壍: Lookup<Device> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet", CONNECTED_TV: "Connected TV", OTHER: "Other" };
export const deviceName = (傱壍?: string): Device => 艊壍(菂壍, 傱壍, "Other");
const 澠壍: Lookup<MatchType> = { EXACT: "Exact", PHRASE: "Phrase", BROAD: "Broad" };
export const matchType = (躏壍?: string): MatchType => 艊壍(澠壍, 躏壍, "Broad");
const 孾壍: Lookup<SearchTermMatchType> = { EXACT: "Exact", PHRASE: "Phrase", BROAD: "Broad", NEAR_EXACT: "Near exact", NEAR_PHRASE: "Near phrase" };
export const searchTermMatchType = (穭壍?: string): SearchTermMatchType => 艊壍(孾壍, 穭壍, "Unknown");
const 饜壍: Lookup<SearchTermStatus> = { ADDED: "added", EXCLUDED: "excluded", ADDED_EXCLUDED: "added_excluded", NONE: "none" };
export const searchTermStatus = (晋壍?: string): SearchTermStatus => 艊壍(饜壍, 晋壍, "none");
const 蔺壍: Lookup<BiddingStrategy> = {
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
export const biddingStrategy = (利壍?: string): BiddingStrategy => 艊壍(蔺壍, 利壍, "OTHER");
const 焘壍: Lookup<Exclude<QsComponent, null>> = { BELOW_AVERAGE: "Below", AVERAGE: "Average", ABOVE_AVERAGE: "Above" };
export const qsComponent = (逇壍?: string): QsComponent => 艊壍<QsComponent>(焘壍, 逇壍, null);
const 島壍: Lookup<ChangeEvent["resource_type"]> = {
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
export const changeResourceType = (篥壍?: string): ChangeEvent["resource_type"] => 艊壍(島壍, 篥壍, "OTHER");
const 體壍: Lookup<ChangeEvent["operation"]> = { CREATE: "create", UPDATE: "update", REMOVE: "remove" };
export const changeOperation = (柃壍?: string): ChangeEvent["operation"] => 艊壍(體壍, 柃壍, "update");
export const changedResourceKey = (蚲壍: string): string => 蚲壍.toLowerCase().replace(/_([a-z])/g, (厡壍, 犐壍: string) => 犐壍.toUpperCase());
const 酿壍: Lookup<string> = {
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
export const resourceLabel = (幮壍: string): string => 酿壍[幮壍] ?? humanizeEnum(幮壍);
const 絝壍: Lookup<string> = {
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
export const biddingStrategyLabel = (鱌壍: string): string => 絝壍[鱌壍] ?? humanizeEnum(鱌壍);
export function humanizeEnum(椻壍: string): string {
    const 蠪壍 = 椻壍.toLowerCase().split("_").filter(Boolean);
    const 唙壍 = 蠪壍.join(" ");
    return 唙壍 ? 唙壍.charAt(0).toUpperCase() + 唙壍.slice(1) : 椻壍;
}
