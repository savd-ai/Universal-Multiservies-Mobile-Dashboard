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
    resolve(row: Record<string, unknown>, dims: EntityDims): DimensionValue;
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COUNTRY_NAMES: Record<string, string> = {
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
const str = (v: unknown): string => (v == null ? "" : String(v));
function simple(key: DimensionKey, label: string, field: string, kind: DimensionKind = "category"): DimensionDef {
    return { key, label, kind, field, resolve: (row) => ({ id: str(row[field]), label: str(row[field]) || "—" }) };
}
export const DIMENSIONS: Record<DimensionKey, DimensionDef> = {
    date: {
        key: "date",
        label: "Date",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => ({ id: str(row.date), label: str(row.date) }),
    },
    week: {
        key: "week",
        label: "Week",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => {
            const w = isoWeek(str(row.date));
            return { id: w, label: w };
        },
    },
    month: {
        key: "month",
        label: "Month",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => {
            const m = monthKey(str(row.date));
            return { id: m, label: m };
        },
    },
    quarter: {
        key: "quarter",
        label: "Quarter",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => {
            const { y, m } = parts(str(row.date));
            const q = `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
            return { id: q, label: q };
        },
    },
    year: {
        key: "year",
        label: "Year",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => {
            const y = String(parts(str(row.date)).y);
            return { id: y, label: y };
        },
    },
    dow: {
        key: "dow",
        label: "Day of week",
        kind: "time",
        field: "date",
        derivedFromDate: true,
        resolve: (row) => {
            const w = dow(str(row.date));
            const iso = w === 0 ? 7 : w;
            return { id: String(iso), label: WEEKDAYS[w] ?? "", order: iso };
        },
    },
    hour: {
        key: "hour",
        label: "Hour",
        kind: "time",
        field: "hour",
        resolve: (row) => {
            const h = Number(row.hour);
            return { id: String(h), label: `${String(h).padStart(2, "0")}:00`, order: h };
        },
    },
    account: simple("account", "Account", "account_id", "entity"),
    campaign: {
        key: "campaign",
        label: "Campaign",
        kind: "entity",
        field: "campaign_id",
        resolve: (row, dims) => {
            const id = str(row.campaign_id);
            return { id, label: dims.campaigns.get(id)?.name ?? id };
        },
    },
    campaign_type: {
        key: "campaign_type",
        label: "Campaign type",
        kind: "category",
        field: "campaign_id",
        resolve: (row, dims) => {
            const t = dims.campaigns.get(str(row.campaign_id))?.type ?? "Other";
            return { id: t, label: t };
        },
    },
    campaign_status: {
        key: "campaign_status",
        label: "Status",
        kind: "category",
        field: "campaign_id",
        resolve: (row, dims) => {
            const s = dims.campaigns.get(str(row.campaign_id))?.status ?? "Enabled";
            return { id: s, label: s };
        },
    },
    bidding_strategy: {
        key: "bidding_strategy",
        label: "Bid strategy",
        kind: "category",
        field: "campaign_id",
        resolve: (row, dims) => {
            const b = dims.campaigns.get(str(row.campaign_id))?.bidding_strategy ?? "OTHER";
            return { id: b, label: humanizeEnum(b) };
        },
    },
    ad_group: {
        key: "ad_group",
        label: "Ad group",
        kind: "entity",
        field: "ad_group_id",
        resolve: (row, dims) => {
            const id = str(row.ad_group_id);
            return { id, label: dims.adGroups.get(id)?.name ?? id };
        },
    },
    keyword: {
        key: "keyword",
        label: "Keyword",
        kind: "entity",
        field: "keyword_id",
        resolve: (row, dims) => {
            const id = str(row.keyword_id);
            const k = dims.keywords.get(id);
            return { id, label: k ? formatKeyword(k.text, k.match_type) : id };
        },
    },
    match_type: {
        key: "match_type",
        label: "Match type",
        kind: "category",
        field: "keyword_id",
        resolve: (row, dims) => {
            const m = dims.keywords.get(str(row.keyword_id))?.match_type ?? "Broad";
            return { id: m, label: m };
        },
    },
    search_term: simple("search_term", "Search term", "search_term", "entity"),
    st_status: simple("st_status", "Search term status", "st_status"),
    st_match_type: simple("st_match_type", "Search term match", "st_match_type"),
    device: simple("device", "Device", "device"),
    country: {
        key: "country",
        label: "Country",
        kind: "category",
        field: "country",
        resolve: (row) => {
            const c = str(row.country) || "ZZ";
            return { id: c, label: COUNTRY_NAMES[c] ?? c };
        },
    },
    platform: {
        key: "platform",
        label: "Platform",
        kind: "category",
        field: "platform",
        resolve: (row) => {
            const p = str(row.platform);
            return { id: p, label: PLATFORM_LABELS[p] ?? p };
        },
    },
    platform_campaign: simple("platform_campaign", "Platform campaign", "platform_campaign", "entity"),
};
export function isTimeDimension(key: DimensionKey): boolean {
    return DIMENSIONS[key].kind === "time";
}
export function formatKeyword(text: string, match: string): string {
    if (match === "Exact")
        return `[${text}]`;
    if (match === "Phrase")
        return `"${text}"`;
    return text;
}
export function humanizeEnum(v: string): string {
    const special: Record<string, string> = { CPA: "CPA", ROAS: "ROAS", CPC: "CPC", CPM: "CPM" };
    return v
        .split("_")
        .map((w, i) => special[w] ?? (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
        .join(" ");
}
export function registerPlatformLabel(id: string, label: string): void {
    PLATFORM_LABELS[id] = label;
}
