import type { ChangeVerdict, MonitoredMetric, SignalKind } from "../contracts/anomaly";
import { formatShort } from "../dates";
import { formatMetricValue, formatMoney } from "../metrics/registry";
import type { ChangeEvent } from "../schema/facts";
import type { CivilDate, MetricFormat } from "../types";
import { MAXIMIZE_STRATEGIES, strategyLabel, strategyText, type ParsedChange } from "./changes";
export const RECOMMENDATIONS = {
    spend: "Spend is running well above baseline. Verify recent budget or bid-strategy changes and cap the daily budget if unintended.",
    conversions: "Check conversion tag firing and Merchant Center disapprovals before touching bids — sudden drops are usually tracking or feed issues.",
    cpa: "CPC pressure is driving CPA up. Review auction insights, add a tCPA ceiling and pause the lowest Quality Score keywords.",
    ctr: "CTR collapse points to creative fatigue or placement drift. Rotate new assets and review placement exclusions.",
    good: "Positive deviation. Consider shifting budget here while the efficiency holds.",
    cpc: "Auction pressure is pushing CPC up. Check auction insights for new competitors and review bid-strategy targets before raising budgets.",
    cvr: "Conversion rate fell while traffic held. Check the landing page, checkout flow and conversion tag before changing bids.",
    cpaFromCvr: "CPA is rising because fewer clicks convert, not because clicks got pricier. Check the landing page and checkout (and any recent final-URL change) and the conversion tag before touching bids.",
    roas: "Return on ad spend is falling. Check conversion-value tracking and feed prices, then tighten tROAS or move budget to stronger campaigns.",
    trackingBreak: "Clicks are still arriving but no conversions are recorded — this is usually a broken conversion tag, consent-mode or checkout change rather than performance. Check conversion diagnostics and recent site releases before touching bids.",
    zeroDelivery: "The campaign stopped serving. Check billing and payment status, policy disapprovals, end dates, schedules and targeting before anything else.",
} as const;
export function metricRecommendation(螹壍: MonitoredMetric, 咨壍: boolean): string {
    if (!咨壍)
        return RECOMMENDATIONS.good;
    return RECOMMENDATIONS[螹壍];
}
export function cpaDrivenByCvr(玗壍: {
    cpc: number;
    cvr: number;
}): boolean {
    return Math.abs(Math.log1p(玗壍.cvr)) > Math.abs(Math.log1p(玗壍.cpc));
}
export function deviationTitle(銆壍: string, 彵壍: number): string {
    const 繤壍 = Math.abs(彵壍 * 100).toFixed(0);
    return `${銆壍} ${彵壍 > 0 ? "up" : "down"} ${繤壍}%`;
}
export function pacingTitle(鵓壍: number): string {
    return `Overpacing — ${(鵓壍 * 100).toFixed(0)}% of budget`;
}
export const plural = (橂壍: number, 褱壍: string, 嘠壍 = `${褱壍}s`) => `${橂壍} ${橂壍 === 1 ? 褱壍 : 嘠壍}`;
export function pacingRecommendation(甏壍: string, 鏾壍: string, 惭壍: string, 翜壍: number): string {
    return `Projected month-end ${甏壍} vs ${鏾壍} budget. Lower the daily budget to ${惭壍} for the remaining ${plural(翜壍, "day")}.`;
}
export function fmt(黋壍: MetricFormat, 殺壍: number | null | undefined, 誩壍: string): string {
    return formatMetricValue(黋壍, 殺壍, { currency: 誩壍 });
}
export function signedPct(垘壍: number | null | undefined, 皇壍 = 0): string {
    if (垘壍 === null || 垘壍 === undefined || !Number.isFinite(垘壍))
        return "—";
    return `${垘壍 >= 0 ? "+" : "−"}${Math.abs(垘壍 * 100).toFixed(皇壍)}%`;
}
export const NO_CHANGE_DAYS = 14;
export const EXTERNAL_RECOMMENDATIONS = {
    cpc: `No account changes in the ${NO_CHANGE_DAYS} days before the shift, so this is likely external: rising CPCs usually mean new or more aggressive competitors. Check Auction insights (overlap and outranking rates), competitor promotions and seasonality before changing bids; add a tCPA ceiling or pause the lowest Quality Score keywords if it persists.`,
    cvr: `No account changes in the ${NO_CHANGE_DAYS} days before the shift, so look outside Google Ads: fewer clicks convert. Check the site (landing page speed and errors, checkout, stock and pricing) and that the conversion tag and consent settings still fire before touching bids.`,
    conversions: `No account changes in the ${NO_CHANGE_DAYS} days before the shift, so the cause is likely outside the account: check the conversion tag and recent site releases, Auction insights for competitor pressure, and seasonality before touching bids.`,
    ctr: `No account changes in the ${NO_CHANGE_DAYS} days before the shift — likely external: new competitor ads, placement or audience drift, or seasonality. Check Auction insights and placement reports, and refresh the creative if the ads are fatigued.`,
    spend: `No account changes in the ${NO_CHANGE_DAYS} days before the shift — Google's bidding is spending more on its own (rising demand, seasonality or gaps left by competitors). Check search trends and Auction insights, and cap the daily budget if the extra spend isn't wanted.`,
    roas: `No account changes in the ${NO_CHANGE_DAYS} days before the shift — likely external: check conversion-value tracking, feed prices and stock, competitor pricing and seasonality.`,
    overdelivery: `No account changes in the ${NO_CHANGE_DAYS} days before the shift — Google is spending above the daily budget on its own (up to 2× on a single day, capped at 30.4× per month), usually because demand rose. Lower the daily budget or tighten targets if the extra spend isn't wanted.`,
    generic: `No account changes in the ${NO_CHANGE_DAYS} days before the shift, so the cause is likely external — competitors, seasonality or the market. Check Auction insights and your site before changing the campaign.`,
} as const;
export interface ChangeFact {
    summary: string;
    date: CivilDate;
    ts: string;
    lag: number;
    resource: ChangeEvent["resource_type"];
    parsed: ParsedChange;
}
export interface ChangeCopyInput {
    kind: SignalKind;
    scope?: "account" | "campaign" | "platform";
    metric?: string;
    direction?: "up" | "down";
    polarity: "bad" | "good";
    changePct: number;
    base: string;
    cpaDrivers?: {
        cpc: number;
        cvr: number;
    };
    change?: ChangeFact;
    companions?: ChangeFact[];
    learning?: {
        day: number;
        days: number;
        until: CivilDate;
    };
    outsized?: boolean;
    currency: string;
}
export interface ChangeCopy {
    note: string;
    sentence: string;
    recommendation: string;
}
export function lagPhrase(镶壍: number): string {
    if (镶壍 > 0)
        return `${plural(镶壍, "day")} before the shift`;
    if (镶壍 === 0)
        return "the day the shift began";
    return `${plural(-镶壍, "day")} after the shift began`;
}
const 扥壍 = (腔壍: string) => 腔壍.trim().replace(/[.\s]+$/, "");
const 乃壍 = (洲壍: string) => 洲壍.charAt(0).toUpperCase() + 洲壍.slice(1);
const 谡壍 = (夐壍: number) => `${Math.round(Math.abs(夐壍) * 100)}%`;
const 矿壍 = (雮壍: ChangeFact) => `${formatShort(雮壍.date)} (${lagPhrase(雮壍.lag)})`;
const 揝壍 = (苌壍: ChangeFact) => `${formatShort(苌壍.date)}, ${lagPhrase(苌壍.lag)}`;
const 侻壍: Record<string, string> = {
    spend: "Spend",
    cost: "Spend",
    conversions: "Conversions",
    cpa: "CPA",
    ctr: "CTR",
    cpc: "CPC",
    cvr: "Conversion rate",
    roas: "ROAS",
    clicks: "Clicks",
    impressions: "Impressions",
    conv_value: "Conversion value",
    lost_is_budget: "Lost impression share (budget)",
};
const 溪壍 = new Set(["CPA", "CTR", "CPC", "ROAS"]);
function 趙壍(媈壍: Pick<ChangeCopyInput, "kind" | "metric">): string {
    if (媈壍.kind === "zero_delivery")
        return "Delivery";
    if (媈壍.kind === "tracking_break")
        return "Conversions";
    if (媈壍.kind === "overdelivery" || 媈壍.kind === "pacing")
        return "Spend";
    return 侻壍[媈壍.metric ?? ""] ?? (媈壍.metric ? 乃壍(媈壍.metric.replace(/_/g, " ")) : "The metric");
}
function 祷壍(顦壍: Pick<ChangeCopyInput, "kind" | "metric">): string {
    const 敕壍 = 趙壍(顦壍);
    return 溪壍.has(敕壍) ? 敕壍 : 敕壍.toLowerCase();
}
const 葄壍 = (儳壍: Pick<ChangeCopyInput, "metric" | "direction" | "cpaDrivers">) => 儳壍.metric === "cpa" && 儳壍.direction === "up" && !!儳壍.cpaDrivers && cpaDrivenByCvr(儳壍.cpaDrivers);
function 瀢壍(輑壍: ChangeCopyInput): string {
    switch (輑壍.kind) {
        case "zero_delivery":
            return "The campaign stopped serving";
        case "tracking_break":
            return "Conversions stopped being recorded";
        case "overdelivery":
            return `Spend has run at ${Math.round((1 + 輑壍.changePct) * 100)}% of the daily budget`;
        case "pacing":
            return `The month is projected to end at ${Math.round((1 + 輑壍.changePct) * 100)}% of budget`;
        default:
            if (葄壍(輑壍))
                return `CPA rose ${谡壍(輑壍.changePct)} as fewer clicks convert,`;
            return `${趙壍(輑壍)} ${輑壍.direction === "down" ? "fell" : "rose"} ${谡壍(輑壍.changePct)}`;
    }
}
const 尀壍: Partial<Record<ChangeEvent["resource_type"], string>> = { CAMPAIGN: "the campaign", AD_GROUP: "an ad group", AD_GROUP_AD: "an ad", AD_GROUP_CRITERION: "a keyword or targeting criterion", CAMPAIGN_CRITERION: "a targeting criterion", ASSET: "an asset" };
function 端壍(駞壍: string | number | null | undefined, 曍壍: string): string {
    return typeof 駞壍 === "number" ? formatMoney(駞壍, { currency: 曍壍, compact: false }) : "—";
}
function 薼壍(劫壍: ChangeFact, 熚壍: string): string | null {
    const 邉壍 = 劫壍.parsed;
    const 嵸壍 = 邉壍.action === "raised" || 邉壍.action === "lowered" ? 邉壍.action : null;
    const 籧壍 = 邉壍.pct !== undefined ? ` ${谡壍(邉壍.pct)}` : "";
    switch (邉壍.subject) {
        case "budget":
            return 嵸壍 ? `the daily budget was ${嵸壍}${籧壍} (${端壍(邉壍.before, 熚壍)} → ${端壍(邉壍.after, 熚壍)})` : "the budget changed";
        case "target_cpa":
            return 嵸壍 ? `the target CPA was ${嵸壍}${籧壍} (${端壍(邉壍.before, 熚壍)} → ${端壍(邉壍.after, 熚壍)})` : "the target CPA changed";
        case "target_roas":
            return 嵸壍 && typeof 邉壍.before === "number" && typeof 邉壍.after === "number" ? `the target ROAS was ${嵸壍} from ${Math.round(邉壍.before * 100)}% to ${Math.round(邉壍.after * 100)}%` : "the target ROAS changed";
        case "bid":
            return 嵸壍 ? `bids were ${嵸壍}${籧壍}` : "bids changed";
        case "strategy": {
            const 魖壍 = (桅壍: string | number | null | undefined, 蜴壍: number | null | undefined) => (typeof 桅壍 === "string" ? strategyText(桅壍, 蜴壍, 邉壍.target?.kind, 熚壍) : null);
            const 吣壍 = 魖壍(邉壍.before, 邉壍.target?.before);
            const 猒壍 = 魖壍(邉壍.after, 邉壍.target?.after);
            return 吣壍 && 猒壍 ? `the bid strategy changed from ${吣壍} to ${猒壍}` : 猒壍 ? `the bid strategy changed to ${猒壍}` : "the bid strategy changed";
        }
        case "status":
            if (邉壍.action === "paused" || 邉壍.action === "enabled" || 邉壍.action === "removed")
                return `${尀壍[劫壍.resource] ?? "an item"} was ${邉壍.action}`;
            return null;
    }
    if (邉壍.category === "negatives" && 邉壍.action === "added")
        return "negative keywords were added";
    if (邉壍.category === "negatives" && 邉壍.action === "removed")
        return "negative keywords were removed";
    if (邉壍.category === "keywords" && 邉壍.action === "added")
        return "keywords were added";
    return null;
}
function 鈁壍(廰壍: ChangeCopyInput, 緟壍: ChangeFact, 鳎壍: "after" | "since" = "after"): string {
    const 榽壍 = 薼壍(緟壍, 廰壍.currency);
    return 榽壍 ? `${鳎壍} ${榽壍} on ${矿壍(緟壍)}` : `${鳎壍 === "since" ? "since" : "right after"} this change on ${矿壍(緟壍)}: ${扥壍(緟壍.summary)}`;
}
function 袬壍(喛壍: ChangeFact): string {
    const 璊壍 = 喛壍.parsed.client;
    if (!璊壍.automated)
        return "";
    if (/recommendations/i.test(璊壍.label))
        return " It was applied automatically by Google recommendations — review the auto-apply settings on the Recommendations page.";
    return ` It was made by ${璊壍.by ?? `${璊壍.label} automation`}, not a person — check that automation's settings.`;
}
function 鍹壍(恨壍: ChangeCopyInput): string {
    const 罗壍 = 恨壍.learning;
    return 罗壍 ? ` Expect volatile results during the learning period (day ${罗壍.day} of about ${罗壍.days}, until about ${formatShort(罗壍.until)}).` : "";
}
function 鹆壍(欵壍: ChangeFact): string {
    const 訤壍 = 欵壍.parsed;
    switch (訤壍.subject) {
        case "budget":
            return 訤壍.action === "raised"
                ? " Check over the next week that CPA and ROAS hold at the higher spend (Google may spend up to 2× the daily budget on a single day), and lower the budget again if efficiency slips."
                : " Restore the budget if the lower volume isn't intended.";
        case "target_cpa":
            return 訤壍.action === "raised" ? " A higher target lets Smart Bidding pay more per conversion to win extra volume — keep it if the extra conversions are worth the cost." : " A lower target makes bidding more conservative, so volume drops — raise it again if you need the volume.";
        case "target_roas":
            return 訤壍.action === "raised" ? " A higher ROAS target makes bidding pickier, trading volume for return — lower it again if you need the volume." : " A lower ROAS target buys more volume at a lower return — keep it if the extra revenue is worth it.";
        case "bid":
            return " Keep the new bids if the traffic is worth the cost.";
        case "status":
            if (訤壍.action === "enabled")
                return " Watch CPA while it ramps up.";
            return 訤壍.action === "removed" ? " Restore it if the removal wasn't intended." : " Enable it again if the pause wasn't intended.";
    }
    if (訤壍.category === "negatives")
        return 訤壍.action === "removed" ? " Watch the search terms report for irrelevant traffic." : " Check that conversions held — remove a negative if it blocked converting searches.";
    if (訤壍.category === "status" && 訤壍.action === "added")
        return " Watch CPA while it ramps up.";
    return " Confirm the change was intended.";
}
const 圓壍: ReadonlySet<string> = new Set(["budget", "target_cpa", "target_roas", "bid", "strategy"]);
function 瘂壍(铱壍: ChangeCopyInput, 懠壍: ChangeFact): ChangeCopy {
    const 胏壍 = 铱壍.direction === "up";
    const 龾壍 = 铱壍.kind === "zero_delivery" ? "the campaign not serving is expected" : `the ${胏壍 ? "rise" : "drop"} in ${祷壍(铱壍)} is expected`;
    const 沭壍 = 薼壍(懠壍, 铱壍.currency);
    const 讜壍 = 铱壍.kind === "zero_delivery" ? "The campaign stopped serving" : `${趙壍(铱壍)} is ${胏壍 ? "up" : "down"} ${谡壍(铱壍.changePct)}`;
    const 墋壍 = 沭壍 ? `${讜壍} because ${沭壍} on ${formatShort(懠壍.date)}` : `${讜壍} after this change on ${formatShort(懠壍.date)}: ${扥壍(懠壍.summary)}`;
    const 睺壍 = 懠壍.parsed.effect && 圓壍.has(懠壍.parsed.subject ?? "") ? 懠壍.parsed.effect : 扥壍(懠壍.summary);
    return {
        note: `${睺壍} on ${formatShort(懠壍.date)} — ${龾壍}.`,
        sentence: ` Expected after the change on ${矿壍(懠壍)}: ${扥壍(懠壍.summary)}.`,
        recommendation: `${墋壍} — the expected effect of the change, not an anomaly.${鹆壍(懠壍)}${袬壍(懠壍)}`,
    };
}
function 险壍(捘壍: ChangeCopyInput, 艇壍: ChangeFact): ChangeCopy {
    const 伶壍 = 捘壍.learning ?? { day: 1, days: 1, until: 艇壍.date };
    const 渥壍 = 艇壍.parsed.subject === "strategy";
    const 贔壍 = 薼壍(艇壍, 捘壍.currency) ?? "the bidding changed";
    return {
        note: `${乃壍(贔壍)} on ${formatShort(艇壍.date)} — ${祷壍(捘壍)} swings are expected while Smart Bidding re-learns (until about ${formatShort(伶壍.until)}).`,
        sentence: ` The campaign is in its learning period (day ${伶壍.day} of ${伶壍.days}) after the change on ${矿壍(艇壍)}: ${扥壍(艇壍.summary)}.`,
        recommendation: `${瀢壍(捘壍)} while the campaign re-learns after ${贔壍} on ${formatShort(艇壍.date)} — day ${伶壍.day} of about ${伶壍.days}. Give Smart Bidding until about ${formatShort(伶壍.until)} before judging the new ${渥壍 ? "strategy" : "target"}: more bid, target or budget edits restart learning. If it hasn't settled by then, ${渥壍 ? "set a target or switch back" : "move the target back towards its previous value"}.${袬壍(艇壍)}`,
    };
}
function 娃壍(磲壍: ParsedChange): {
    effect: string;
    advice: string;
} {
    const 韡壍 = typeof 磲壍.after === "string" ? 磲壍.after : "";
    const 擐壍 = 韡壍 ? strategyLabel(韡壍) : "The new strategy";
    if (MAXIMIZE_STRATEGIES.has(韡壍) && !(磲壍.target?.after ?? null)) {
        const 莿壍 = 韡壍 === "MAXIMIZE_CONVERSION_VALUE" ? "ROAS" : 韡壍 === "MAXIMIZE_CONVERSIONS" ? "CPA" : "CPC";
        const 傮壍 = 韡壍 === "MAXIMIZE_CONVERSION_VALUE" ? "Set a target ROAS" : 韡壍 === "MAXIMIZE_CONVERSIONS" ? "Set a target CPA to cap cost per conversion" : "Set a maximum CPC bid limit";
        return { effect: `${擐壍} has no ${莿壍} target, so it spends the full daily budget — up to 2× on some days, capped at 30.4× per month.`, advice: `${傮壍}, or lower the daily budget if the extra spend isn't wanted.` };
    }
    return { effect: `${擐壍} bids differently from the previous strategy.`, advice: "Check its target, and lower the daily budget if the extra spend isn't wanted." };
}
const 澝壍: ReadonlySet<SignalKind> = new Set(["overdelivery", "pacing"]);
function 躌壍(孻壍: ChangeCopyInput, 穪壍: ChangeFact): string {
    const 饙壍 = 穪壍.parsed;
    const 晈壍 = 澝壍.has(孻壍.kind) || 孻壍.metric === "spend" || 孻壍.metric === "cost";
    const 蔷壍 = 澝壍.has(孻壍.kind) ? "since" : "after";
    switch (饙壍.category) {
        case "bidding": {
            if (晈壍) {
                const 刦壍 = 娃壍(饙壍);
                return `${瀢壍(孻壍)} ${鈁壍(孻壍, 穪壍, 蔷壍)}. ${刦壍.effect} ${刦壍.advice}${鍹壍(孻壍)}`;
            }
            return `${瀢壍(孻壍)} ${鈁壍(孻壍, 穪壍)}. The new strategy bids differently — compare before and after with Analyze impact, and set a target or switch back if efficiency doesn't recover.${鍹壍(孻壍)}`;
        }
        case "bid_target": {
            const 焕壍 = 饙壍.subject === "target_cpa" ? 饙壍.action === "raised" : 饙壍.action === "lowered";
            const 逄壍 = 孻壍.outsized
                ? " That's more than the change alone explains — check for other causes too (auction pressure, tracking, the site)."
                : 饙壍.subject === "bid"
                    ? " Move bids back towards their previous level if the change isn't paying off."
                    : 焕壍
                        ? " A looser target lets bids rise — tighten it again if the extra cost isn't worth the volume."
                        : " A stricter target makes bidding more conservative — loosen it again if you need the volume.";
            return `${瀢壍(孻壍)} ${鈁壍(孻壍, 穪壍, 蔷壍)}.${逄壍}${鍹壍(孻壍)}`;
        }
        case "budget": {
            const 峳壍 = 孻壍.outsized
                ? " That's more than the budget change explains — check for other changes (bids, targeting, strategy) and cap the budget if it's unintended."
                : 澝壍.has(孻壍.kind)
                    ? " Lower the budget again, or raise the monthly target if the extra spend is intended."
                    : " Confirm the new budget is intended.";
            return `${瀢壍(孻壍)} ${鈁壍(孻壍, 穪壍, 蔷壍)}.${峳壍}`;
        }
        case "landing": {
            const 篢壍 = 孻壍.kind === "tracking_break"
                ? "Check that the conversion tag (and consent mode) fires on the new page before touching bids, and revert the URL if it doesn't recover."
                : "Open the new page on mobile and desktop, confirm the conversion tag fires on it and that URL parameters don't break tracking — revert the URL if it doesn't recover within a day or two.";
            return `${瀢壍(孻壍)} right after this change on ${矿壍(穪壍)}: ${扥壍(穪壍.summary)}. ${篢壍}`;
        }
        case "creative": {
            const 髑壍 = [穪壍, ...(孻壍.companions ?? [])].sort((柀壍, 蚯壍) => 柀壍.ts.localeCompare(蚯壍.ts));
            const 厞壍 = 髑壍.some((犍壍) => 犍壍.parsed.action === "paused" || 犍壍.parsed.action === "removed");
            const 酼壍 = 髑壍.map((幫壍) => 扥壍(幫壍.summary)).join("; ");
            return `${瀢壍(孻壍)} after the ads changed on ${矿壍(穪壍)}: ${酼壍}. Compare the new ad's ${祷壍(孻壍)} with the previous one${厞壍 ? " and consider re-enabling the paused ad while you test new creative" : ", and restore the previous version if it doesn't recover"}.`;
        }
        default:
            return `${瀢壍(孻壍)} ${鈁壍(孻壍, 穪壍, 蔷壍)}. Compare before and after with Analyze impact on the campaign's Changes tab, and revert the change if ${祷壍(孻壍)} doesn't recover.`;
    }
}
function 絚壍(鱉壍: ChangeCopyInput): string {
    if (鱉壍.kind === "tracking_break" || 鱉壍.kind === "zero_delivery" || 鱉壍.polarity === "good")
        return 鱉壍.base;
    if (鱉壍.kind === "overdelivery")
        return EXTERNAL_RECOMMENDATIONS.overdelivery;
    switch (鱉壍.metric) {
        case "spend":
        case "cost":
            return EXTERNAL_RECOMMENDATIONS.spend;
        case "cpa":
            return 鱉壍.cpaDrivers && cpaDrivenByCvr(鱉壍.cpaDrivers) ? EXTERNAL_RECOMMENDATIONS.cvr : EXTERNAL_RECOMMENDATIONS.cpc;
        case "cpc":
            return EXTERNAL_RECOMMENDATIONS.cpc;
        case "cvr":
            return EXTERNAL_RECOMMENDATIONS.cvr;
        case "conversions":
            return EXTERNAL_RECOMMENDATIONS.conversions;
        case "ctr":
            return EXTERNAL_RECOMMENDATIONS.ctr;
        case "roas":
        case "conv_value":
            return EXTERNAL_RECOMMENDATIONS.roas;
        default:
            return EXTERNAL_RECOMMENDATIONS.generic;
    }
}
export function changeCopy(椸壍: ChangeVerdict, 蠧壍: ChangeCopyInput): ChangeCopy {
    const 唖壍 = 蠧壍.change;
    if (椸壍 === "no_recent_changes") {
        const 琅壍 = 蠧壍.scope === "account" ? "this account" : "this campaign";
        const 鋴壍 = 蠧壍.kind === "tracking_break" ? "look outside Google Ads (the conversion tag, consent settings or a site release)" : 蠧壍.kind === "zero_delivery" ? "check billing, policy status and the ad schedule" : "the cause is likely external (competitors, seasonality or market)";
        return {
            note: `Nothing changed in ${琅壍} in the ${NO_CHANGE_DAYS} days before the shift, so ${鋴壍}.`,
            sentence: ` No account changes in the ${NO_CHANGE_DAYS} days before the shift — likely external.`,
            recommendation: 絚壍(蠧壍),
        };
    }
    if (!唖壍)
        return { note: "No related account changes found.", sentence: "", recommendation: 蠧壍.base };
    switch (椸壍) {
        case "expected":
            return 瘂壍(蠧壍, 唖壍);
        case "learning":
            return 险壍(蠧壍, 唖壍);
        case "likely_cause":
            return {
                note: `${扥壍(唖壍.summary)} (${揝壍(唖壍)}).`,
                sentence: ` Likely cause: ${扥壍(唖壍.summary)} (${揝壍(唖壍)}).`,
                recommendation: 蠧壍.polarity === "good" ? 蠧壍.base : `${躌壍(蠧壍, 唖壍)}${袬壍(唖壍)}`,
            };
        case "possible_cause":
            return {
                note: `${扥壍(唖壍.summary)} (${揝壍(唖壍)}) — may be related.`,
                sentence: ` Possibly related: ${扥壍(唖壍.summary)} (${揝壍(唖壍)}).`,
                recommendation: 蠧壍.polarity === "good" ? 蠧壍.base : `${蠧壍.base} A recent change may be related: ${扥壍(唖壍.summary)} (${揝壍(唖壍)}) — compare before and after with Analyze impact.`,
            };
        default:
            return {
                note: `${扥壍(唖壍.summary)} happened after the shift began (${formatShort(唖壍.date)}), so it can't explain its start.`,
                sentence: ` Changed after the shift began: ${扥壍(唖壍.summary)} (${揝壍(唖壍)}).`,
                recommendation: 蠧壍.base,
            };
    }
}
