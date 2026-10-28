import type { BiddingStrategy } from "@/lib/domain/schema/facts";
import type { CampaignType, MatchType } from "@/lib/domain/types";
export interface DemoCampaignSpec {
    id: string;
    name: string;
    type: CampaignType;
    budget: number;
    cpc: number;
    ctr: number;
    cvr: number;
    aov: number;
    util: number;
    bidding: BiddingStrategy;
    targetCpa?: number;
    targetRoas?: number;
    isBase?: number;
    lostBudgetBase?: number;
}
export const PROTOTYPE_CAMPAIGNS: DemoCampaignSpec[] = [
    { id: "c1", name: "Brand — Core Terms", type: "Search", budget: 420, cpc: 0.62, ctr: 0.118, cvr: 0.142, aov: 86, util: 0.93, bidding: "TARGET_IMPRESSION_SHARE", isBase: 0.82, lostBudgetBase: 0.08 },
    { id: "c2", name: "Generic — Running Shoes", type: "Search", budget: 780, cpc: 1.84, ctr: 0.052, cvr: 0.041, aov: 112, util: 0.97, bidding: "MAXIMIZE_CONVERSIONS", isBase: 0.46, lostBudgetBase: 0.12 },
    { id: "c3", name: "PMax — Full Catalog", type: "PMax", budget: 1250, cpc: 0.96, ctr: 0.021, cvr: 0.036, aov: 104, util: 0.95, bidding: "MAXIMIZE_CONVERSION_VALUE", targetRoas: 3.5 },
    { id: "c4", name: "Shopping — Best Sellers", type: "Shopping", budget: 640, cpc: 0.71, ctr: 0.013, cvr: 0.031, aov: 96, util: 0.92, bidding: "TARGET_ROAS", targetRoas: 4, isBase: 0.58, lostBudgetBase: 0.1 },
    { id: "c5", name: "YouTube — Q4 Awareness", type: "Video", budget: 520, cpc: 0.18, ctr: 0.009, cvr: 0.004, aov: 120, util: 0.88, bidding: "TARGET_CPM" },
    { id: "c6", name: "Display — Cart Remarketing", type: "Display", budget: 260, cpc: 0.44, ctr: 0.006, cvr: 0.022, aov: 92, util: 0.9, bidding: "MAXIMIZE_CONVERSIONS" },
    { id: "c7", name: "Demand Gen — Lookalikes", type: "Demand Gen", budget: 380, cpc: 0.52, ctr: 0.011, cvr: 0.012, aov: 108, util: 0.9, bidding: "MAXIMIZE_CONVERSIONS" },
    { id: "c8", name: "Search — Competitor Terms", type: "Search", budget: 300, cpc: 2.35, ctr: 0.038, cvr: 0.024, aov: 118, util: 0.96, bidding: "MAXIMIZE_CLICKS", isBase: 0.31, lostBudgetBase: 0.05 },
];
export const OUTLET_CAMPAIGNS: DemoCampaignSpec[] = [
    { id: "t1", name: "Brand — Trail Gear", type: "Search", budget: 160, cpc: 0.55, ctr: 0.104, cvr: 0.121, aov: 74, util: 0.9, bidding: "TARGET_IMPRESSION_SHARE", isBase: 0.78, lostBudgetBase: 0.06 },
    { id: "t2", name: "Generic — Hiking Boots", type: "Search", budget: 340, cpc: 1.46, ctr: 0.047, cvr: 0.036, aov: 138, util: 0.95, bidding: "TARGET_CPA", targetCpa: 42, isBase: 0.41, lostBudgetBase: 0.14 },
    { id: "t3", name: "PMax — Outlet Catalog", type: "PMax", budget: 520, cpc: 0.81, ctr: 0.019, cvr: 0.033, aov: 92, util: 0.94, bidding: "MAXIMIZE_CONVERSION_VALUE", targetRoas: 3.2 },
    { id: "t4", name: "Shopping — Clearance", type: "Shopping", budget: 260, cpc: 0.58, ctr: 0.015, cvr: 0.034, aov: 68, util: 0.91, bidding: "TARGET_ROAS", targetRoas: 3.6, isBase: 0.52, lostBudgetBase: 0.09 },
    { id: "t5", name: "Display — Site Visitors", type: "Display", budget: 120, cpc: 0.39, ctr: 0.005, cvr: 0.018, aov: 81, util: 0.89, bidding: "MAXIMIZE_CONVERSIONS" },
];
export interface DemoAccountSpec {
    id: string;
    name: string;
    currency: string;
    campaigns: DemoCampaignSpec[];
    seed: string;
    scale: number;
    planted: boolean;
}
export const DEMO_MANAGER = { id: "1112223333", name: "SAVD Demo Agency (MCC)" };
export const DEMO_ACCOUNTS: DemoAccountSpec[] = [
    { id: "4821193307", name: "Acme Running Co.", currency: "USD", campaigns: PROTOTYPE_CAMPAIGNS, seed: "acme", scale: 1, planted: true },
    { id: "9876543210", name: "Trail Gear Outlet", currency: "USD", campaigns: OUTLET_CAMPAIGNS, seed: "trail", scale: 1, planted: false },
];
export interface DemoKeywordSpec {
    text: string;
    match: MatchType;
    qs: number;
}
export interface DemoAdGroupSpec {
    name: string;
    weight: number;
    keywords?: DemoKeywordSpec[];
}
const kw = (text: string, match: MatchType, qs: number): DemoKeywordSpec => ({ text, match, qs });
export const DEMO_AD_GROUPS: Record<string, DemoAdGroupSpec[]> = {
    c1: [
        { name: "Brand — Exact", weight: 0.55, keywords: [kw("acme running", "Exact", 10), kw("acme shoes", "Exact", 9), kw("acme running shoes", "Exact", 10), kw("acme store", "Exact", 9)] },
        { name: "Brand — Product names", weight: 0.33, keywords: [kw("acme cloudstride", "Phrase", 9), kw("acme trailblazer 3", "Phrase", 8), kw("acme pacer", "Phrase", 8), kw("acme glide", "Phrase", 7)] },
        { name: "Brand — Misspellings", weight: 0.12, keywords: [kw("acmee running", "Exact", 7), kw("acme runing", "Exact", 8), kw("akme shoes", "Exact", 6)] },
    ],
    c2: [
        { name: "Running shoes", weight: 0.42, keywords: [kw("running shoes", "Phrase", 6), kw("running shoes men", "Broad", 5), kw("best running shoes", "Exact", 7), kw("running shoes women", "Phrase", 6), kw("lightweight running shoes", "Phrase", 7)] },
        { name: "Trail running shoes", weight: 0.24, keywords: [kw("trail running shoes", "Phrase", 7), kw("trail shoes women", "Exact", 8), kw("waterproof trail runners", "Broad", 5), kw("gore tex trail shoes", "Phrase", 6)] },
        { name: "Wide fit shoes", weight: 0.18, keywords: [kw("wide fit running shoes", "Phrase", 8), kw("wide toe box running shoes", "Exact", 8), kw("wide running shoes men", "Broad", 6)] },
        { name: "Marathon shoes", weight: 0.16, keywords: [kw("marathon running shoes", "Phrase", 6), kw("carbon plate running shoes", "Exact", 7), kw("racing flats", "Phrase", 5)] },
    ],
    c3: [
        { name: "Asset group — Full catalog", weight: 0.58 },
        { name: "Asset group — Trail", weight: 0.24 },
        { name: "Asset group — Apparel", weight: 0.18 },
    ],
    c4: [
        { name: "Best sellers — Road", weight: 0.5 },
        { name: "Best sellers — Trail", weight: 0.32 },
        { name: "Best sellers — Accessories", weight: 0.18 },
    ],
    c5: [
        { name: "In-market runners", weight: 0.46 },
        { name: "Custom intent — marathon", weight: 0.31 },
        { name: "Affinity — fitness", weight: 0.23 },
    ],
    c6: [
        { name: "Cart abandoners 7d", weight: 0.48 },
        { name: "Cart abandoners 30d", weight: 0.3 },
        { name: "Product viewers", weight: 0.22 },
    ],
    c7: [
        { name: "Lookalike — purchasers", weight: 0.44 },
        { name: "Lookalike — high AOV", weight: 0.31 },
        { name: "Interest — running", weight: 0.25 },
    ],
    c8: [
        { name: "Competitor — StrideMax", weight: 0.46, keywords: [kw("stridemax shoes", "Phrase", 4), kw("stridemax vs acme", "Exact", 5), kw("stridemax running", "Broad", 3)] },
        { name: "Competitor — PeakPace", weight: 0.32, keywords: [kw("peakpace running shoes", "Phrase", 4), kw("peakpace sale", "Exact", 5), kw("peakpace alternatives", "Phrase", 6)] },
        { name: "Competitor — Velora", weight: 0.22, keywords: [kw("velora trainers", "Phrase", 3), kw("velora outlet", "Exact", 4)] },
    ],
    t1: [{ name: "Brand — Exact", weight: 1, keywords: [kw("trail gear outlet", "Exact", 9), kw("trailgear", "Exact", 9), kw("trail gear store", "Phrase", 8)] }],
    t2: [
        { name: "Hiking boots", weight: 0.6, keywords: [kw("hiking boots", "Phrase", 6), kw("waterproof hiking boots", "Phrase", 7), kw("hiking boots women", "Exact", 7)] },
        { name: "Trail shoes", weight: 0.4, keywords: [kw("trail shoes sale", "Phrase", 6), kw("cheap trail shoes", "Broad", 4)] },
    ],
    t3: [{ name: "Asset group — Outlet", weight: 1 }],
    t4: [{ name: "Clearance — All", weight: 1 }],
    t5: [{ name: "Site visitors 30d", weight: 1 }],
};
export interface DemoSearchTermSpec {
    term: string;
    weight: number;
    cvr: number;
    status?: "added" | "excluded" | "none";
}
const st = (term: string, weight: number, cvr2: number, status: DemoSearchTermSpec["status"] = "none"): DemoSearchTermSpec => ({ term, weight, cvr: cvr2, status });
export const DEMO_SEARCH_TERMS: Record<string, DemoSearchTermSpec[]> = {
    c1: [
        st("acme running", 0.3, 1.1, "added"),
        st("acme shoes", 0.18, 1.05, "added"),
        st("acme running shoes", 0.16, 1.1, "added"),
        st("acme cloudstride review", 0.08, 0.8),
        st("acme store near me", 0.07, 1.0),
        st("acme discount code", 0.06, 1.3),
        st("acme careers", 0.04, 0),
        st("acme running club", 0.04, 0.2),
        st("acme returns policy", 0.04, 0.1),
        st("acme outlet", 0.03, 0.9),
    ],
    c2: [
        st("running shoes", 0.16, 1.0, "added"),
        st("best running shoes 2026", 0.1, 1.1),
        st("running shoes women", 0.09, 1.0, "added"),
        st("wide fit running shoes", 0.08, 1.4),
        st("trail running shoes waterproof", 0.07, 1.1),
        st("free running shoes", 0.06, 0),
        st("running shoes jobs", 0.04, 0),
        st("how to clean running shoes", 0.05, 0),
        st("used running shoes", 0.04, 0.05),
        st("running shoe repair near me", 0.03, 0),
        st("running shoes pdf size chart", 0.03, 0),
        st("carbon plate running shoes", 0.07, 0.9),
        st("marathon shoes for flat feet", 0.06, 1.2),
        st("cheap running shoes", 0.06, 0.4),
        st("diy shoe stretcher", 0.03, 0),
        st("running shoes men", 0.03, 1.0),
    ],
    c3: [
        st("running shoes sale", 0.2, 1.1),
        st("trail shoes", 0.15, 1.0),
        st("acme running", 0.12, 1.4),
        st("running socks", 0.1, 0.8),
        st("running jacket women", 0.1, 0.7),
        st("free shipping running shoes", 0.08, 0.6),
        st("running shoes jobs", 0.05, 0),
        st("how to lace running shoes", 0.06, 0),
        st("gym shoes", 0.08, 0.6),
        st("velora outlet", 0.06, 0.1),
    ],
    c4: [
        st("acme cloudstride", 0.22, 1.2),
        st("trail running shoes women", 0.16, 1.1),
        st("running shoes under 100", 0.14, 1.0),
        st("running water bottle", 0.1, 0.8),
        st("running shoes kids", 0.1, 0.9),
        st("shoe laces", 0.08, 0.3),
        st("running shoes repair kit", 0.06, 0),
        st("used acme shoes", 0.07, 0.05),
        st("running socks merino", 0.07, 0.9),
    ],
    c8: [
        st("stridemax shoes", 0.28, 1.0, "added"),
        st("stridemax vs acme", 0.18, 1.4, "added"),
        st("peakpace running shoes", 0.17, 0.9, "added"),
        st("stridemax customer service", 0.1, 0),
        st("peakpace login", 0.08, 0),
        st("velora trainers", 0.1, 0.8, "added"),
        st("stridemax warranty claim", 0.05, 0),
        st("peakpace sale", 0.04, 1.1),
    ],
    t2: [
        st("hiking boots", 0.35, 1.0, "added"),
        st("waterproof hiking boots", 0.25, 1.2),
        st("hiking boots repair", 0.1, 0),
        st("free hiking boots", 0.08, 0),
        st("hiking boots women", 0.22, 1.1, "added"),
    ],
};
export const DEVICE_MIX: Record<string, Record<string, number>> = {
    Search: { Mobile: 0.6, Desktop: 0.33, Tablet: 0.07 },
    Shopping: { Mobile: 0.64, Desktop: 0.3, Tablet: 0.06 },
    PMax: { Mobile: 0.62, Desktop: 0.3, Tablet: 0.05, "Connected TV": 0.03 },
    Video: { Mobile: 0.7, Desktop: 0.1, Tablet: 0.05, "Connected TV": 0.15 },
    Display: { Mobile: 0.66, Desktop: 0.26, Tablet: 0.08 },
    "Demand Gen": { Mobile: 0.78, Desktop: 0.16, Tablet: 0.06 },
    App: { Mobile: 0.95, Tablet: 0.05 },
    Other: { Mobile: 0.6, Desktop: 0.35, Tablet: 0.05 },
};
export const DEVICE_CVR: Record<string, number> = { Mobile: 0.85, Desktop: 1.25, Tablet: 0.9, "Connected TV": 0.3, Other: 0.8 };
export const GEO_MIX: [
    country: string,
    share: number,
    cvr: number
][] = [
    ["US", 0.7, 1.0],
    ["CA", 0.08, 0.95],
    ["GB", 0.07, 0.9],
    ["AU", 0.05, 0.92],
    ["DE", 0.04, 0.8],
    ["FR", 0.03, 0.75],
    ["ZZ", 0.03, 0.6],
];
export function hourCurve(campaignType: CampaignType, weekend: boolean): number[] {
    const out: number[] = [];
    for (let h = 0; h < 24; h++) {
        const hh = weekend ? h - 1 : h;
        const night = hh < 6 ? 0.18 + hh * 0.03 : 0;
        const morning = gauss(hh, 9, 2.2) * 0.8;
        const lunch = gauss(hh, 12.5, 1.6) * 1.0;
        const evening = gauss(hh, 20, 2.1) * (campaignType === "Video" || campaignType === "Demand Gen" ? 1.5 : 1.05);
        const base = campaignType === "Display" ? 0.55 : 0.25;
        out.push(night + base + morning + lunch + evening);
    }
    return out;
}
function gauss(x: number, mu: number, sigma: number): number {
    return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
}
export interface DemoPlatformSpec {
    share: number;
    roas: number;
    cpc: number;
    ctr: number;
    aov: number;
}
export const DEMO_PLATFORMS: Record<string, DemoPlatformSpec> = {
    meta: { share: 0.62, roas: 2.9, cpc: 0.74, ctr: 0.013, aov: 94 },
    microsoft: { share: 0.14, roas: 4.1, cpc: 1.12, ctr: 0.041, aov: 108 },
    tiktok: { share: 0.3, roas: 1.9, cpc: 0.38, ctr: 0.009, aov: 82 },
    linkedin: { share: 0.18, roas: 1.4, cpc: 4.8, ctr: 0.006, aov: 160 },
    amazon: { share: 0.25, roas: 3.2, cpc: 0.92, ctr: 0.004, aov: 88 },
    pinterest: { share: 0.08, roas: 1.6, cpc: 0.56, ctr: 0.007, aov: 90 },
    snapchat: { share: 0.06, roas: 1.2, cpc: 0.44, ctr: 0.008, aov: 76 },
    reddit: { share: 0.05, roas: 1.5, cpc: 0.61, ctr: 0.005, aov: 99 },
    custom: { share: 0.2, roas: 2.2, cpc: 0.8, ctr: 0.01, aov: 100 },
};
export interface DemoIdea {
    title: string;
    type: "Search" | "PMax" | "Shopping" | "Video" | "Display" | "Demand Gen";
    audience: string;
    keywords: string[];
    rationale: string;
    daily: number;
    impact: string;
    confidence: number;
    citedCampaignIds: string[];
}
export const DEMO_IDEAS: DemoIdea[] = [
    { title: "Brand defense on competitor surge", type: "Search", audience: "Searchers combining your brand with competitor names", keywords: ["acme vs competitor", "acme reviews", "acme discount code"], rationale: "Competitor Terms CPC nearly doubled in 3 days. Defending brand SERPs costs a fraction of that and protects high-intent clicks.", daily: 120, impact: "+38 conv / mo", confidence: 82, citedCampaignIds: ["c8", "c1"] },
    { title: "Long-tail generic Search", type: "Search", audience: "Exact and phrase long-tail running queries", keywords: ["wide fit running shoes", "trail shoes women", "carbon plate trainers"], rationale: "Generic Running Shoes CPA sits above account average; long-tail terms bid cheaper with higher purchase intent.", daily: 110, impact: "CPA −18%", confidence: 77, citedCampaignIds: ["c2"] },
    { title: "Feed-only PMax for top SKUs", type: "PMax", audience: "Shopping intent, top 50 SKUs by margin", keywords: ["feed-only asset group", "margin > 40%", "top sellers"], rationale: "Shopping Best Sellers returns the strongest ROAS in the account; isolating those SKUs limits PMax spend leakage.", daily: 180, impact: "ROAS +0.6x", confidence: 74, citedCampaignIds: ["c4", "c3"] },
    { title: "Demand Gen win-back", type: "Demand Gen", audience: "Customer Match — no purchase in 90+ days", keywords: ["customer match", "win-back offer", "carousel"], rationale: "Cart Remarketing converts at 2.2%. Extending to lapsed buyers adds qualified reach ahead of the Q4 peak.", daily: 70, impact: "+22 conv / mo", confidence: 71, citedCampaignIds: ["c6"] },
    { title: "Shorts creative refresh", type: "Video", audience: "In-market: running and fitness", keywords: ["15s vertical", "product in use", "hook under 2s"], rationale: "Q4 Awareness CTR fell by half in 3 days — a creative-fatigue pattern. Vertical Shorts assets reset frequency.", daily: 90, impact: "CTR back to 0.9%", confidence: 68, citedCampaignIds: ["c5"] },
    { title: "Holiday gift-guide Shopping", type: "Shopping", audience: "Gift shoppers, November–December", keywords: ["gifts for runners", "under $100", "bundles"], rationale: "Seasonal lift starts in early November; a separate campaign protects Best Sellers budget from dilution.", daily: 150, impact: "+$18K revenue", confidence: 64, citedCampaignIds: ["c4"] },
];
export const AI_GOALS = ["Scale conversions", "Lower CPA", "Launch product", "Q4 season"] as const;
export type AiGoal = (typeof AI_GOALS)[number];
export const GOAL_PICK: Record<AiGoal, number[]> = {
    "Scale conversions": [3, 0, 1, 5, 2, 4],
    "Lower CPA": [1, 0, 2, 3, 4, 5],
    "Launch product": [2, 4, 5, 3, 1, 0],
    "Q4 season": [5, 2, 4, 3, 0, 1],
};
