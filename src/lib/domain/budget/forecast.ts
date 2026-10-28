import type { ForecastResult } from "../contracts/budget";
import { addDays, diffDays, dow } from "../dates";
import { mean, round } from "../stats";
import type { CivilDate } from "../types";
import { weekdayFactors } from "./units";
export const HOLT = { alpha: 0.3, beta: 0.1, phi: 0.9 } as const;
export const HISTORY_DAYS = 84;
const Z80 = 1.2816;
const BACKTEST_DAYS = 14;
export interface ForecastInput {
    metric: ForecastResult["metric"];
    campaignId?: string;
    history: readonly {
        date: CivilDate;
        value: number;
    }[];
    horizon: number;
    dailyCap?: number | null;
    monthEnd: CivilDate;
}
interface HoltState {
    level: number;
    trend: number;
    sigma: number;
    factors: number[];
    end: CivilDate;
}
function fitHolt(history: readonly {
    date: CivilDate;
    value: number;
}[]): HoltState | null {
    if (history.length < 14)
        return null;
    const end = (history[history.length - 1] as {
        date: CivilDate;
    }).date;
    const byDate = new Map(history.map((h) => [h.date, h.value] as const));
    const factors = weekdayFactors((d) => byDate.get(d) ?? 0, end, Math.min(56, history.length));
    const y = history.map((h) => {
        const f = factors[dow(h.date)] ?? 1;
        return f > 0 ? h.value / f : h.value;
    });
    const { alpha, beta, phi } = HOLT;
    let level = mean(y.slice(0, 7));
    let trend = (mean(y.slice(7, 14)) - level) / 7;
    const residuals: number[] = [];
    for (let t = 7; t < y.length; t++) {
        const yt = y[t] as number;
        const oneStep = level + phi * trend;
        residuals.push(yt - oneStep);
        const prevLevel = level;
        level = alpha * yt + (1 - alpha) * oneStep;
        trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
    }
    const sigma = Math.sqrt(mean(residuals.map((e) => e * e)));
    return { level, trend, sigma, factors, end };
}
function project(state: HoltState, horizon: number, cap: number | null | undefined): ForecastResult["points"] {
    const { alpha, phi } = HOLT;
    const out: ForecastResult["points"] = [];
    let damp = 0;
    for (let h = 1; h <= horizon; h++) {
        damp += phi ** h;
        const date = addDays(state.end, h);
        const f = state.factors[dow(date)] ?? 1;
        const base = Math.max(0, (state.level + damp * state.trend) * f);
        const width = Z80 * state.sigma * Math.sqrt(1 + (h - 1) * alpha * alpha) * f;
        const limit = cap && cap > 0 ? cap : Number.POSITIVE_INFINITY;
        out.push({ date, yhat: round(Math.min(limit, base), 2), lo: round(Math.min(limit, Math.max(0, base - width)), 2), hi: round(Math.min(limit, base + width), 2) });
    }
    return out;
}
export function backtestMape(history: readonly {
    date: CivilDate;
    value: number;
}[], days = BACKTEST_DAYS, cap?: number | null): number | null {
    if (history.length < days + 28)
        return null;
    const train = history.slice(0, history.length - days);
    const test = history.slice(history.length - days);
    const state = fitHolt(train);
    if (!state)
        return null;
    const pts = project(state, days, cap);
    const errs: number[] = [];
    test.forEach((a, i) => {
        const p = pts[i];
        if (!p || a.value < 1)
            return;
        errs.push(Math.abs(a.value - p.yhat) / a.value);
    });
    return errs.length ? round(mean(errs), 4) : null;
}
export function forecastSeries(input: ForecastInput): ForecastResult {
    const history = input.history.slice(-HISTORY_DAYS);
    const end = history[history.length - 1]?.date;
    const empty = { yhat: 0, lo: 0, hi: 0 };
    const state = fitHolt(history);
    if (!state || !end) {
        return { metric: input.metric, campaignId: input.campaignId, history: [...history], points: [], totals: { restOfMonth: empty, next30: empty }, method: "holt_damped_dow", backtestMape: null };
    }
    const daysToMonthEnd = Math.max(0, diffDays(end, input.monthEnd));
    const all = project(state, Math.max(input.horizon, 30, daysToMonthEnd), input.dailyCap);
    const sum = (pts: ForecastResult["points"]) => ({ yhat: round(pts.reduce((s, p) => s + p.yhat, 0), 2), lo: round(pts.reduce((s, p) => s + p.lo, 0), 2), hi: round(pts.reduce((s, p) => s + p.hi, 0), 2) });
    return {
        metric: input.metric,
        campaignId: input.campaignId,
        history: history.map((h) => ({ date: h.date, value: round(h.value, 2) })),
        points: all.slice(0, input.horizon),
        totals: { restOfMonth: sum(all.filter((p) => p.date <= input.monthEnd)), next30: sum(all.slice(0, 30)) },
        method: "holt_damped_dow",
        backtestMape: backtestMape(history, BACKTEST_DAYS, input.dailyCap),
    };
}
