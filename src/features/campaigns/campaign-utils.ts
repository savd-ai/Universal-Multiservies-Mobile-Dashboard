import type { CampaignRangeQuery } from "@/lib/api/campaigns";
import type { CampaignListRow, CampaignMetrics, ChangeImpactMetric, ChangeImpactResult } from "@/lib/domain/contracts/actions";
import type { CompareMode, DateRange } from "@/lib/domain/dates";
import { daysInMonth, formatMonth, formatRange, isCivilDate, parts } from "@/lib/domain/dates";
import { deltaSentiment, formatMetricValue, formatMoney } from "@/lib/domain/metrics/registry";
import type { DateRangeSpec } from "@/lib/domain/query/spec";
import type { MetricDirection, MetricFormat } from "@/lib/domain/types";
export function campaignRangeQuery(dateRange: DateRangeSpec, compare: CompareMode): CampaignRangeQuery {
    if ("preset" in dateRange)
        return { range: dateRange.preset, compare };
    return { start: dateRange.start, end: dateRange.end, compare };
}
const RANGE_SHORT: Record<string, string> = { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", mtd: "month to date", qtd: "quarter to date", ytd: "year to date", last_month: "last month" };
export function rangeShortLabel(rangeKey: string, range: DateRange | null): string {
    return RANGE_SHORT[rangeKey] ?? (range ? formatRange(range) : "selected range");
}
export function compareLabel(compare: CompareMode): string {
    return compare === "previous_year" ? "previous year" : compare === "previous_period" ? "previous period" : "";
}
export function rangeSearchOf(s: {
    range: string | null;
    from: string | null;
    to: string | null;
    cmp: string | null;
}): string {
    const p = new URLSearchParams();
    if (s.range && s.range !== "30d")
        p.set("range", s.range);
    if (s.range === "custom" && s.from && s.to) {
        p.set("from", s.from);
        p.set("to", s.to);
    }
    if (s.cmp && s.cmp !== "prev")
        p.set("cmp", s.cmp);
    const str = p.toString();
    return str ? `?${str}` : "";
}
export function pacingMonthOf(dataThrough: string | undefined): {
    label: string;
    month: string;
    marker: number | undefined;
} {
    if (!dataThrough || !isCivilDate(dataThrough))
        return { label: "This month", month: "this month", marker: undefined };
    const label = formatMonth(dataThrough);
    return { label, month: label.split(" ")[0] ?? label, marker: parts(dataThrough).day / daysInMonth(dataThrough) };
}
export const DETAIL_TABS = ["overview", "ad-groups", "keywords", "search-terms", "devices", "changes", "signals", "notes"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
export interface MoneyFmt {
    currency: string;
    fx: number;
}
export const DEFAULT_MONEY: MoneyFmt = { currency: "USD", fx: 1 };
export function moneyFmtOf(status: {
    account: {
        currency: string;
    };
    display: {
        currency: string;
        fxRates: Record<string, number>;
    };
} | undefined): MoneyFmt {
    if (!status)
        return DEFAULT_MONEY;
    const account = status.account.currency || "USD";
    const currency = status.display.currency || account;
    if (currency === account)
        return { currency, fx: 1 };
    const rate = (c: string) => (c === "USD" ? 1 : status.display.fxRates[c]);
    const to = rate(currency);
    const value = rate(account);
    return to && value ? { currency, fx: to / value } : { currency: account, fx: 1 };
}
export function money(v: number | null | undefined, m: MoneyFmt, decimals?: number, compact = true): string {
    if (v === null || v === undefined || !Number.isFinite(v))
        return "—";
    return formatMoney(v, { currency: m.currency, fx: m.fx, decimals, compact });
}
export type MetricKey = keyof CampaignMetrics;
export interface MetricMeta {
    label: string;
    format: MetricFormat;
    direction: MetricDirection;
    decimals?: number;
}
export const METRIC_META: Record<MetricKey, MetricMeta> = {
    cost: { label: "Spend", format: "money", direction: "neutral" },
    impressions: { label: "Impr.", format: "number", direction: "up_good" },
    clicks: { label: "Clicks", format: "number", direction: "up_good" },
    ctr: { label: "CTR", format: "percent", direction: "up_good" },
    cpc: { label: "CPC", format: "money", direction: "down_good", decimals: 2 },
    conversions: { label: "Conv.", format: "decimal", direction: "up_good" },
    cpa: { label: "CPA", format: "money", direction: "down_good", decimals: 2 },
    roas: { label: "ROAS", format: "ratio", direction: "up_good" },
    conv_value: { label: "Conv. value", format: "money", direction: "up_good" },
    cvr: { label: "Conv. rate", format: "percent", direction: "up_good" },
};
export function formatMetric(key: MetricKey, v: number | null | undefined, m: MoneyFmt, opts: {
    compact?: boolean;
} = {}): string {
    const meta = METRIC_META[key];
    if (meta.format === "money")
        return money(v, m, meta.decimals, opts.compact ?? true);
    return formatMetricValue(meta.format, v, { compact: opts.compact ?? true });
}
export function pctChange(cur: number | null | undefined, prev: number | null | undefined): number | null {
    if (cur === null || cur === undefined || prev === null || prev === undefined || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0)
        return null;
    return cur / prev - 1;
}
export function metricSentiment(key: MetricKey, pct: number | null): "good" | "bad" | null {
    return deltaSentiment(METRIC_META[key].direction, pct);
}
export type ColumnKey = "name" | "status" | "bidding" | "budget" | MetricKey | "trend";
export interface ColumnSpec {
    key: ColumnKey;
    label: string;
    track: string;
    min: number;
    align: "left" | "right";
    sortable: boolean;
    defaultOn: boolean;
    locked?: boolean;
    metric?: MetricKey;
}
const num = (key: MetricKey, defaultOn = true): ColumnSpec => ({ key, label: METRIC_META[key].label, track: "minmax(60px,1fr)", min: 60, align: "right", sortable: true, defaultOn, metric: key });
export const CAMPAIGN_COLUMNS: ColumnSpec[] = [
    { key: "name", label: "Campaign", track: "minmax(var(--name-min,220px),2.2fr)", min: 220, align: "left", sortable: true, defaultOn: true, locked: true },
    { key: "status", label: "Status", track: "92px", min: 92, align: "left", sortable: true, defaultOn: true },
    { key: "bidding", label: "Bid strategy", track: "minmax(128px,1.2fr)", min: 128, align: "left", sortable: true, defaultOn: false },
    { key: "budget", label: "Budget/day", track: "minmax(60px,1fr)", min: 60, align: "right", sortable: true, defaultOn: true },
    num("cost"),
    num("impressions"),
    num("clicks"),
    num("ctr"),
    num("cpc"),
    num("conversions"),
    num("cvr", false),
    num("cpa"),
    num("conv_value", false),
    num("roas"),
    { key: "trend", label: "Trend", track: "96px", min: 96, align: "right", sortable: false, defaultOn: true },
];
export const DEFAULT_COLUMNS: ColumnKey[] = CAMPAIGN_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);
const COLUMN_KEYS = new Set<string>(CAMPAIGN_COLUMNS.map((c) => c.key));
export function parseColumnPref(raw: string | null): ColumnKey[] {
    if (!raw)
        return DEFAULT_COLUMNS;
    try {
        const v: unknown = JSON.parse(raw);
        if (!Array.isArray(v))
            return DEFAULT_COLUMNS;
        const keys = new Set(v.filter((k): k is string => typeof k === "string" && COLUMN_KEYS.has(k)));
        keys.add("name");
        return CAMPAIGN_COLUMNS.filter((c) => keys.has(c.key)).map((c) => c.key);
    }
    catch {
        return DEFAULT_COLUMNS;
    }
}
export function gridTemplate(columns: readonly ColumnSpec[], selectable: boolean): string {
    return [selectable ? "16px" : null, ...columns.map((c) => c.track)].filter(Boolean).join(" ");
}
export function gridMinWidth(columns: readonly ColumnSpec[], selectable: boolean): number {
    const tracks = columns.reduce((s, c) => s + c.min, 0) + (selectable ? 16 : 0);
    const gaps = (columns.length + (selectable ? 1 : 0) - 1) * 10;
    return tracks + gaps + 44;
}
export interface RowFilter {
    q?: string;
    types?: readonly string[];
    statuses?: readonly string[];
    campaignIds?: readonly string[];
}
export function filterCampaigns<T extends Pick<CampaignListRow, "id" | "name" | "type" | "status">>(rows: readonly T[], f: RowFilter): T[] {
    const q = (f.q ?? "").trim().toLowerCase();
    return rows.filter((r) => (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase() === q) &&
        (!f.types?.length || f.types.includes(r.type)) &&
        (!f.statuses?.length || f.statuses.includes(r.status)) &&
        (!f.campaignIds?.length || f.campaignIds.includes(r.id)));
}
export type SortDir = "asc" | "desc";
export const SORT_KEYS = CAMPAIGN_COLUMNS.filter((c) => c.sortable).map((c) => c.key) as Exclude<ColumnKey, "trend">[];
export type SortKey = (typeof SORT_KEYS)[number];
export function sortValue(r: CampaignListRow, key: SortKey): number | string | null {
    switch (key) {
        case "name":
            return r.name;
        case "status":
            return r.status;
        case "bidding":
            return r.biddingLabel;
        case "budget":
            return r.dailyBudget;
        default:
            return r.metrics[key];
    }
}
export function sortCampaigns(rows: readonly CampaignListRow[], key: SortKey, dir: SortDir): CampaignListRow[] {
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
        const x = sortValue(a, key);
        const y = sortValue(b, key);
        const xMissing = x === null || (typeof x === "number" && !Number.isFinite(x));
        const yMissing = y === null || (typeof y === "number" && !Number.isFinite(y));
        if (xMissing || yMissing)
            return xMissing === yMissing ? a.name.localeCompare(b.name) : xMissing ? 1 : -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return c !== 0 ? c * sign : a.name.localeCompare(b.name);
    });
}
export function nextSort(cur: {
    key: SortKey;
    dir: SortDir;
}, key: SortKey): {
    key: SortKey;
    dir: SortDir;
} {
    if (cur.key === key)
        return { key, dir: cur.dir === "desc" ? "asc" : "desc" };
    return { key, dir: key === "name" || key === "status" || key === "bidding" ? "asc" : "desc" };
}
export const ZERO_METRICS: CampaignMetrics = { cost: 0, impressions: 0, clicks: 0, ctr: null, cpc: null, conversions: 0, cpa: null, roas: null, conv_value: 0, cvr: null };
export interface CampaignTotals extends CampaignMetrics {
    dailyBudget: number;
    count: number;
}
export function totalsOf(list: readonly CampaignMetrics[], budgets: readonly (number | null)[] = []): CampaignTotals {
    const sum = (k: "cost" | "impressions" | "clicks" | "conversions" | "conv_value") => list.reduce((s, m) => s + (Number.isFinite(m[k]) ? m[k] : 0), 0);
    const cost = sum("cost");
    const impressions = sum("impressions");
    const clicks = sum("clicks");
    const conversions = sum("conversions");
    const conv_value = sum("conv_value");
    const div = (a: number, b: number) => (b > 0 ? a / b : null);
    return {
        cost,
        impressions,
        clicks,
        ctr: div(clicks, impressions),
        cpc: div(cost, clicks),
        conversions,
        cpa: div(cost, conversions),
        roas: div(conv_value, cost),
        conv_value,
        cvr: div(conversions, clicks),
        dailyBudget: budgets.reduce<number>((s, b) => s + (b ?? 0), 0),
        count: list.length,
    };
}
export function csvCell(v: string | number | null | undefined): string {
    if (v === null || v === undefined)
        return "";
    if (typeof v === "number")
        return Number.isFinite(v) ? String(v) : "";
    let s = v;
    if (/^[=+\-@\t\r]/.test(s))
        s = `'${s}`;
    return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
const round = (v: number | null | undefined, d: number): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
export function campaignCsv(rows: readonly CampaignListRow[], visible: readonly ColumnKey[], m: MoneyFmt): string {
    const cols = CAMPAIGN_COLUMNS.filter((c) => visible.includes(c.key) && c.key !== "trend");
    const cur = m.currency;
    const header: string[] = [];
    for (const c of cols) {
        if (c.key === "name")
            header.push("Campaign", "Campaign ID", "Type");
        else if (c.key === "budget")
            header.push(`Daily budget (${cur})`);
        else if (c.metric && METRIC_META[c.metric].format === "money")
            header.push(`${c.metric === "cost" ? "Spend" : c.metric === "cpc" ? "Avg. CPC" : c.metric === "cpa" ? "CPA" : "Conv. value"} (${cur})`);
        else if (c.metric && METRIC_META[c.metric].format === "percent")
            header.push(`${c.metric === "ctr" ? "CTR" : "Conv. rate"} (%)`);
        else
            header.push(c.key === "impressions" ? "Impressions" : c.key === "conversions" ? "Conversions" : c.label);
    }
    const body = rows.map((r) => {
        const out: (string | number | null)[] = [];
        for (const c of cols) {
            if (c.key === "name")
                out.push(r.name, r.id, r.type);
            else if (c.key === "status")
                out.push(r.status);
            else if (c.key === "bidding")
                out.push(r.biddingLabel);
            else if (c.key === "budget")
                out.push(round(r.dailyBudget === null ? null : r.dailyBudget * m.fx, 2));
            else if (c.metric) {
                const meta = METRIC_META[c.metric];
                const v = r.metrics[c.metric];
                out.push(meta.format === "money" ? round(v === null ? null : v * m.fx, 2) : meta.format === "percent" ? round(v === null ? null : v * 100, 2) : meta.format === "ratio" ? round(v, 2) : round(v, 2));
            }
        }
        return out;
    });
    return `﻿${toCsv(header, body)}`;
}
export function accentHeadline(name: string): string {
    const clean = name.replace(/\*/g, "").replace(/\s+/g, " ").trim();
    if (!clean)
        return "*Campaign*";
    const last = [...clean.matchAll(/\s*(?:—|–|\|)\s*|\s+-\s+|\s*:\s+/g)].at(-1);
    const at = last?.index ?? 0;
    if (last && at > 0) {
        const cut = at + last[0].length;
        const tail = clean.slice(cut).trim();
        if (tail)
            return `${clean.slice(0, cut)}*${tail}*`;
    }
    const i = clean.lastIndexOf(" ");
    return i > 0 ? `${clean.slice(0, i + 1)}*${clean.slice(i + 1)}*` : `*${clean}*`;
}
export function keywordNotation(text: string, matchType: string): string {
    const t = matchType.toLowerCase();
    if (t === "exact")
        return `[${text}]`;
    if (t === "phrase")
        return `"${text}"`;
    return text;
}
export function adjustBudget(daily: number, pct: number): number {
    return Math.max(0.01, Math.round(daily * (1 + pct / 100) * 100) / 100);
}
export function formatPValue(p: number): string {
    if (!Number.isFinite(p))
        return "—";
    if (p < 0.001)
        return "< 0.001";
    return p < 0.01 ? p.toFixed(3) : p.toFixed(2);
}
export function formatP(p: number): string {
    const v = formatPValue(p);
    return v.startsWith("<") ? `p ${v}` : `p = ${v}`;
}
const IMPACT_NAMES: Record<ChangeImpactMetric["metric"], string> = { cost: "daily spend", conversions: "daily conversions", cpa: "CPA", ctr: "CTR" };
const IMPACT_DIRECTION: Record<ChangeImpactMetric["metric"], MetricDirection> = { cost: "neutral", conversions: "up_good", cpa: "down_good", ctr: "up_good" };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function metricChangeText(m: Pick<ChangeImpactMetric, "metric" | "deltaPct" | "p">, withP = true): string {
    const name = IMPACT_NAMES[m.metric];
    const d = m.deltaPct;
    const body = d === null || !Number.isFinite(d) ? `${name} could not be compared` : Math.abs(d) < 0.005 ? `${name} was flat` : `${name} ${d > 0 ? "rose" : "fell"} ${Math.round(Math.abs(d) * 100)}%`;
    return withP && d !== null ? `${body} (${formatP(m.p)})` : body;
}
export interface ImpactVerdict {
    text: string;
    tone: "good" | "bad" | "neutral";
    preliminary: boolean;
}
const PRIORITY: ChangeImpactMetric["metric"][] = ["cpa", "conversions", "cost", "ctr"];
export function impactVerdict(result: Pick<ChangeImpactResult, "metrics" | "after">): ImpactVerdict {
    const preliminary = result.after.days > 0 && result.after.days < 7;
    if (result.after.days === 0)
        return { text: "Too recent to measure — there is no complete day after this change yet.", tone: "neutral", preliminary: false };
    const sig = PRIORITY.map((k) => result.metrics.find((m) => m.metric === k)).filter((m): m is ChangeImpactMetric => !!m && m.significant && m.deltaPct !== null);
    const suffix = preliminary ? ` Preliminary: only ${result.after.days} day${result.after.days === 1 ? "" : "s"} of data after it.` : "";
    if (!sig.length) {
        const moved = [...result.metrics].filter((m) => m.deltaPct !== null).sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))[0];
        const detail = moved && Math.abs(moved.deltaPct ?? 0) >= 0.005 ? ` The largest move, ${metricChangeText(moved)}, is within normal day-to-day variation.` : "";
        return { text: `No significant change in spend, conversions, CPA or CTR after this change.${detail}${suffix}`, tone: "neutral", preliminary };
    }
    const lead = sig.slice(0, 2);
    const text = lead.length === 1
        ? `${capitalize(metricChangeText(lead[0] as ChangeImpactMetric, false))} after this change (${formatP((lead[0] as ChangeImpactMetric).p)}).`
        : `${capitalize(metricChangeText(lead[0] as ChangeImpactMetric))} and ${metricChangeText(lead[1] as ChangeImpactMetric)} after this change.`;
    const first = lead[0] as ChangeImpactMetric;
    const s = deltaSentiment(IMPACT_DIRECTION[first.metric], first.deltaPct);
    return { text: `${text}${suffix}`, tone: s === "good" ? "good" : s === "bad" ? "bad" : "neutral", preliminary };
}
