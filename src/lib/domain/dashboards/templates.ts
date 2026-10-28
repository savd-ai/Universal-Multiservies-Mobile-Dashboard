import type { DashboardBody, DashboardTemplate, GridItem, WidgetInstance } from "../contracts/dashboard";
type W = WidgetInstance & {
    layout: Omit<GridItem, "i">;
};
const w = (id: string, text: string, x: number, y: number, width: number, h: number, extra: Partial<WidgetInstance> = {}): W => ({
    id,
    type: text,
    config: {},
    ...extra,
    layout: { x, y, w: width, h },
});
const kpis = (id: string, x: number, y: number, width: number, h = 10): W => w(id, "question", x, y, width, h, {
    title: "Key metrics",
    subtitle: "vs previous period",
    config: { preset: "kpis", query: { source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas", "ctr", "clicks"], dimensions: [], compare: "previous_period" }, viz: { type: "kpi-strip" } },
});
const trend = (id: string, x: number, y: number, width: number, h = 17): W => w(id, "question", x, y, width, h, {
    title: "Spend & conversions",
    subtitle: "Daily · hover for detail",
    config: { preset: "trend", query: { source: "google_ads", metrics: ["cost", "conversions", "cpa"], dimensions: ["date"], compare: "previous_period", fillGaps: true }, viz: { type: "trend-multiples" } },
});
const question = (id: string, x: number, y: number, width: number, h: number, title: string, subtitle: string, preset: string, query: Record<string, unknown>, viz: Record<string, unknown>): W => w(id, "question", x, y, width, h, { title, subtitle, config: { preset, query: { source: "google_ads", ...query }, viz } });
const TEMPLATES: Record<Exclude<DashboardTemplate, "blank">, {
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
            kpis("kpis", 0, 0, 12),
            trend("trend", 0, 10, 8),
            w("pacing", "pacing", 8, 10, 4, 17, { title: "Budget pacing", subtitle: "Month to date", config: {} }),
            w("anomalies", "anomaly-feed", 0, 27, 4, 20, { title: "Anomalies", subtitle: "Last 3 days vs baseline", config: { limit: 4 } }),
            w("campaigns", "campaign-performance", 4, 27, 8, 20, { title: "Campaign performance", subtitle: "Sorted by spend", config: { limit: 6 } }),
        ],
    },
    executive: {
        name: "Executive",
        headline: "The account at a *glance*",
        description: "Board-level summary: KPIs, narrative, goal progress and biggest movers.",
        widgets: [
            kpis("x-kpis", 0, 0, 12),
            w("x-goal", "goal-tracker", 7, 10, 5, 12, { title: "Monthly goal", subtitle: "Conversions vs target", config: { metric: "conversions" } }),
            trend("x-trend", 0, 22, 7, 17),
            w("x-movers", "top-movers", 0, 39, 6, 16, { title: "Top movers", subtitle: "Biggest changes vs previous period", config: { metric: "conversions", limit: 5 } }),
            question("x-types", 6, 39, 6, 16, "Spend by campaign type", "Share of spend", "type-mix", { metrics: ["cost", "roas"], dimensions: ["campaign_type"], sort: [{ key: "cost", dir: "desc" }] }, { type: "bar", horizontal: true }),
        ],
    },
    budget: {
        name: "Budget & pacing",
        headline: "Every dollar, *accounted* for",
        description: "Pacing, cumulative spend, forecast, intraday spend and budget-limited opportunities.",
        widgets: [
            w("b-pacing", "pacing", 0, 0, 4, 17, { title: "Budget pacing", subtitle: "Month to date", config: {} }),
            w("b-cum", "cumulative-spend", 4, 0, 8, 17, { title: "Cumulative spend", subtitle: "Actual · projected · ideal", config: {} }),
            w("b-forecast", "forecast", 0, 17, 8, 16, { title: "30-day forecast", subtitle: "Spend with 80% band", config: { metric: "cost" } }),
            w("b-today", "today-so-far", 8, 17, 4, 16, { title: "Today so far", subtitle: "Hourly spend vs typical", config: {} }),
            w("b-opps", "opportunities", 0, 33, 6, 16, { title: "Opportunities", subtitle: "Budget-limited, above-average ROAS", config: {} }),
            question("b-lost", 6, 33, 6, 16, "Impression share lost", "Search & Shopping · budget vs rank", "lost-is", { metrics: ["search_is", "lost_is_budget", "lost_is_rank"], dimensions: ["campaign"], filters: [{ dim: "campaign_type", op: "in", value: ["Search", "Shopping"] }], sort: [{ key: "lost_is_budget", dir: "desc" }] }, { type: "table" }),
        ],
    },
    monitoring: {
        name: "Monitoring",
        headline: "Quiet until it *matters*",
        description: "Signals, alert status, data health, intraday spend, hour × weekday patterns and wasted search terms.",
        widgets: [
            w("m-status", "alert-status", 0, 0, 4, 12, { title: "Alert status", subtitle: "Open signals by severity", config: {} }),
            w("m-health", "data-health", 4, 0, 4, 12, { title: "Data health", subtitle: "Sources and freshness", config: {} }),
            w("m-today", "today-so-far", 8, 0, 4, 12, { title: "Today so far", subtitle: "Hourly spend vs typical", config: {} }),
            w("m-feed", "anomaly-feed", 0, 12, 6, 20, { title: "Anomalies", subtitle: "Most important first", config: { limit: 6 } }),
            question("m-heat", 6, 12, 6, 20, "Hour × weekday", "Conversions by hour of day", "heatmap", { metrics: ["conversions"], dimensions: ["dow", "hour"] }, { type: "heatmap" }),
            w("m-waste", "search-term-waste", 0, 32, 12, 16, { title: "Search-term waste", subtitle: "Spend with no conversions", config: { limit: 8 } }),
        ],
    },
};
export const TEMPLATE_LIST = (Object.keys(TEMPLATES) as Exclude<DashboardTemplate, "blank">[]).map((id) => ({ id, name: TEMPLATES[id].name, headline: TEMPLATES[id].headline, description: TEMPLATES[id].description }));
export function buildFromTemplate(template: DashboardTemplate, overrides: Partial<DashboardBody> = {}): DashboardBody {
    if (template === "blank") {
        return { name: overrides.name ?? "Untitled dashboard", headline: overrides.headline ?? "A *fresh* canvas", isDefault: false, template: "blank", defaults: {}, widgets: [], layout: [], ...overrides };
    }
    const t = TEMPLATES[template];
    return {
        name: t.name,
        headline: t.headline,
        description: t.description,
        isDefault: false,
        template,
        defaults: {},
        widgets: t.widgets.map(({ layout: _layout, ...inst }) => inst),
        layout: t.widgets.map((wd) => ({ i: wd.id, ...wd.layout })),
        ...overrides,
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
