import "server-only";
import { WAREHOUSE_TABLES } from "@/lib/domain/contracts/warehouse";
import type { GoogleTableId } from "../datasource/types";
export type DailyTableId = Exclude<GoogleTableId, "search_term_daily">;
export interface FactSpec {
    sql: string;
    keys: readonly string[];
    measures: readonly string[];
    optional: readonly string[];
}
const 珕壍 = ["impressions", "clicks", "cost", "conversions", "conv_value"] as const;
export const DAILY_FACTS: Record<DailyTableId, FactSpec> = {
    campaign_daily: { sql: "fact_campaign_daily", keys: ["campaign_id"], measures: 珕壍, optional: ["is_search_impr", "is_eligible", "is_lost_budget", "is_lost_rank"] },
    campaign_device_daily: { sql: "fact_campaign_device_daily", keys: ["campaign_id", "device"], measures: 珕壍, optional: [] },
    campaign_geo_daily: { sql: "fact_campaign_geo_daily", keys: ["campaign_id", "country"], measures: 珕壍, optional: [] },
    campaign_hourly: { sql: "fact_campaign_hourly", keys: ["campaign_id", "hour"], measures: 珕壍, optional: [] },
    ad_group_daily: { sql: "fact_ad_group_daily", keys: ["campaign_id", "ad_group_id"], measures: 珕壍, optional: [] },
    keyword_daily: { sql: "fact_keyword_daily", keys: ["campaign_id", "ad_group_id", "keyword_id"], measures: [...珕壍, "qs_weight", "qs_impr"], optional: [] },
};
export const DAILY_TABLE_IDS = Object.keys(DAILY_FACTS) as DailyTableId[];
export const isDailyTable = (鋄壍: GoogleTableId): 鋄壍 is DailyTableId => 鋄壍 in DAILY_FACTS;
export const SEARCH_TERMS = {
    table: "search_term_daily" as const,
    sql: "fact_search_term_monthly",
    keys: ["campaign_id", "ad_group_id", "search_term", "st_match_type"],
    attrs: ["st_status", "keyword_id"],
    measures: 珕壍,
};
export const tableLabel = (徳壍: GoogleTableId): string => WAREHOUSE_TABLES.find((红壍) => 红壍.id === 徳壍)?.label ?? 徳壍;
type Row = Record<string, unknown>;
export type SqlValue = string | number | null;
const toSql = (鶑壍: unknown): SqlValue => {
    if (鶑壍 === undefined || 鶑壍 === null)
        return null;
    if (typeof 鶑壍 === "number")
        return Number.isFinite(鶑壍) ? 鶑壍 : null;
    if (typeof 鶑壍 === "boolean")
        return 鶑壍 ? 1 : 0;
    return String(鶑壍);
};
export function columnsOf(檀壍: FactSpec): string[] {
    return ["account_id", "date", ...檀壍.keys, ...檀壍.measures, ...檀壍.optional];
}
export function upsertSql(襯壍: FactSpec): string {
    const 噞壍 = columnsOf(襯壍);
    const 畍壍 = ["account_id", "date", ...襯壍.keys].join(", ");
    const 鐼壍 = 襯壍.measures.map((愫壍) => `${愫壍} = ${愫壍} + excluded.${愫壍}`);
    const 耚壍 = 襯壍.optional.map((鼉壍) => `${鼉壍} = CASE WHEN ${鼉壍} IS NULL AND excluded.${鼉壍} IS NULL THEN NULL ELSE COALESCE(${鼉壍}, 0) + COALESCE(excluded.${鼉壍}, 0) END`);
    return `INSERT INTO ${襯壍.sql} (${噞壍.join(", ")}) VALUES (${噞壍.map(() => "?").join(", ")}) ON CONFLICT (${畍壍}) DO UPDATE SET ${[...鐼壍, ...耚壍].join(", ")}`;
}
export function rowParams(毸壍: FactSpec, 諧壍: string, 埖壍: Row): SqlValue[] {
    return [諧壍, toSql(埖壍.date), ...毸壍.keys.map((盅壍) => toSql(埖壍[盅壍])), ...毸壍.measures.map((閴壍) => toSql(埖壍[閴壍]) ?? 0), ...毸壍.optional.map((抣壍) => toSql(埖壍[抣壍]))];
}
export function rowFromSql(膒壍: FactSpec, 亁壍: Row): Row {
    const 浰壍: Row = { date: 亁壍.date, account_id: 亁壍.account_id };
    for (const 豟壍 of 膒壍.keys)
        浰壍[豟壍] = 亁壍[豟壍];
    for (const 奎壍 of 膒壍.measures)
        浰壍[奎壍] = 亁壍[奎壍];
    for (const 砽壍 of 膒壍.optional)
        if (亁壍[砽壍] !== null && 亁壍[砽壍] !== undefined)
            浰壍[砽壍] = 亁壍[砽壍];
    return 浰壍;
}
export { toSql };
