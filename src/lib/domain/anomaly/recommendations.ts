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
export function metricRecommendation(metric: MonitoredMetric, bad: boolean): string {
    if (!bad)
        return RECOMMENDATIONS.good;
    return RECOMMENDATIONS[metric];
}
export function cpaDrivenByCvr(d: {
    cpc: number;
    cvr: number;
}): boolean {
    return Math.abs(Math.log1p(d.cvr)) > Math.abs(Math.log1p(d.cpc));
}
export function deviationTitle(label: string, changePct: number): string {
    const pct = Math.abs(changePct * 100).toFixed(0);
    return `${label} ${changePct > 0 ? "up" : "down"} ${pct}%`;
}
export function pacingTitle(paceRatio: number): string {
    return `Overpacing — ${(paceRatio * 100).toFixed(0)}% of budget`;
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function pacingRecommendation(projected: string, target: string, recommendedDaily: string, remainingDays: number): string {
    return `Projected month-end ${projected} vs ${target} budget. Lower the daily budget to ${recommendedDaily} for the remaining ${plural(remainingDays, "day")}.`;
}
export function fmt(format: MetricFormat, v: number | null | undefined, currency: string): string {
    return formatMetricValue(format, v, { currency });
}
export function signedPct(pct: number | null | undefined, decimals = 0): string {
    if (pct === null || pct === undefined || !Number.isFinite(pct))
        return "—";
    return `${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(decimals)}%`;
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
export function lagPhrase(lag: number): string {
    if (lag > 0)
        return `${plural(lag, "day")} before the shift`;
    if (lag === 0)
        return "the day the shift began";
    return `${plural(-lag, "day")} after the shift began`;
}
const strip = (s: string) => s.trim().replace(/[.\s]+$/, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pctText = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;
const when = (c: ChangeFact) => `${formatShort(c.date)} (${lagPhrase(c.lag)})`;
const dated = (c: ChangeFact) => `${formatShort(c.date)}, ${lagPhrase(c.lag)}`;
const METRIC_NAME: Record<string, string> = {
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
const ACRONYM = new Set(["CPA", "CTR", "CPC", "ROAS"]);
function metricName(i: Pick<ChangeCopyInput, "kind" | "metric">): string {
    if (i.kind === "zero_delivery")
        return "Delivery";
    if (i.kind === "tracking_break")
        return "Conversions";
    if (i.kind === "overdelivery" || i.kind === "pacing")
        return "Spend";
    return METRIC_NAME[i.metric ?? ""] ?? (i.metric ? cap(i.metric.replace(/_/g, " ")) : "The metric");
}
function metricNoun(i: Pick<ChangeCopyInput, "kind" | "metric">): string {
    const m = metricName(i);
    return ACRONYM.has(m) ? m : m.toLowerCase();
}
const cvrLed = (i: Pick<ChangeCopyInput, "metric" | "direction" | "cpaDrivers">) => i.metric === "cpa" && i.direction === "up" && !!i.cpaDrivers && cpaDrivenByCvr(i.cpaDrivers);
function lead(i: ChangeCopyInput): string {
    switch (i.kind) {
        case "zero_delivery":
            return "The campaign stopped serving";
        case "tracking_break":
            return "Conversions stopped being recorded";
        case "overdelivery":
            return `Spend has run at ${Math.round((1 + i.changePct) * 100)}% of the daily budget`;
        case "pacing":
            return `The month is projected to end at ${Math.round((1 + i.changePct) * 100)}% of budget`;
        default:
            if (cvrLed(i))
                return `CPA rose ${pctText(i.changePct)} as fewer clicks convert,`;
            return `${metricName(i)} ${i.direction === "down" ? "fell" : "rose"} ${pctText(i.changePct)}`;
    }
}
const THING: Partial<Record<ChangeEvent["resource_type"], string>> = { CAMPAIGN: "the campaign", AD_GROUP: "an ad group", AD_GROUP_AD: "an ad", AD_GROUP_CRITERION: "a keyword or targeting criterion", CAMPAIGN_CRITERION: "a targeting criterion", ASSET: "an asset" };
function moneyOf(v: string | number | null | undefined, currency: string): string {
    return typeof v === "number" ? formatMoney(v, { currency, compact: false }) : "—";
}
function clause(c: ChangeFact, currency: string): string | null {
    const p = c.parsed;
    const move = p.action === "raised" || p.action === "lowered" ? p.action : null;
    const pct = p.pct !== undefined ? ` ${pctText(p.pct)}` : "";
    switch (p.subject) {
        case "budget":
            return move ? `the daily budget was ${move}${pct} (${moneyOf(p.before, currency)} → ${moneyOf(p.after, currency)})` : "the budget changed";
        case "target_cpa":
            return move ? `the target CPA was ${move}${pct} (${moneyOf(p.before, currency)} → ${moneyOf(p.after, currency)})` : "the target CPA changed";
        case "target_roas":
            return move && typeof p.before === "number" && typeof p.after === "number" ? `the target ROAS was ${move} from ${Math.round(p.before * 100)}% to ${Math.round(p.after * 100)}%` : "the target ROAS changed";
        case "bid":
            return move ? `bids were ${move}${pct}` : "bids changed";
        case "strategy": {
            const text = (v: string | number | null | undefined, target: number | null | undefined) => (typeof v === "string" ? strategyText(v, target, p.target?.kind, currency) : null);
            const value = text(p.before, p.target?.before);
            const to = text(p.after, p.target?.after);
            return value && to ? `the bid strategy changed from ${value} to ${to}` : to ? `the bid strategy changed to ${to}` : "the bid strategy changed";
        }
        case "status":
            if (p.action === "paused" || p.action === "enabled" || p.action === "removed")
                return `${THING[c.resource] ?? "an item"} was ${p.action}`;
            return null;
    }
    if (p.category === "negatives" && p.action === "added")
        return "negative keywords were added";
    if (p.category === "negatives" && p.action === "removed")
        return "negative keywords were removed";
    if (p.category === "keywords" && p.action === "added")
        return "keywords were added";
    return null;
}
function afterChange(i: ChangeCopyInput, c: ChangeFact, connector: "after" | "since" = "after"): string {
    const cl = clause(c, i.currency);
    return cl ? `${connector} ${cl} on ${when(c)}` : `${connector === "since" ? "since" : "right after"} this change on ${when(c)}: ${strip(c.summary)}`;
}
function automationNote(c: ChangeFact): string {
    const client = c.parsed.client;
    if (!client.automated)
        return "";
    if (/recommendations/i.test(client.label))
        return " It was applied automatically by Google recommendations — review the auto-apply settings on the Recommendations page.";
    return ` It was made by ${client.by ?? `${client.label} automation`}, not a person — check that automation's settings.`;
}
function learningTail(i: ChangeCopyInput): string {
    const l = i.learning;
    return l ? ` Expect volatile results during the learning period (day ${l.day} of about ${l.days}, until about ${formatShort(l.until)}).` : "";
}
function expectedAdvice(c: ChangeFact): string {
    const p = c.parsed;
    switch (p.subject) {
        case "budget":
            return p.action === "raised"
                ? " Check over the next week that CPA and ROAS hold at the higher spend (Google may spend up to 2× the daily budget on a single day), and lower the budget again if efficiency slips."
                : " Restore the budget if the lower volume isn't intended.";
        case "target_cpa":
            return p.action === "raised" ? " A higher target lets Smart Bidding pay more per conversion to win extra volume — keep it if the extra conversions are worth the cost." : " A lower target makes bidding more conservative, so volume drops — raise it again if you need the volume.";
        case "target_roas":
            return p.action === "raised" ? " A higher ROAS target makes bidding pickier, trading volume for return — lower it again if you need the volume." : " A lower ROAS target buys more volume at a lower return — keep it if the extra revenue is worth it.";
        case "bid":
            return " Keep the new bids if the traffic is worth the cost.";
        case "status":
            if (p.action === "enabled")
                return " Watch CPA while it ramps up.";
            return p.action === "removed" ? " Restore it if the removal wasn't intended." : " Enable it again if the pause wasn't intended.";
    }
    if (p.category === "negatives")
        return p.action === "removed" ? " Watch the search terms report for irrelevant traffic." : " Check that conversions held — remove a negative if it blocked converting searches.";
    if (p.category === "status" && p.action === "added")
        return " Watch CPA while it ramps up.";
    return " Confirm the change was intended.";
}
const VALUE_SUBJECTS: ReadonlySet<string> = new Set(["budget", "target_cpa", "target_roas", "bid", "strategy"]);
function expectedCopy(i: ChangeCopyInput, c: ChangeFact): ChangeCopy {
    const up = i.direction === "up";
    const what = i.kind === "zero_delivery" ? "the campaign not serving is expected" : `the ${up ? "rise" : "drop"} in ${metricNoun(i)} is expected`;
    const cl = clause(c, i.currency);
    const head = i.kind === "zero_delivery" ? "The campaign stopped serving" : `${metricName(i)} is ${up ? "up" : "down"} ${pctText(i.changePct)}`;
    const because = cl ? `${head} because ${cl} on ${formatShort(c.date)}` : `${head} after this change on ${formatShort(c.date)}: ${strip(c.summary)}`;
    const label = c.parsed.effect && VALUE_SUBJECTS.has(c.parsed.subject ?? "") ? c.parsed.effect : strip(c.summary);
    return {
        note: `${label} on ${formatShort(c.date)} — ${what}.`,
        sentence: ` Expected after the change on ${when(c)}: ${strip(c.summary)}.`,
        recommendation: `${because} — the expected effect of the change, not an anomaly.${expectedAdvice(c)}${automationNote(c)}`,
    };
}
function learningCopy(i: ChangeCopyInput, c: ChangeFact): ChangeCopy {
    const l = i.learning ?? { day: 1, days: 1, until: c.date };
    const strategy = c.parsed.subject === "strategy";
    const cl = clause(c, i.currency) ?? "the bidding changed";
    return {
        note: `${cap(cl)} on ${formatShort(c.date)} — ${metricNoun(i)} swings are expected while Smart Bidding re-learns (until about ${formatShort(l.until)}).`,
        sentence: ` The campaign is in its learning period (day ${l.day} of ${l.days}) after the change on ${when(c)}: ${strip(c.summary)}.`,
        recommendation: `${lead(i)} while the campaign re-learns after ${cl} on ${formatShort(c.date)} — day ${l.day} of about ${l.days}. Give Smart Bidding until about ${formatShort(l.until)} before judging the new ${strategy ? "strategy" : "target"}: more bid, target or budget edits restart learning. If it hasn't settled by then, ${strategy ? "set a target or switch back" : "move the target back towards its previous value"}.${automationNote(c)}`,
    };
}
function strategyEffect(p: ParsedChange): {
    effect: string;
    advice: string;
} {
    const to = typeof p.after === "string" ? p.after : "";
    const label = to ? strategyLabel(to) : "The new strategy";
    if (MAXIMIZE_STRATEGIES.has(to) && !(p.target?.after ?? null)) {
        const goal = to === "MAXIMIZE_CONVERSION_VALUE" ? "ROAS" : to === "MAXIMIZE_CONVERSIONS" ? "CPA" : "CPC";
        const advice = to === "MAXIMIZE_CONVERSION_VALUE" ? "Set a target ROAS" : to === "MAXIMIZE_CONVERSIONS" ? "Set a target CPA to cap cost per conversion" : "Set a maximum CPC bid limit";
        return { effect: `${label} has no ${goal} target, so it spends the full daily budget — up to 2× on some days, capped at 30.4× per month.`, advice: `${advice}, or lower the daily budget if the extra spend isn't wanted.` };
    }
    return { effect: `${label} bids differently from the previous strategy.`, advice: "Check its target, and lower the daily budget if the extra spend isn't wanted." };
}
const SPEND_KINDS: ReadonlySet<SignalKind> = new Set(["overdelivery", "pacing"]);
function likelyRecommendation(i: ChangeCopyInput, c: ChangeFact): string {
    const p = c.parsed;
    const spendish = SPEND_KINDS.has(i.kind) || i.metric === "spend" || i.metric === "cost";
    const connector = SPEND_KINDS.has(i.kind) ? "since" : "after";
    switch (p.category) {
        case "bidding": {
            if (spendish) {
                const s = strategyEffect(p);
                return `${lead(i)} ${afterChange(i, c, connector)}. ${s.effect} ${s.advice}${learningTail(i)}`;
            }
            return `${lead(i)} ${afterChange(i, c)}. The new strategy bids differently — compare before and after with Analyze impact, and set a target or switch back if efficiency doesn't recover.${learningTail(i)}`;
        }
        case "bid_target": {
            const looser = p.subject === "target_cpa" ? p.action === "raised" : p.action === "lowered";
            const advice = i.outsized
                ? " That's more than the change alone explains — check for other causes too (auction pressure, tracking, the site)."
                : p.subject === "bid"
                    ? " Move bids back towards their previous level if the change isn't paying off."
                    : looser
                        ? " A looser target lets bids rise — tighten it again if the extra cost isn't worth the volume."
                        : " A stricter target makes bidding more conservative — loosen it again if you need the volume.";
            return `${lead(i)} ${afterChange(i, c, connector)}.${advice}${learningTail(i)}`;
        }
        case "budget": {
            const advice = i.outsized
                ? " That's more than the budget change explains — check for other changes (bids, targeting, strategy) and cap the budget if it's unintended."
                : SPEND_KINDS.has(i.kind)
                    ? " Lower the budget again, or raise the monthly target if the extra spend is intended."
                    : " Confirm the new budget is intended.";
            return `${lead(i)} ${afterChange(i, c, connector)}.${advice}`;
        }
        case "landing": {
            const advice = i.kind === "tracking_break"
                ? "Check that the conversion tag (and consent mode) fires on the new page before touching bids, and revert the URL if it doesn't recover."
                : "Open the new page on mobile and desktop, confirm the conversion tag fires on it and that URL parameters don't break tracking — revert the URL if it doesn't recover within a day or two.";
            return `${lead(i)} right after this change on ${when(c)}: ${strip(c.summary)}. ${advice}`;
        }
        case "creative": {
            const all = [c, ...(i.companions ?? [])].sort((a, b) => a.ts.localeCompare(b.ts));
            const paused = all.some((x) => x.parsed.action === "paused" || x.parsed.action === "removed");
            const list = all.map((x) => strip(x.summary)).join("; ");
            return `${lead(i)} after the ads changed on ${when(c)}: ${list}. Compare the new ad's ${metricNoun(i)} with the previous one${paused ? " and consider re-enabling the paused ad while you test new creative" : ", and restore the previous version if it doesn't recover"}.`;
        }
        default:
            return `${lead(i)} ${afterChange(i, c, connector)}. Compare before and after with Analyze impact on the campaign's Changes tab, and revert the change if ${metricNoun(i)} doesn't recover.`;
    }
}
function externalRecommendation(i: ChangeCopyInput): string {
    if (i.kind === "tracking_break" || i.kind === "zero_delivery" || i.polarity === "good")
        return i.base;
    if (i.kind === "overdelivery")
        return EXTERNAL_RECOMMENDATIONS.overdelivery;
    switch (i.metric) {
        case "spend":
        case "cost":
            return EXTERNAL_RECOMMENDATIONS.spend;
        case "cpa":
            return i.cpaDrivers && cpaDrivenByCvr(i.cpaDrivers) ? EXTERNAL_RECOMMENDATIONS.cvr : EXTERNAL_RECOMMENDATIONS.cpc;
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
export function changeCopy(verdict: ChangeVerdict, i: ChangeCopyInput): ChangeCopy {
    const c = i.change;
    if (verdict === "no_recent_changes") {
        const where = i.scope === "account" ? "this account" : "this campaign";
        const outside = i.kind === "tracking_break" ? "look outside Google Ads (the conversion tag, consent settings or a site release)" : i.kind === "zero_delivery" ? "check billing, policy status and the ad schedule" : "the cause is likely external (competitors, seasonality or market)";
        return {
            note: `Nothing changed in ${where} in the ${NO_CHANGE_DAYS} days before the shift, so ${outside}.`,
            sentence: ` No account changes in the ${NO_CHANGE_DAYS} days before the shift — likely external.`,
            recommendation: externalRecommendation(i),
        };
    }
    if (!c)
        return { note: "No related account changes found.", sentence: "", recommendation: i.base };
    switch (verdict) {
        case "expected":
            return expectedCopy(i, c);
        case "learning":
            return learningCopy(i, c);
        case "likely_cause":
            return {
                note: `${strip(c.summary)} (${dated(c)}).`,
                sentence: ` Likely cause: ${strip(c.summary)} (${dated(c)}).`,
                recommendation: i.polarity === "good" ? i.base : `${likelyRecommendation(i, c)}${automationNote(c)}`,
            };
        case "possible_cause":
            return {
                note: `${strip(c.summary)} (${dated(c)}) — may be related.`,
                sentence: ` Possibly related: ${strip(c.summary)} (${dated(c)}).`,
                recommendation: i.polarity === "good" ? i.base : `${i.base} A recent change may be related: ${strip(c.summary)} (${dated(c)}) — compare before and after with Analyze impact.`,
            };
        default:
            return {
                note: `${strip(c.summary)} happened after the shift began (${formatShort(c.date)}), so it can't explain its start.`,
                sentence: ` Changed after the shift began: ${strip(c.summary)} (${dated(c)}).`,
                recommendation: i.base,
            };
    }
}
