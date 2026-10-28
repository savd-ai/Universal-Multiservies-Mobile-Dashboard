import { axisLabel, baseOption, categoryAxis, tooltipHtml, valueAxis, type TipRow } from "@/components/charts/base";
import { colorFor } from "@/components/charts/palette";
import type { ChartTokens } from "@/components/charts/tokens";
import { curveOutcome } from "@/lib/domain/budget/curves";
import { interpolatePoints, outcomeOf } from "@/lib/domain/budget/google";
import type { CurvesResponse, ForecastResult, ResponseCurve, ScenarioPoint } from "@/lib/domain/contracts/budget";
import type { SimulationDayPoint, SimulationType } from "@/lib/domain/contracts/estimates";
import { formatShort } from "@/lib/domain/dates";
import { formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import type { FlightPreview } from "./flighting";
import { money, moneyExact, perDay } from "./money";
import { formatOutcome, marginalLabel, type Objective } from "./optimizer";
import { evenTicks, weeklyTicks, type CumulativeSeries } from "./pacing";
import { settingLabel } from "./simulators";
const WASH = { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] };
const pointer = (t: ChartTokens) => ({ lineStyle: { color: t.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } });
export function cumulativeOption(t: ChartTokens, s: CumulativeSeries, currency: string, reduced: boolean) {
    const ticks = weeklyTicks(s.dates.length);
    const budgetLine = t.theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(60,60,67,0.18)";
    return {
        ...baseOption(t, reduced),
        grid: { left: 52, right: 10, top: 20, bottom: 24 },
        axisPointer: pointer(t),
        xAxis: categoryAxis(t, s.dates, {
            boundaryGap: false,
            axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v), alignMinLabel: "left", alignMaxLabel: "right" },
        }),
        yAxis: valueAxis(t, "money", currency, { min: 0, max: s.max, splitNumber: 3 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "axis",
            formatter: (ps: {
                dataIndex: number;
            }[]) => {
                const i = ps[0]?.dataIndex ?? 0;
                const rows: TipRow[] = [];
                const a = s.actual[i];
                const p = s.projected[i];
                if (a !== null && a !== undefined)
                    rows.push({ color: t.accentLine, label: "Actual", value: money(a, currency, { compact: false }) });
                if (p !== null && p !== undefined && (a === null || a === undefined))
                    rows.push({ color: t.accentLine, dashed: true, label: "Projected", value: money(p, currency, { compact: false }) });
                rows.push({ color: t.faint, label: "Ideal pace", value: money(s.ideal[i], currency, { compact: false }) });
                rows.push({ label: "Budget", value: money(s.total, currency, { compact: false }) });
                return tooltipHtml(formatShort(s.dates[i] ?? ""), rows);
            },
        },
        series: [
            {
                name: "Ideal pace",
                type: "line",
                data: s.ideal,
                symbol: "none",
                lineStyle: { color: t.faint, width: 1 },
                silent: true,
                z: 1,
                markLine: {
                    symbol: "none",
                    silent: true,
                    label: { show: true, position: "insideEndTop", formatter: `Budget ${money(s.total, currency)}`, color: t.muted3, fontFamily: t.fontMono, fontSize: 10 },
                    lineStyle: { color: budgetLine, width: 1, type: [4, 4] },
                    data: [{ yAxis: s.total }],
                },
            },
            {
                name: "Actual",
                type: "line",
                data: s.actual,
                symbol: "circle",
                symbolSize: 8,
                showSymbol: false,
                lineStyle: { color: t.accentLine, width: 2 },
                itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
                emphasis: { scale: false },
                areaStyle: { color: WASH },
                z: 3,
            },
            { name: "Projected", type: "line", data: s.projected, symbol: "none", lineStyle: { color: t.accentLine, width: 2, type: [5, 4] }, z: 2 },
        ],
    };
}
export function forecastOption(t: ChartTokens, forecast: ForecastResult, historyDays: number, format: MetricFormat, currency: string, label: string, reduced: boolean) {
    const history = forecast.history.slice(-historyDays);
    const points = forecast.points;
    const dates = [...history.map((h) => h.date), ...points.map((p) => p.date)];
    const fmt = (v: number | null | undefined) => formatMetricValue(format, v, { currency, compact: false, decimals: format === "decimal" ? 1 : undefined });
    const ticks = evenTicks(dates.length, 6);
    const pad = history.map(() => null);
    const last = history[history.length - 1];
    return {
        ...baseOption(t, reduced),
        grid: { left: 56, right: 10, top: 12, bottom: 24 },
        axisPointer: pointer(t),
        xAxis: categoryAxis(t, dates, { boundaryGap: false, axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v), alignMinLabel: "left", alignMaxLabel: "right" } }),
        yAxis: valueAxis(t, format, currency, { splitNumber: 4, min: 0 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "axis",
            formatter: (ps: {
                dataIndex: number;
            }[]) => {
                const i = ps[0]?.dataIndex ?? 0;
                const h = history[i];
                if (h)
                    return tooltipHtml(formatShort(h.date), [{ color: t.accentLine, label: `${label}, actual`, value: fmt(h.value) }]);
                const p = points[i - history.length];
                if (!p)
                    return "";
                return tooltipHtml(formatShort(p.date), [
                    { color: t.accentLine, dashed: true, label: `${label}, forecast`, value: fmt(p.yhat) },
                    { label: "80% range", value: `${fmt(p.lo)} – ${fmt(p.hi)}` },
                ]);
            },
        },
        series: [
            { name: "lo", type: "line", data: [...pad, ...points.map((p) => p.lo)], stack: "band", symbol: "none", lineStyle: { opacity: 0 }, silent: true },
            { name: "band", type: "line", data: [...pad, ...points.map((p) => Math.max(0, p.hi - p.lo))], stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(4,191,157,0.14)" }, silent: true },
            {
                name: "Actual",
                type: "line",
                data: [...history.map((h) => h.value), ...points.map(() => null)],
                symbol: "circle",
                symbolSize: 8,
                showSymbol: false,
                lineStyle: { color: t.accentLine, width: 2 },
                itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 },
                areaStyle: { color: WASH },
            },
            {
                name: "Forecast",
                type: "line",
                data: [...history.map((_, i) => (i === history.length - 1 ? (last?.value ?? null) : null)), ...points.map((p) => p.yhat)],
                symbol: "none",
                lineStyle: { color: t.accentLine, width: 2, type: [5, 4] },
            },
        ],
    };
}
type Curve = CurvesResponse["curves"][number];
export function niceCeil(v: number): number {
    if (!(v > 0))
        return 1;
    const mag = 10 ** Math.floor(Math.log10(v));
    return ([1, 2, 2.5, 5, 10].map((s) => s * mag).find((x) => x >= v) ?? 10 * mag) as number;
}
export function curveOption(t: ChartTokens, curve: Curve, objective: Objective, currentDaily: number | null, recommendedDaily: number | null, currency: string, reduced: boolean) {
    const xMax = niceCeil(Math.max(curve.spendRange[1] * 1.4, (currentDaily ?? 0) * 1.8, (recommendedDaily ?? 0) * 1.15, 1));
    const points = Array.from({ length: 48 }, (_, i) => (xMax * (i + 1)) / 48).map((x) => [x, curveOutcome(curve, x)] as [
        number,
        number
    ]);
    const dot = (x: number | null, filled: boolean) => (x !== null && x > 0 ? [{ value: [x, curveOutcome(curve, x)], itemStyle: filled ? { color: t.accent, borderColor: t.surface, borderWidth: 2 } : { color: t.surface, borderColor: t.accentLine, borderWidth: 2 } }] : []);
    return {
        ...baseOption(t, reduced),
        grid: { left: 44, right: 8, top: 8, bottom: 20 },
        xAxis: valueAxis(t, "money", currency, { min: 0, max: xMax, splitNumber: 2, splitLine: { show: false } }),
        yAxis: valueAxis(t, objective === "conv_value" ? "money" : "number", currency, { min: 0, splitNumber: 2 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "axis",
            formatter: (ps: {
                value: [
                    number,
                    number
                ];
                seriesIndex: number;
            }[]) => {
                const p = ps.find((x2) => x2.seriesIndex === 0) ?? ps[0];
                if (!p)
                    return "";
                const [x, y] = p.value;
                return tooltipHtml(perDay(x, currency), [{ color: t.accentLine, label: objective === "conv_value" ? "Expected value / day" : "Expected conv. / day", value: formatOutcome(objective, y, currency) }]);
            },
        },
        series: [
            {
                name: "Response",
                type: "line",
                data: points,
                symbol: "none",
                lineStyle: { color: t.accentLine, width: 2 },
                markArea: { silent: true, itemStyle: { color: "rgba(4,191,157,0.08)" }, data: [[{ xAxis: curve.spendRange[0] }, { xAxis: curve.spendRange[1] }]] },
                z: 2,
            },
            { name: "Current", type: "scatter", data: dot(currentDaily, true), symbolSize: 9, z: 4, silent: true },
            { name: "Recommended", type: "scatter", data: dot(recommendedDaily, false), symbolSize: 9, z: 5, silent: true },
        ],
    };
}
const isCurrent = (p: ScenarioPoint) => Math.abs(p.pct) < 1e-9;
export const scenarioLabel = (p: number) => (Math.abs(p) < 1e-9 ? "Current" : `${p > 0 ? "+" : "−"}${Math.round(Math.abs(p) * 100)}%`);
export function scenarioLabelled(points: readonly ScenarioPoint[]): Set<number> {
    const withCost = points.filter((p) => p.marginalCost !== null);
    return new Set([withCost[0]?.pct, 0, points[points.length - 1]?.pct].filter((x): x is number => x !== undefined));
}
export function scenarioOption(t: ChartTokens, points: readonly ScenarioPoint[], objective: Objective, currency: string, reduced: boolean) {
    const labelled = scenarioLabelled(points);
    const base = points.find(isCurrent);
    const unit = objective === "conversions" ? "conv." : "value";
    return {
        ...baseOption(t, reduced),
        grid: { left: 56, right: 24, top: 28, bottom: 26 },
        axisPointer: pointer(t),
        xAxis: valueAxis(t, "money", currency, { scale: true, splitNumber: 4, splitLine: { show: false } }),
        yAxis: valueAxis(t, objective === "conv_value" ? "money" : "number", currency, { scale: true, splitNumber: 3 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "axis",
            formatter: (ps: {
                dataIndex: number;
            }[]) => {
                const p = points[ps[0]?.dataIndex ?? 0];
                if (!p)
                    return "";
                const rows: TipRow[] = [{ color: t.accentLine, label: `Expected ${unit}`, value: formatOutcome(objective, p.expected, currency) }];
                if (p.marginalCost !== null)
                    rows.push({ label: objective === "conversions" ? "Marginal CPA" : "Marginal ROAS", value: marginalLabel(objective, p.marginalCost, currency) });
                if (base && p !== base)
                    rows.push({ label: "vs current", value: formatDelta(base.expected > 0 ? p.expected / base.expected - 1 : null) });
                return tooltipHtml(`${scenarioLabel(p.pct)} · ${money(p.total, currency)}`, rows);
            },
        },
        series: [
            {
                name: "Expected",
                type: "line",
                data: points.map((p) => {
                    const current = isCurrent(p);
                    return {
                        value: [p.total, p.expected],
                        symbolSize: current ? 11 : 8,
                        itemStyle: current ? { color: t.accent, borderColor: t.surface, borderWidth: 2 } : { color: t.surface, borderColor: t.accentLine, borderWidth: 2 },
                        label: {
                            show: labelled.has(p.pct),
                            position: "top",
                            distance: 8,
                            color: t.muted3,
                            fontFamily: t.fontMono,
                            fontSize: 10,
                            formatter: () => (current ? `Current · ${marginalLabel(objective, p.marginalCost, currency)}` : marginalLabel(objective, p.marginalCost, currency)),
                        },
                    };
                }),
                symbol: "circle",
                showSymbol: true,
                lineStyle: { color: t.accentLine, width: 2 },
                labelLayout: { hideOverlap: true },
                z: 3,
            },
        ],
    };
}
export function flightingOption(t: ChartTokens, preview: FlightPreview, currency: string, reduced: boolean) {
    const dates = preview.days.map((d) => d.date);
    const ticks = weeklyTicks(dates.length);
    return {
        ...baseOption(t, reduced),
        grid: { left: 56, right: 10, top: 18, bottom: 24 },
        xAxis: categoryAxis(t, dates, { axisLabel: { ...axisLabel(t), interval: (i: number) => ticks.has(i), formatter: (v: string) => formatShort(v) } }),
        yAxis: valueAxis(t, "money", currency, { min: 0, splitNumber: 3 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "item",
            formatter: (p: {
                dataIndex: number;
            }) => {
                const d = preview.days[p.dataIndex];
                return d ? tooltipHtml(formatShort(d.date), [{ color: t.accentLine, label: "Daily amount", value: moneyExact(d.amount, currency) }]) : "";
            },
        },
        series: [
            {
                name: "Daily amount",
                type: "bar",
                data: preview.days.map((d) => d.amount),
                barMaxWidth: 24,
                barCategoryGap: "18%",
                itemStyle: { color: t.accentLine, borderRadius: [4, 4, 0, 0] },
                emphasis: { itemStyle: { color: t.accent } },
                markLine: {
                    symbol: "none",
                    silent: true,
                    label: { show: true, position: "insideEndTop", formatter: `Even ${perDay(preview.avgDaily, currency)}`, color: t.muted3, fontFamily: t.fontMono, fontSize: 10 },
                    lineStyle: { color: t.faint, width: 1, type: [4, 4] },
                    data: [{ yAxis: preview.avgDaily }],
                },
            },
        ],
    };
}
export interface SimulatorChart {
    type: SimulationType;
    objective: Objective;
    points: readonly SimulationDayPoint[];
    modelCurve: Pick<ResponseCurve, "a" | "b"> | null;
    current: number | null;
    whatIf: number | null;
    currency: string;
}
export function simulatorOption(t: ChartTokens, c: SimulatorChart, reduced: boolean) {
    const google = colorFor("estimate_source", "google_simulator", 1, t);
    const model = colorFor("estimate_source", "model", 0, t);
    const moneyAxis = c.type !== "TARGET_ROAS";
    const hi = Math.max(0, ...c.points.map((p) => p.value), c.current ?? 0, c.whatIf ?? 0);
    const ratioStep = (v: number) => (v <= 6 ? 1 : v <= 12 ? 2 : 5);
    const rawRatio = Math.max(1, hi * 1.08);
    const xMax = moneyAxis ? niceCeil(hi * 1.08) : Math.ceil(rawRatio / ratioStep(rawRatio)) * ratioStep(rawRatio);
    const xInterval = moneyAxis ? xMax / 5 : ratioStep(rawRatio);
    const curve = c.type === "BUDGET" ? c.modelCurve : null;
    const modelData = curve ? Array.from({ length: 48 }, (_, i) => (xMax * (i + 1)) / 48).map((x) => [x, curveOutcome(curve, x)] as [
        number,
        number
    ]) : [];
    const unit = c.objective === "conversions" ? "Conv. / day" : "Value / day";
    const mark = (x: number | null, label: string, dashed: boolean) => x !== null && x > 0
        ? [{ xAxis: x, label: { show: true, position: "end", formatter: label, color: t.muted3, fontFamily: t.fontMono, fontSize: 10 }, lineStyle: { color: t.faint, width: 1, type: dashed ? [4, 4] : "solid" } }]
        : [];
    const marks = [...mark(c.current, `Current ${settingLabel(c.type, c.current, c.currency)}`, false), ...(c.whatIf !== null && c.current !== null && Math.abs(c.whatIf - c.current) < 1e-6 ? [] : mark(c.whatIf, "What-if", true))];
    return {
        ...baseOption(t, reduced),
        grid: { left: 52, right: 16, top: 26, bottom: 24 },
        axisPointer: pointer(t),
        xAxis: valueAxis(t, moneyAxis ? "money" : "ratio", c.currency, { min: 0, max: xMax, interval: xInterval, splitLine: { show: false } }),
        yAxis: valueAxis(t, c.objective === "conv_value" ? "money" : "number", c.currency, { min: 0, splitNumber: 3 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "axis",
            formatter: (ps: {
                axisValue?: number | string;
            }[]) => {
                const x = Number(ps[0]?.axisValue);
                if (!Number.isFinite(x) || x <= 0)
                    return "";
                const g = interpolatePoints(c.points, x, 0);
                const rows: TipRow[] = [{ color: google, label: `Google, ${unit.toLowerCase()}`, value: g ? formatOutcome(c.objective, outcomeOf(g, c.objective), c.currency) : "not simulated" }];
                if (curve)
                    rows.push({ color: model, dashed: true, label: `Our model, ${unit.toLowerCase()}`, value: formatOutcome(c.objective, curveOutcome(curve, x), c.currency) });
                if (g)
                    rows.push({ label: "Google, cost / day", value: money(g.cost, c.currency, { compact: false }) });
                return tooltipHtml(settingLabel(c.type, x, c.currency), rows);
            },
        },
        series: [
            {
                name: "Google simulator",
                type: "line",
                data: c.points.map((p) => [p.value, outcomeOf(p, c.objective)]),
                symbol: "circle",
                symbolSize: 8,
                showSymbol: true,
                lineStyle: { color: google, width: 2 },
                itemStyle: { color: google, borderColor: t.surface, borderWidth: 2 },
                emphasis: { scale: false },
                markLine: { symbol: "none", silent: true, data: marks },
                z: 3,
            },
            ...(curve ? [{ name: "Our model", type: "line", data: modelData, symbol: "none", lineStyle: { color: model, width: 2, type: [5, 4] }, silent: true, z: 2 }] : []),
        ],
    };
}
