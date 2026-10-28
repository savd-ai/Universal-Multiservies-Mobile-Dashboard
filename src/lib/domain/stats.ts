export const sum = (xs: readonly number[]): number => xs.reduce((s, v) => s + v, 0);
export const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : 0);
export function std(xs: readonly number[]): number {
    if (xs.length === 0)
        return 0;
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((v) => (v - m) ** 2)));
}
export function median(xs: readonly number[]): number {
    if (xs.length === 0)
        return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
export function mad(xs: readonly number[]): number {
    if (xs.length === 0)
        return 0;
    const m = median(xs);
    return median(xs.map((v) => Math.abs(v - m))) * 1.4826;
}
export function quantile(xs: readonly number[], q: number): number {
    if (xs.length === 0)
        return 0;
    const s = [...xs].sort((a2, b2) => a2 - b2);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const a = s[lo] as number;
    const b = s[hi] as number;
    return a + (b - a) * (pos - lo);
}
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export function safeDiv(a: number, b: number): number | null {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0)
        return null;
    return a / b;
}
export interface OlsFit {
    slope: number;
    intercept: number;
    r2: number;
    n: number;
}
export function ols(x: readonly number[], y: readonly number[]): OlsFit {
    const n = Math.min(x.length, y.length);
    if (n < 2)
        return { slope: 0, intercept: n ? (y[0] as number) : 0, r2: 0, n };
    const mx = mean(x.slice(0, n));
    const my = mean(y.slice(0, n));
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
        const dx = (x[i] as number) - mx;
        const dy = (y[i] as number) - my;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
    return { slope, intercept, r2, n };
}
export function welchT(a: readonly number[], b: readonly number[]): {
    t: number;
    df: number;
    p: number;
} {
    if (a.length < 2 || b.length < 2)
        return { t: 0, df: 0, p: 1 };
    const ma = mean(a);
    const mb = mean(b);
    const va = sampleVar(a);
    const vb = sampleVar(b);
    const se = Math.sqrt(va / a.length + vb / b.length);
    if (se === 0)
        return { t: 0, df: a.length + b.length - 2, p: 1 };
    const t = (ma - mb) / se;
    const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
    return { t, df, p: 2 * (1 - studentTCdf(Math.abs(t), df)) };
}
function sampleVar(xs: readonly number[]): number {
    const m = mean(xs);
    return sum(xs.map((v) => (v - m) ** 2)) / (xs.length - 1);
}
export function studentTCdf(t: number, df: number): number {
    const x = df / (df + t * t);
    const ib = regIncBeta(x, df / 2, 0.5);
    return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}
function regIncBeta(x: number, a: number, b: number): number {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lbeta);
    if (x < (a + 1) / (a + b + 2))
        return (front * betaCf(x, a, b)) / a;
    return 1 - (front * betaCf(1 - x, b, a)) / b;
}
function betaCf(x: number, a: number, b: number): number {
    const maxIter = 200;
    const eps = 3e-14;
    let c = 1;
    let d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < 1e-30)
        d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIter; m++) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30)
            d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30)
            c = 1e-30;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30)
            d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30)
            c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < eps)
            break;
    }
    return h;
}
function lgamma(z: number): number {
    const g = 7;
    const coef = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5)
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = coef[0] as number;
    for (let i = 1; i < g + 2; i++)
        x += (coef[i] as number) / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
export function roundTo(v: number, step: number): number {
    return Math.round(v / step) * step;
}
export function round(v: number, decimals = 0): number {
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
}
