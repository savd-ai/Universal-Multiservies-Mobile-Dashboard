import { describe, expect, it } from "vitest";
import { readChartTokens } from "@/components/charts/tokens";
import type { CurvesResponse, ForecastResult, PacingReport, ScenarioPoint } from "@/lib/domain/contracts/budget";
import { cumulativeOption, curveOption, flightingOption, forecastOption, niceCeil, scenarioLabel, scenarioLabelled, scenarioOption, simulatorOption } from "@/features/budget/lib/chart-options";
import { flightPreview } from "@/features/budget/lib/flighting";
import { cumulativeSeries } from "@/features/budget/lib/pacing";
const t = readChartTokens();
type Series = {
    name: string;
    type: string;
    data: unknown[];
    markLine?: {
        data: {
            yAxis: number;
        }[];
    };
    markArea?: unknown;
    stack?: string;
    barMaxWidth?: number;
    itemStyle?: {
        borderRadius?: number[];
    };
    lineStyle?: {
        type?: unknown;
        width?: number;
    };
};
const seriesOf = (o: {
    series: unknown[];
}) => o.series as Series[];
describe("chart option builders", () => {
    it("cumulative: budget line on the always-populated ideal series, dashed projection", () => {
        const cumulative: PacingReport["cumulative"] = [
            { date: "2026-10-01", actual: null, ideal: 50, projected: 40 },
            { date: "2026-10-02", actual: null, ideal: 100, projected: 90 },
        ];
        const o = cumulativeOption(t, cumulativeSeries({ cumulative, daysInMonth: 2 }, 100, 90), "USD", true);
        const [ideal, actual, projected] = seriesOf(o);
        expect(ideal?.markLine?.data).toEqual([{ yAxis: 100 }]);
        expect(actual?.data).toEqual([null, null]);
        expect(projected?.lineStyle?.type).toEqual([5, 4]);
        expect(projected?.lineStyle?.width).toBe(2);
        const y = o.yAxis as unknown as {
            min: number;
            max: number;
        };
        expect(y.min).toBe(0);
        expect(y.max).toBeCloseTo(110, 6);
    });
    it("forecast: band = stacked lo + (hi − lo), forecast joins the last actual", () => {
        const f: ForecastResult = {
            metric: "cost",
            history: [
                { date: "2026-09-27", value: 10 },
                { date: "2026-09-28", value: 12 },
            ],
            points: [{ date: "2026-09-29", yhat: 11, lo: 9, hi: 14 }],
            totals: { restOfMonth: { yhat: 11, lo: 9, hi: 14 }, next30: { yhat: 11, lo: 9, hi: 14 } },
            method: "holt_damped_dow",
            backtestMape: 0.02,
        };
        const [lo, band, actual, forecast] = seriesOf(forecastOption(t, f, 56, "money", "USD", "Spend", true));
        expect(lo?.data).toEqual([null, null, 9]);
        expect(band?.data).toEqual([null, null, 5]);
        expect(lo?.stack).toBe("band");
        expect(band?.stack).toBe("band");
        expect(actual?.data).toEqual([10, 12, null]);
        expect(forecast?.data).toEqual([null, 12, 11]);
    });
    it("curve: clean axis max, observed range shaded, current and recommended marks", () => {
        expect(niceCeil(606)).toBe(1000);
        expect(niceCeil(1866)).toBe(2000);
        expect(niceCeil(2100)).toBe(2500);
        const curve: CurvesResponse["curves"][number] = { campaignId: "c1", name: "Brand", objective: "conv_value", a: 43.6, b: 0.87, bRaw: 1.2, r2: 0.42, n: 60, spendRange: [328, 433], confidence: "medium" };
        const o = curveOption(t, curve, "conv_value", 420, 671.67, "USD", true);
        const [line, current, recommended] = seriesOf(o);
        expect(o.xAxis).toMatchObject({ min: 0, max: 1000 });
        expect(line?.markArea).toBeTruthy();
        expect(current?.data).toHaveLength(1);
        expect(recommended?.data).toHaveLength(1);
        expect(seriesOf(curveOption(t, curve, "conv_value", 420, null, "USD", true))[2]?.data).toEqual([]);
    });
    it("scenarios: labels only the first costed point, the current total and the last", () => {
        const pts: ScenarioPoint[] = [-0.3, -0.2, -0.1, 0, 0.1, 0.5].map((pct, i) => ({ pct, total: 100 * (1 + pct), expected: 10 + i, marginalCost: i === 0 ? null : 20 + i }));
        expect([...scenarioLabelled(pts)].sort()).toEqual([-0.2, 0, 0.5].sort());
        expect(scenarioLabel(0)).toBe("Current");
        expect(scenarioLabel(-0.3)).toBe("−30%");
        expect(scenarioLabel(0.5)).toBe("+50%");
        const data = seriesOf(scenarioOption(t, pts, "conversions", "USD", true))[0]?.data as {
            label: {
                show: boolean;
            };
            symbolSize: number;
        }[];
        expect(data.map((d) => d.label.show)).toEqual([false, true, false, true, false, true]);
        expect(data[3]?.symbolSize).toBe(11);
    });
    it("simulator: Google's points and our model share one y-axis, identity colors, current and what-if marks", () => {
        const points = [210, 420, 630, 840].map((value, i) => ({ value, cost: value * 0.95, clicks: 100, impressions: 2000, conversions: 5 + 3 * i, convValue: (5 + 3 * i) * 90, requiredBudget: null }));
        const input = { type: "BUDGET" as const, objective: "conversions" as const, points, modelCurve: { a: 0.3, b: 0.7 }, current: 420, whatIf: 600, currency: "USD" };
        const o = simulatorOption(t, input, true);
        expect(Array.isArray(o.yAxis)).toBe(false);
        expect(o.yAxis).toMatchObject({ type: "value", min: 0 });
        expect(o.xAxis).toMatchObject({ type: "value", min: 0, max: 1000, interval: 200 });
        type SimSeries = {
            data: unknown[];
            lineStyle?: {
                color?: string;
                type?: unknown;
            };
            markLine?: {
                data: {
                    xAxis: number;
                }[];
            };
        };
        const simSeries = (x: {
            series: unknown[];
        }) => x.series as SimSeries[];
        const [google, model] = simSeries(o);
        expect(google?.data).toEqual(points.map((p) => [p.value, p.conversions]));
        expect(google?.lineStyle?.color).toBe(t.series[1]);
        expect(model?.lineStyle).toMatchObject({ color: t.series[0], type: [5, 4] });
        expect(model?.data).toHaveLength(48);
        expect(google?.markLine?.data.map((d) => d.xAxis)).toEqual([420, 600]);
        expect(simSeries(simulatorOption(t, { ...input, whatIf: 420 }, true))[0]?.markLine?.data).toHaveLength(1);
        const roas = simulatorOption(t, { ...input, type: "TARGET_ROAS", points: points.map((p, i) => ({ ...p, value: [3, 3.5, 4, 5][i] as number })), current: 4, whatIf: null }, true);
        expect(seriesOf(roas)).toHaveLength(1);
        expect(roas.xAxis).toMatchObject({ max: 6, interval: 1 });
        const tip = (o.tooltip as unknown as {
            formatter: (ps: {
                axisValue: number;
            }[]) => string;
        }).formatter([{ axisValue: 525 }]);
        expect(tip).toContain("$525/day");
        expect(tip).toContain("Google, conv. / day");
        expect(tip).toContain("Our model, conv. / day");
        expect((o.tooltip as unknown as {
            formatter: (ps: {
                axisValue: number;
            }[]) => string;
        }).formatter([{ axisValue: 990 }])).toContain("not simulated");
    });
    it("flighting: bars capped at 24px with 4px rounded tops and the even line", () => {
        const [bars] = seriesOf(flightingOption(t, flightPreview(3100, "2026-10", "even"), "USD", true));
        expect(bars?.type).toBe("bar");
        expect(bars?.barMaxWidth).toBe(24);
        expect(bars?.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
        expect(bars?.markLine?.data).toEqual([{ yAxis: 100 }]);
        expect(bars?.data).toHaveLength(31);
    });
});
