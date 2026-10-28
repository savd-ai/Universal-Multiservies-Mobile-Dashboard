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
const BASE = ["impressions", "clicks", "cost", "conversions", "conv_value"] as const;
export const DAILY_FACTS: Record<DailyTableId, FactSpec> = {
    campaign_daily: { sql: "fact_campaign_daily", keys: ["campaign_id"], measures: BASE, optional: ["is_search_impr", "is_eligible", "is_lost_budget", "is_lost_rank"] },
    campaign_device_daily: { sql: "fact_campaign_device_daily", keys: ["campaign_id", "device"], measures: BASE, optional: [] },
    campaign_geo_daily: { sql: "fact_campaign_geo_daily", keys: ["campaign_id", "country"], measures: BASE, optional: [] },
    campaign_hourly: { sql: "fact_campaign_hourly", keys: ["campaign_id", "hour"], measures: BASE, optional: [] },
    ad_group_daily: { sql: "fact_ad_group_daily", keys: ["campaign_id", "ad_group_id"], measures: BASE, optional: [] },
    keyword_daily: { sql: "fact_keyword_daily", keys: ["campaign_id", "ad_group_id", "keyword_id"], measures: [...BASE, "qs_weight", "qs_impr"], optional: [] },
};
export const DAILY_TABLE_IDS = Object.keys(DAILY_FACTS) as DailyTableId[];
export const isDailyTable = (t: GoogleTableId): t is DailyTableId => t in DAILY_FACTS;
export const SEARCH_TERMS = {
    table: "search_term_daily" as const,
    sql: "fact_search_term_monthly",
    keys: ["campaign_id", "ad_group_id", "search_term", "st_match_type"],
    attrs: ["st_status", "keyword_id"],
    measures: BASE,
};
export const tableLabel = (id: GoogleTableId): string => WAREHOUSE_TABLES.find((t) => t.id === id)?.label ?? id;
type Row = Record<string, unknown>;
export type SqlValue = string | number | null;
const toSql = (v: unknown): SqlValue => {
    if (v === undefined || v === null)
        return null;
    if (typeof v === "number")
        return Number.isFinite(v) ? v : null;
    if (typeof v === "boolean")
        return v ? 1 : 0;
    return String(v);
};
export function columnsOf(spec: FactSpec): string[] {
    return ["account_id", "date", ...spec.keys, ...spec.measures, ...spec.optional];
}
export function upsertSql(spec: FactSpec): string {
    const cols = columnsOf(spec);
    const key = ["account_id", "date", ...spec.keys].join(", ");
    const sum = spec.measures.map((m) => `${m} = ${m} + excluded.${m}`);
    const opt = spec.optional.map((m) => `${m} = CASE WHEN ${m} IS NULL AND excluded.${m} IS NULL THEN NULL ELSE COALESCE(${m}, 0) + COALESCE(excluded.${m}, 0) END`);
    return `INSERT INTO ${spec.sql} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT (${key}) DO UPDATE SET ${[...sum, ...opt].join(", ")}`;
}
export function rowParams(spec: FactSpec, accountId: string, row: Row): SqlValue[] {
    return [accountId, toSql(row.date), ...spec.keys.map((k) => toSql(row[k])), ...spec.measures.map((m) => toSql(row[m]) ?? 0), ...spec.optional.map((m) => toSql(row[m]))];
}
export function rowFromSql(spec: FactSpec, r: Row): Row {
    const out: Row = { date: r.date, account_id: r.account_id };
    for (const k of spec.keys)
        out[k] = r[k];
    for (const m of spec.measures)
        out[m] = r[m];
    for (const m of spec.optional)
        if (r[m] !== null && r[m] !== undefined)
            out[m] = r[m];
    return out;
}
export { toSql };
