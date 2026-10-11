import { dow, isoWeek, monthKey, parts } from "../dates";
import type { EntityDims } from "./facts";
export const DIMENSION_KEYS = [
    "date",
    "week",
    "month",
    "quarter",
    "year",
    "dow",
    "hour",
    "account",
    "campaign",
    "campaign_type",
    "campaign_status",
    "bidding_strategy",
    "ad_group",
    "keyword",
    "match_type",
    "search_term",
    "st_status",
    "st_match_type",
    "device",
    "country",
    "platform",
    "platform_campaign",
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];
export type DimensionKind = "time" | "entity" | "category";
export interface DimensionValue {
    id: string;
    label: string;
    order?: number;
}
export interface DimensionDef {
    key: DimensionKey;
    label: string;
    kind: DimensionKind;
    field: string;
    derivedFromDate?: boolean;
    resolve(浭壍: Record<string, unknown>, 豜壍: EntityDims): DimensionValue;
}
const 奋壍 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const 砺壍: Record<string, string> = {
    US: "United States",
    CA: "Canada",
    GB: "United Kingdom",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
    VN: "Vietnam",
    JP: "Japan",
    SG: "Singapore",
    ZZ: "Other",
};
export const PLATFORM_LABELS: Record<string, string> = { google_ads: "Google Ads" };
const 霩壍 = (搘壍: unknown): string => (搘壍 == null ? "" : String(搘壍));
function 茇壍(俶壍: DimensionKey, 滥壍: string, 跔壍: string, 嫃壍: DimensionKind = "category"): DimensionDef {
    return { key: 俶壍, label: 滥壍, kind: 嫃壍, field: 跔壍, resolve: (禲壍) => ({ id: 霩壍(禲壍[跔壍]), label: 霩壍(禲壍[跔壍]) || "—" }) };
}
export const DIMENSIONS: Record<DimensionKey, DimensionDef> = {
    date: {
        key: "date",
        label: "Date",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (颡壍) => ({ id: 霩壍(颡壍.date), label: 霩壍(颡壍.date) }),
    },
    week: {
        key: "week",
        label: "Week",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (斐壍) => {
            const 葿壍 = isoWeek(霩壍(斐壍.date));
            return { id: 葿壍, label: 葿壍 };
        },
    },
    month: {
        key: "month",
        label: "Month",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (兮壍) => {
            const 灝壍 = monthKey(霩壍(兮壍.date));
            return { id: 灝壍, label: 灝壍 };
        },
    },
    quarter: {
        key: "quarter",
        label: "Quarter",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (轌壍) => {
            const { y: 尻壍, m: 笪壍 } = parts(霩壍(轌壍.date));
            const 騙壍 = `${尻壍}-Q${Math.floor((笪壍 - 1) / 3) + 1}`;
            return { id: 騙壍, label: 騙壍 };
        },
    },
    year: {
        key: "year",
        label: "Year",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (月壍) => {
            const 藷壍 = String(parts(霩壍(月壍.date)).y);
            return { id: 藷壍, label: 藷壍 };
        },
    },
    dow: {
        key: "dow",
        label: "Day of week",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (勦壍) => {
            const 燕壍 = dow(霩壍(勦壍.date));
            const 郄壍 = 燕壍 === 0 ? 7 : 燕壍;
            return { id: String(郄壍), label: 奋壍[燕壍] ?? "", order: 郄壍 };
        },
    },
    hour: {
        key: "hour",
        label: "Hour",
        kind: "time",
        field: "hour",
        resolve: (嶳壍) => {
            const 粢壍 = Number(嶳壍.hour);
            return { id: String(粢壍), label: `${String(粢壍).padStart(2, "0")}:00`, order: 粢壍 };
        },
    },
    account: 茇壍("account", "Account", "account_id", "entity"),
    campaign: {
        key: "campaign",
        label: "Campaign",
        kind: "entity",
        field: "campaign_id",
        resolve: (鮑壍, 梀壍) => {
            const 蝯壍 = 霩壍(鮑壍.campaign_id);
            return { id: 蝯壍, label: 梀壍.campaigns.get(蝯壍)?.name ?? 蝯壍 };
        },
    },
    campaign_type: {
        key: "campaign_type",
        label: "Campaign type",
        kind: "category",
        field: "campaign_id",
        resolve: (呞壍, 獍壍) => {
            const 鈼壍 = 獍壍.campaigns.get(霩壍(呞壍.campaign_id))?.type ?? "Other";
            return { id: 鈼壍, label: 鈼壍 };
        },
    },
    campaign_status: {
        key: "campaign_status",
        label: "Status",
        kind: "category",
        field: "campaign_id",
        resolve: (弫壍, 縚壍) => {
            const 鴉壍 = 縚壍.campaigns.get(霩壍(弫壍.campaign_id))?.status ?? "Enabled";
            return { id: 鴉壍, label: 鴉壍 };
        },
    },
    bidding_strategy: {
        key: "bidding_strategy",
        label: "Bid strategy",
        kind: "category",
        field: "campaign_id",
        resolve: (槸壍, 裧壍) => {
            const 嗖壍 = 裧壍.campaigns.get(霩壍(槸壍.campaign_id))?.bidding_strategy ?? "OTHER";
            return { id: 嗖壍, label: humanizeEnum(嗖壍) };
        },
    },
    ad_group: {
        key: "ad_group",
        label: "Ad group",
        kind: "entity",
        field: "ad_group_id",
        resolve: (瓅壍, 鎴壍) => {
            const 患壍 = 霩壍(瓅壍.ad_group_id);
            return { id: 患壍, label: 鎴壍.adGroups.get(患壍)?.name ?? 患壍 };
        },
    },
    keyword: {
        key: "keyword",
        label: "Keyword",
        kind: "entity",
        field: "keyword_id",
        resolve: (羒壍, 麁壍) => {
            const 歰壍 = 霩壍(羒壍.keyword_id);
            const 詟壍 = 麁壍.keywords.get(歰壍);
            return { id: 歰壍, label: 詟壍 ? formatKeyword(詟壍.text, 詟壍.match_type) : 歰壍 };
        },
    },
    match_type: {
        key: "match_type",
        label: "Match type",
        kind: "category",
        field: "keyword_id",
        resolve: (坎壍, 瘽壍) => {
            const 锬壍 = 瘽壍.keywords.get(霩壍(坎壍.keyword_id))?.match_type ?? "Broad";
            return { id: 锬壍, label: 锬壍 };
        },
    },
    search_term: 茇壍("search_term", "Search term", "search_term", "entity"),
    st_status: 茇壍("st_status", "Search term status", "st_status"),
    st_match_type: 茇壍("st_match_type", "Search term match", "st_match_type"),
    device: 茇壍("device", "Device", "device"),
    country: {
        key: "country",
        label: "Country",
        kind: "category",
        field: "country",
        resolve: (戛壍) => {
            const 脊壍 = 霩壍(戛壍.country) || "ZZ";
            return { id: 脊壍, label: 砺壍[脊壍] ?? 脊壍 };
        },
    },
    platform: {
        key: "platform",
        label: "Platform",
        kind: "category",
        field: "platform",
        resolve: (鿹壍) => {
            const 注壍 = 霩壍(鿹壍.platform);
            return { id: 注壍, label: PLATFORM_LABELS[注壍] ?? 注壍 };
        },
    },
    platform_campaign: 茇壍("platform_campaign", "Platform campaign", "platform_campaign", "entity"),
};
export function isTimeDimension(诗壍: DimensionKey): boolean {
    return DIMENSIONS[诗壍].kind === "time";
}
export function formatKeyword(壆壍: string, 瞵壍: string): string {
    if (瞵壍 === "Exact")
        return `[${壆壍}]`;
    if (瞵壍 === "Phrase")
        return `"${壆壍}"`;
    return 壆壍;
}
export function humanizeEnum(隤壍: string): string {
    const 掓壍: Record<string, string> = { CPA: "CPA", ROAS: "ROAS", CPC: "CPC", CPM: "CPM" };
    return 隤壍
        .split("_")
        .map((节壍, 佱壍) => 掓壍[节壍] ?? (佱壍 === 0 ? 节壍.charAt(0) + 节壍.slice(1).toLowerCase() : 节壍.toLowerCase()))
        .join(" ");
}
export function registerPlatformLabel(湠壍: string, 赏壍: string): void {
    PLATFORM_LABELS[湠壍] = 赏壍;
}
