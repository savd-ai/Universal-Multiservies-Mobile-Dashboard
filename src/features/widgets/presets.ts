import type { VizSettings, WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import type { WidgetCategory } from "./types";
export interface QuestionPreset {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    category: WidgetCategory;
    size: {
        w: number;
        h: number;
    };
    query: WidgetQueryInput;
    viz: VizSettings;
    keywords?: string[];
}
const g = (q: Omit<WidgetQueryInput, "source"> & {
    source?: string;
}): WidgetQueryInput => ({ source: "google_ads", ...q }) as WidgetQueryInput;
export const QUESTION_PRESETS: QuestionPreset[] = [
    { id: "kpis", title: "Key metrics", subtitle: "vs previous period", description: "Spend, conversions, CPA, ROAS, CTR and clicks with deltas and sparklines.", category: "Performance", size: { w: 12, h: 10 }, query: g({ metrics: ["cost", "conversions", "cpa", "roas", "ctr", "clicks"], dimensions: [], compare: "previous_period" }), viz: { type: "kpi-strip" } },
    { id: "trend", title: "Spend & conversions", subtitle: "Daily · hover for detail", description: "Daily spend (with the previous period) above conversions, one shared crosshair.", category: "Performance", size: { w: 8, h: 17 }, query: g({ metrics: ["cost", "conversions", "cpa"], dimensions: ["date"], compare: "previous_period", fillGaps: true }), viz: { type: "trend-multiples" } },
    { id: "roas-trend", title: "ROAS trend", subtitle: "Daily vs previous period", description: "Return on ad spend by day with the comparison period dashed.", category: "Performance", size: { w: 6, h: 15 }, query: g({ metrics: ["roas"], dimensions: ["date"], compare: "previous_period", fillGaps: true }), viz: { type: "line" } },
    { id: "type-mix", title: "Spend by campaign type", subtitle: "Spend · ROAS", description: "Where the budget goes, with ROAS as a direct label.", category: "Performance", size: { w: 6, h: 16 }, query: g({ metrics: ["cost", "roas"], dimensions: ["campaign_type"], sort: [{ key: "cost", dir: "desc" }] }), viz: { type: "bar", horizontal: true } },
    { id: "type-trend", title: "Daily spend by type", subtitle: "Stacked by campaign type", description: "Spend mix over time.", category: "Performance", size: { w: 8, h: 16 }, query: g({ metrics: ["cost"], dimensions: ["date", "campaign_type"] }), viz: { type: "stacked-bar" } },
    { id: "device-split", title: "Device split", subtitle: "Share of spend", description: "Mobile, desktop, tablet and connected TV.", category: "Performance", size: { w: 4, h: 16 }, query: g({ metrics: ["cost"], dimensions: ["device"] }), viz: { type: "donut" } },
    { id: "cpa-by-device", title: "CPA by device", subtitle: "Daily", description: "Cost per conversion over time for each device.", category: "Performance", size: { w: 8, h: 16 }, query: g({ metrics: ["cpa"], dimensions: ["date", "device"] }), viz: { type: "line" } },
    { id: "heatmap", title: "Hour × weekday", subtitle: "Conversions by hour of day", description: "When conversions happen — for ad scheduling.", category: "Monitoring", size: { w: 6, h: 20 }, query: g({ metrics: ["conversions"], dimensions: ["dow", "hour"] }), viz: { type: "heatmap" } },
    { id: "funnel", title: "Conversion funnel", subtitle: "Impressions → clicks → conversions", description: "Step volumes and rates between steps.", category: "Performance", size: { w: 4, h: 16 }, query: g({ metrics: ["impressions", "clicks", "conversions"], dimensions: [] }), viz: { type: "funnel" } },
    { id: "bubble", title: "CPA vs spend", subtitle: "Bubble size = conversions", description: "Spot expensive campaigns that don't convert.", category: "Performance", size: { w: 6, h: 18 }, query: g({ metrics: ["cost", "cpa", "conversions"], dimensions: ["campaign"] }), viz: { type: "scatter", sizeKey: "conversions" } },
    { id: "treemap", title: "Spend treemap", subtitle: "By campaign", description: "Relative spend at a glance.", category: "Budget", size: { w: 6, h: 16 }, query: g({ metrics: ["cost"], dimensions: ["campaign"], sort: [{ key: "cost", dir: "desc" }] }), viz: { type: "treemap" } },
    { id: "geo", title: "Top countries", subtitle: "Spend, conversions, CPA, ROAS", description: "Performance by country.", category: "Performance", size: { w: 6, h: 16 }, query: g({ metrics: ["cost", "conversions", "cpa", "roas"], dimensions: ["country"], sort: [{ key: "cost", dir: "desc" }], limit: 12 }), viz: { type: "geo-table" } },
    { id: "lost-is", title: "Impression share lost", subtitle: "Search & Shopping · budget vs rank", description: "Search impression share and what was lost to budget or rank.", category: "Budget", size: { w: 6, h: 16 }, query: g({ metrics: ["search_is", "lost_is_budget", "lost_is_rank"], dimensions: ["campaign"], filters: [{ dim: "campaign_type", op: "in", value: ["Search", "Shopping"] }], sort: [{ key: "lost_is_budget", dir: "desc" }] }), viz: { type: "table" } },
    { id: "search-terms", title: "Top search terms", subtitle: "By spend", description: "What people actually searched, with cost and conversions.", category: "Monitoring", size: { w: 8, h: 18 }, query: g({ metrics: ["cost", "clicks", "conversions", "cpa"], dimensions: ["search_term"], sort: [{ key: "cost", dir: "desc" }], limit: 25 }), viz: { type: "table" } },
    { id: "keywords-qs", title: "Quality Score by keyword", subtitle: "Highest spend first", description: "Average Quality Score next to spend and conversions.", category: "Performance", size: { w: 8, h: 18 }, query: g({ metrics: ["avg_qs", "cost", "conversions", "cpa"], dimensions: ["keyword", "match_type"], sort: [{ key: "cost", dir: "desc" }], limit: 25 }), viz: { type: "table" } },
    { id: "campaign-table", title: "Campaign table", subtitle: "All metrics", description: "Every campaign with the full metric set and totals.", category: "Performance", size: { w: 12, h: 20 }, query: g({ metrics: ["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas"], dimensions: ["campaign"], sort: [{ key: "cost", dir: "desc" }], compare: "previous_period" }), viz: { type: "table" } },
    { id: "conversions-number", title: "Conversions", subtitle: "vs previous period", description: "One big number with its change.", category: "Performance", size: { w: 3, h: 9 }, query: g({ metrics: ["conversions"], dimensions: [], compare: "previous_period" }), viz: { type: "number" } },
];
export function presetById(id: string): QuestionPreset | undefined {
    return QUESTION_PRESETS.find((p) => p.id === id);
}
