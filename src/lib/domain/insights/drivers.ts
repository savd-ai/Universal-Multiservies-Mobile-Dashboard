import { round } from "../stats";
export interface Totals {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conv_value: number;
}
export interface DriverContribution {
    id: string;
    label: string;
    current: number | null;
    previous: number | null;
    delta: number | null;
    contribution: number;
    share: number | null;
    rate?: number;
    mix?: number;
}
export interface LogFactor {
    factor: string;
    label: string;
    dln: number;
    share: number | null;
}
export interface LogDecomposition {
    metric: string;
    identity: string;
    total: number;
    factors: LogFactor[];
}
export interface DriversSummary {
    current: number | null;
    previous: number | null;
    delta: number | null;
    deltaPct: number | null;
}
export interface AdditiveSegment {
    id: string;
    label: string;
    current: number;
    previous: number;
}
export function additiveContributions(segments: readonly AdditiveSegment[]): {
    total: DriversSummary;
    contributions: DriverContribution[];
} {
    const cur = segments.reduce((s, x) => s + x.current, 0);
    const prev = segments.reduce((s, x) => s + x.previous, 0);
    const delta = cur - prev;
    const contributions = segments.map((x) => {
        const c = x.current - x.previous;
        return { id: x.id, label: x.label, current: x.current, previous: x.previous, delta: c, contribution: c, share: Math.abs(delta) > 1e-12 ? c / delta : null };
    });
    return { total: summary(cur, prev), contributions: sortByImpact(contributions) };
}
export interface RatioSegment {
    id: string;
    label: string;
    num1: number;
    den1: number;
    num0: number;
    den0: number;
}
export function ratioContributions(segments: readonly RatioSegment[], scale = 1): {
    total: DriversSummary;
    contributions: DriverContribution[];
} | null {
    const N1 = segments.reduce((s, x) => s + x.num1, 0);
    const D1 = segments.reduce((s, x) => s + x.den1, 0);
    const N0 = segments.reduce((s, x) => s + x.num0, 0);
    const D0 = segments.reduce((s, x) => s + x.den0, 0);
    if (D1 <= 0 || D0 <= 0)
        return null;
    const R1 = (scale * N1) / D1;
    const R0 = (scale * N0) / D0;
    const delta = R1 - R0;
    const contributions = segments.map((x) => {
        const c = (scale * x.num1 - R0 * x.den1) / D1 - (scale * x.num0 - R0 * x.den0) / D0;
        const r1 = x.den1 > 0 ? (scale * x.num1) / x.den1 : null;
        const r0 = x.den0 > 0 ? (scale * x.num0) / x.den0 : null;
        const w1 = x.den1 / D1;
        const rate = r1 !== null && r0 !== null ? w1 * (r1 - r0) : 0;
        return {
            id: x.id,
            label: x.label,
            current: r1,
            previous: r0,
            delta: r1 !== null && r0 !== null ? r1 - r0 : null,
            contribution: c,
            share: Math.abs(delta) > 1e-12 ? c / delta : null,
            rate,
            mix: c - rate,
        };
    });
    return { total: summary(R1, R0), contributions: sortByImpact(contributions) };
}
function summary(cur: number | null, prev: number | null): DriversSummary {
    const delta = cur !== null && prev !== null ? cur - prev : null;
    return { current: cur, previous: prev, delta, deltaPct: delta !== null && prev ? delta / prev : null };
}
function sortByImpact(list: DriverContribution[]): DriverContribution[] {
    return list.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.label.localeCompare(b.label));
}
const ln = (v: number) => (v > 0 ? Math.log(v) : Number.NaN);
type Factor = {
    factor: string;
    label: string;
    sign: 1 | -1;
    value: (t: Totals) => number;
};
const F: Record<string, Factor> = {
    impressions: { factor: "impressions", label: "Impressions", sign: 1, value: (t) => t.impressions },
    ctr: { factor: "ctr", label: "CTR", sign: 1, value: (t) => (t.impressions > 0 ? t.clicks / t.impressions : 0) },
    cpc: { factor: "cpc", label: "CPC", sign: 1, value: (t) => (t.clicks > 0 ? t.cost / t.clicks : 0) },
    cvr: { factor: "cvr", label: "Conv. rate", sign: 1, value: (t) => (t.clicks > 0 ? t.conversions / t.clicks : 0) },
    aov: { factor: "aov", label: "Avg. order value", sign: 1, value: (t) => (t.conversions > 0 ? t.conv_value / t.conversions : 0) },
};
const IDENTITIES: Record<string, {
    identity: string;
    value: (t: Totals) => number;
    factors: Factor[];
}> = {
    cpa: { identity: "ln CPA = ln CPC − ln CVR", value: (t) => (t.conversions > 0 ? t.cost / t.conversions : 0), factors: [F.cpc as Factor, { ...(F.cvr as Factor), sign: -1 }] },
    cost: { identity: "ln spend = ln impressions + ln CTR + ln CPC", value: (t) => t.cost, factors: [F.impressions as Factor, F.ctr as Factor, F.cpc as Factor] },
    clicks: { identity: "ln clicks = ln impressions + ln CTR", value: (t) => t.clicks, factors: [F.impressions as Factor, F.ctr as Factor] },
    conversions: { identity: "ln conversions = ln impressions + ln CTR + ln CVR", value: (t) => t.conversions, factors: [F.impressions as Factor, F.ctr as Factor, F.cvr as Factor] },
    conv_value: { identity: "ln value = ln impressions + ln CTR + ln CVR + ln AOV", value: (t) => t.conv_value, factors: [F.impressions as Factor, F.ctr as Factor, F.cvr as Factor, F.aov as Factor] },
    roas: { identity: "ln ROAS = ln CVR + ln AOV − ln CPC", value: (t) => (t.cost > 0 ? t.conv_value / t.cost : 0), factors: [F.cvr as Factor, F.aov as Factor, { ...(F.cpc as Factor), sign: -1 }] },
};
export function logDecomposition(metric: string, cur: Totals, prev: Totals): LogDecomposition | null {
    const id = IDENTITIES[metric];
    if (!id)
        return null;
    const total = ln(id.value(cur)) - ln(id.value(prev));
    if (!Number.isFinite(total))
        return null;
    const factors: LogFactor[] = [];
    for (const f of id.factors) {
        const d = f.sign * (ln(f.value(cur)) - ln(f.value(prev)));
        if (!Number.isFinite(d))
            return null;
        factors.push({ factor: f.factor, label: f.sign < 0 ? `${f.label} (inverse)` : f.label, dln: round(d, 6), share: Math.abs(total) >= 0.005 ? round(d / total, 4) : null });
    }
    return { metric, identity: id.identity, total: round(total, 6), factors };
}
