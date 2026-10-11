import type { DashboardBody, DashboardTemplate, GridItem, WidgetInstance } from "../contracts/dashboard";
type W = WidgetInstance & {
    layout: Omit<GridItem, "i">;
};
const 岀壍 = (筯壍: string, 驞壍: string, 杍壍: number, 蘼壍: number, 匫壍: number, 爚壍: number, 鄉壍: Partial<WidgetInstance> = {}): W => ({
    id: 筯壍,
    type: 驞壍,
    config: {},
    ...鄉壍,
    layout: { x: 杍壍, y: 蘼壍, w: 匫壍, h: 爚壍 },
});
const 巸壍 = (糧壍: string, 鯖壍: number, 棅壍: number, 螴壍: number, 咣壍 = 10): W => 岀壍(糧壍, "question", 鯖壍, 棅壍, 螴壍, 咣壍, {
    title: "Key metrics",
    subtitle: "vs previous period",
    config: { preset: "kpis", query: { source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas", "ctr", "clicks"], dimensions: [], compare: "previous_period" }, viz: { type: "kpi-strip" } },
});
const 玒壍 = (銁壍: string, 彰壍: number, 繟壍: number, 鵎壍: number, 樽壍 = 17): W => 岀壍(銁壍, "question", 彰壍, 繟壍, 鵎壍, 樽壍, {
    title: "Spend & conversions",
    subtitle: "Daily · hover for detail",
    config: { preset: "trend", query: { source: "google_ads", metrics: ["cost", "conversions", "cpa"], dimensions: ["date"], compare: "previous_period", fillGaps: true }, viz: { type: "trend-multiples" } },
});
const 褬壍 = (嘛壍: string, 甊壍: number, 鏹壍: number, 惨壍: number, 翗壍: number, 黆壍: string, 段壍: string, 誤壍: string, 垓壍: Record<string, unknown>, 皂壍: Record<string, unknown>): W => 岀壍(嘛壍, "question", 甊壍, 鏹壍, 惨壍, 翗壍, { title: 黆壍, subtitle: 段壍, config: { preset: 誤壍, query: { source: "google_ads", ...垓壍 }, viz: 皂壍 } });
const 镱壍: Record<Exclude<DashboardTemplate, "blank">, {
    name: string;
    headline: string;
    description: string;
    widgets: W[];
}> = {
    performance: {
        name: "Overview",
        headline: "What is *actually* driving your growth?",
        description: "The prototype's default view: headline KPIs, trend, pacing, signals, and campaigns.",
        widgets: [
            巸壍("kpis", 0, 0, 12),
            玒壍("trend", 0, 10, 8),
            岀壍("pacing", "pacing", 8, 10, 4, 17, { title: "Budget pacing", subtitle: "Month to date", config: {} }),
            岀壍("anomalies", "anomaly-feed", 0, 27, 4, 20, { title: "Anomalies", subtitle: "Last 3 days vs baseline", config: { limit: 4 } }),
            岀壍("campaigns", "campaign-performance", 4, 27, 8, 20, { title: "Campaign performance", subtitle: "Sorted by spend", config: { limit: 6 } }),
        ],
    },
    executive: {
        name: "Executive",
        headline: "The account at a *glance*",
        description: "Board-level summary: KPIs, narrative, goal progress and biggest movers.",
        widgets: [
            巸壍("x-kpis", 0, 0, 12),
            岀壍("x-goal", "goal-tracker", 7, 10, 5, 12, { title: "Monthly goal", subtitle: "Conversions vs target", config: { metric: "conversions" } }),
            玒壍("x-trend", 0, 22, 7, 17),
            岀壍("x-movers", "top-movers", 0, 39, 6, 16, { title: "Top movers", subtitle: "Biggest changes vs previous period", config: { metric: "conversions", limit: 5 } }),
            褬壍("x-types", 6, 39, 6, 16, "Spend by campaign type", "Share of spend", "type-mix", { metrics: ["cost", "roas"], dimensions: ["campaign_type"], sort: [{ key: "cost", dir: "desc" }] }, { type: "bar", horizontal: true }),
        ],
    },
    budget: {
        name: "Budget & pacing",
        headline: "Every dollar, *accounted* for",
        description: "Pacing, cumulative spend, forecast, intraday spend and budget-limited opportunities.",
        widgets: [
            岀壍("b-pacing", "pacing", 0, 0, 4, 17, { title: "Budget pacing", subtitle: "Month to date", config: {} }),
            岀壍("b-cum", "cumulative-spend", 4, 0, 8, 17, { title: "Cumulative spend", subtitle: "Actual · projected · ideal", config: {} }),
            岀壍("b-forecast", "forecast", 0, 17, 8, 16, { title: "30-day forecast", subtitle: "Spend with 80% band", config: { metric: "cost" } }),
            岀壍("b-today", "today-so-far", 8, 17, 4, 16, { title: "Today so far", subtitle: "Hourly spend vs typical", config: {} }),
            岀壍("b-opps", "opportunities", 0, 33, 6, 16, { title: "Opportunities", subtitle: "Budget-limited, above-average ROAS", config: {} }),
            褬壍("b-lost", 6, 33, 6, 16, "Impression share lost", "Search & Shopping · budget vs rank", "lost-is", { metrics: ["search_is", "lost_is_budget", "lost_is_rank"], dimensions: ["campaign"], filters: [{ dim: "campaign_type", op: "in", value: ["Search", "Shopping"] }], sort: [{ key: "lost_is_budget", dir: "desc" }] }, { type: "table" }),
        ],
    },
    monitoring: {
        name: "Monitoring",
        headline: "Quiet until it *matters*",
        description: "Signals, alert status, data health, intraday spend, hour × weekday patterns and wasted search terms.",
        widgets: [
            岀壍("m-status", "alert-status", 0, 0, 4, 12, { title: "Alert status", subtitle: "Open signals by severity", config: {} }),
            岀壍("m-health", "data-health", 4, 0, 4, 12, { title: "Data health", subtitle: "Sources and freshness", config: {} }),
            岀壍("m-today", "today-so-far", 8, 0, 4, 12, { title: "Today so far", subtitle: "Hourly spend vs typical", config: {} }),
            岀壍("m-feed", "anomaly-feed", 0, 12, 6, 20, { title: "Anomalies", subtitle: "Most important first", config: { limit: 6 } }),
            褬壍("m-heat", 6, 12, 6, 20, "Hour × weekday", "Conversions by hour of day", "heatmap", { metrics: ["conversions"], dimensions: ["dow", "hour"] }, { type: "heatmap" }),
            岀壍("m-waste", "search-term-waste", 0, 32, 12, 16, { title: "Search-term waste", subtitle: "Spend with no conversions", config: { limit: 8 } }),
        ],
    },
};
export const TEMPLATE_LIST = (Object.keys(镱壍) as Exclude<DashboardTemplate, "blank">[]).map((扠壍) => ({ id: 扠壍, name: 镱壍[扠壍].name, headline: 镱壍[扠壍].headline, description: 镱壍[扠壍].description }));
export function buildFromTemplate(腏壍: DashboardTemplate, 举壍: Partial<DashboardBody> = {}): DashboardBody {
    if (腏壍 === "blank") {
        return { name: 举壍.name ?? "Untitled dashboard", headline: 举壍.headline ?? "A *fresh* canvas", isDefault: false, template: "blank", defaults: {}, widgets: [], layout: [], ...举壍 };
    }
    const 洭壍 = 镱壍[腏壍];
    return {
        name: 洭壍.name,
        headline: 洭壍.headline,
        description: 洭壍.description,
        isDefault: false,
        template: 腏壍,
        defaults: {},
        widgets: 洭壍.widgets.map(({ layout: _谜壍, ...夋壍 }) => 夋壍),
        layout: 洭壍.widgets.map((矺壍) => ({ i: 矺壍.id, ...矺壍.layout })),
        ...举壍,
    };
}
export function seedDashboardBodies(): (DashboardBody & {
    id: string;
})[] {
    return [
        { id: "overview", ...buildFromTemplate("performance", { isDefault: true, order: 0 }) },
        { id: "executive", ...buildFromTemplate("executive", { order: 1 }) },
        { id: "monitoring", ...buildFromTemplate("monitoring", { order: 2 }) },
    ];
}
