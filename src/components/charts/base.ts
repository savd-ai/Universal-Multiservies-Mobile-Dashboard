import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import { moneyOpts, type MoneyLike } from "@/lib/money";
import type { ChartTokens } from "./tokens";
export function escapeHtml(s: unknown): string {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
export function axisLabel(t: ChartTokens) {
    return { color: t.faint, fontFamily: t.fontMono, fontSize: 10 };
}
export function valueAxis(t: ChartTokens, format: MetricFormat, currency?: MoneyLike, extra: Record<string, unknown> = {}) {
    return {
        type: "value" as const,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" as const } },
        axisLabel: {
            ...axisLabel(t),
            hideOverlap: true,
            formatter: (v: number) => formatMetricValue(format, v, { ...moneyOpts(currency), compact: true, decimals: format === "percent" ? 1 : format === "decimal" || format === "number" || format === "ratio" ? (Number.isInteger(v) ? 0 : 1) : format === "money" && Math.abs(v) < 100 && !Number.isInteger(v) ? 2 : format === "money" ? 0 : undefined }),
        },
        ...extra,
    };
}
export function categoryAxis(t: ChartTokens, data: string[], extra: Record<string, unknown> = {}) {
    return {
        type: "category" as const,
        data,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabel(t), hideOverlap: true },
        ...extra,
    };
}
export function baseOption(t: ChartTokens, reducedMotion: boolean) {
    return {
        animation: !reducedMotion,
        animationDuration: 300,
        animationEasing: "cubicOut" as const,
        textStyle: { fontFamily: t.fontSans, color: t.muted },
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
export function tooltipHtml(title: string, rows: TipRow[]): string {
    return [
        `<div class="tip-date">${escapeHtml(title)}</div>`,
        ...rows.map((r) => `<div class="tip-row"><span class="tip-key">${r.color ? `<span class="tip-line" style="background:${r.dashed ? "transparent" : r.color};${r.dashed ? `border-top:1.5px dashed ${r.color};height:0;` : ""}"></span>` : ""}${escapeHtml(r.label)}</span><span class="tip-val">${escapeHtml(r.value)}</span></div>`),
    ].join("");
}
export function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
