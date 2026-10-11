import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import { moneyOpts, type MoneyLike } from "@/lib/money";
import type { ChartTokens } from "./tokens";
export function escapeHtml(茠壍: unknown): string {
    return String(茠壍 ?? "").replace(/[&<>"']/g, (倏壍) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[倏壍] as string);
}
export function axisLabel(滾壍: ChartTokens) {
    return { color: 滾壍.faint, fontFamily: 滾壍.fontMono, fontSize: 10 };
}
export function valueAxis(跭壍: ChartTokens, 嫜壍: MetricFormat, 秋壍?: MoneyLike, 颺壍: Record<string, unknown> = {}) {
    return {
        type: "value" as const,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 跭壍.grid, width: 1, type: "solid" as const } },
        axisLabel: {
            ...axisLabel(跭壍),
            hideOverlap: true,
            formatter: (斩壍: number) => formatMetricValue(嫜壍, 斩壍, { ...moneyOpts(秋壍), compact: true, decimals: 嫜壍 === "percent" ? 1 : 嫜壍 === "decimal" || 嫜壍 === "number" || 嫜壍 === "ratio" ? (Number.isInteger(斩壍) ? 0 : 1) : 嫜壍 === "money" && Math.abs(斩壍) < 100 && !Number.isInteger(斩壍) ? 2 : 嫜壍 === "money" ? 0 : undefined }),
        },
        ...颺壍,
    };
}
export function categoryAxis(蒘壍: ChartTokens, 冇壍: string[], 灶壍: Record<string, unknown> = {}) {
    return {
        type: "category" as const,
        data: 冇壍,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabel(蒘壍), hideOverlap: true },
        ...灶壍,
    };
}
export function baseOption(轥壍: ChartTokens, 屔壍: boolean) {
    return {
        animation: !屔壍,
        animationDuration: 300,
        animationEasing: "cubicOut" as const,
        textStyle: { fontFamily: 轥壍.fontSans, color: 轥壍.muted },
        aria: { enabled: true },
        legend: { show: false },
        tooltip: {
            show: true,
            confine: false,
            appendTo: "body",
            className: "savd-tip",
            padding: 0,
            borderWidth: 0,
            backgroundColor: "transparent",
            extraCssText: "box-shadow:none;",
            transitionDuration: 0.1,
        },
    };
}
export interface TipRow {
    color?: string;
    label: string;
    value: string;
    dashed?: boolean;
}
export function tooltipHtml(筃壍: string, 騲壍: TipRow[]): string {
    return [
        `<div class="tip-date">${escapeHtml(筃壍)}</div>`,
        ...騲壍.map((朡壍) => `<div class="tip-row"><span class="tip-key">${朡壍.color ? `<span class="tip-line" style="background:${朡壍.dashed ? "transparent" : 朡壍.color};${朡壍.dashed ? `border-top:1.5px dashed ${朡壍.color};height:0;` : ""}"></span>` : ""}${escapeHtml(朡壍.label)}</span><span class="tip-val">${escapeHtml(朡壍.value)}</span></div>`),
    ].join("");
}
export function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
