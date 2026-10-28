import type { AnomalySettings, ChangeCategory, ChangeVerdict, Signal, SignalChangeContext, SignalKind, SignalRelatedChange } from "../contracts/anomaly";
import { addDays, diffDays, formatShort } from "../dates";
import type { ChangeEvent } from "../schema/facts";
import { round } from "../stats";
import type { CivilDate } from "../types";
import { parseChange, type ParsedChange } from "./changes";
import { SEVERITY_WEIGHT } from "./ids";
import { changeCopy, cpaDrivenByCvr, lagPhrase, NO_CHANGE_DAYS, type ChangeFact } from "./recommendations";
export type ChangeHistorySettings = AnomalySettings["changeHistory"];
export interface CorrelateOptions {
    settings: ChangeHistorySettings;
    available: boolean;
    from?: CivilDate;
    currency: string;
    unitCampaigns?: ReadonlyMap<string, readonly string[]>;
}
type Relevance = SignalRelatedChange["relevance"];
const MAX_RELATED = 5;
const EXPLAINED_FLOOR = 0.25;
const EXPLAINED_FACTOR = 2;
const EFFICIENCY: ReadonlySet<string> = new Set(["cpa", "cpc", "cvr", "roas", "conversions", "ctr"]);
const EXPECTABLE: ReadonlySet<SignalKind> = new Set(["metric_deviation", "threshold", "zero_delivery"]);
const EXTERNAL_KINDS: ReadonlySet<SignalKind> = new Set(["metric_deviation", "threshold", "tracking_break", "zero_delivery", "overdelivery"]);
export function signalTopic(s: Pick<Signal, "kind" | "metric">): string {
    if (s.kind === "metric_deviation" || s.kind === "threshold") {
        const m = s.metric ?? "";
        if (m === "cost")
            return "spend";
        if (m === "conv_value")
            return "roas";
        if (m === "clicks" || m === "impressions")
            return "ctr";
        return m;
    }
    return s.kind;
}
function relevanceTopic(s: Pick<Signal, "kind" | "metric" | "cpaDrivers">): string {
    const topic = signalTopic(s);
    if (topic !== "cpa" || !s.cpaDrivers)
        return topic;
    return cpaDrivenByCvr(s.cpaDrivers) ? "cvr" : "cpc";
}
const RELEVANCE: Record<ChangeCategory, {
    high: readonly string[];
    medium: readonly string[];
}> = {
    bidding: { high: ["spend", "cpa", "cpc", "roas", "pacing", "overdelivery"], medium: ["conversions", "ctr", "cvr", "budget_limited", "lost_is_budget"] },
    bid_target: { high: ["spend", "cpa", "cpc", "roas", "conversions", "pacing", "overdelivery"], medium: ["ctr", "cvr", "budget_limited", "lost_is_budget"] },
    budget: { high: ["spend", "pacing", "overdelivery", "budget_limited", "zero_delivery", "lost_is_budget"], medium: ["conversions", "cpa"] },
    landing: { high: ["conversions", "cvr", "cpa", "roas", "tracking_break"], medium: ["ctr"] },
    creative: { high: ["ctr"], medium: ["cvr", "conversions", "cpc", "cpa", "zero_delivery"] },
    status: { high: ["zero_delivery", "spend", "pacing", "overdelivery"], medium: ["conversions", "ctr"] },
    keywords: { high: [], medium: ["spend", "ctr", "cpc", "conversions", "cpa", "cvr", "zero_delivery"] },
    negatives: { high: [], medium: ["spend", "ctr", "cpc", "conversions", "cpa", "cvr"] },
    targeting: { high: [], medium: ["spend", "ctr", "cpc", "conversions", "cpa", "cvr"] },
    other: { high: [], medium: [] },
};
const RANK: Record<Relevance, number> = { high: 3, medium: 2, low: 1 };
const DOWN: Record<Relevance, Relevance> = { high: "medium", medium: "low", low: "low" };
export function relevanceFor(category: ChangeCategory, topic: string): Relevance {
    const r = RELEVANCE[category];
    if (r.high.includes(topic))
        return "high";
    if (r.medium.includes(topic))
        return "medium";
    return "low";
}
export type EffectKey = "spend" | "conversions" | "clicks" | "impressions" | "conv_value" | "cpa" | "cpc" | "ctr" | "cvr" | "roas" | "lost_is_budget" | "delivery";
const VOLUME: readonly EffectKey[] = ["spend", "conversions", "clicks", "impressions", "conv_value"];
export function expectedEffects(p: ParsedChange, resource: ChangeEvent["resource_type"]): {
    up: readonly EffectKey[];
    down: readonly EffectKey[];
} | null {
    const raised = p.action === "raised";
    const lowered = p.action === "lowered";
    switch (p.subject) {
        case "budget":
            return raised ? { up: VOLUME, down: ["lost_is_budget"] } : lowered ? { up: ["lost_is_budget"], down: VOLUME } : null;
        case "target_cpa":
            return raised ? { up: [...VOLUME, "cpa", "cpc"], down: [] } : lowered ? { up: [], down: [...VOLUME, "cpa", "cpc"] } : null;
        case "target_roas":
            return raised ? { up: ["roas"], down: [...VOLUME, "cpc"] } : lowered ? { up: [...VOLUME, "cpc"], down: ["roas"] } : null;
        case "bid":
            return raised ? { up: ["cpc", "spend", "clicks", "impressions"], down: [] } : lowered ? { up: [], down: ["cpc", "spend", "clicks", "impressions"] } : null;
        case "status": {
            if (resource !== "CAMPAIGN" && resource !== "AD_GROUP")
                return null;
            if (p.action === "paused" || p.action === "removed")
                return { up: [], down: [...VOLUME, "delivery"] };
            return p.action === "enabled" ? { up: VOLUME, down: [] } : null;
        }
    }
    if (p.category === "negatives")
        return p.action === "added" ? { up: ["ctr"], down: ["clicks", "spend", "impressions"] } : p.action === "removed" ? { up: ["clicks", "spend", "impressions"], down: ["ctr"] } : null;
    if (p.category === "status" && p.action === "added")
        return { up: VOLUME, down: [] };
    return null;
}
const EFFECT_KEY: Record<string, EffectKey> = { spend: "spend", cost: "spend", conversions: "conversions", clicks: "clicks", impressions: "impressions", conv_value: "conv_value", cpa: "cpa", cpc: "cpc", ctr: "ctr", cvr: "cvr", roas: "roas", lost_is_budget: "lost_is_budget" };
function signalEffect(s: Signal): {
    key: EffectKey;
    up: boolean;
} | null {
    if (!EXPECTABLE.has(s.kind))
        return null;
    if (s.kind === "zero_delivery")
        return { key: "delivery", up: false };
    const key = EFFECT_KEY[s.metric ?? ""];
    return key && s.direction ? { key, up: s.direction === "up" } : null;
}
interface Candidate extends ChangeFact {
    event: ChangeEvent;
    relevance: Relevance;
}
interface Learning {
    change: Candidate;
    day: number;
    days: number;
    until: CivilDate;
}
interface Verdict {
    verdict: ChangeVerdict;
    primary?: Candidate;
    learning?: Learning;
    outsized?: boolean;
}
const onsetOf = (s: Pick<Signal, "onsetDate" | "window">): CivilDate => s.onsetDate ?? s.window.recentStart;
function candidatesFor(signal: Signal, events: readonly ChangeEvent[], opts: CorrelateOptions): Candidate[] {
    const onset = onsetOf(signal);
    const topic = relevanceTopic(signal);
    const campaignScoped = signal.scope === "campaign";
    const campaignIds = opts.unitCampaigns?.get(signal.entity.id) ?? [signal.entity.id];
    const out: Candidate[] = [];
    for (const event of events) {
        if (campaignScoped && (!event.campaign_id || !campaignIds.includes(event.campaign_id)))
            continue;
        const parsed = parseChange(event, opts.currency);
        const lag = diffDays(event.date, onset);
        let relevance = relevanceFor(parsed.category, topic);
        if (lag < 0)
            relevance = DOWN[relevance];
        if (!campaignScoped)
            relevance = DOWN[relevance];
        out.push({ event, parsed, relevance, lag, summary: event.summary, date: event.date, ts: event.ts, resource: event.resource_type });
    }
    return out;
}
const byRelevance = (a: Candidate, b: Candidate) => RANK[b.relevance] - RANK[a.relevance] || Math.abs(a.lag) - Math.abs(b.lag) || b.ts.localeCompare(a.ts);
const byProximity = (a: Candidate, b: Candidate) => a.lag - b.lag || RANK[b.relevance] - RANK[a.relevance] || b.ts.localeCompare(a.ts);
function toRelated(c: Candidate): SignalRelatedChange {
    return {
        eventId: c.event.id,
        ts: c.ts,
        summary: c.summary,
        relevance: c.relevance,
        lagDays: c.lag,
        category: c.parsed.category,
        clientLabel: c.parsed.client.label,
        ...(c.parsed.client.automated ? { automated: true } : {}),
        ...(c.event.campaign_id ? { campaignId: c.event.campaign_id } : {}),
        ...(c.parsed.effect ? { effect: c.parsed.effect } : {}),
    };
}
function relatedList(signal: Signal, cands: readonly Candidate[], lookbackDays: number, primary?: Candidate): SignalRelatedChange[] {
    const addDays2 = addDays(onsetOf(signal), -lookbackDays);
    const list = cands.filter((c) => c.date >= addDays2 && c.date <= signal.window.recentEnd).sort(byRelevance).slice(0, MAX_RELATED);
    if (primary && !list.includes(primary))
        list.splice(MAX_RELATED - 1, 1, primary);
    return list.map(toRelated);
}
function learningOf(cands: readonly Candidate[], onset: CivilDate, end: CivilDate, days: number): Learning | null {
    if (days <= 0)
        return null;
    let best: Candidate | null = null;
    for (const c of cands) {
        const s = c.parsed.subject;
        if (s !== "strategy" && s !== "target_cpa" && s !== "target_roas")
            continue;
        if (c.date > onset || diffDays(c.date, end) + 1 > days)
            continue;
        if (!best || c.ts > best.ts)
            best = c;
    }
    return best ? { change: best, day: diffDays(best.date, end) + 1, days, until: addDays(best.date, days - 1) } : null;
}
function assess(signal: Signal, cands: readonly Candidate[], opts: CorrelateOptions): Verdict {
    const s = opts.settings;
    const onset = onsetOf(signal);
    const end = signal.window.recentEnd;
    const campaignScoped = signal.scope === "campaign";
    const causes = cands.filter((c) => c.lag >= 0 && c.lag <= s.lookbackDays).sort(byProximity);
    const learning = campaignScoped ? learningOf(cands, onset, end, s.learningDays) : null;
    const effect = campaignScoped ? signalEffect(signal) : null;
    let outsized: Candidate | undefined;
    if (effect) {
        for (const c of causes) {
            const exp = expectedEffects(c.parsed, c.resource);
            if (!exp || !(effect.up ? exp.up : exp.down).includes(effect.key))
                continue;
            if (c.parsed.pct !== undefined && Math.abs(signal.changePct) > Math.max(EXPLAINED_FLOOR, EXPLAINED_FACTOR * Math.abs(c.parsed.pct))) {
                outsized ??= c;
                continue;
            }
            return { verdict: "expected", primary: c };
        }
    }
    if (learning && (signal.kind === "metric_deviation" || signal.kind === "threshold") && EFFICIENCY.has(signalTopic(signal))) {
        return { verdict: "learning", primary: learning.change, learning };
    }
    const high = causes.find((c) => c.relevance === "high");
    if (high)
        return { verdict: "likely_cause", primary: high, ...(learning?.change === high ? { learning } : {}), ...(high === outsized ? { outsized: true } : {}) };
    const medium = causes.find((c) => c.relevance === "medium");
    if (medium)
        return { verdict: "possible_cause", primary: medium };
    const quietFrom = addDays(onset, -NO_CHANGE_DAYS);
    const quietScope = campaignScoped || signal.scope === "account";
    if (opts.available && quietScope && signal.polarity === "bad" && EXTERNAL_KINDS.has(signal.kind) && (!opts.from || opts.from <= quietFrom) && !cands.some((c) => c.date >= quietFrom && c.date <= end)) {
        return { verdict: "no_recent_changes" };
    }
    const after = cands.filter((c) => c.lag < 0 && c.date <= end && c.relevance !== "low").sort(byRelevance)[0];
    return { verdict: "none", ...(after ? { primary: after } : {}) };
}
function withVerdict(signal: Signal, cands: readonly Candidate[], opts: CorrelateOptions): Signal {
    const s = opts.settings;
    const v = assess(signal, cands, opts);
    const primary = v.primary;
    const companions = primary ? cands.filter((c) => c !== primary && c.date === primary.date && c.lag >= 0 && c.parsed.category === primary.parsed.category) : [];
    const copy = changeCopy(v.verdict, {
        kind: signal.kind,
        scope: signal.scope,
        metric: signal.metric,
        direction: signal.direction,
        polarity: signal.polarity,
        changePct: signal.changePct,
        base: signal.recommendation,
        cpaDrivers: signal.cpaDrivers,
        change: primary,
        companions,
        learning: v.learning,
        outsized: v.outsized,
        currency: opts.currency,
    });
    let severity = signal.severity;
    if (v.verdict === "expected" && s.downgradeExpected)
        severity = "info";
    if (v.verdict === "learning" && s.capDuringLearning && severity === "critical")
        severity = "warning";
    const lowered = severity !== signal.severity;
    const context: SignalChangeContext = {
        verdict: v.verdict,
        note: copy.note,
        ...(primary ? { eventId: primary.event.id, lagDays: primary.lag } : {}),
        ...(v.learning ? { learning: { day: v.learning.day, days: v.learning.days } } : {}),
        ...(lowered ? { severityBefore: signal.severity } : {}),
    };
    const capped = v.verdict === "learning" && lowered ? " Severity is capped at warning while the campaign re-learns." : "";
    return {
        ...signal,
        severity,
        score: lowered ? round((signal.score / SEVERITY_WEIGHT[signal.severity]) * SEVERITY_WEIGHT[severity], 3) : signal.score,
        summary: `${signal.summary}${copy.sentence}${capped}`,
        recommendation: copy.recommendation,
        relatedChanges: relatedList(signal, cands, s.lookbackDays, primary),
        changeContext: context,
    };
}
function withRelated(signal: Signal, cands: readonly Candidate[], lookbackDays: number): Signal {
    const related = relatedList(signal, cands, lookbackDays);
    if (!related.length)
        return signal;
    const top = related[0];
    const summary = top && top.relevance === "high" ? `${signal.summary} Possibly related: ${top.summary.replace(/\.$/, "")} (${formatShort(top.ts.slice(0, 10))}, ${lagPhrase(top.lagDays)}).` : signal.summary;
    return { ...signal, relatedChanges: related, summary };
}
export function correlateChanges(signals: readonly Signal[], events: readonly ChangeEvent[], opts: CorrelateOptions): Signal[] {
    const s = opts.settings;
    if (!opts.available && !events.length)
        return [...signals];
    return signals.map((signal) => {
        const cands = candidatesFor(signal, events, opts);
        if (!s.enabled || signal.kind === "budget_limited")
            return withRelated(signal, cands, s.lookbackDays);
        return withVerdict(signal, cands, opts);
    });
}
