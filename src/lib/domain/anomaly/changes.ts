import type { ChangeAction, ChangeCategory } from "../contracts/anomaly";
import { formatMoney } from "../metrics/registry";
import type { ChangeEvent } from "../schema/facts";
export type ChangeEventLike = Pick<ChangeEvent, "resource_type" | "operation" | "changed_fields" | "diffs" | "summary"> & Partial<Pick<ChangeEvent, "client_type">>;
export type ChangeSubject = "budget" | "target_cpa" | "target_roas" | "bid" | "strategy" | "status";
export interface ChangeClient {
    label: string;
    automated: boolean;
    by?: string;
}
export interface ParsedChange {
    category: ChangeCategory;
    action: ChangeAction;
    subject?: ChangeSubject;
    before?: string | number | null;
    after?: string | number | null;
    pct?: number;
    target?: {
        kind: "target_cpa" | "target_roas";
        before: number | null;
        after: number | null;
    };
    effect?: string;
    client: ChangeClient;
}
export const CHANGE_CATEGORY_LABEL: Record<ChangeCategory, string> = {
    bidding: "Bid strategy",
    bid_target: "Bids & targets",
    budget: "Budget",
    landing: "Landing page",
    creative: "Ads & assets",
    status: "Status",
    keywords: "Keywords",
    negatives: "Negative keywords",
    targeting: "Targeting",
    other: "Other",
};
const CLIENTS: Record<string, ChangeClient> = {
    GOOGLE_ADS_WEB_CLIENT: { label: "Google Ads web", automated: false },
    GOOGLE_ADS_EDITOR: { label: "Editor", automated: false },
    GOOGLE_ADS_MOBILE_APP: { label: "Mobile app", automated: false },
    GOOGLE_ADS_BULK_UPLOAD: { label: "Bulk upload", automated: false },
    GOOGLE_ADS_RECOMMENDATIONS: { label: "Google recommendations", automated: false },
    GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION: { label: "Google recommendations (auto-applied)", automated: true, by: "auto-applied Google recommendations" },
    GOOGLE_ADS_API: { label: "API", automated: true, by: "an API tool" },
    GOOGLE_ADS_SCRIPTS: { label: "Script", automated: true, by: "a Google Ads script" },
    GOOGLE_ADS_AUTOMATED_RULE: { label: "Automated rule", automated: true, by: "an automated rule" },
    SEARCH_ADS_360_SYNC: { label: "Search Ads 360", automated: true, by: "Search Ads 360 sync" },
    SEARCH_ADS_360_POST: { label: "Search Ads 360", automated: false },
    INTERNAL_TOOL: { label: "Google internal tool", automated: true, by: "a Google internal tool" },
    SAVD_DASHBOARD_SIMULATION: { label: "SAVD simulation", automated: false },
};
const OTHER_CLIENT: ChangeClient = { label: "Other", automated: false };
export function changeClient(clientType: string | undefined): ChangeClient {
    return (clientType && CLIENTS[clientType]) || OTHER_CLIENT;
}
const STRATEGY = /^(bidding_strategy_type|bidding_strategy|accessible_bidding_strategy)$/;
const TARGET = /(^|[._])(target_cpa|target_roas|target_cpm|target_spend|target_impression_share|cpc_bid|cpm_bid|cpv_bid|bid_modifier|enhanced_cpc)/;
const STATUS = /^(status|start_date|end_date|start_date_time|end_date_time)$|(^|[._])(pause|enable)$/;
const URL_FIELD = /(^|\.)(final_urls|final_mobile_urls|final_url_suffix|tracking_url_template|url_custom_parameters|final_app_urls)$/;
const CAMPAIGN_TARGETING = /setting|network|geo_target|frequency_cap|url_expansion|excluded_parent_asset/;
const KEYWORD = /(^|[._])keyword/;
const CRITERION_TARGETING = /audience|user_list|user_interest|custom_affinity|custom_intent|age_range|gender|income_range|parental_status|location|proximity|language|device|ad_schedule|placement|topic|mobile_app|youtube|webpage|content_label|carrier|operating_system|ip_block|listing|product|life_event|demographic|brand/;
const CREATIVE = /(^|[._])ad\.|creative|asset|headline|description|video|image|sitelink|callout|responsive/;
function fieldsOf(e: Pick<ChangeEventLike, "changed_fields" | "diffs">): string[] {
    return [...new Set([...e.changed_fields, ...e.diffs.map((d) => d.field)].map((f) => f.toLowerCase()))];
}
const handler = (fields: readonly string[], re: RegExp) => fields.some((f) => re.test(f));
const only = (fields: readonly string[], re: RegExp) => fields.length > 0 && fields.every((f) => re.test(f));
function isNegative(e: Pick<ChangeEventLike, "diffs" | "summary">, fields: readonly string[]): boolean {
    const flag = e.diffs.find((d) => d.field === "negative");
    if (flag)
        return flag.after === "true";
    return handler(fields, /negative/) || /\bnegative\b/i.test(e.summary);
}
export function changeCategory(e: Pick<ChangeEventLike, "resource_type" | "operation" | "changed_fields" | "diffs" | "summary">): ChangeCategory {
    const f = fieldsOf(e);
    switch (e.resource_type) {
        case "CAMPAIGN_BUDGET":
            return "budget";
        case "CAMPAIGN":
            if (handler(f, STRATEGY))
                return "bidding";
            if (handler(f, TARGET))
                return "bid_target";
            if (handler(f, /^campaign_budget$/))
                return "budget";
            if (handler(f, STATUS) || e.operation !== "update")
                return "status";
            if (handler(f, URL_FIELD))
                return "landing";
            if (handler(f, CAMPAIGN_TARGETING))
                return "targeting";
            return "other";
        case "AD_GROUP":
            if (handler(f, STRATEGY))
                return "bidding";
            if (handler(f, TARGET))
                return "bid_target";
            if (handler(f, STATUS) || e.operation !== "update")
                return "status";
            if (handler(f, URL_FIELD))
                return "landing";
            if (handler(f, /targeting_setting|audience_setting/))
                return "targeting";
            return "other";
        case "AD_GROUP_AD":
            return only(f, URL_FIELD) ? "landing" : "creative";
        case "ASSET":
            return only(f, URL_FIELD) ? "landing" : "creative";
        case "AD_GROUP_CRITERION":
        case "CAMPAIGN_CRITERION": {
            const keyword = handler(f, KEYWORD) || /keyword/i.test(e.summary);
            if (keyword) {
                if (e.resource_type === "CAMPAIGN_CRITERION" || isNegative(e, f))
                    return "negatives";
                if (only(f, URL_FIELD))
                    return "landing";
                if (handler(f, TARGET) && !handler(f, /^keyword\./))
                    return "bid_target";
                return "keywords";
            }
            if (only(f, /(^|[._])bid_modifier$/))
                return "bid_target";
            return "targeting";
        }
        default:
            if (handler(f, STRATEGY))
                return "bidding";
            if (handler(f, TARGET))
                return "bid_target";
            if (handler(f, /budget|(^|\.)amount/))
                return "budget";
            if (handler(f, URL_FIELD))
                return "landing";
            if (handler(f, KEYWORD))
                return isNegative(e, f) ? "negatives" : "keywords";
            if (handler(f, CREATIVE))
                return "creative";
            if (handler(f, CRITERION_TARGETING))
                return "targeting";
            if (handler(f, STATUS))
                return "status";
            return "other";
    }
}
const STRATEGY_LABEL: Record<string, string> = {
    TARGET_CPA: "Target CPA",
    TARGET_ROAS: "Target ROAS",
    MAXIMIZE_CONVERSIONS: "Maximize conversions",
    MAXIMIZE_CONVERSION_VALUE: "Maximize conversion value",
    TARGET_SPEND: "Maximize clicks",
    MAXIMIZE_CLICKS: "Maximize clicks",
    MANUAL_CPC: "Manual CPC",
    ENHANCED_CPC: "Enhanced CPC",
    TARGET_IMPRESSION_SHARE: "Target impression share",
    MANUAL_CPM: "Manual CPM",
    TARGET_CPM: "Target CPM",
    MANUAL_CPV: "Manual CPV",
    TARGET_CPV: "Target CPV",
    COMMISSION: "Commission",
    PERCENT_CPC: "Percent CPC",
};
const humanize = (v: string) => {
    const s = v.replace(/[._]+/g, " ").trim().toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : v;
};
export const strategyLabel = (v: string): string => STRATEGY_LABEL[v] ?? humanize(v);
export const MAXIMIZE_STRATEGIES: ReadonlySet<string> = new Set(["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_SPEND", "MAXIMIZE_CLICKS"]);
const num = (v: unknown): number | null => {
    if (typeof v === "number")
        return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
        return Number(v);
    return null;
};
const signed = (pct: number) => `${pct >= 0 ? "+" : "−"}${Math.round(Math.abs(pct) * 100)}%`;
const roasText = (v: number) => `${Math.round(v * 100)}%`;
const modifierText = (v: number) => signed(v - 1);
type Diff = ChangeEvent["diffs"][number];
const diffOf = (e: Pick<ChangeEventLike, "diffs">, re: RegExp): Diff | undefined => e.diffs.find((d) => re.test(d.field.toLowerCase()));
const TARGET_CPA_DIFF = /(^|\.)target_cpa$/;
const TARGET_ROAS_DIFF = /(^|\.)target_roas$/;
function moved(subject: ChangeSubject, d: Diff, label: string, fmt: (v: number) => string): Omit<ParsedChange, "category" | "client"> {
    const before = num(d.before);
    const after = num(d.after);
    if (before === null || after === null || before <= 0) {
        return { action: "updated", subject, before: d.before, after: d.after, effect: after !== null ? `${label} set to ${fmt(after)}` : `${label} changed` };
    }
    const pct = after / before - 1;
    return { action: pct > 0 ? "raised" : pct < 0 ? "lowered" : "updated", subject, before, after, pct, effect: `${label} ${signed(pct)} (${fmt(before)} → ${fmt(after)})` };
}
function strategyTarget(e: Pick<ChangeEventLike, "diffs">): ParsedChange["target"] {
    for (const [kind, re] of [["target_cpa", TARGET_CPA_DIFF], ["target_roas", TARGET_ROAS_DIFF]] as const) {
        const diffs = e.diffs.filter((d) => re.test(d.field.toLowerCase()));
        if (!diffs.length)
            continue;
        const before = diffs.map((d) => num(d.before)).find((v) => v !== null) ?? null;
        const after = diffs.map((d) => num(d.after)).find((v) => v !== null) ?? null;
        return { kind, before, after };
    }
    return undefined;
}
export function strategyText(strategy: string, target: number | null | undefined, kind: "target_cpa" | "target_roas" | undefined, currency: string): string {
    const label = strategyLabel(strategy);
    if (target === null || target === undefined || !kind)
        return label;
    return `${label} (${kind === "target_cpa" ? formatMoney(target, { currency, compact: false }) : roasText(target)})`;
}
export function parseChange(e: ChangeEventLike, currency = "USD"): ParsedChange {
    const category = changeCategory(e);
    const client = changeClient(e.client_type);
    const money = (v: number) => formatMoney(v, { currency, compact: false });
    const done = (p: Omit<ParsedChange, "category" | "client">): ParsedChange => ({ category, client, ...p });
    if (category === "bidding") {
        const d = diffOf(e, /^bidding_strategy_type$/);
        const target = strategyTarget(e);
        const selected = typeof d?.before === "string" ? strategyText(d.before, target?.before, target?.kind, currency) : null;
        const to = typeof d?.after === "string" ? strategyText(d.after, target?.after, target?.kind, currency) : null;
        return done({ action: "switched", subject: "strategy", before: d?.before ?? null, after: d?.after ?? null, ...(target ? { target } : {}), effect: selected && to ? `${selected} → ${to}` : to ? `Bid strategy → ${to}` : "Bid strategy changed" });
    }
    const budget = category === "budget" ? diffOf(e, /^(amount|total_amount)$/) : undefined;
    if (budget)
        return done(moved("budget", budget, "Budget", money));
    if (category === "bid_target") {
        const cpa = diffOf(e, TARGET_CPA_DIFF);
        if (cpa)
            return done(moved("target_cpa", cpa, "Target CPA", money));
        const roas = diffOf(e, TARGET_ROAS_DIFF);
        if (roas)
            return done(moved("target_roas", roas, "Target ROAS", roasText));
        const bid = diffOf(e, /(^|\.)(cpc_bid|cpm_bid|cpv_bid)$/);
        if (bid)
            return done(moved("bid", bid, "Bid", money));
        const modifier = diffOf(e, /(^|\.)bid_modifier$/);
        if (modifier)
            return done(moved("bid", modifier, "Bid adjustment", modifierText));
    }
    const status = diffOf(e, /^status$/);
    if (status && typeof status.after === "string" && e.operation !== "create") {
        const s = status.after.toUpperCase();
        const action: ChangeAction = s === "PAUSED" ? "paused" : s === "ENABLED" ? "enabled" : s === "REMOVED" ? "removed" : "updated";
        return done({ action, subject: "status", before: status.before, after: status.after, ...(action !== "updated" ? { effect: action.charAt(0).toUpperCase() + action.slice(1) } : {}) });
    }
    if (e.operation === "create")
        return done({ action: "added", effect: "Added" });
    if (e.operation === "remove")
        return done({ action: "removed", effect: "Removed" });
    return done({ action: "updated", ...(category === "landing" ? { effect: "Final URL changed" } : {}) });
}
