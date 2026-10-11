import { emptySpec, type ExploreState } from "./notebook-state";
export interface Starter {
    id: string;
    title: string;
    caption: string;
    state: ExploreState;
}
export const STARTERS: Starter[] = [
    {
        id: "type-roas",
        title: "Spend and ROAS by campaign type",
        caption: "Where the money goes and what it returns",
        state: { spec: emptySpec({ metrics: ["cost", "roas"], dimensions: ["campaign_type"], sort: [{ key: "cost", dir: "desc" }] }), viz: { type: "bar" } },
    },
    {
        id: "hour-weekday",
        title: "Conversions by hour × weekday",
        caption: "When customers actually convert",
        state: { spec: emptySpec({ metrics: ["conversions"], dimensions: ["dow", "hour"] }), viz: { type: "heatmap" } },
    },
    {
        id: "wasted-terms",
        title: "Top search terms with no conversions",
        caption: "Spend that never converted — negative keyword candidates",
        state: {
            spec: emptySpec({ metrics: ["cost", "clicks", "conversions"], dimensions: ["search_term"], having: [{ metric: "conversions", op: "eq", value: 0 }], sort: [{ key: "cost", dir: "desc" }], limit: 25 }),
            viz: { type: "table" },
        },
    },
    {
        id: "cpa-device",
        title: "CPA trend by device",
        caption: "Is mobile getting more expensive?",
        state: { spec: emptySpec({ metrics: ["cpa"], dimensions: ["date", "device"] }), viz: { type: "line" } },
    },
    {
        id: "blended-platform",
        title: "Blended spend by platform",
        caption: "Google Ads next to every connected ad platform",
        state: { spec: emptySpec({ source: "blended", metrics: ["cost"], dimensions: ["date", "platform"] }), viz: { type: "stacked-bar" } },
    },
    {
        id: "lost-is",
        title: "Where impression share is lost",
        caption: "Budget vs rank, Search & Shopping campaigns",
        state: {
            spec: emptySpec({
                metrics: ["search_is", "lost_is_budget", "lost_is_rank"],
                dimensions: ["campaign"],
                filters: [{ dim: "campaign_type", op: "in", value: ["Search", "Shopping"] }],
                sort: [{ key: "lost_is_budget", dir: "desc" }],
            }),
            viz: { type: "table" },
        },
    },
];
