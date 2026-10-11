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
const 信壍 = { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(4,191,157,0.22)" }, { offset: 1, color: "rgba(4,191,157,0)" }] };
const 滐壍 = (趿壍: ChartTokens) => ({ lineStyle: { color: 趿壍.theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(60,60,67,0.25)", width: 1 } });
export function cumulativeOption(媮壍: ChartTokens, 禝壍: CumulativeSeries, 颌壍: string, 敻壍: boolean) {
    const 葪壍 = weeklyTicks(禝壍.dates.length);
    const 兙壍 = 媮壍.theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(60,60,67,0.18)";
    return {
        ...baseOption(媮壍, 敻壍),
        grid: { left: 52, right: 10, top: 20, bottom: 24 },
        axisPointer: 滐壍(媮壍),
        xAxis: categoryAxis(媮壍, 禝壍.dates, {
            boundaryGap: false,
            axisLabel: { ...axisLabel(媮壍), interval: (灈壍: number) => 葪壍.has(灈壍), formatter: (輷壍: string) => formatShort(輷壍), alignMinLabel: "left", alignMaxLabel: "right" },
        }),
        yAxis: valueAxis(媮壍, "money", 颌壍, { min: 0, max: 禝壍.max, splitNumber: 3 }),
        tooltip: {
            ...baseOption(媮壍, 敻壍).tooltip,
            trigger: "axis",
            formatter: (尦壍: {
                dataIndex: number;
            }[]) => {
                const 笕壍 = 尦壍[0]?.dataIndex ?? 0;
                const 騄壍: TipRow[] = [];
                const 曳壍 = 禝壍.actual[笕壍];
                const 藢壍 = 禝壍.projected[笕壍];
                if (曳壍 !== null && 曳壍 !== undefined)
                    騄壍.push({ color: 媮壍.accentLine, label: "Actual", value: money(曳壍, 颌壍, { compact: false }) });
                if (藢壍 !== null && 藢壍 !== undefined && (曳壍 === null || 曳壍 === undefined))
                    騄壍.push({ color: 媮壍.accentLine, dashed: true, label: "Projected", value: money(藢壍, 颌壍, { compact: false }) });
                騄壍.push({ color: 媮壍.faint, label: "Ideal pace", value: money(禝壍.ideal[笕壍], 颌壍, { compact: false }) });
                騄壍.push({ label: "Budget", value: money(禝壍.total, 颌壍, { compact: false }) });
                return tooltipHtml(formatShort(禝壍.dates[笕壍] ?? ""), 騄壍);
            },
        },
        series: [
            {
                name: "Ideal pace",
                type: "line",
                data: 禝壍.ideal,
                symbol: "none",
                lineStyle: { color: 媮壍.faint, width: 1 },
                silent: true,
                z: 1,
                markLine: {
                    symbol: "none",
                    silent: true,
                    label: { show: true, position: "insideEndTop", formatter: `Budget ${money(禝壍.total, 颌壍)}`, color: 媮壍.muted3, fontFamily: 媮壍.fontMono, fontSize: 10 },
                    lineStyle: { color: 兙壍, width: 1, type: [4, 4] },
                    data: [{ yAxis: 禝壍.total }],
                },
            },
            {
                name: "Actual",
                type: "line",
                data: 禝壍.actual,
                symbol: "circle",
                symbolSize: 8,
                showSymbol: false,
                lineStyle: { color: 媮壍.accentLine, width: 2 },
                itemStyle: { color: 媮壍.accent, borderColor: 媮壍.surface, borderWidth: 2 },
                emphasis: { scale: false },
                areaStyle: { color: 信壍 },
                z: 3,
            },
            { name: "Projected", type: "line", data: 禝壍.projected, symbol: "none", lineStyle: { color: 媮壍.accentLine, width: 2, type: [5, 4] }, z: 2 },
        ],
    };
}
export function forecastOption(勑壍: ChartTokens, 燀壍: ForecastResult, 邯壍: number, 嶞壍: MetricFormat, 粍壍: string, 魼壍: string, 桫壍: boolean) {
    const 蝚壍 = 燀壍.history.slice(-邯壍);
    const 呉壍 = 燀壍.points;
    const 猸壍 = [...蝚壍.map((鈧壍) => 鈧壍.date), ...呉壍.map((弖壍) => 弖壍.date)];
    const 縅壍 = (鳴壍: number | null | undefined) => formatMetricValue(嶞壍, 鳴壍, { currency: 粍壍, compact: false, decimals: 嶞壍 === "decimal" ? 1 : undefined });
    const 槣壍 = evenTicks(猸壍.length, 6);
    const 裒壍 = 蝚壍.map(() => null);
    const 嗁壍 = 蝚壍[蝚壍.length - 1];
    return {
        ...baseOption(勑壍, 桫壍),
        grid: { left: 56, right: 10, top: 12, bottom: 24 },
        axisPointer: 滐壍(勑壍),
        xAxis: categoryAxis(勑壍, 猸壍, { boundaryGap: false, axisLabel: { ...axisLabel(勑壍), interval: (環壍: number) => 槣壍.has(環壍), formatter: (鎟壍: string) => formatShort(鎟壍), alignMinLabel: "left", alignMaxLabel: "right" } }),
        yAxis: valueAxis(勑壍, 嶞壍, 粍壍, { splitNumber: 4, min: 0 }),
        tooltip: {
            ...baseOption(勑壍, 桫壍).tooltip,
            trigger: "axis",
            formatter: (悎壍: {
                dataIndex: number;
            }[]) => {
                const 罽壍 = 悎壍[0]?.dataIndex ?? 0;
                const 鹬壍 = 蝚壍[罽壍];
                if (鹬壍)
                    return tooltipHtml(formatShort(鹬壍.date), [{ color: 勑壍.accentLine, label: `${魼壍}, actual`, value: 縅壍(鹬壍.value) }]);
                const 歛壍 = 呉壍[罽壍 - 蝚壍.length];
                if (!歛壍)
                    return "";
                return tooltipHtml(formatShort(歛壍.date), [
                    { color: 勑壍.accentLine, dashed: true, label: `${魼壍}, forecast`, value: 縅壍(歛壍.yhat) },
                    { label: "80% range", value: `${縅壍(歛壍.lo)} – ${縅壍(歛壍.hi)}` },
                ]);
            },
        },
        series: [
            { name: "lo", type: "line", data: [...裒壍, ...呉壍.map((詊壍) => 詊壍.lo)], stack: "band", symbol: "none", lineStyle: { opacity: 0 }, silent: true },
            { name: "band", type: "line", data: [...裒壍, ...呉壍.map((圹壍) => Math.max(0, 圹壍.hi - 圹壍.lo))], stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(4,191,157,0.14)" }, silent: true },
            {
                name: "Actual",
                type: "line",
                data: [...蝚壍.map((瘨壍) => 瘨壍.value), ...呉壍.map(() => null)],
                symbol: "circle",
                symbolSize: 8,
                showSymbol: false,
                lineStyle: { color: 勑壍.accentLine, width: 2 },
                itemStyle: { color: 勑壍.accent, borderColor: 勑壍.surface, borderWidth: 2 },
                areaStyle: { color: 信壍 },
            },
            {
                name: "Forecast",
                type: "line",
                data: [...蝚壍.map((锗壍, 戆壍) => (戆壍 === 蝚壍.length - 1 ? (嗁壍?.value ?? null) : null)), ...呉壍.map((胵壍) => 胵壍.yhat)],
                symbol: "none",
                lineStyle: { color: 勑壍.accentLine, width: 2, type: [5, 4] },
            },
        ],
    };
}
type Curve = CurvesResponse["curves"][number];
export function niceCeil(鿤壍: number): number {
    if (!(鿤壍 > 0))
        return 1;
    const 泓壍 = 10 ** Math.floor(Math.log10(鿤壍));
    return ([1, 2, 2.5, 5, 10].map((诂壍) => 诂壍 * 泓壍).find((墱壍) => 墱壍 >= 鿤壍) ?? 10 * 泓壍) as number;
}
export function curveOption(瞠壍: ChartTokens, 随壍: Curve, 捾壍: Objective, 艭壍: number | null, 作壍: number | null, 湋壍: string, 贺壍: boolean) {
    const 娩壍 = niceCeil(Math.max(随壍.spendRange[1] * 1.4, (艭壍 ?? 0) * 1.8, (作壍 ?? 0) * 1.15, 1));
    const 礘壍 = Array.from({ length: 48 }, (頇壍, 擶壍) => (娩壍 * (擶壍 + 1)) / 48).map((菥壍) => [菥壍, curveOutcome(随壍, 菥壍)] as [
        number,
        number
    ]);
    const 僔壍 = (濃壍: number | null, 躲壍: boolean) => (濃壍 !== null && 濃壍 > 0 ? [{ value: [濃壍, curveOutcome(随壍, 濃壍)], itemStyle: 躲壍 ? { color: 瞠壍.accent, borderColor: 瞠壍.surface, borderWidth: 2 } : { color: 瞠壍.surface, borderColor: 瞠壍.accentLine, borderWidth: 2 } }] : []);
    return {
        ...baseOption(瞠壍, 贺壍),
        grid: { left: 44, right: 8, top: 8, bottom: 20 },
        xAxis: valueAxis(瞠壍, "money", 湋壍, { min: 0, max: 娩壍, splitNumber: 2, splitLine: { show: false } }),
        yAxis: valueAxis(瞠壍, 捾壍 === "conv_value" ? "money" : "number", 湋壍, { min: 0, splitNumber: 2 }),
        tooltip: {
            ...baseOption(瞠壍, 贺壍).tooltip,
            trigger: "axis",
            formatter: (审壍: {
                value: [
                    number,
                    number
                ];
                seriesIndex: number;
            }[]) => {
                const 窐壍 = 审壍.find((饿壍) => 饿壍.seriesIndex === 0) ?? 审壍[0];
                if (!窐壍)
                    return "";
                const [普壍, 蕝壍] = 窐壍.value;
                return tooltipHtml(perDay(普壍, 湋壍), [{ color: 瞠壍.accentLine, label: 捾壍 === "conv_value" ? "Expected value / day" : "Expected conv. / day", value: formatOutcome(捾壍, 蕝壍, 湋壍) }]);
            },
        },
        series: [
            {
                name: "Response",
                type: "line",
                data: 礘壍,
                symbol: "none",
                lineStyle: { color: 瞠壍.accentLine, width: 2 },
                markArea: { silent: true, itemStyle: { color: "rgba(4,191,157,0.08)" }, data: [[{ xAxis: 随壍.spendRange[0] }, { xAxis: 随壍.spendRange[1] }]] },
                z: 2,
            },
            { name: "Current", type: "scatter", data: 僔壍(艭壍, true), symbolSize: 9, z: 4, silent: true },
            { name: "Recommended", type: "scatter", data: 僔壍(作壍, false), symbolSize: 9, z: 5, silent: true },
        ],
    };
}
const 剌壍 = (焻壍: ScenarioPoint) => Math.abs(焻壍.pct) < 1e-9;
export const scenarioLabel = (逪壍: number) => (Math.abs(逪壍) < 1e-9 ? "Current" : `${逪壍 > 0 ? "+" : "−"}${Math.round(Math.abs(逪壍) * 100)}%`);
export function scenarioLabelled(崙壍: readonly ScenarioPoint[]): Set<number> {
    const 簈壍 = 崙壍.filter((髷壍) => 髷壍.marginalCost !== null);
    return new Set([簈壍[0]?.pct, 0, 崙壍[崙壍.length - 1]?.pct].filter((柦壍): 柦壍 is number => 柦壍 !== undefined));
}
export function scenarioOption(蛕壍: ChartTokens, 叄壍: readonly ScenarioPoint[], 犳壍: Objective, 醢壍: string, 庑壍: boolean) {
    const 綀壍 = scenarioLabelled(叄壍);
    const 鱯壍 = 叄壍.find(剌壍);
    const 楞壍 = 犳壍 === "conversions" ? "conv." : "value";
    return {
        ...baseOption(蛕壍, 庑壍),
        grid: { left: 56, right: 24, top: 28, bottom: 26 },
        axisPointer: 滐壍(蛕壍),
        xAxis: valueAxis(蛕壍, "money", 醢壍, { scale: true, splitNumber: 4, splitLine: { show: false } }),
        yAxis: valueAxis(蛕壍, 犳壍 === "conv_value" ? "money" : "number", 醢壍, { scale: true, splitNumber: 3 }),
        tooltip: {
            ...baseOption(蛕壍, 庑壍).tooltip,
            trigger: "axis",
            formatter: (衍壍: {
                dataIndex: number;
            }[]) => {
                const 唼壍 = 叄壍[衍壍[0]?.dataIndex ?? 0];
                if (!唼壍)
                    return "";
                const 琫壍: TipRow[] = [{ color: 蛕壍.accentLine, label: `Expected ${楞壍}`, value: formatOutcome(犳壍, 唼壍.expected, 醢壍) }];
                if (唼壍.marginalCost !== null)
                    琫壍.push({ label: 犳壍 === "conversions" ? "Marginal CPA" : "Marginal ROAS", value: marginalLabel(犳壍, 唼壍.marginalCost, 醢壍) });
                if (鱯壍 && 唼壍 !== 鱯壍)
                    琫壍.push({ label: "vs current", value: formatDelta(鱯壍.expected > 0 ? 唼壍.expected / 鱯壍.expected - 1 : null) });
                return tooltipHtml(`${scenarioLabel(唼壍.pct)} · ${money(唼壍.total, 醢壍)}`, 琫壍);
            },
        },
        series: [
            {
                name: "Expected",
                type: "line",
                data: 叄壍.map((錚壍) => {
                    const 怉壍 = 剌壍(錚壍);
                    return {
                        value: [錚壍.total, 錚壍.expected],
                        symbolSize: 怉壍 ? 11 : 8,
                        itemStyle: 怉壍 ? { color: 蛕壍.accent, borderColor: 蛕壍.surface, borderWidth: 2 } : { color: 蛕壍.surface, borderColor: 蛕壍.accentLine, borderWidth: 2 },
                        label: {
                            show: 綀壍.has(錚壍.pct),
                            position: "top",
                            distance: 8,
                            color: 蛕壍.muted3,
                            fontFamily: 蛕壍.fontMono,
                            fontSize: 10,
                            formatter: () => (怉壍 ? `Current · ${marginalLabel(犳壍, 錚壍.marginalCost, 醢壍)}` : marginalLabel(犳壍, 錚壍.marginalCost, 醢壍)),
                        },
                    };
                }),
                symbol: "circle",
                showSymbol: true,
                lineStyle: { color: 蛕壍.accentLine, width: 2 },
                labelLayout: { hideOverlap: true },
                z: 3,
            },
        ],
    };
}
export function flightingOption(绸壍: ChartTokens, 鷧壍: FlightPreview, 櫖壍: string, 觅壍: boolean) {
    const 嚴壍 = 鷧壍.days.map((疣壍) => 疣壍.date);
    const 钒壍 = weeklyTicks(嚴壍.length);
    return {
        ...baseOption(绸壍, 觅壍),
        grid: { left: 56, right: 10, top: 18, bottom: 24 },
        xAxis: categoryAxis(绸壍, 嚴壍, { axisLabel: { ...axisLabel(绸壍), interval: (憁壍: number) => 钒壍.has(憁壍), formatter: (聰壍: string) => formatShort(聰壍) } }),
        yAxis: valueAxis(绸壍, "money", 櫖壍, { min: 0, splitNumber: 3 }),
        tooltip: {
            ...baseOption(绸壍, 觅壍).tooltip,
            trigger: "item",
            formatter: (齟壍: {
                dataIndex: number;
            }) => {
                const 汎壍 = 鷧壍.days[齟壍.dataIndex];
                return 汎壍 ? tooltipHtml(formatShort(汎壍.date), [{ color: 绸壍.accentLine, label: "Daily amount", value: moneyExact(汎壍.amount, 櫖壍) }]) : "";
            },
        },
        series: [
            {
                name: "Daily amount",
                type: "bar",
                data: 鷧壍.days.map((謽壍) => 謽壍.amount),
                barMaxWidth: 24,
                barCategoryGap: "18%",
                itemStyle: { color: 绸壍.accentLine, borderRadius: [4, 4, 0, 0] },
                emphasis: { itemStyle: { color: 绸壍.accent } },
                markLine: {
                    symbol: "none",
                    silent: true,
                    label: { show: true, position: "insideEndTop", formatter: `Even ${perDay(鷧壍.avgDaily, 櫖壍)}`, color: 绸壍.muted3, fontFamily: 绸壍.fontMono, fontSize: 10 },
                    lineStyle: { color: 绸壍.faint, width: 1, type: [4, 4] },
                    data: [{ yAxis: 鷧壍.avgDaily }],
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
export function simulatorOption(堬壍: ChartTokens, 眛壍: SimulatorChart, 阊壍: boolean) {
    const 拹壍 = colorFor("estimate_source", "google_simulator", 1, 堬壍);
    const 臨壍 = colorFor("estimate_source", "model", 0, 堬壍);
    const 仗壍 = 眛壍.type !== "TARGET_ROAS";
    const 淆壍 = Math.max(0, ...眛壍.points.map((貵壍) => 貵壍.value), 眛壍.current ?? 0, 眛壍.whatIf ?? 0);
    const 妤壍 = (碓壍: number) => (碓壍 <= 6 ? 1 : 碓壍 <= 12 ? 2 : 5);
    const 鞂壍 = Math.max(1, 淆壍 * 1.08);
    const 摱壍 = 仗壍 ? niceCeil(淆壍 * 1.08) : Math.ceil(鞂壍 / 妤壍(鞂壍)) * 妤壍(鞂壍);
    const 荠壍 = 仗壍 ? 摱壍 / 5 : 妤壍(鞂壍);
    const 偏壍 = 眛壍.type === "BUDGET" ? 眛壍.modelCurve : null;
    const 漾壍 = 偏壍 ? Array.from({ length: 48 }, (踭壍, 嬜壍) => (摱壍 * (嬜壍 + 1)) / 48).map((程壍) => [程壍, curveOutcome(偏壍, 程壍)] as [
        number,
        number
    ]) : [];
    const 飺壍 = 眛壍.objective === "conversions" ? "Conv. / day" : "Value / day";
    const 早壍 = (蓘壍: number | null, 凇壍: string, 炶壍: boolean) => 蓘壍 !== null && 蓘壍 > 0
        ? [{ xAxis: 蓘壍, label: { show: true, position: "end", formatter: 凇壍, color: 堬壍.muted3, fontFamily: 堬壍.fontMono, fontSize: 10 }, lineStyle: { color: 堬壍.faint, width: 1, type: 炶壍 ? [4, 4] : "solid" } }]
        : [];
    const 辥壍 = [...早壍(眛壍.current, `Current ${settingLabel(眛壍.type, 眛壍.current, 眛壍.currency)}`, false), ...(眛壍.whatIf !== null && 眛壍.current !== null && Math.abs(眛壍.whatIf - 眛壍.current) < 1e-6 ? [] : 早壍(眛壍.whatIf, "What-if", true))];
    return {
        ...baseOption(堬壍, 阊壍),
        grid: { left: 52, right: 16, top: 26, bottom: 24 },
        axisPointer: 滐壍(堬壍),
        xAxis: valueAxis(堬壍, 仗壍 ? "money" : "ratio", 眛壍.currency, { min: 0, max: 摱壍, interval: 荠壍, splitLine: { show: false } }),
        yAxis: valueAxis(堬壍, 眛壍.objective === "conv_value" ? "money" : "number", 眛壍.currency, { min: 0, splitNumber: 3 }),
        tooltip: {
            ...baseOption(堬壍, 阊壍).tooltip,
            trigger: "axis",
            formatter: (岔壍: {
                axisValue?: number | string;
            }[]) => {
                const 箃壍 = Number(岔壍[0]?.axisValue);
                if (!Number.isFinite(箃壍) || 箃壍 <= 0)
                    return "";
                const 驲壍 = interpolatePoints(眛壍.points, 箃壍, 0);
                const 条壍: TipRow[] = [{ color: 拹壍, label: `Google, ${飺壍.toLowerCase()}`, value: 驲壍 ? formatOutcome(眛壍.objective, outcomeOf(驲壍, 眛壍.objective), 眛壍.currency) : "not simulated" }];
                if (偏壍)
                    条壍.push({ color: 臨壍, dashed: true, label: `Our model, ${飺壍.toLowerCase()}`, value: formatOutcome(眛壍.objective, curveOutcome(偏壍, 箃壍), 眛壍.currency) });
                if (驲壍)
                    条壍.push({ label: "Google, cost / day", value: money(驲壍.cost, 眛壍.currency, { compact: false }) });
                return tooltipHtml(settingLabel(眛壍.type, 箃壍, 眛壍.currency), 条壍);
            },
        },
        series: [
            {
                name: "Google simulator",
                type: "line",
                data: 眛壍.points.map((虐壍) => [虐壍.value, outcomeOf(虐壍, 眛壍.objective)]),
                symbol: "circle",
                symbolSize: 8,
                showSymbol: true,
                lineStyle: { color: 拹壍, width: 2 },
                itemStyle: { color: 拹壍, borderColor: 堬壍.surface, borderWidth: 2 },
                emphasis: { scale: false },
                markLine: { symbol: "none", silent: true, data: 辥壍 },
                z: 3,
            },
            ...(偏壍 ? [{ name: "Our model", type: "line", data: 漾壍, symbol: "none", lineStyle: { color: 臨壍, width: 2, type: [5, 4] }, silent: true, z: 2 }] : []),
        ],
    };
}
