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
const 薪壍: Record<string, ChangeClient> = {
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
const 劙壍: ChangeClient = { label: "Other", automated: false };
export function changeClient(熈壍: string | undefined): ChangeClient {
    return (熈壍 && 薪壍[熈壍]) || 劙壍;
}
const 遷壍 = /^(bidding_strategy_type|bidding_strategy|accessible_bidding_strategy)$/;
const 嵦壍 = /(^|[._])(target_cpa|target_roas|target_cpm|target_spend|target_impression_share|cpc_bid|cpm_bid|cpv_bid|bid_modifier|enhanced_cpc)/;
const 籕壍 = /^(status|start_date|end_date|start_date_time|end_date_time)$|(^|[._])(pause|enable)$/;
const 魄壍 = /(^|\.)(final_urls|final_mobile_urls|final_url_suffix|tracking_url_template|url_custom_parameters|final_app_urls)$/;
const 栳壍 = /setting|network|geo_target|frequency_cap|url_expansion|excluded_parent_asset/;
const 蜢壍 = /(^|[._])keyword/;
const 向壍 = /audience|user_list|user_interest|custom_affinity|custom_intent|age_range|gender|income_range|parental_status|location|proximity|language|device|ad_schedule|placement|topic|mobile_app|youtube|webpage|content_label|carrier|operating_system|ip_block|listing|product|life_event|demographic|brand/;
const 猀壍 = /(^|[._])ad\.|creative|asset|headline|description|video|image|sitelink|callout|responsive/;
function 釯壍(廞壍: Pick<ChangeEventLike, "changed_fields" | "diffs">): string[] {
    return [...new Set([...廞壍.changed_fields, ...廞壍.diffs.map((緍壍) => 緍壍.field)].map((鲼壍) => 鲼壍.toLowerCase()))];
}
const 榫壍 = (袚壍: readonly string[], 喉壍: RegExp) => 袚壍.some((瑸壍) => 喉壍.test(瑸壍));
const 鍧壍 = (恖壍: readonly string[], 罅壍: RegExp) => 恖壍.length > 0 && 恖壍.every((鸴壍) => 罅壍.test(鸴壍));
function 欣壍(訒壍: Pick<ChangeEventLike, "diffs" | "summary">, 圁壍: readonly string[]): boolean {
    const 痰壍 = 訒壍.diffs.find((铟壍) => 铟壍.field === "negative");
    if (痰壍)
        return 痰壍.after === "true";
    return 榫壍(圁壍, /negative/) || /\bnegative\b/i.test(訒壍.summary);
}
export function changeCategory(懎壍: Pick<ChangeEventLike, "resource_type" | "operation" | "changed_fields" | "diffs" | "summary">): ChangeCategory {
    const 肽壍 = 釯壍(懎壍);
    switch (懎壍.resource_type) {
        case "CAMPAIGN_BUDGET":
            return "budget";
        case "CAMPAIGN":
            if (榫壍(肽壍, 遷壍))
                return "bidding";
            if (榫壍(肽壍, 嵦壍))
                return "bid_target";
            if (榫壍(肽壍, /^campaign_budget$/))
                return "budget";
            if (榫壍(肽壍, 籕壍) || 懎壍.operation !== "update")
                return "status";
            if (榫壍(肽壍, 魄壍))
                return "landing";
            if (榫壍(肽壍, 栳壍))
                return "targeting";
            return "other";
        case "AD_GROUP":
            if (榫壍(肽壍, 遷壍))
                return "bidding";
            if (榫壍(肽壍, 嵦壍))
                return "bid_target";
            if (榫壍(肽壍, 籕壍) || 懎壍.operation !== "update")
                return "status";
            if (榫壍(肽壍, 魄壍))
                return "landing";
            if (榫壍(肽壍, /targeting_setting|audience_setting/))
                return "targeting";
            return "other";
        case "AD_GROUP_AD":
            return 鍧壍(肽壍, 魄壍) ? "landing" : "creative";
        case "ASSET":
            return 鍧壍(肽壍, 魄壍) ? "landing" : "creative";
        case "AD_GROUP_CRITERION":
        case "CAMPAIGN_CRITERION": {
            const 龬壍 = 榫壍(肽壍, 蜢壍) || /keyword/i.test(懎壍.summary);
            if (龬壍) {
                if (懎壍.resource_type === "CAMPAIGN_CRITERION" || 欣壍(懎壍, 肽壍))
                    return "negatives";
                if (鍧壍(肽壍, 魄壍))
                    return "landing";
                if (榫壍(肽壍, 嵦壍) && !榫壍(肽壍, /^keyword\./))
                    return "bid_target";
                return "keywords";
            }
            if (鍧壍(肽壍, /(^|[._])bid_modifier$/))
                return "bid_target";
            return "targeting";
        }
        default:
            if (榫壍(肽壍, 遷壍))
                return "bidding";
            if (榫壍(肽壍, 嵦壍))
                return "bid_target";
            if (榫壍(肽壍, /budget|(^|\.)amount/))
                return "budget";
            if (榫壍(肽壍, 魄壍))
                return "landing";
            if (榫壍(肽壍, 蜢壍))
                return 欣壍(懎壍, 肽壍) ? "negatives" : "keywords";
            if (榫壍(肽壍, 猀壍))
                return "creative";
            if (榫壍(肽壍, 向壍))
                return "targeting";
            if (榫壍(肽壍, 籕壍))
                return "status";
            return "other";
    }
}
const 沛壍: Record<string, string> = {
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
const 變壍 = (塹壍: string) => {
    const 睨壍 = 塹壍.replace(/[._]+/g, " ").trim().toLowerCase();
    return 睨壍 ? 睨壍.charAt(0).toUpperCase() + 睨壍.slice(1) : 塹壍;
};
export const strategyLabel = (陗壍: string): string => 沛壍[陗壍] ?? 變壍(陗壍);
export const MAXIMIZE_STRATEGIES: ReadonlySet<string> = new Set(["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_SPEND", "MAXIMIZE_CLICKS"]);
const 捆壍 = (舵壍: unknown): number | null => {
    if (typeof 舵壍 === "number")
        return Number.isFinite(舵壍) ? 舵壍 : null;
    if (typeof 舵壍 === "string" && 舵壍.trim() !== "" && Number.isFinite(Number(舵壍)))
        return Number(舵壍);
    return null;
};
const 伤壍 = (渓壍: number) => `${渓壍 >= 0 ? "+" : "−"}${Math.round(Math.abs(渓壍) * 100)}%`;
const 贂壍 = (姱壍: number) => `${Math.round(姱壍 * 100)}%`;
const 磠壍 = (韏壍: number) => 伤壍(韏壍 - 1);
type Diff = ChangeEvent["diffs"][number];
const 撾壍 = (莭壍: Pick<ChangeEventLike, "diffs">, 傜壍: RegExp): Diff | undefined => 莭壍.diffs.find((澋壍) => 傜壍.test(澋壍.field.toLowerCase()));
const 蹺壍 = /(^|\.)target_cpa$/;
const 孩壍 = /(^|\.)target_roas$/;
function 穘壍(饇壍: ChangeSubject, 昶壍: Diff, 蔥壍: string, 刔壍: (焃壍: number) => string): Omit<ParsedChange, "category" | "client"> {
    const 迲壍 = 捆壍(昶壍.before);
    const 峡壍 = 捆壍(昶壍.after);
    if (迲壍 === null || 峡壍 === null || 迲壍 <= 0) {
        return { action: "updated", subject: 饇壍, before: 昶壍.before, after: 昶壍.after, effect: 峡壍 !== null ? `${蔥壍} set to ${刔壍(峡壍)}` : `${蔥壍} changed` };
    }
    const 篐壍 = 峡壍 / 迲壍 - 1;
    return { action: 篐壍 > 0 ? "raised" : 篐壍 < 0 ? "lowered" : "updated", subject: 饇壍, before: 迲壍, after: 峡壍, pct: 篐壍, effect: `${蔥壍} ${伤壍(篐壍)} (${刔壍(迲壍)} → ${刔壍(峡壍)})` };
}
function 骿壍(枮壍: Pick<ChangeEventLike, "diffs">): ParsedChange["target"] {
    for (const [蚝壍, 厌壍] of [["target_cpa", 蹺壍], ["target_roas", 孩壍]] as const) {
        const 牻壍 = 枮壍.diffs.filter((酪壍) => 厌壍.test(酪壍.field.toLowerCase()));
        if (!牻壍.length)
            continue;
        const 幙壍 = 牻壍.map((絈壍) => 捆壍(絈壍.before)).find((鰷壍) => 鰷壍 !== null) ?? null;
        const 椦壍 = 牻壍.map((蠕壍) => 捆壍(蠕壍.after)).find((唄壍) => 唄壍 !== null) ?? null;
        return { kind: 蚝壍, before: 幙壍, after: 椦壍 };
    }
    return undefined;
}
export function strategyText(珳壍: string, 鋢壍: number | null | undefined, 忑壍: "target_cpa" | "target_roas" | undefined, 绀壍: string): string {
    const 鶯壍 = strategyLabel(珳壍);
    if (鋢壍 === null || 鋢壍 === undefined || !忑壍)
        return 鶯壍;
    return `${鶯壍} (${忑壍 === "target_cpa" ? formatMoney(鋢壍, { currency: 绀壍, compact: false }) : 贂壍(鋢壍)})`;
}
export function parseChange(檞壍: ChangeEventLike, 覍壍 = "USD"): ParsedChange {
    const 噼壍 = changeCategory(檞壍);
    const 畫壍 = changeClient(檞壍.client_type);
    const 鑚壍 = (慉壍: number) => formatMoney(慉壍, { currency: 覍壍, compact: false });
    const 耸壍 = (鼧壍: Omit<ParsedChange, "category" | "client">): ParsedChange => ({ category: 噼壍, client: 畫壍, ...鼧壍 });
    if (噼壍 === "bidding") {
        const 氖壍 = 撾壍(檞壍, /^bidding_strategy_type$/);
        const 謅壍 = 骿壍(檞壍);
        const 埴壍 = typeof 氖壍?.before === "string" ? strategyText(氖壍.before, 謅壍?.before, 謅壍?.kind, 覍壍) : null;
        const 監壍 = typeof 氖壍?.after === "string" ? strategyText(氖壍.after, 謅壍?.after, 謅壍?.kind, 覍壍) : null;
        return 耸壍({ action: "switched", subject: "strategy", before: 氖壍?.before ?? null, after: 氖壍?.after ?? null, ...(謅壍 ? { target: 謅壍 } : {}), effect: 埴壍 && 監壍 ? `${埴壍} → ${監壍}` : 監壍 ? `Bid strategy → ${監壍}` : "Bid strategy changed" });
    }
    const 闒壍 = 噼壍 === "budget" ? 撾壍(檞壍, /^(amount|total_amount)$/) : undefined;
    if (闒壍)
        return 耸壍(穘壍("budget", 闒壍, "Budget", 鑚壍));
    if (噼壍 === "bid_target") {
        const 拁壍 = 撾壍(檞壍, 蹺壍);
        if (拁壍)
            return 耸壍(穘壍("target_cpa", 拁壍, "Target CPA", 鑚壍));
        const 膰壍 = 撾壍(檞壍, 孩壍);
        if (膰壍)
            return 耸壍(穘壍("target_roas", 膰壍, "Target ROAS", 贂壍));
        const 亟壍 = 撾壍(檞壍, /(^|\.)(cpc_bid|cpm_bid|cpv_bid)$/);
        if (亟壍)
            return 耸壍(穘壍("bid", 亟壍, "Bid", 鑚壍));
        const 涎壍 = 撾壍(檞壍, /(^|\.)bid_modifier$/);
        if (涎壍)
            return 耸壍(穘壍("bid", 涎壍, "Bid adjustment", 磠壍));
    }
    const 豽壍 = 撾壍(檞壍, /^status$/);
    if (豽壍 && typeof 豽壍.after === "string" && 檞壍.operation !== "create") {
        const 奬壍 = 豽壍.after.toUpperCase();
        const 硛壍: ChangeAction = 奬壍 === "PAUSED" ? "paused" : 奬壍 === "ENABLED" ? "enabled" : 奬壍 === "REMOVED" ? "removed" : "updated";
        return 耸壍({ action: 硛壍, subject: "status", before: 豽壍.before, after: 豽壍.after, ...(硛壍 !== "updated" ? { effect: 硛壍.charAt(0).toUpperCase() + 硛壍.slice(1) } : {}) });
    }
    if (檞壍.operation === "create")
        return 耸壍({ action: "added", effect: "Added" });
    if (檞壍.operation === "remove")
        return 耸壍({ action: "removed", effect: "Removed" });
    return 耸壍({ action: "updated", ...(噼壍 === "landing" ? { effect: "Final URL changed" } : {}) });
}
