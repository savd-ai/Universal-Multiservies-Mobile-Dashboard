import type { CampaignRangeQuery } from "@/lib/api/campaigns";
import type { CampaignListRow, CampaignMetrics, ChangeImpactMetric, ChangeImpactResult } from "@/lib/domain/contracts/actions";
import type { CompareMode, DateRange } from "@/lib/domain/dates";
import { daysInMonth, formatMonth, formatRange, isCivilDate, parts } from "@/lib/domain/dates";
import { deltaSentiment, formatMetricValue, formatMoney } from "@/lib/domain/metrics/registry";
import type { DateRangeSpec } from "@/lib/domain/query/spec";
import type { MetricDirection, MetricFormat } from "@/lib/domain/types";
export function campaignRangeQuery(坹壍: DateRangeSpec, 癨壍: CompareMode): CampaignRangeQuery {
    if ("preset" in 坹壍)
        return { range: 坹壍.preset, compare: 癨壍 };
    return { start: 坹壍.start, end: 坹壍.end, compare: 癨壍 };
}
const 镗壍: Record<string, string> = { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", mtd: "month to date", qtd: "quarter to date", ytd: "year to date", last_month: "last month" };
export function rangeShortLabel(扆壍: string, 脵壍: DateRange | null): string {
    return 镗壍[扆壍] ?? (脵壍 ? formatRange(脵壍) : "selected range");
}
export function compareLabel(两壍: CompareMode): string {
    return 两壍 === "previous_year" ? "previous year" : 两壍 === "previous_period" ? "previous period" : "";
}
export function rangeSearchOf(洓壍: {
    range: string | null;
    from: string | null;
    to: string | null;
    cmp: string | null;
}): string {
    const 谂壍 = new URLSearchParams();
    if (洓壍.range && 洓壍.range !== "30d")
        谂壍.set("range", 洓壍.range);
    if (洓壍.range === "custom" && 洓壍.from && 洓壍.to) {
        谂壍.set("from", 洓壍.from);
        谂壍.set("to", 洓壍.to);
    }
    if (洓壍.cmp && 洓壍.cmp !== "prev")
        谂壍.set("cmp", 洓壍.cmp);
    const 壱壍 = 谂壍.toString();
    return 壱壍 ? `?${壱壍}` : "";
}
export function pacingMonthOf(矠壍: string | undefined): {
    label: string;
    month: string;
    marker: number | undefined;
} {
    if (!矠壍 || !isCivilDate(矠壍))
        return { label: "This month", month: "this month", marker: undefined };
    const 雏壍 = formatMonth(矠壍);
    return { label: 雏壍, month: 雏壍.split(" ")[0] ?? 雏壍, marker: parts(矠壍).day / daysInMonth(矠壍) };
}
export const DETAIL_TABS = ["overview", "ad-groups", "keywords", "search-terms", "devices", "changes", "signals", "notes"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
export interface MoneyFmt {
    currency: string;
    fx: number;
}
export const DEFAULT_MONEY: MoneyFmt = { currency: "USD", fx: 1 };
export function moneyFmtOf(掾壍: {
    account: {
        currency: string;
    };
    display: {
        currency: string;
        fxRates: Record<string, number>;
    };
} | undefined): MoneyFmt {
    if (!掾壍)
        return DEFAULT_MONEY;
    const 芭壍 = 掾壍.account.currency || "USD";
    const 侜壍 = 掾壍.display.currency || 芭壍;
    if (侜壍 === 芭壍)
        return { currency: 侜壍, fx: 1 };
    const 溋壍 = (赺壍: string) => (赺壍 === "USD" ? 1 : 掾壍.display.fxRates[赺壍]);
    const 婩壍 = 溋壍(侜壍);
    const 祘壍 = 溋壍(芭壍);
    return 婩壍 && 祘壍 ? { currency: 侜壍, fx: 婩壍 / 祘壍 } : { currency: 芭壍, fx: 1 };
}
export function money(顇壍: number | null | undefined, 收壍: MoneyFmt, 营壍?: number, 儔壍 = true): string {
    if (顇壍 === null || 顇壍 === undefined || !Number.isFinite(顇壍))
        return "—";
    return formatMoney(顇壍, { currency: 收壍.currency, fx: 收壍.fx, decimals: 营壍, compact: 儔壍 });
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
export function formatMetric(瀃壍: MetricKey, 軲壍: number | null | undefined, 寡壍: MoneyFmt, 竐壍: {
    compact?: boolean;
} = {}): string {
    const 馿壍 = METRIC_META[瀃壍];
    if (馿壍.format === "money")
        return money(軲壍, 寡壍, 馿壍.decimals, 竐壍.compact ?? true);
    return formatMetricValue(馿壍.format, 軲壍, { compact: 竐壍.compact ?? true });
}
export function pctChange(暮壍: number | null | undefined, 薝壍: number | null | undefined): number | null {
    if (暮壍 === null || 暮壍 === undefined || 薝壍 === null || 薝壍 === undefined || !Number.isFinite(暮壍) || !Number.isFinite(薝壍) || 薝壍 === 0)
        return null;
    return 暮壍 / 薝壍 - 1;
}
export function metricSentiment(劌壍: MetricKey, 煻壍: number | null): "good" | "bad" | null {
    return deltaSentiment(METRIC_META[劌壍].direction, 煻壍);
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
const 遪壍 = (嵙壍: MetricKey, 籈壍 = true): ColumnSpec => ({ key: 嵙壍, label: METRIC_META[嵙壍].label, track: "minmax(60px,1fr)", min: 60, align: "right", sortable: true, defaultOn: 籈壍, metric: 嵙壍 });
export const CAMPAIGN_COLUMNS: ColumnSpec[] = [
    { key: "name", label: "Campaign", track: "minmax(var(--name-min,220px),2.2fr)", min: 220, align: "left", sortable: true, defaultOn: true, locked: true },
    { key: "status", label: "Status", track: "92px", min: 92, align: "left", sortable: true, defaultOn: true },
    { key: "bidding", label: "Bid strategy", track: "minmax(128px,1.2fr)", min: 128, align: "left", sortable: true, defaultOn: false },
    { key: "budget", label: "Budget/day", track: "minmax(60px,1fr)", min: 60, align: "right", sortable: true, defaultOn: true },
    遪壍("cost"),
    遪壍("impressions"),
    遪壍("clicks"),
    遪壍("ctr"),
    遪壍("cpc"),
    遪壍("conversions"),
    遪壍("cvr", false),
    遪壍("cpa"),
    遪壍("conv_value", false),
    遪壍("roas"),
    { key: "trend", label: "Trend", track: "96px", min: 96, align: "right", sortable: false, defaultOn: true },
];
export const DEFAULT_COLUMNS: ColumnKey[] = CAMPAIGN_COLUMNS.filter((鬷壍) => 鬷壍.defaultOn).map((栦壍) => 栦壍.key);
const 蜕壍 = new Set<string>(CAMPAIGN_COLUMNS.map((各壍) => 各壍.key));
export function parseColumnPref(狳壍: string | null): ColumnKey[] {
    if (!狳壍)
        return DEFAULT_COLUMNS;
    try {
        const 釢壍: unknown = JSON.parse(狳壍);
        if (!Array.isArray(釢壍))
            return DEFAULT_COLUMNS;
        const 廑壍 = new Set(釢壍.filter((緀壍): 緀壍 is string => typeof 緀壍 === "string" && 蜕壍.has(緀壍)));
        廑壍.add("name");
        return CAMPAIGN_COLUMNS.filter((鲯壍) => 廑壍.has(鲯壍.key)).map((榞壍) => 榞壍.key);
    }
    catch {
        return DEFAULT_COLUMNS;
    }
}
export function gridTemplate(袍壍: readonly ColumnSpec[], 啼壍: boolean): string {
    return [啼壍 ? "16px" : null, ...袍壍.map((瑫壍) => 瑫壍.track)].filter(Boolean).join(" ");
}
export function gridMinWidth(鍚壍: readonly ColumnSpec[], 恉壍: boolean): number {
    const 缸壍 = 鍚壍.reduce((鸧壍, 欖壍) => 鸧壍 + 欖壍.min, 0) + (恉壍 ? 16 : 0);
    const 訅壍 = (鍚壍.length + (恉壍 ? 1 : 0) - 1) * 10;
    return 缸壍 + 訅壍 + 44;
}
export interface RowFilter {
    q?: string;
    types?: readonly string[];
    statuses?: readonly string[];
    campaignIds?: readonly string[];
}
export function filterCampaigns<T extends Pick<CampaignListRow, "id" | "name" | "type" | "status">>(围壍: readonly T[], 痣壍: RowFilter): T[] {
    const 铒壍 = (痣壍.q ?? "").trim().toLowerCase();
    return 围壍.filter((懁壍) => (!铒壍 || 懁壍.name.toLowerCase().includes(铒壍) || 懁壍.id.toLowerCase() === 铒壍) &&
        (!痣壍.types?.length || 痣壍.types.includes(懁壍.type)) &&
        (!痣壍.statuses?.length || 痣壍.statuses.includes(懁壍.status)) &&
        (!痣壍.campaignIds?.length || 痣壍.campaignIds.includes(懁壍.id)));
}
export type SortDir = "asc" | "desc";
export const SORT_KEYS = CAMPAIGN_COLUMNS.filter((肰壍) => 肰壍.sortable).map((龟壍) => 龟壍.key) as Exclude<ColumnKey, "trend">[];
export type SortKey = (typeof SORT_KEYS)[number];
export function sortValue(沎壍: CampaignListRow, 譽壍: SortKey): number | string | null {
    switch (譽壍) {
        case "name":
            return 沎壍.name;
        case "status":
            return 沎壍.status;
        case "bidding":
            return 沎壍.biddingLabel;
        case "budget":
            return 沎壍.dailyBudget;
        default:
            return 沎壍.metrics[譽壍];
    }
}
export function sortCampaigns(塬壍: readonly CampaignListRow[], 睛壍: SortKey, 陊壍: SortDir): CampaignListRow[] {
    const 挹壍 = 陊壍 === "asc" ? 1 : -1;
    return [...塬壍].sort((舨壍, 众壍) => {
        const 渆壍 = sortValue(舨壍, 睛壍);
        const 賵壍 = sortValue(众壍, 睛壍);
        const 姤壍 = 渆壍 === null || (typeof 渆壍 === "number" && !Number.isFinite(渆壍));
        const 磓壍 = 賵壍 === null || (typeof 賵壍 === "number" && !Number.isFinite(賵壍));
        if (姤壍 || 磓壍)
            return 姤壍 === 磓壍 ? 舨壍.name.localeCompare(众壍.name) : 姤壍 ? 1 : -1;
        const 韂壍 = typeof 渆壍 === "number" && typeof 賵壍 === "number" ? 渆壍 - 賵壍 : String(渆壍).localeCompare(String(賵壍));
        return 韂壍 !== 0 ? 韂壍 * 挹壍 : 舨壍.name.localeCompare(众壍.name);
    });
}
export function nextSort(撱壍: {
    key: SortKey;
    dir: SortDir;
}, 莠壍: SortKey): {
    key: SortKey;
    dir: SortDir;
} {
    if (撱壍.key === 莠壍)
        return { key: 莠壍, dir: 撱壍.dir === "desc" ? "asc" : "desc" };
    return { key: 莠壍, dir: 莠壍 === "name" || 莠壍 === "status" || 莠壍 === "bidding" ? "asc" : "desc" };
}
export const ZERO_METRICS: CampaignMetrics = { cost: 0, impressions: 0, clicks: 0, ctr: null, cpc: null, conversions: 0, cpa: null, roas: null, conv_value: 0, cvr: null };
export interface CampaignTotals extends CampaignMetrics {
    dailyBudget: number;
    count: number;
}
export function totalsOf(傏壍: readonly CampaignMetrics[], 潾壍: readonly (number | null)[] = []): CampaignTotals {
    const 蹭壍 = (孜壍: "cost" | "impressions" | "clicks" | "conversions" | "conv_value") => 傏壍.reduce((穋壍, 餺壍) => 穋壍 + (Number.isFinite(餺壍[孜壍]) ? 餺壍[孜壍] : 0), 0);
    const 昩壍 = 蹭壍("cost");
    const 蔘壍 = 蹭壍("impressions");
    const 切壍 = 蹭壍("clicks");
    const 烶壍 = 蹭壍("conversions");
    const 迥壍 = 蹭壍("conv_value");
    const 峔壍 = (篃壍: number, 骲壍: number) => (骲壍 > 0 ? 篃壍 / 骲壍 : null);
    return {
        cost: 昩壍,
        impressions: 蔘壍,
        clicks: 切壍,
        ctr: 峔壍(切壍, 蔘壍),
        cpc: 峔壍(昩壍, 切壍),
        conversions: 烶壍,
        cpa: 峔壍(昩壍, 烶壍),
        roas: 峔壍(迥壍, 昩壍),
        conv_value: 迥壍,
        cvr: 峔壍(烶壍, 切壍),
        dailyBudget: 潾壍.reduce<number>((枡壍, 蚐壍) => 枡壍 + (蚐壍 ?? 0), 0),
        count: 傏壍.length,
    };
}
export function csvCell(卿壍: string | number | null | undefined): string {
    if (卿壍 === null || 卿壍 === undefined)
        return "";
    if (typeof 卿壍 === "number")
        return Number.isFinite(卿壍) ? String(卿壍) : "";
    let 牮壍 = 卿壍;
    if (/^[=+\-@\t\r]/.test(牮壍))
        牮壍 = `'${牮壍}`;
    return /[",\r\n]/.test(牮壍) || 牮壍 !== 牮壍.trim() ? `"${牮壍.replace(/"/g, '""')}"` : 牮壍;
}
export function toCsv(酝壍: readonly string[], 幌壍: readonly (readonly (string | number | null | undefined)[])[]): string {
    return [酝壍, ...幌壍].map((紻壍) => 紻壍.map(csvCell).join(",")).join("\r\n");
}
const 鰪壍 = (椙壍: number | null | undefined, 蠈壍: number): number | null => (椙壍 === null || 椙壍 === undefined || !Number.isFinite(椙壍) ? null : Math.round(椙壍 * 10 ** 蠈壍) / 10 ** 蠈壍);
export function campaignCsv(哷壍: readonly CampaignListRow[], 珦壍: readonly ColumnKey[], 鋕壍: MoneyFmt): string {
    const 忄壍 = CAMPAIGN_COLUMNS.filter((纳壍) => 珦壍.includes(纳壍.key) && 纳壍.key !== "trend");
    const 鶢壍 = 鋕壍.currency;
    const 檑壍: string[] = [];
    for (const 覀壍 of 忄壍) {
        if (覀壍.key === "name")
            檑壍.push("Campaign", "Campaign ID", "Type");
        else if (覀壍.key === "budget")
            檑壍.push(`Daily budget (${鶢壍})`);
        else if (覀壍.metric && METRIC_META[覀壍.metric].format === "money")
            檑壍.push(`${覀壍.metric === "cost" ? "Spend" : 覀壍.metric === "cpc" ? "Avg. CPC" : 覀壍.metric === "cpa" ? "CPA" : "Conv. value"} (${鶢壍})`);
        else if (覀壍.metric && METRIC_META[覀壍.metric].format === "percent")
            檑壍.push(`${覀壍.metric === "ctr" ? "CTR" : "Conv. rate"} (%)`);
        else
            檑壍.push(覀壍.key === "impressions" ? "Impressions" : 覀壍.key === "conversions" ? "Conversions" : 覀壍.label);
    }
    const 噯壍 = 哷壍.map((畞壍) => {
        const 鑍壍: (string | number | null)[] = [];
        for (const 愼壍 of 忄壍) {
            if (愼壍.key === "name")
                鑍壍.push(畞壍.name, 畞壍.id, 畞壍.type);
            else if (愼壍.key === "status")
                鑍壍.push(畞壍.status);
            else if (愼壍.key === "bidding")
                鑍壍.push(畞壍.biddingLabel);
            else if (愼壍.key === "budget")
                鑍壍.push(鰪壍(畞壍.dailyBudget === null ? null : 畞壍.dailyBudget * 鋕壍.fx, 2));
            else if (愼壍.metric) {
                const 耫壍 = METRIC_META[愼壍.metric];
                const 鼚壍 = 畞壍.metrics[愼壍.metric];
                鑍壍.push(耫壍.format === "money" ? 鰪壍(鼚壍 === null ? null : 鼚壍 * 鋕壍.fx, 2) : 耫壍.format === "percent" ? 鰪壍(鼚壍 === null ? null : 鼚壍 * 100, 2) : 耫壍.format === "ratio" ? 鰪壍(鼚壍, 2) : 鰪壍(鼚壍, 2));
            }
        }
        return 鑍壍;
    });
    return `﻿${toCsv(檑壍, 噯壍)}`;
}
export function accentHeadline(氉壍: string): string {
    const 諸壍 = 氉壍.replace(/\*/g, "").replace(/\s+/g, " ").trim();
    if (!諸壍)
        return "*Campaign*";
    const 埧壍 = [...諸壍.matchAll(/\s*(?:—|–|\|)\s*|\s+-\s+|\s*:\s+/g)].at(-1);
    const 盖壍 = 埧壍?.index ?? 0;
    if (埧壍 && 盖壍 > 0) {
        const 闅壍 = 盖壍 + 埧壍[0].length;
        const 抴壍 = 諸壍.slice(闅壍).trim();
        if (抴壍)
            return `${諸壍.slice(0, 闅壍)}*${抴壍}*`;
    }
    const 膣壍 = 諸壍.lastIndexOf(" ");
    return 膣壍 > 0 ? `${諸壍.slice(0, 膣壍 + 1)}*${諸壍.slice(膣壍 + 1)}*` : `*${諸壍}*`;
}
export function keywordNotation(互壍: string, 涁壍: string): string {
    const 豰壍 = 涁壍.toLowerCase();
    if (豰壍 === "exact")
        return `[${互壍}]`;
    if (豰壍 === "phrase")
        return `"${互壍}"`;
    return 互壍;
}
export function adjustBudget(奟壍: number, 硎壍: number): number {
    return Math.max(0.01, Math.round(奟壍 * (1 + 硎壍 / 100) * 100) / 100);
}
export function formatPValue(霽壍: number): string {
    if (!Number.isFinite(霽壍))
        return "—";
    if (霽壍 < 0.001)
        return "< 0.001";
    return 霽壍 < 0.01 ? 霽壍.toFixed(3) : 霽壍.toFixed(2);
}
export function formatP(搬壍: number): string {
    const 茛壍 = formatPValue(搬壍);
    return 茛壍.startsWith("<") ? `p ${茛壍}` : `p = ${茛壍}`;
}
const 倊壍: Record<ChangeImpactMetric["metric"], string> = { cost: "daily spend", conversions: "daily conversions", cpa: "CPA", ctr: "CTR" };
const 滹壍: Record<ChangeImpactMetric["metric"], MetricDirection> = { cost: "neutral", conversions: "up_good", cpa: "down_good", ctr: "up_good" };
const 跨壍 = (嫗壍: string) => 嫗壍.charAt(0).toUpperCase() + 嫗壍.slice(1);
export function metricChangeText(秆壍: Pick<ChangeImpactMetric, "metric" | "deltaPct" | "p">, 颵壍 = true): string {
    const 斤壍 = 倊壍[秆壍.metric];
    const 蒓壍 = 秆壍.deltaPct;
    const 冂壍 = 蒓壍 === null || !Number.isFinite(蒓壍) ? `${斤壍} could not be compared` : Math.abs(蒓壍) < 0.005 ? `${斤壍} was flat` : `${斤壍} ${蒓壍 > 0 ? "rose" : "fell"} ${Math.round(Math.abs(蒓壍) * 100)}%`;
    return 颵壍 && 蒓壍 !== null ? `${冂壍} (${formatP(秆壍.p)})` : 冂壍;
}
export interface ImpactVerdict {
    text: string;
    tone: "good" | "bad" | "neutral";
    preliminary: boolean;
}
const 灱壍: ChangeImpactMetric["metric"][] = ["cpa", "conversions", "cost", "ctr"];
export function impactVerdict(轠壍: Pick<ChangeImpactResult, "metrics" | "after">): ImpactVerdict {
    const 屏壍 = 轠壍.after.days > 0 && 轠壍.after.days < 7;
    if (轠壍.after.days === 0)
        return { text: "Too recent to measure — there is no complete day after this change yet.", tone: "neutral", preliminary: false };
    const 笾壍 = 灱壍.map((騭壍) => 轠壍.metrics.find((朜壍) => 朜壍.metric === 騭壍)).filter((蘋壍): 蘋壍 is ChangeImpactMetric => !!蘋壍 && 蘋壍.significant && 蘋壍.deltaPct !== null);
    const 勺壍 = 屏壍 ? ` Preliminary: only ${轠壍.after.days} day${轠壍.after.days === 1 ? "" : "s"} of data after it.` : "";
    if (!笾壍.length) {
        const 燩壍 = [...轠壍.metrics].filter((郘壍) => 郘壍.deltaPct !== null).sort((巇壍, 粶壍) => Math.abs(粶壍.deltaPct ?? 0) - Math.abs(巇壍.deltaPct ?? 0))[0];
        const 鮥壍 = 燩壍 && Math.abs(燩壍.deltaPct ?? 0) >= 0.005 ? ` The largest move, ${metricChangeText(燩壍)}, is within normal day-to-day variation.` : "";
        return { text: `No significant change in spend, conversions, CPA or CTR after this change.${鮥壍}${勺壍}`, tone: "neutral", preliminary: 屏壍 };
    }
    const 梔壍 = 笾壍.slice(0, 2);
    const 螃壍 = 梔壍.length === 1
        ? `${跨壍(metricChangeText(梔壍[0] as ChangeImpactMetric, false))} after this change (${formatP((梔壍[0] as ChangeImpactMetric).p)}).`
        : `${跨壍(metricChangeText(梔壍[0] as ChangeImpactMetric))} and ${metricChangeText(梔壍[1] as ChangeImpactMetric)} after this change.`;
    const 呲壍 = 梔壍[0] as ChangeImpactMetric;
    const 獡壍 = deltaSentiment(滹壍[呲壍.metric], 呲壍.deltaPct);
    return { text: `${螃壍}${勺壍}`, tone: 獡壍 === "good" ? "good" : 獡壍 === "bad" ? "bad" : "neutral", preliminary: 屏壍 };
}
