import type { RulePreviewResult, ThresholdRule } from "@/lib/domain/contracts/anomaly";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { CampaignType, MetricFormat, Severity } from "@/lib/domain/types";
export type RuleOp = ThresholdRule["op"];
export type RuleWindowKind = ThresholdRule["window"]["kind"];
export const RULE_OPS: {
    value: RuleOp;
    label: string;
    symbol: string;
}[] = [
    { value: "gt", label: "is above", symbol: ">" },
    { value: "gte", label: "is at or above", symbol: "≥" },
    { value: "lt", label: "is below", symbol: "<" },
    { value: "lte", label: "is at or below", symbol: "≤" },
    { value: "change_pct_gt", label: "change % is above", symbol: ">" },
    { value: "change_pct_lt", label: "change % is below", symbol: "<" },
];
export const isChangeOp = (op: RuleOp): boolean => op === "change_pct_gt" || op === "change_pct_lt";
const opSymbol = (op: RuleOp) => RULE_OPS.find((o) => o.value === op)?.symbol ?? op;
const clean = (v: number) => Number(v.toFixed(6));
export function ruleValueToInput(op: RuleOp, format: MetricFormat, value: number): string {
    if (isChangeOp(op) || format === "percent")
        return String(clean(value * 100));
    return String(clean(value));
}
export function ruleInputToValue(op: RuleOp, format: MetricFormat, input: string): number | null {
    const text = input.trim().replace(/[−–]/g, "-").replace(/[,$€£¥₫%×x\s]/gi, "");
    if (!text || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text))
        return null;
    const n = Number(text);
    if (!Number.isFinite(n))
        return null;
    return isChangeOp(op) || format === "percent" ? clean(n / 100) : n;
}
export function ruleValueUnit(op: RuleOp, format: MetricFormat, currencySymbol: string): string {
    if (isChangeOp(op) || format === "percent")
        return "%";
    if (format === "money")
        return currencySymbol.trim();
    if (format === "ratio")
        return "×";
    return "";
}
function signedPct(v: number): string {
    const pct = Math.abs(v * 100);
    const body = Number.isInteger(clean(pct)) ? pct.toFixed(0) : pct.toFixed(1);
    return `${v < 0 ? "−" : "+"}${body}%`;
}
export function formatRuleValue(op: RuleOp, format: MetricFormat, value: number, currency: string): string {
    if (isChangeOp(op))
        return signedPct(value);
    return formatMetricValue(format, value, { currency, compact: false });
}
export interface MetricMeta {
    short: string;
    format: MetricFormat;
}
export function describeRuleCondition(rule: Pick<ThresholdRule, "metric" | "op" | "value">, meta: MetricMeta | undefined, currency: string): string {
    const short = meta?.short ?? rule.metric;
    const format = meta?.format ?? "number";
    const value = formatRuleValue(rule.op, format, rule.value, currency);
    return isChangeOp(rule.op) ? `${short} change ${opSymbol(rule.op)} ${value}` : `${short} ${opSymbol(rule.op)} ${value}`;
}
export function describeRuleWindow(rule: Pick<ThresholdRule, "op" | "window">): string {
    const n = rule.window.days;
    const change = isChangeOp(rule.op);
    if (rule.window.kind === "last_n_days") {
        if (n === 1)
            return change ? "Latest day vs the day before" : "Latest day";
        return change ? `Last ${n} days vs the previous ${n}` : `Last ${n} days combined`;
    }
    if (n === 1)
        return change ? "Latest day vs the 14 days before" : "Latest day";
    return change ? `Each of the last ${n} days vs the 14 before` : `Each of the last ${n} days`;
}
export function describeRuleScope(rule: Pick<ThresholdRule, "scope">, campaignNames: ReadonlyMap<string, string>): string {
    if (rule.scope.level === "account")
        return "Account total";
    const ids = rule.scope.campaignIds ?? [];
    const types = rule.scope.campaignTypes ?? [];
    const parts: string[] = [];
    if (ids.length === 1 && ids[0])
        parts.push(campaignNames.get(ids[0]) ?? ids[0]);
    else if (ids.length > 1)
        parts.push(`${ids.length} campaigns`);
    if (types.length)
        parts.push(types.join(", "));
    return parts.length ? parts.join(" · ") : "All campaigns";
}
export interface PreviewEntity {
    id: string;
    name: string;
    days: number;
    lastDate: string;
    lastObserved: number;
    severity: Severity;
}
export interface PreviewSummary {
    windowDays: number;
    firedDays: number;
    totalHits: number;
    perDay: {
        date: string;
        count: number;
    }[];
    entities: PreviewEntity[];
}
export function summarizeRulePreview(result: RulePreviewResult): PreviewSummary {
    const by = new Map<string, PreviewEntity>();
    for (const d of result.days) {
        for (const h of d.hits) {
            const e = by.get(h.entityId);
            if (!e)
                by.set(h.entityId, { id: h.entityId, name: h.entityName, days: 1, lastDate: d.date, lastObserved: h.observed, severity: h.severity });
            else {
                e.days += 1;
                if (d.date >= e.lastDate) {
                    e.lastDate = d.date;
                    e.lastObserved = h.observed;
                }
            }
        }
    }
    return {
        windowDays: result.days.length,
        firedDays: result.days.filter((d) => d.hits.length > 0).length,
        totalHits: result.totalHits,
        perDay: result.days.map((d) => ({ date: d.date, count: d.hits.length })),
        entities: [...by.values()].sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)),
    };
}
export interface RuleDraft {
    id?: string;
    name: string;
    enabled: boolean;
    level: "account" | "campaign";
    campaignIds: string[];
    campaignTypes: CampaignType[];
    metric: string;
    op: RuleOp;
    valueInput: string;
    windowKind: RuleWindowKind;
    days: number;
    severity: Severity;
}
export function newRuleDraft(): RuleDraft {
    return { name: "", enabled: true, level: "campaign", campaignIds: [], campaignTypes: [], metric: "cpa", op: "gt", valueInput: "", windowKind: "last_n_days", days: 3, severity: "warning" };
}
export function draftFromRule(rule: ThresholdRule, format: MetricFormat): RuleDraft {
    return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        level: rule.scope.level,
        campaignIds: [...(rule.scope.campaignIds ?? [])],
        campaignTypes: [...(rule.scope.campaignTypes ?? [])],
        metric: rule.metric,
        op: rule.op,
        valueInput: ruleValueToInput(rule.op, format, rule.value),
        windowKind: rule.window.kind,
        days: rule.window.days,
        severity: rule.severity,
    };
}
export type RuleBody = Omit<ThresholdRule, "id"> & {
    id?: string;
};
export function ruleFromDraft(d: RuleDraft, format: MetricFormat): {
    ok: true;
    rule: RuleBody;
} | {
    ok: false;
    error: string;
} {
    const name = d.name.trim();
    if (!name)
        return { ok: false, error: "Give the rule a name." };
    if (name.length > 80)
        return { ok: false, error: "Keep the name under 80 characters." };
    if (!d.metric)
        return { ok: false, error: "Pick a metric." };
    const value = ruleInputToValue(d.op, format, d.valueInput);
    if (value === null)
        return { ok: false, error: "Enter a number for the threshold." };
    if (!Number.isInteger(d.days) || d.days < 1 || d.days > 30)
        return { ok: false, error: "The window is 1–30 days." };
    const scope: ThresholdRule["scope"] = d.level === "account" ? { level: "account" } : { level: "campaign", ...(d.campaignIds.length ? { campaignIds: d.campaignIds } : {}), ...(d.campaignTypes.length ? { campaignTypes: d.campaignTypes } : {}) };
    return {
        ok: true,
        rule: { ...(d.id ? { id: d.id } : {}), name, enabled: d.enabled, scope, metric: d.metric, op: d.op, value, window: { kind: d.windowKind, days: d.days }, severity: d.severity },
    };
}
