import { z } from "zod";
import { DATE_PRESETS, isCivilDate } from "../dates";
import { DIMENSION_KEYS } from "../schema/dimensions";
export const civilDateSchema = z.string().refine(isCivilDate, "Expected a YYYY-MM-DD date");
export const querySourceSchema = z.union([z.literal("google_ads"), z.literal("blended"), z.string().regex(/^plugin:[a-z0-9][a-z0-9-]{0,62}$/)]);
export type QuerySource = z.infer<typeof querySourceSchema>;
export const dimensionKeySchema = z.enum(DIMENSION_KEYS);
export const FILTER_OPS = ["eq", "neq", "in", "nin", "contains", "ncontains", "starts_with"] as const;
export const filterSchema = z.object({
    dim: dimensionKeySchema,
    op: z.enum(FILTER_OPS),
    value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(200)]),
});
export type QueryFilter = z.infer<typeof filterSchema>;
export const HAVING_OPS = ["gt", "gte", "lt", "lte", "eq", "neq", "between"] as const;
export const havingSchema = z.object({
    metric: z.string().min(1).max(64),
    op: z.enum(HAVING_OPS),
    value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
});
export type QueryHaving = z.infer<typeof havingSchema>;
export const dateRangeSpecSchema = z.union([
    z.object({ preset: z.enum(DATE_PRESETS), includeToday: z.boolean().optional() }),
    z.object({ start: civilDateSchema, end: civilDateSchema }),
]);
export type DateRangeSpec = z.infer<typeof dateRangeSpecSchema>;
export const compareSchema = z.enum(["none", "previous_period", "previous_year"]);
export const sortSchema = z.object({ key: z.string().min(1).max(80), dir: z.enum(["asc", "desc"]) });
export const querySpecSchema = z.object({
    source: querySourceSchema.default("google_ads"),
    accountId: z.string().max(32).optional(),
    metrics: z.array(z.string().min(1).max(64)).min(1).max(12),
    dimensions: z.array(dimensionKeySchema).max(3).default([]),
    filters: z.array(filterSchema).max(10).default([]),
    having: z.array(havingSchema).max(5).default([]),
    dateRange: dateRangeSpecSchema.default({ preset: "last_30d" }),
    compare: compareSchema.default("none"),
    sort: z.array(sortSchema).max(3).optional(),
    limit: z.number().int().min(1).max(10000).optional(),
    totals: z.boolean().optional(),
    fillGaps: z.boolean().optional(),
});
export type QuerySpec = z.infer<typeof querySpecSchema>;
export type QuerySpecInput = z.input<typeof querySpecSchema>;
export interface QueryColumn {
    key: string;
    label: string;
    kind: "dimension" | "metric";
    format?: string;
}
export type QueryCell = string | number | null;
export type QueryRow = Record<string, QueryCell>;
export interface QuerySourceMeta {
    id: string;
    label: string;
    mode: "live" | "blank";
    reason?: string;
    stale?: boolean;
}
export interface QueryResult {
    columns: QueryColumn[];
    rows: QueryRow[];
    totals?: Record<string, number | null>;
    compareTotals?: Record<string, number | null>;
    meta: {
        range: {
            start: string;
            end: string;
            days: number;
        };
        compareRange?: {
            start: string;
            end: string;
        };
        table: string;
        grain: "daily" | "range";
        currency: string;
        timezone: string;
        sources: QuerySourceMeta[];
        truncated: boolean;
        rowCount: number;
        warnings: string[];
        tookMs: number;
    };
}
export function normalizeSpec(埓壍: QuerySpec): QuerySpec {
    return {
        ...埓壍,
        filters: [...埓壍.filters].sort((盂壍, 閱壍) => JSON.stringify(盂壍).localeCompare(JSON.stringify(閱壍))),
        having: [...埓壍.having].sort((抠壍, 膏壍) => JSON.stringify(抠壍).localeCompare(JSON.stringify(膏壍))),
    };
}
export function specHash(乾壍: QuerySpec): string {
    return JSON.stringify(normalizeSpec(乾壍));
}
