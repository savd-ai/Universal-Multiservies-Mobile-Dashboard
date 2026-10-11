import { describe, expect, it } from "vitest";
import { readChartTokens } from "@/components/charts/tokens";
import type { CurvesResponse, ForecastResult, PacingReport, ScenarioPoint } from "@/lib/domain/contracts/budget";
import { cumulativeOption, curveOption, flightingOption, forecastOption, niceCeil, scenarioLabel, scenarioLabelled, scenarioOption, simulatorOption } from "@/features/budget/lib/chart-options";
import { flightPreview } from "@/features/budget/lib/flighting";
import { cumulativeSeries } from "@/features/budget/lib/pacing";
const 蛺壍 = readChartTokens();
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
const 叩壍 = (狘壍: {
    series: unknown[];
}) => 狘壍.series as Series[];
describe("chart option builders", () => {
    it("cumulative: budget line on the always-populated ideal series, dashed projection", () => {
        const 采壍: PacingReport["cumulative"] = [
            { date: "2026-10-01", actual: null, ideal: 50, projected: 40 },
            { date: "2026-10-02", actual: null, ideal: 100, projected: 90 },
        ];
        const 庶壍 = cumulativeOption(蛺壍, cumulativeSeries({ cumulative: 采壍, daysInMonth: 2 }, 100, 90), "USD", true);
        const [綥壍, 鲔壍, 榃壍] = 叩壍(庶壍);
        expect(綥壍?.markLine?.data).toEqual([{ yAxis: 100 }]);
        expect(鲔壍?.data).toEqual([null, null]);
        expect(榃壍?.lineStyle?.type).toEqual([5, 4]);
        expect(榃壍?.lineStyle?.width).toBe(2);
        const 衲壍 = 庶壍.yAxis as unknown as {
            min: number;
            max: number;
        };
        expect(衲壍.min).toBe(0);
        expect(衲壍.max).toBeCloseTo(110, 6);
    });
    it("forecast: band = stacked lo + (hi − lo), forecast joins the last actual", () => {
        const 啡壍: ForecastResult = {
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
        const [瑐壍, 錿壍, 怮壍, 缝壍] = 叩壍(forecastOption(蛺壍, 啡壍, 56, "money", "USD", "Spend", true));
        expect(瑐壍?.data).toEqual([null, null, 9]);
        expect(錿壍?.data).toEqual([null, null, 5]);
        expect(瑐壍?.stack).toBe("band");
        expect(錿壍?.stack).toBe("band");
        expect(怮壍?.data).toEqual([10, 12, null]);
        expect(缝壍?.data).toEqual([null, 12, 11]);
    });
    it("curve: clean axis max, observed range shaded, current and recommended marks", () => {
        expect(niceCeil(606)).toBe(1000);
        expect(niceCeil(1866)).toBe(2000);
        expect(niceCeil(2100)).toBe(2500);
        const 鸌壍: CurvesResponse["curves"][number] = { campaignId: "c1", name: "Brand", objective: "conv_value", a: 43.6, b: 0.87, bRaw: 1.2, r2: 0.42, n: 60, spendRange: [328, 433], confidence: "medium" };
        const 櫻壍 = curveOption(蛺壍, 鸌壍, "conv_value", 420, 671.67, "USD", true);
        const [觪壍, 囙壍, 痈壍] = 叩壍(櫻壍);
        expect(櫻壍.xAxis).toMatchObject({ min: 0, max: 1000 });
        expect(觪壍?.markArea).toBeTruthy();
        expect(囙壍?.data).toHaveLength(1);
        expect(痈壍?.data).toHaveLength(1);
        expect(叩壍(curveOption(蛺壍, 鸌壍, "conv_value", 420, null, "USD", true))[2]?.data).toEqual([]);
    });
    it("scenarios: labels only the first costed point, the current total and the last", () => {
        const 钷壍: ScenarioPoint[] = [-0.3, -0.2, -0.1, 0, 0.1, 0.5].map((憦壍, 肕壍) => ({ pct: 憦壍, total: 100 * (1 + 憦壍), expected: 10 + 肕壍, marginalCost: 肕壍 === 0 ? null : 20 + 肕壍 }));
        expect([...scenarioLabelled(钷壍)].sort()).toEqual([-0.2, 0, 0.5].sort());
        expect(scenarioLabel(0)).toBe("Current");
        expect(scenarioLabel(-0.3)).toBe("−30%");
        expect(scenarioLabel(0.5)).toBe("+50%");
        const 龄壍 = 叩壍(scenarioOption(蛺壍, 钷壍, "conversions", "USD", true))[0]?.data as {
            label: {
                show: boolean;
            };
            symbolSize: number;
        }[];
        expect(龄壍.map((汳壍) => 汳壍.label.show)).toEqual([false, true, false, true, false, true]);
        expect(龄壍[3]?.symbolSize).toBe(11);
    });
    it("simulator: Google's points and our model share one y-axis, identity colors, current and what-if marks", () => {
        const 譢壍 = [210, 420, 630, 840].map((塑壍, 着壍) => ({ value: 塑壍, cost: 塑壍 * 0.95, clicks: 100, impressions: 2000, conversions: 5 + 3 * 着壍, convValue: (5 + 3 * 着壍) * 90, requiredBudget: null }));
        const 阯壍 = { type: "BUDGET" as const, objective: "conversions" as const, points: 譢壍, modelCurve: { a: 0.3, b: 0.7 }, current: 420, whatIf: 600, currency: "USD" };
        const 挞壍 = simulatorOption(蛺壍, 阯壍, true);
        expect(Array.isArray(挞壍.yAxis)).toBe(false);
        expect(挞壍.yAxis).toMatchObject({ type: "value", min: 0 });
        expect(挞壍.xAxis).toMatchObject({ type: "value", min: 0, max: 1000, interval: 200 });
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
        const 舍壍 = (仼壍: {
            series: unknown[];
        }) => 仼壍.series as SimSeries[];
        const [淫壍, 賚壍] = 舍壍(挞壍);
        expect(淫壍?.data).toEqual(譢壍.map((姉壍) => [姉壍.value, 姉壍.conversions]));
        expect(淫壍?.lineStyle?.color).toBe(蛺壍.series[1]);
        expect(賚壍?.lineStyle).toMatchObject({ color: 蛺壍.series[0], type: [5, 4] });
        expect(賚壍?.data).toHaveLength(48);
        expect(淫壍?.markLine?.data.map((碸壍) => 碸壍.xAxis)).toEqual([420, 600]);
        expect(舍壍(simulatorOption(蛺壍, { ...阯壍, whatIf: 420 }, true))[0]?.markLine?.data).toHaveLength(1);
        const 鞧壍 = simulatorOption(蛺壍, { ...阯壍, type: "TARGET_ROAS", points: 譢壍.map((撖壍, 莅壍) => ({ ...撖壍, value: [3, 3.5, 4, 5][莅壍] as number })), current: 4, whatIf: null }, true);
        expect(叩壍(鞧壍)).toHaveLength(1);
        expect(鞧壍.xAxis).toMatchObject({ max: 6, interval: 1 });
        const 側壍 = (挞壍.tooltip as unknown as {
            formatter: (潣壍: {
                axisValue: number;
            }[]) => string;
        }).formatter([{ axisValue: 525 }]);
        expect(側壍).toContain("$525/day");
        expect(側壍).toContain("Google, conv. / day");
        expect(側壍).toContain("Our model, conv. / day");
        expect((挞壍.tooltip as unknown as {
            formatter: (蹒壍: {
                axisValue: number;
            }[]) => string;
        }).formatter([{ axisValue: 990 }])).toContain("not simulated");
    });
    it("flighting: bars capped at 24px with 4px rounded tops and the even line", () => {
        const [孁壍] = 叩壍(flightingOption(蛺壍, flightPreview(3100, "2026-10", "even"), "USD", true));
        expect(孁壍?.type).toBe("bar");
        expect(孁壍?.barMaxWidth).toBe(24);
        expect(孁壍?.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
        expect(孁壍?.markLine?.data).toEqual([{ yAxis: 100 }]);
        expect(孁壍?.data).toHaveLength(31);
    });
});
