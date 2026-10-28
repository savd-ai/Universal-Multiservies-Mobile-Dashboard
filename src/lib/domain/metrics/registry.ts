import type { FactTableId, MeasureKey } from "../schema/facts";
import { FACT_TABLES } from "../schema/facts";
import { safeDiv } from "../stats";
import type { MetricDirection, MetricFormat } from "../types";
import { compileFormula, type FormulaValue } from "./formula";
export type Aggregates = Partial<Record<MeasureKey, number>>;
export interface MetricDef {
    key: string;
    label: string;
    short: string;
    kind: "base" | "derived" | "custom";
    format: MetricFormat;
    direction: MetricDirection;
    deps: MeasureKey[];
    description: string;
    formula?: string;
    compute: (agg: Aggregates, values?: Record<string, FormulaValue>) => number | null;
}
const base = (key: MeasureKey, label: string, short: string, format: MetricFormat, direction: MetricDirection, description: string): MetricDef => ({
    key,
    label,
    short,
    kind: "base",
    format,
    direction,
    deps: [key],
    description,
    compute: (agg) => agg[key] ?? 0,
});
const ratio = (key: string, label: string, short: string, format: MetricFormat, direction: MetricDirection, num: MeasureKey, den: MeasureKey, description: string, scale = 1): MetricDef => ({
    key,
    label,
    short,
    kind: "derived",
    format,
    direction,
    deps: [num, den],
    description,
    formula: scale === 1 ? `${num} / ${den}` : `${scale} * ${num} / ${den}`,
    compute: (agg) => {
        const v = safeDiv((agg[num] ?? 0) * scale, agg[den] ?? 0);
        return v;
    },
});
export const BUILTIN_METRICS: MetricDef[] = [
    base("cost", "Spend", "Spend", "money", "neutral", "Total cost of clicks and impressions."),
    base("impressions", "Impressions", "Impr.", "number", "up_good", "Times your ads were shown."),
    base("clicks", "Clicks", "Clicks", "number", "up_good", "Clicks on your ads."),
    base("conversions", "Conversions", "Conv.", "decimal", "up_good", "Conversions counted by your conversion actions (can be fractional with data-driven attribution)."),
    base("conv_value", "Conversion value", "Value", "money", "up_good", "Total value of conversions (revenue)."),
    ratio("ctr", "CTR", "CTR", "percent", "up_good", "clicks", "impressions", "Click-through rate = clicks ÷ impressions."),
    ratio("cpc", "Avg. CPC", "CPC", "money", "down_good", "cost", "clicks", "Average cost per click = spend ÷ clicks."),
    ratio("cpm", "Avg. CPM", "CPM", "money", "down_good", "cost", "impressions", "Cost per 1,000 impressions.", 1000),
    ratio("cvr", "Conv. rate", "CVR", "percent", "up_good", "conversions", "clicks", "Conversion rate = conversions ÷ clicks."),
    ratio("cpa", "Cost / conv.", "CPA", "money", "down_good", "cost", "conversions", "Cost per acquisition = spend ÷ conversions."),
    ratio("roas", "ROAS", "ROAS", "ratio", "up_good", "conv_value", "cost", "Return on ad spend = conversion value ÷ spend."),
    ratio("aov", "Avg. order value", "AOV", "money", "up_good", "conv_value", "conversions", "Conversion value ÷ conversions."),
    ratio("search_is", "Search impr. share", "Impr. share", "percent", "up_good", "is_search_impr", "is_eligible", "Impressions received ÷ impressions you were eligible for (Search & Shopping)."),
    ratio("lost_is_budget", "Lost IS (budget)", "Lost IS budget", "percent", "down_good", "is_lost_budget", "is_eligible", "Share of eligible impressions lost because the budget ran out."),
    ratio("lost_is_rank", "Lost IS (rank)", "Lost IS rank", "percent", "down_good", "is_lost_rank", "is_eligible", "Share of eligible impressions lost to Ad Rank (bid, quality)."),
    ratio("avg_qs", "Avg. Quality Score", "Avg. QS", "decimal", "up_good", "qs_weight", "qs_impr", "Impression-weighted Quality Score (keywords)."),
    ratio("mer", "MER", "MER", "ratio", "up_good", "store_revenue", "cost", "Marketing efficiency ratio = store revenue ÷ total ad spend (blended)."),
];
const BUILTIN_BY_KEY = new Map(BUILTIN_METRICS.map((m) => [m.key, m]));
export interface CustomMetricInput {
    key: string;
    label: string;
    formula: string;
    format: MetricFormat;
    direction: MetricDirection;
    description?: string;
}
export class MetricRegistry {
    private readonly defs = new Map<string, MetricDef>();
    constructor(custom: readonly CustomMetricInput[] = []) {
        for (const m of BUILTIN_METRICS)
            this.defs.set(m.key, m);
        this.addCustom(custom);
    }
    private addCustom(custom: readonly CustomMetricInput[]): void {
        const pending = new Map(custom.map((c) => [c.key, c]));
        const compiled = new Map<string, ReturnType<typeof compileFormula>>();
        for (const c of custom) {
            try {
                compiled.set(c.key, compileFormula(c.formula));
            }
            catch {
            }
        }
        const visiting = new Set<string>();
        const done = new Map<string, MetricDef>();
        const resolveDef = (key: string): MetricDef | null => {
            const builtin = BUILTIN_BY_KEY.get(key);
            if (builtin)
                return builtin;
            if (done.has(key))
                return done.get(key) ?? null;
            const input = pending.get(key);
            const comp = compiled.get(key);
            if (!input || !comp)
                return null;
            if (visiting.has(key))
                return null;
            visiting.add(key);
            const depDefs: MetricDef[] = [];
            for (const id of comp.identifiers) {
                const d = resolveDef(id);
                if (!d) {
                    visiting.delete(key);
                    return null;
                }
                depDefs.push(d);
            }
            visiting.delete(key);
            const deps = [...new Set(depDefs.flatMap((d) => d.deps))];
            const def: MetricDef = {
                key,
                label: input.label,
                short: input.label,
                kind: "custom",
                format: input.format,
                direction: input.direction,
                deps,
                description: input.description ?? `Custom metric: ${input.formula}`,
                formula: input.formula,
                compute: (agg) => comp.run((name) => this.computeValue(name, agg)),
            };
            done.set(key, def);
            return def;
        };
        for (const c of custom) {
            const def = resolveDef(c.key);
            if (def)
                this.defs.set(c.key, def);
        }
    }
    get(key: string): MetricDef | undefined {
        return this.defs.get(key);
    }
    has(key: string): boolean {
        return this.defs.has(key);
    }
    list(): MetricDef[] {
        return [...this.defs.values()];
    }
    keys(): Set<string> {
        return new Set(this.defs.keys());
    }
    computeValue(key: string, agg: Aggregates): number | null {
        const def = this.defs.get(key);
        if (!def)
            return null;
        const v = def.compute(agg);
        return v === null || !Number.isFinite(v) ? null : v;
    }
    availableIn(key: string): FactTableId[] {
        const def = this.defs.get(key);
        if (!def)
            return [];
        return (Object.values(FACT_TABLES) as {
            id: FactTableId;
            measures: readonly MeasureKey[];
        }[])
            .filter((t) => def.deps.every((d) => t.measures.includes(d)))
            .map((t) => t.id);
    }
}
export interface FormatOptions {
    currency?: string;
    fx?: number;
    compact?: boolean;
    decimals?: number;
}
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export function formatMoney(v: number, opts: FormatOptions = {}): string {
    const currency = opts.currency ?? "USD";
    const value = v * (opts.fx ?? 1);
    const abs = Math.abs(value);
    if (currency === "VND")
        return `₫${compactFmt.format(value)}`;
    const currencySymbol2 = currencySymbol(currency);
    if (opts.compact !== false && abs >= 10000)
        return `${value < 0 ? "−" : ""}${currencySymbol2}${compactFmt.format(abs)}`;
    const decimals = opts.decimals ?? (abs < 100 && abs !== Math.round(abs) ? 2 : 0);
    const body = abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${value < 0 ? "−" : ""}${currencySymbol2}${body}`;
}
export function currencySymbol(currency: string): string {
    const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", VND: "₫", AUD: "A$", CAD: "C$", SGD: "S$", INR: "₹" };
    return map[currency] ?? `${currency} `;
}
export function formatNumber(v: number, opts: FormatOptions = {}): string {
    const abs = Math.abs(v);
    if (opts.compact !== false && abs >= 10000)
        return compactFmt.format(v).replace("-", "−");
    const decimals = opts.decimals ?? 0;
    return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace("-", "−");
}
export function formatMetricValue(format: MetricFormat, v: number | null | undefined, opts: FormatOptions = {}): string {
    if (v === null || v === undefined || !Number.isFinite(v))
        return "—";
    switch (format) {
        case "money":
            return formatMoney(v, opts);
        case "number":
            return formatNumber(v, opts);
        case "decimal":
            return formatNumber(v, { ...opts, decimals: opts.decimals ?? (Math.abs(v) >= 100 ? 0 : 1) });
        case "percent":
            return `${(v * 100).toFixed(opts.decimals ?? 2)}%`;
        case "ratio":
            return `${v.toFixed(opts.decimals ?? 2)}x`;
    }
}
export function formatDelta(pct: number | null | undefined): string {
    if (pct === null || pct === undefined || !Number.isFinite(pct))
        return "—";
    const sign = pct >= 0 ? "+" : "−";
    return `${sign}${Math.abs(pct * 100).toFixed(1)}%`;
}
export function deltaSentiment(direction: MetricDirection, pct: number | null | undefined): "good" | "bad" | null {
    if (pct === null || pct === undefined || !Number.isFinite(pct) || Math.abs(pct) < 0.005 || direction === "neutral")
        return null;
    const up = pct > 0;
    return (direction === "up_good") === up ? "good" : "bad";
}
