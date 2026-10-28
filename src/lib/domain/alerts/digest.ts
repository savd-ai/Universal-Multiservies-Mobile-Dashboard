import type { AlertMessage } from "../contracts/alerts";
import { formatDelta, formatMetricValue } from "../metrics/registry";
export interface DigestTotals {
    cost: number | null;
    conversions: number | null;
    cpa: number | null;
    roas: number | null;
}
export interface DigestInput {
    date: string;
    currency: string;
    yesterday: DigestTotals;
    dayBefore: DigestTotals;
    last7: DigestTotals;
    prior7: DigestTotals;
    openSignals: number;
    critical: number;
    topSignal?: {
        title: string;
        entity: string;
    } | null;
}
type Kpi = NonNullable<AlertMessage["digest"]>["kpis"][number];
const pct = (cur: number | null, prev: number | null): number | null => {
    if (cur === null || prev === null || prev === 0)
        return null;
    const d = cur / prev - 1;
    return Math.abs(d) < 0.0005 ? 0 : d;
};
const METRICS: {
    key: keyof DigestTotals;
    label: string;
    format: "money" | "decimal" | "ratio";
}[] = [
    { key: "cost", label: "Spend", format: "money" },
    { key: "conversions", label: "Conversions", format: "decimal" },
    { key: "cpa", label: "CPA", format: "money" },
    { key: "roas", label: "ROAS", format: "ratio" },
];
export function digestKpis(input: DigestInput): Kpi[] {
    const tile = (period: string, cur: DigestTotals, prev: DigestTotals) => METRICS.map((m) => {
        const delta = pct(cur[m.key], prev[m.key]);
        return { label: `${m.label} · ${period}`, value: formatMetricValue(m.format, cur[m.key], { currency: input.currency }), ...(delta !== null ? { delta: formatDelta(delta) } : {}) };
    });
    return [...tile("yesterday", input.yesterday, input.dayBefore), ...tile("7 days", input.last7, input.prior7)];
}
export function digestNarrative(input: DigestInput): string {
    const money = (v: number | null) => formatMetricValue("money", v, { currency: input.currency });
    const y = input.yesterday;
    const parts: string[] = [];
    if (y.cost === null || y.cost === 0)
        parts.push("No spend was recorded yesterday.");
    else {
        const d = pct(y.cost, input.dayBefore.cost);
        const conv = y.conversions ?? 0;
        parts.push(`Yesterday: ${money(y.cost)} spend${d !== null ? ` (${formatDelta(d)} vs the day before)` : ""}, ${formatMetricValue("decimal", conv)} conversion${conv === 1 ? "" : "s"}${y.cpa !== null ? ` at ${money(y.cpa)} CPA` : ""}.`);
    }
    const w = input.last7;
    if (w.cost) {
        const dc = pct(w.cpa, input.prior7.cpa);
        const dr = pct(w.roas, input.prior7.roas);
        const bits = [w.cpa !== null ? `CPA ${money(w.cpa)}${dc !== null ? ` (${formatDelta(dc)})` : ""}` : null, w.roas !== null ? `ROAS ${formatMetricValue("ratio", w.roas)}${dr !== null ? ` (${formatDelta(dr)})` : ""}` : null].filter(Boolean);
        if (bits.length)
            parts.push(`Last 7 days: ${bits.join(", ")} vs the week before.`);
    }
    if (input.openSignals === 0)
        parts.push("No open signals.");
    else {
        parts.push(`${input.openSignals} open signal${input.openSignals === 1 ? "" : "s"}${input.critical ? `, ${input.critical} critical` : ""}${input.topSignal ? ` — top: ${input.topSignal.title} (${input.topSignal.entity})` : ""}.`);
    }
    return parts.join(" ");
}
