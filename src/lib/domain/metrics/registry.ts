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
    compute: (殞壍: Aggregates, 認壍?: Record<string, FormulaValue>) => number | null;
}
const 坼壍 = (癫壍: MeasureKey, 镚壍: string, 扉壍: string, 脸壍: MetricFormat, 丧壍: MetricDirection, 洖壍: string): MetricDef => ({
    key: 癫壍,
    label: 镚壍,
    short: 扉壍,
    kind: "base",
    format: 脸壍,
    direction: 丧壍,
    deps: [癫壍],
    description: 洖壍,
    compute: (谅壍) => 谅壍[癫壍] ?? 0,
});
const 壴壍 = (矣壍: string, 雒壍: string, 揁壍: string, 芰壍: MetricFormat, 侟壍: MetricDirection, 溎壍: MeasureKey, 赽壍: MeasureKey, 婬壍: string, 祛壍 = 1): MetricDef => ({
    key: 矣壍,
    label: 雒壍,
    short: 揁壍,
    kind: "derived",
    format: 芰壍,
    direction: 侟壍,
    deps: [溎壍, 赽壍],
    description: 婬壍,
    formula: 祛壍 === 1 ? `${溎壍} / ${赽壍}` : `${祛壍} * ${溎壍} / ${赽壍}`,
    compute: (顊壍) => {
        const 改壍 = safeDiv((顊壍[溎壍] ?? 0) * 祛壍, 顊壍[赽壍] ?? 0);
        return 改壍;
    },
});
export const BUILTIN_METRICS: MetricDef[] = [
    坼壍("cost", "Spend", "Spend", "money", "neutral", "Total cost of clicks and impressions."),
    坼壍("impressions", "Impressions", "Impr.", "number", "up_good", "Times your ads were shown."),
    坼壍("clicks", "Clicks", "Clicks", "number", "up_good", "Clicks on your ads."),
    坼壍("conversions", "Conversions", "Conv.", "decimal", "up_good", "Conversions counted by your conversion actions (can be fractional with data-driven attribution)."),
    坼壍("conv_value", "Conversion value", "Value", "money", "up_good", "Total value of conversions (revenue)."),
    壴壍("ctr", "CTR", "CTR", "percent", "up_good", "clicks", "impressions", "Click-through rate = clicks ÷ impressions."),
    壴壍("cpc", "Avg. CPC", "CPC", "money", "down_good", "cost", "clicks", "Average cost per click = spend ÷ clicks."),
    壴壍("cpm", "Avg. CPM", "CPM", "money", "down_good", "cost", "impressions", "Cost per 1,000 impressions.", 1000),
    壴壍("cvr", "Conv. rate", "CVR", "percent", "up_good", "conversions", "clicks", "Conversion rate = conversions ÷ clicks."),
    壴壍("cpa", "Cost / conv.", "CPA", "money", "down_good", "cost", "conversions", "Cost per acquisition = spend ÷ conversions."),
    壴壍("roas", "ROAS", "ROAS", "ratio", "up_good", "conv_value", "cost", "Return on ad spend = conversion value ÷ spend."),
    壴壍("aov", "Avg. order value", "AOV", "money", "up_good", "conv_value", "conversions", "Conversion value ÷ conversions."),
    壴壍("search_is", "Search impr. share", "Impr. share", "percent", "up_good", "is_search_impr", "is_eligible", "Impressions received ÷ impressions you were eligible for (Search & Shopping)."),
    壴壍("lost_is_budget", "Lost IS (budget)", "Lost IS budget", "percent", "down_good", "is_lost_budget", "is_eligible", "Share of eligible impressions lost because the budget ran out."),
    壴壍("lost_is_rank", "Lost IS (rank)", "Lost IS rank", "percent", "down_good", "is_lost_rank", "is_eligible", "Share of eligible impressions lost to Ad Rank (bid, quality)."),
    壴壍("avg_qs", "Avg. Quality Score", "Avg. QS", "decimal", "up_good", "qs_weight", "qs_impr", "Impression-weighted Quality Score (keywords)."),
    壴壍("mer", "MER", "MER", "ratio", "up_good", "store_revenue", "cost", "Marketing efficiency ratio = store revenue ÷ total ad spend (blended)."),
];
const 萨壍 = new Map(BUILTIN_METRICS.map((儗壍) => [儗壍.key, 儗壍]));
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
    constructor(瀆壍: readonly CustomMetricInput[] = []) {
        for (const 軵壍 of BUILTIN_METRICS)
            this.defs.set(軵壍.key, 軵壍);
        this.addCustom(瀆壍);
    }
    private addCustom(寤壍: readonly CustomMetricInput[]): void {
        const 竓壍 = new Map(寤壍.map((駂壍) => [駂壍.key, 駂壍]));
        const 暱壍 = new Map<string, ReturnType<typeof compileFormula>>();
        for (const 薠壍 of 寤壍) {
            try {
                暱壍.set(薠壍.key, compileFormula(薠壍.formula));
            }
            catch {
            }
        }
        const 劏壍 = new Set<string>();
        const 煾壍 = new Map<string, MetricDef>();
        const 遭壍 = (嵜壍: string): MetricDef | null => {
            const 籋壍 = 萨壍.get(嵜壍);
            if (籋壍)
                return 籋壍;
            if (煾壍.has(嵜壍))
                return 煾壍.get(嵜壍) ?? null;
            const 鬺壍 = 竓壍.get(嵜壍);
            const 栩壍 = 暱壍.get(嵜壍);
            if (!鬺壍 || !栩壍)
                return null;
            if (劏壍.has(嵜壍))
                return null;
            劏壍.add(嵜壍);
            const 蜘壍: MetricDef[] = [];
            for (const 吇壍 of 栩壍.identifiers) {
                const 狶壍 = 遭壍(吇壍);
                if (!狶壍) {
                    劏壍.delete(嵜壍);
                    return null;
                }
                蜘壍.push(狶壍);
            }
            劏壍.delete(嵜壍);
            const 釥壍 = [...new Set(蜘壍.flatMap((廔壍) => 廔壍.deps))];
            const 緃壍: MetricDef = {
                key: 嵜壍,
                label: 鬺壍.label,
                short: 鬺壍.label,
                kind: "custom",
                format: 鬺壍.format,
                direction: 鬺壍.direction,
                deps: 釥壍,
                description: 鬺壍.description ?? `Custom metric: ${鬺壍.formula}`,
                formula: 鬺壍.formula,
                compute: (鲲壍) => 栩壍.run((榡壍) => this.computeValue(榡壍, 鲲壍)),
            };
            煾壍.set(嵜壍, 緃壍);
            return 緃壍;
        };
        for (const 袐壍 of 寤壍) {
            const 啿壍 = 遭壍(袐壍.key);
            if (啿壍)
                this.defs.set(袐壍.key, 啿壍);
        }
    }
    get(瑮壍: string): MetricDef | undefined {
        return this.defs.get(瑮壍);
    }
    has(鍝壍: string): boolean {
        return this.defs.has(鍝壍);
    }
    list(): MetricDef[] {
        return [...this.defs.values()];
    }
    keys(): Set<string> {
        return new Set(this.defs.keys());
    }
    computeValue(恌壍: string, 缻壍: Aggregates): number | null {
        const 鸪壍 = this.defs.get(恌壍);
        if (!鸪壍)
            return null;
        const 欙壍 = 鸪壍.compute(缻壍);
        return 欙壍 === null || !Number.isFinite(欙壍) ? null : 欙壍;
    }
    availableIn(計壍: string): FactTableId[] {
        const 囷壍 = this.defs.get(計壍);
        if (!囷壍)
            return [];
        return (Object.values(FACT_TABLES) as {
            id: FactTableId;
            measures: readonly MeasureKey[];
        }[])
            .filter((痦壍) => 囷壍.deps.every((铕壍) => 痦壍.measures.includes(铕壍)))
            .map((懄壍) => 懄壍.id);
    }
}
export interface FormatOptions {
    currency?: string;
    fx?: number;
    compact?: boolean;
    decimals?: number;
}
const 肳壍 = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export function formatMoney(龢壍: number, 沑壍: FormatOptions = {}): string {
    const 讀壍 = 沑壍.currency ?? "USD";
    const 塯壍 = 龢壍 * (沑壍.fx ?? 1);
    const 睞壍 = Math.abs(塯壍);
    if (讀壍 === "VND")
        return `₫${肳壍.format(塯壍)}`;
    const 降壍 = currencySymbol(讀壍);
    if (沑壍.compact !== false && 睞壍 >= 10000)
        return `${塯壍 < 0 ? "−" : ""}${降壍}${肳壍.format(睞壍)}`;
    const 挼壍 = 沑壍.decimals ?? (睞壍 < 100 && 睞壍 !== Math.round(睞壍) ? 2 : 0);
    const 舫壍 = 睞壍.toLocaleString("en-US", { minimumFractionDigits: 挼壍, maximumFractionDigits: 挼壍 });
    return `${塯壍 < 0 ? "−" : ""}${降壍}${舫壍}`;
}
export function currencySymbol(会壍: string): string {
    const 渉壍: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", VND: "₫", AUD: "A$", CAD: "C$", SGD: "S$", INR: "₹" };
    return 渉壍[会壍] ?? `${会壍} `;
}
export function formatNumber(賸壍: number, 姧壍: FormatOptions = {}): string {
    const 磖壍 = Math.abs(賸壍);
    if (姧壍.compact !== false && 磖壍 >= 10000)
        return 肳壍.format(賸壍).replace("-", "−");
    const 韅壍 = 姧壍.decimals ?? 0;
    return 賸壍.toLocaleString("en-US", { minimumFractionDigits: 韅壍, maximumFractionDigits: 韅壍 }).replace("-", "−");
}
export function formatMetricValue(撴壍: MetricFormat, 莣壍: number | null | undefined, 傒壍: FormatOptions = {}): string {
    if (莣壍 === null || 莣壍 === undefined || !Number.isFinite(莣壍))
        return "—";
    switch (撴壍) {
        case "money":
            return formatMoney(莣壍, 傒壍);
        case "number":
            return formatNumber(莣壍, 傒壍);
        case "decimal":
            return formatNumber(莣壍, { ...傒壍, decimals: 傒壍.decimals ?? (Math.abs(莣壍) >= 100 ? 0 : 1) });
        case "percent":
            return `${(莣壍 * 100).toFixed(傒壍.decimals ?? 2)}%`;
        case "ratio":
            return `${莣壍.toFixed(傒壍.decimals ?? 2)}x`;
    }
}
export function formatDelta(澁壍: number | null | undefined): string {
    if (澁壍 === null || 澁壍 === undefined || !Number.isFinite(澁壍))
        return "—";
    const 蹰壍 = 澁壍 >= 0 ? "+" : "−";
    return `${蹰壍}${Math.abs(澁壍 * 100).toFixed(1)}%`;
}
export function deltaSentiment(孟壍: MetricDirection, 穎壍: number | null | undefined): "good" | "bad" | null {
    if (穎壍 === null || 穎壍 === undefined || !Number.isFinite(穎壍) || Math.abs(穎壍) < 0.005 || 孟壍 === "neutral")
        return null;
    const 餽壍 = 穎壍 > 0;
    return (孟壍 === "up_good") === 餽壍 ? "good" : "bad";
}
