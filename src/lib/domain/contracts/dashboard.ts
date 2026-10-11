import { z } from "zod";
import { CAMPAIGN_TYPES, DEVICES } from "../types";
import { compareSchema, dateRangeSpecSchema, querySpecSchema } from "../query/spec";
export const gridItemSchema = z.object({
    i: z.string().min(1).max(64),
    x: z.number().int().min(0).max(11),
    y: z.number().int().min(0).max(10000),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(2).max(400),
});
export type GridItem = z.infer<typeof gridItemSchema>;
export const FILTER_KEYS = ["range", "compare", "campaignType", "campaign", "status", "device", "cross"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export const widgetInstanceSchema = z.object({
    id: z.string().min(1).max(64),
    type: z.string().min(1).max(64),
    title: z.string().max(120).optional(),
    subtitle: z.string().max(160).optional(),
    config: z.record(z.string(), z.unknown()).default({}),
    filterOptOut: z.array(z.enum(FILTER_KEYS)).optional(),
});
export type WidgetInstance = z.infer<typeof widgetInstanceSchema>;
export const dashboardDefaultsSchema = z.object({
    range: z.string().max(32).optional(),
    compare: compareSchema.optional(),
    campaignTypes: z.array(z.enum(CAMPAIGN_TYPES)).optional(),
    devices: z.array(z.enum(DEVICES)).optional(),
});
export const DASHBOARD_TEMPLATES = ["performance", "executive", "budget", "monitoring", "blank"] as const;
export type DashboardTemplate = (typeof DASHBOARD_TEMPLATES)[number];
export const dashboardBodySchema = z.object({
    name: z.string().min(1).max(80),
    headline: z.string().max(140).optional(),
    description: z.string().max(400).optional(),
    isDefault: z.boolean().default(false),
    template: z.enum(DASHBOARD_TEMPLATES).optional(),
    defaults: dashboardDefaultsSchema.default({}),
    widgets: z.array(widgetInstanceSchema).max(60),
    layout: z.array(gridItemSchema).max(60),
    tv: z.object({ include: z.boolean(), seconds: z.number().int().min(10).max(600) }).optional(),
    order: z.number().int().optional(),
});
export type DashboardBody = z.infer<typeof dashboardBodySchema>;
export interface Dashboard extends DashboardBody {
    id: string;
    schemaVersion: 1;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export const dashboardExportSchema = z.object({
    kind: z.literal("savd.dashboard"),
    schemaVersion: z.literal(1),
    doc: dashboardBodySchema,
});
export const VIZ_TYPES = [
    "number",
    "kpi-strip",
    "line",
    "area",
    "bar",
    "stacked-bar",
    "trend-multiples",
    "donut",
    "table",
    "pivot",
    "gauge",
    "funnel",
    "scatter",
    "heatmap",
    "treemap",
    "geo-table",
    "progress-goal",
] as const;
export type VizType = (typeof VIZ_TYPES)[number];
export const vizSettingsSchema = z
    .object({
    type: z.enum(VIZ_TYPES),
    goal: z.number().optional(),
    goalLabel: z.string().max(40).optional(),
    stacked: z.boolean().optional(),
    horizontal: z.boolean().optional(),
    showLegend: z.boolean().optional(),
    showValues: z.boolean().optional(),
    xKey: z.string().max(64).optional(),
    yKeys: z.array(z.string().max(64)).max(6).optional(),
    sizeKey: z.string().max(64).optional(),
})
    .passthrough();
export type VizSettings = z.infer<typeof vizSettingsSchema>;
export const widgetQuerySchema = querySpecSchema.extend({ dateRange: dateRangeSpecSchema.optional() });
export type WidgetQuery = z.infer<typeof widgetQuerySchema>;
export type WidgetQueryInput = z.input<typeof widgetQuerySchema>;
export const savedQuestionBodySchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(400).optional(),
    query: querySpecSchema,
    viz: vizSettingsSchema,
    origin: z.enum(["explore"]).default("explore"),
});
export type SavedQuestionBody = z.infer<typeof savedQuestionBodySchema>;
export interface SavedQuestion extends SavedQuestionBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export const annotationBodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    text: z.string().min(1).max(280),
    campaignId: z.string().max(64).optional(),
    accountId: z.string().max(32).optional(),
    kind: z.enum(["note", "launch", "promo", "incident"]).default("note"),
});
export type AnnotationBody = z.infer<typeof annotationBodySchema>;
export interface Annotation extends AnnotationBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export const customMetricBodySchema = z.object({
    key: z.string().regex(/^cm_[a-z0-9_]{1,40}$/, "Keys look like cm_profit"),
    label: z.string().min(1).max(60),
    formula: z.string().min(1).max(500),
    format: z.enum(["money", "number", "decimal", "percent", "ratio"]),
    direction: z.enum(["up_good", "down_good", "neutral"]),
    description: z.string().max(240).optional(),
});
export type CustomMetricBody = z.infer<typeof customMetricBodySchema>;
export interface CustomMetric extends CustomMetricBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
