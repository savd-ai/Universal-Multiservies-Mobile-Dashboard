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
const 靊壍 = 5;
const 搹壍 = 0.25;
const 茨壍 = 2;
const 倗壍: ReadonlySet<string> = new Set(["cpa", "cpc", "cvr", "roas", "conversions", "ctr"]);
const 漆壍: ReadonlySet<SignalKind> = new Set(["metric_deviation", "threshold", "zero_delivery"]);
const 践壍: ReadonlySet<SignalKind> = new Set(["metric_deviation", "threshold", "tracking_break", "zero_delivery", "overdelivery"]);
export function signalTopic(嫤壍: Pick<Signal, "kind" | "metric">): string {
    if (嫤壍.kind === "metric_deviation" || 嫤壍.kind === "threshold") {
        const 秓壍 = 嫤壍.metric ?? "";
        if (秓壍 === "cost")
            return "spend";
        if (秓壍 === "conv_value")
            return "roas";
        if (秓壍 === "clicks" || 秓壍 === "impressions")
            return "ctr";
        return 秓壍;
    }
    return 嫤壍.kind;
}
function 飂壍(斱壍: Pick<Signal, "kind" | "metric" | "cpaDrivers">): string {
    const 蒠壍 = signalTopic(斱壍);
    if (蒠壍 !== "cpa" || !斱壍.cpaDrivers)
        return 蒠壍;
    return cpaDrivenByCvr(斱壍.cpaDrivers) ? "cvr" : "cpc";
}
const 冏壍: Record<ChangeCategory, {
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
const 灾壍: Record<Relevance, number> = { high: 3, medium: 2, low: 1 };
const 轭壍: Record<Relevance, Relevance> = { high: "medium", medium: "low", low: "low" };
export function relevanceFor(屜壍: ChangeCategory, 筋壍: string): Relevance {
    const 騺壍 = 冏壍[屜壍];
    if (騺壍.high.includes(筋壍))
        return "high";
    if (騺壍.medium.includes(筋壍))
        return "medium";
    return "low";
}
export type EffectKey = "spend" | "conversions" | "clicks" | "impressions" | "conv_value" | "cpa" | "cpc" | "ctr" | "cvr" | "roas" | "lost_is_budget" | "delivery";
const 朩壍: readonly EffectKey[] = ["spend", "conversions", "clicks", "impressions", "conv_value"];
export function expectedEffects(蘘壍: ParsedChange, 匇壍: ChangeEvent["resource_type"]): {
    up: readonly EffectKey[];
    down: readonly EffectKey[];
} | null {
    const 燶壍 = 蘘壍.action === "raised";
    const 郥壍 = 蘘壍.action === "lowered";
    switch (蘘壍.subject) {
        case "budget":
            return 燶壍 ? { up: 朩壍, down: ["lost_is_budget"] } : 郥壍 ? { up: ["lost_is_budget"], down: 朩壍 } : null;
        case "target_cpa":
            return 燶壍 ? { up: [...朩壍, "cpa", "cpc"], down: [] } : 郥壍 ? { up: [], down: [...朩壍, "cpa", "cpc"] } : null;
        case "target_roas":
            return 燶壍 ? { up: ["roas"], down: [...朩壍, "cpc"] } : 郥壍 ? { up: [...朩壍, "cpc"], down: ["roas"] } : null;
        case "bid":
            return 燶壍 ? { up: ["cpc", "spend", "clicks", "impressions"], down: [] } : 郥壍 ? { up: [], down: ["cpc", "spend", "clicks", "impressions"] } : null;
        case "status": {
            if (匇壍 !== "CAMPAIGN" && 匇壍 !== "AD_GROUP")
                return null;
            if (蘘壍.action === "paused" || 蘘壍.action === "removed")
                return { up: [], down: [...朩壍, "delivery"] };
            return 蘘壍.action === "enabled" ? { up: 朩壍, down: [] } : null;
        }
    }
    if (蘘壍.category === "negatives")
        return 蘘壍.action === "added" ? { up: ["ctr"], down: ["clicks", "spend", "impressions"] } : 蘘壍.action === "removed" ? { up: ["clicks", "spend", "impressions"], down: ["ctr"] } : null;
    if (蘘壍.category === "status" && 蘘壍.action === "added")
        return { up: 朩壍, down: [] };
    return null;
}
const 巔壍: Record<string, EffectKey> = { spend: "spend", cost: "spend", conversions: "conversions", clicks: "clicks", impressions: "impressions", conv_value: "conv_value", cpa: "cpa", cpc: "cpc", ctr: "ctr", cvr: "cvr", roas: "roas", lost_is_budget: "lost_is_budget" };
function 糃壍(鮲壍: Signal): {
    key: EffectKey;
    up: boolean;
} | null {
    if (!漆壍.has(鮲壍.kind))
        return null;
    if (鮲壍.kind === "zero_delivery")
        return { key: "delivery", up: false };
    const 梡壍 = 巔壍[鮲壍.metric ?? ""];
    return 梡壍 && 鮲壍.direction ? { key: 梡壍, up: 鮲壍.direction === "up" } : null;
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
const 螐壍 = (呿壍: Pick<Signal, "onsetDate" | "window">): CivilDate => 呿壍.onsetDate ?? 呿壍.window.recentStart;
function 獮壍(鉝壍: Signal, 彌壍: readonly ChangeEvent[], 縻壍: CorrelateOptions): Candidate[] {
    const 鴪壍 = 螐壍(鉝壍);
    const 標壍 = 飂壍(鉝壍);
    const 褈壍 = 鉝壍.scope === "campaign";
    const 嗷壍 = 縻壍.unitCampaigns?.get(鉝壍.entity.id) ?? [鉝壍.entity.id];
    const 瓦壍: Candidate[] = [];
    for (const 鏕壍 of 彌壍) {
        if (褈壍 && (!鏕壍.campaign_id || !嗷壍.includes(鏕壍.campaign_id)))
            continue;
        const 惄壍 = parseChange(鏕壍, 縻壍.currency);
        const 羳壍 = diffDays(鏕壍.date, 鴪壍);
        let 麢壍 = relevanceFor(惄壍.category, 標壍);
        if (羳壍 < 0)
            麢壍 = 轭壍[麢壍];
        if (!褈壍)
            麢壍 = 轭壍[麢壍];
        瓦壍.push({ event: 鏕壍, parsed: 惄壍, relevance: 麢壍, lag: 羳壍, summary: 鏕壍.summary, date: 鏕壍.date, ts: 鏕壍.ts, resource: 鏕壍.resource_type });
    }
    return 瓦壍;
}
const 殑壍 = (誀壍: Candidate, 坯壍: Candidate) => 灾壍[坯壍.relevance] - 灾壍[誀壍.relevance] || Math.abs(誀壍.lag) - Math.abs(坯壍.lag) || 坯壍.ts.localeCompare(誀壍.ts);
const 癞壍 = (镍壍: Candidate, 戼壍: Candidate) => 镍壍.lag - 戼壍.lag || 灾壍[戼壍.relevance] - 灾壍[镍壍.relevance] || 戼壍.ts.localeCompare(镍壍.ts);
function 脫壍(业壍: Candidate): SignalRelatedChange {
    return {
        eventId: 业壍.event.id,
        ts: 业壍.ts,
        summary: 业壍.summary,
        relevance: 业壍.relevance,
        lagDays: 业壍.lag,
        category: 业壍.parsed.category,
        clientLabel: 业壍.parsed.client.label,
        ...(业壍.parsed.client.automated ? { automated: true } : {}),
        ...(业壍.event.campaign_id ? { campaignId: 业壍.event.campaign_id } : {}),
        ...(业壍.parsed.effect ? { effect: 业壍.parsed.effect } : {}),
    };
}
function 洉壍(诸壍: Signal, 壧壍: readonly Candidate[], 矖壍: number, 雅壍?: Candidate): SignalRelatedChange[] {
    const 掴壍 = addDays(螐壍(诸壍), -矖壍);
    const 芣壍 = 壧壍.filter((侒壍) => 侒壍.date >= 掴壍 && 侒壍.date <= 诸壍.window.recentEnd).sort(殑壍).slice(0, 靊壍);
    if (雅壍 && !芣壍.includes(雅壍))
        芣壍.splice(靊壍 - 1, 1, 雅壍);
    return 芣壍.map(脫壍);
}
function 溁壍(走壍: readonly Candidate[], 婟壍: CivilDate, 祎壍: CivilDate, 頽壍: number): Learning | null {
    if (頽壍 <= 0)
        return null;
    let 攬壍: Candidate | null = null;
    for (const 萛壍 of 走壍) {
        const 儊壍 = 萛壍.parsed.subject;
        if (儊壍 !== "strategy" && 儊壍 !== "target_cpa" && 儊壍 !== "target_roas")
            continue;
        if (萛壍.date > 婟壍 || diffDays(萛壍.date, 祎壍) + 1 > 頽壍)
            continue;
        if (!攬壍 || 萛壍.ts > 攬壍.ts)
            攬壍 = 萛壍;
    }
    return 攬壍 ? { change: 攬壍, day: diffDays(攬壍.date, 祎壍) + 1, days: 頽壍, until: addDays(攬壍.date, 頽壍 - 1) } : null;
}
function 濹壍(軨壍: Signal, 寗壍: readonly Candidate[], 竆壍: CorrelateOptions): Verdict {
    const 馵壍 = 竆壍.settings;
    const 暤壍 = 螐壍(軨壍);
    const 薓壍 = 軨壍.window.recentEnd;
    const 劂壍 = 軨壍.scope === "campaign";
    const 煱壍 = 寗壍.filter((遠壍) => 遠壍.lag >= 0 && 遠壍.lag <= 馵壍.lookbackDays).sort(癞壍);
    const 嵏壍 = 劂壍 ? 溁壍(寗壍, 暤壍, 薓壍, 馵壍.learningDays) : null;
    const 簾壍 = 劂壍 ? 糃壍(軨壍) : null;
    let 鬭壍: Candidate | undefined;
    if (簾壍) {
        for (const 栜壍 of 煱壍) {
            const 蜋壍 = expectedEffects(栜壍.parsed, 栜壍.resource);
            if (!蜋壍 || !(簾壍.up ? 蜋壍.up : 蜋壍.down).includes(簾壍.key))
                continue;
            if (栜壍.parsed.pct !== undefined && Math.abs(軨壍.changePct) > Math.max(搹壍, 茨壍 * Math.abs(栜壍.parsed.pct))) {
                鬭壍 ??= 栜壍;
                continue;
            }
            return { verdict: "expected", primary: 栜壍 };
        }
    }
    if (嵏壍 && (軨壍.kind === "metric_deviation" || 軨壍.kind === "threshold") && 倗壍.has(signalTopic(軨壍))) {
        return { verdict: "learning", primary: 嵏壍.change, learning: 嵏壍 };
    }
    const 叺壍 = 煱壍.find((狩壍) => 狩壍.relevance === "high");
    if (叺壍)
        return { verdict: "likely_cause", primary: 叺壍, ...(嵏壍?.change === 叺壍 ? { learning: 嵏壍 } : {}), ...(叺壍 === 鬭壍 ? { outsized: true } : {}) };
    const 釘壍 = 煱壍.find((廇壍) => 廇壍.relevance === "medium");
    if (釘壍)
        return { verdict: "possible_cause", primary: 釘壍 };
    const 綶壍 = addDays(暤壍, -NO_CHANGE_DAYS);
    const 鲥壍 = 劂壍 || 軨壍.scope === "account";
    if (竆壍.available && 鲥壍 && 軨壍.polarity === "bad" && 践壍.has(軨壍.kind) && (!竆壍.from || 竆壍.from <= 綶壍) && !寗壍.some((榔壍) => 榔壍.date >= 綶壍 && 榔壍.date <= 薓壍)) {
        return { verdict: "no_recent_changes" };
    }
    const 袃壍 = 寗壍.filter((啲壍) => 啲壍.lag < 0 && 啲壍.date <= 薓壍 && 啲壍.relevance !== "low").sort(殑壍)[0];
    return { verdict: "none", ...(袃壍 ? { primary: 袃壍 } : {}) };
}
function 瑡壍(鍐壍: Signal, 怿壍: readonly Candidate[], 缮壍: CorrelateOptions): Signal {
    const 鸝壍 = 缮壍.settings;
    const 欌壍 = 濹壍(鍐壍, 怿壍, 缮壍);
    const 觻壍 = 欌壍.primary;
    const 囪壍 = 觻壍 ? 怿壍.filter((痙壍) => 痙壍 !== 觻壍 && 痙壍.date === 觻壍.date && 痙壍.lag >= 0 && 痙壍.parsed.category === 觻壍.parsed.category) : [];
    const 铈壍 = changeCopy(欌壍.verdict, {
        kind: 鍐壍.kind,
        scope: 鍐壍.scope,
        metric: 鍐壍.metric,
        direction: 鍐壍.direction,
        polarity: 鍐壍.polarity,
        changePct: 鍐壍.changePct,
        base: 鍐壍.recommendation,
        cpaDrivers: 鍐壍.cpaDrivers,
        change: 觻壍,
        companions: 囪壍,
        learning: 欌壍.learning,
        outsized: 欌壍.outsized,
        currency: 缮壍.currency,
    });
    let 憷壍 = 鍐壍.severity;
    if (欌壍.verdict === "expected" && 鸝壍.downgradeExpected)
        憷壍 = "info";
    if (欌壍.verdict === "learning" && 鸝壍.capDuringLearning && 憷壍 === "critical")
        憷壍 = "warning";
    const 肦壍 = 憷壍 !== 鍐壍.severity;
    const 龕壍: SignalChangeContext = {
        verdict: 欌壍.verdict,
        note: 铈壍.note,
        ...(觻壍 ? { eventId: 觻壍.event.id, lagDays: 觻壍.lag } : {}),
        ...(欌壍.learning ? { learning: { day: 欌壍.learning.day, days: 欌壍.learning.days } } : {}),
        ...(肦壍 ? { severityBefore: 鍐壍.severity } : {}),
    };
    const 沄壍 = 欌壍.verdict === "learning" && 肦壍 ? " Severity is capped at warning while the campaign re-learns." : "";
    return {
        ...鍐壍,
        severity: 憷壍,
        score: 肦壍 ? round((鍐壍.score / SEVERITY_WEIGHT[鍐壍.severity]) * SEVERITY_WEIGHT[憷壍], 3) : 鍐壍.score,
        summary: `${鍐壍.summary}${铈壍.sentence}${沄壍}`,
        recommendation: 铈壍.recommendation,
        relatedChanges: 洉壍(鍐壍, 怿壍, 鸝壍.lookbackDays, 觻壍),
        changeContext: 龕壍,
    };
}
function 譳壍(塢壍: Signal, 睑壍: readonly Candidate[], 陀壍: number): Signal {
    const 振壍 = 洉壍(塢壍, 睑壍, 陀壍);
    if (!振壍.length)
        return 塢壍;
    const 舞壍 = 振壍[0];
    const 伍壍 = 舞壍 && 舞壍.relevance === "high" ? `${塢壍.summary} Possibly related: ${舞壍.summary.replace(/\.$/, "")} (${formatShort(舞壍.ts.slice(0, 10))}, ${lagPhrase(舞壍.lagDays)}).` : 塢壍.summary;
    return { ...塢壍, relatedChanges: 振壍, summary: 伍壍 };
}
export function correlateChanges(淼壍: readonly Signal[], 賫壍: readonly ChangeEvent[], 姚壍: CorrelateOptions): Signal[] {
    const 磉壍 = 姚壍.settings;
    if (!姚壍.available && !賫壍.length)
        return [...淼壍];
    return 淼壍.map((鞸壍) => {
        const 撧壍 = 獮壍(鞸壍, 賫壍, 姚壍);
        if (!磉壍.enabled || 鞸壍.kind === "budget_limited")
            return 譳壍(鞸壍, 撧壍, 磉壍.lookbackDays);
        return 瑡壍(鞸壍, 撧壍, 姚壍);
    });
}
