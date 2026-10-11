import { MONITORED_METRICS, type AnomalySettings, type DetectorId, type MonitoredMetric, type Signal, type SignalKind, type ThresholdRule } from "../contracts/anomaly";
import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type PacingReport, type PacingRow } from "../contracts/budget";
import { formatShort } from "../dates";
import type { Aggregates, MetricRegistry } from "../metrics/registry";
import { mad, median, round, std } from "../stats";
import type { CivilDate, MetricFormat, Mode, Severity } from "../types";
import { SEVERITY_WEIGHT, signalId } from "./ids";
import { cpaDrivenByCvr, fmt, metricRecommendation, pacingRecommendation, pacingTitle, plural, RECOMMENDATIONS, signedPct, deviationTitle } from "./recommendations";
import { combineSeries, dailyValues, dateAt, displaySeries, emptyDay, firstDataIndex, MONITORED, sumWindow, type DayTotals, type EntitySeries, type MonitoredDef, type WindowSum } from "./series";
export interface DetectorContext {
    accountId: string;
    accountName: string;
    mode: Mode;
    currency: string;
    dataThrough: CivilDate;
    now: string;
    settings: AnomalySettings;
    conversionLag: boolean;
    registry?: MetricRegistry;
}
const 莖壍 = 1e-9;
export const MAX_ONSET_LOOKBACK = 7;
const 傅壍 = 5;
export const DEFAULT_DAILY_OVER = 1.2;
export const DEFAULT_DAILY_OVER_CRITICAL = 1.5;
const 潴壍 = 7;
interface Draft {
    entity: Signal["entity"];
    scope?: Signal["scope"];
    kind: SignalKind;
    detector: DetectorId;
    ruleId?: string;
    metric?: string;
    direction?: "up" | "down";
    polarity: "bad" | "good";
    severity: Severity;
    strength: number;
    observed: number;
    expected: number;
    changePct?: number;
    z?: number;
    band?: {
        lo: number;
        hi: number;
    };
    window: Signal["window"];
    onsetDate?: CivilDate;
    series: Signal["series"];
    title: string;
    summary: string;
    recommendation: string;
    evidence: Signal["evidence"];
    cpaDrivers?: Signal["cpaDrivers"];
    format: MetricFormat;
}
function 蹣壍(孒壍: number, 穁壍: number): number {
    if (穁壍 === 0)
        return 孒壍 === 0 ? 0 : 孒壍 > 0 ? 1 : -1;
    const 餰壍 = 孒壍 / 穁壍 - 1;
    return Number.isFinite(餰壍) ? 餰壍 : 0;
}
export function makeSignal(星壍: DetectorContext, 蔎壍: Draft): Signal {
    const 函壍 = 蔎壍.changePct ?? 蹣壍(蔎壍.observed, 蔎壍.expected);
    return {
        id: signalId(蔎壍.entity.id, 蔎壍.kind, 蔎壍.detector, 蔎壍.window.recentEnd, 蔎壍.metric, 蔎壍.ruleId),
        accountId: 星壍.accountId,
        mode: 星壍.mode,
        scope: 蔎壍.scope ?? "campaign",
        entity: 蔎壍.entity,
        kind: 蔎壍.kind,
        detectors: [蔎壍.detector],
        ruleId: 蔎壍.ruleId,
        metric: 蔎壍.metric,
        direction: 蔎壍.direction,
        polarity: 蔎壍.polarity,
        severity: 蔎壍.severity,
        score: round(Math.max(0, 蔎壍.strength) * SEVERITY_WEIGHT[蔎壍.severity], 3),
        observed: 蔎壍.observed,
        expected: 蔎壍.expected,
        changePct: 函壍,
        z: 蔎壍.z,
        band: 蔎壍.band,
        window: 蔎壍.window,
        onsetDate: 蔎壍.onsetDate,
        series: 蔎壍.series,
        title: 蔎壍.title,
        summary: 蔎壍.summary,
        recommendation: 蔎壍.recommendation,
        evidence: 蔎壍.evidence,
        relatedChanges: [],
        ...(蔎壍.cpaDrivers ? { cpaDrivers: 蔎壍.cpaDrivers } : {}),
        format: 蔎壍.format,
        dataAsOf: 星壍.dataThrough,
        detectedAt: 星壍.now,
    };
}
const 烬壍 = (进壍: EntitySeries): Signal["entity"] => ({ id: 进壍.id, name: 进壍.name, type: 进壍.type });
function 峊壍(箹壍: EntitySeries, 骨壍: number, 林壍: number): string {
    return `${formatShort(dateAt(箹壍, 骨壍))} – ${formatShort(dateAt(箹壍, 林壍))}`;
}
export interface Deviation {
    observed: number;
    expected: number;
    sd: number;
    z: number;
    recentStart: number;
    end: number;
    baselineStart: number;
    baselineEnd: number;
    onsetIndex: number;
}
export function zDeviation(蚆壍: EntitySeries, 卵壍: MonitoredDef, 牤壍: number, 酓壍: number, 幂壍: number, 紱壍 = 蚆壍.days.length - 1): Deviation | null {
    const 鰠壍 = 紱壍 - 牤壍 + 1;
    const 椏壍 = firstDataIndex(蚆壍);
    if (鰠壍 <= 椏壍)
        return null;
    const 蟾壍 = 卵壍.window(sumWindow(蚆壍, 鰠壍, 紱壍));
    if (蟾壍 === null)
        return null;
    let 哭壍 = 0;
    while (哭壍 < MAX_ONSET_LOOKBACK) {
        const 珜壍 = 鰠壍 - 哭壍 - 1;
        const 鋋壍 = 珜壍 - 1;
        const 徺壍 = 鋋壍 - 酓壍 + 1;
        if (徺壍 < 椏壍)
            break;
        const 纩壍 = dailyValues(蚆壍, 卵壍, 徺壍, 鋋壍);
        const 鶘壍 = 卵壍.window(sumWindow(蚆壍, 徺壍, 鋋壍));
        const 檇壍 = 蚆壍.days[珜壍];
        const 襶壍 = 檇壍 ? 卵壍.daily(檇壍) : null;
        if (纩壍.length < 傅壍 || 鶘壍 === null || 襶壍 === null)
            break;
        const 噥壍 = std(纩壍) || 莖壍;
        const 畔壍 = Math.sign(蟾壍 - 鶘壍);
        if (畔壍 !== 0 && ((襶壍 - 鶘壍) / 噥壍) * 畔壍 >= 幂壍)
            哭壍++;
        else
            break;
    }
    const 鑃壍 = 鰠壍 - 哭壍 - 1;
    const 愲壍 = Math.max(椏壍, 鑃壍 - 酓壍 + 1);
    const 耡壍 = dailyValues(蚆壍, 卵壍, 愲壍, 鑃壍);
    if (耡壍.length < 傅壍)
        return null;
    const 鼐壍 = 卵壍.window(sumWindow(蚆壍, 愲壍, 鑃壍));
    if (鼐壍 === null)
        return null;
    const 毿壍 = std(耡壍) || 莖壍;
    const 諮壍 = (蟾壍 - 鼐壍) / 毿壍;
    let 埝壍 = 鰠壍 - 哭壍;
    if (哭壍 === 0) {
        const 盌壍 = Math.sign(諮壍);
        for (let 閻壍 = 鰠壍; 閻壍 <= 紱壍; 閻壍++) {
            const 抪壍 = 蚆壍.days[閻壍];
            const 膙壍 = 抪壍 ? 卵壍.daily(抪壍) : null;
            if (膙壍 !== null && ((膙壍 - 鼐壍) / 毿壍) * 盌壍 >= 幂壍) {
                埝壍 = 閻壍;
                break;
            }
        }
    }
    return { observed: 蟾壍, expected: 鼐壍, sd: 毿壍, z: 諮壍, recentStart: 鰠壍, end: 紱壍, baselineStart: 愲壍, baselineEnd: 鑃壍, onsetIndex: 埝壍 };
}
export function robustDeviation(予壍: EntitySeries, 海壍: MonitoredDef, 豦壍: number, 奕壍: number, 硄壍 = 予壍.days.length - 1): Deviation | null {
    const 霳壍 = 硄壍 - 豦壍 + 1;
    const 搢壍 = 霳壍 - 1;
    const 茑壍 = Math.max(firstDataIndex(予壍), 搢壍 - 奕壍 + 1);
    const 倀壍 = dailyValues(予壍, 海壍, 茑壍, 搢壍);
    const 滯壍 = 海壍.window(sumWindow(予壍, 霳壍, 硄壍));
    if (倀壍.length < 傅壍 || 滯壍 === null)
        return null;
    const 跞壍 = median(倀壍);
    const 嫍壍 = mad(倀壍) || 莖壍;
    return { observed: 滯壍, expected: 跞壍, sd: 嫍壍, z: (滯壍 - 跞壍) / 嫍壍, recentStart: 霳壍, end: 硄壍, baselineStart: 茑壍, baselineEnd: 搢壍, onsetIndex: 霳壍 };
}
export function seasonalDeviation(禼壍: EntitySeries, 颫壍: MonitoredDef, 斚壍: number, 蒉壍 = 禼壍.days.length - 1): Deviation | null {
    const 典壍 = firstDataIndex(禼壍);
    const 灧壍: number[] = [];
    for (let 轖壍 = 1; 轖壍 <= 斚壍; 轖壍++)
        if (蒉壍 - 7 * 轖壍 >= 典壍)
            灧壍.push(蒉壍 - 7 * 轖壍);
    if (灧壍.length < 2)
        return null;
    const 居壍 = 禼壍.days[蒉壍];
    const 笴壍 = 居壍 ? 颫壍.daily(居壍) : null;
    if (笴壍 === null)
        return null;
    const 騣壍: WindowSum = { ...emptyDay(), n: 0 };
    const 朒壍: number[] = [];
    for (const 蘁壍 of 灧壍) {
        const 勰壍 = 禼壍.days[蘁壍];
        if (!勰壍)
            continue;
        const 營壍 = 颫壍.daily(勰壍);
        if (營壍 !== null)
            朒壍.push(營壍);
        騣壍.cost += 勰壍.cost;
        騣壍.clicks += 勰壍.clicks;
        騣壍.impressions += 勰壍.impressions;
        騣壍.conversions += 勰壍.conversions;
        騣壍.conv_value += 勰壍.conv_value;
        騣壍.n++;
    }
    const 郎壍 = 颫壍.window(騣壍);
    if (郎壍 === null || 朒壍.length < 2)
        return null;
    const 嶽壍 = std(朒壍) || 莖壍;
    return { observed: 笴壍, expected: 郎壍, sd: 嶽壍, z: (笴壍 - 郎壍) / 嶽壍, recentStart: 蒉壍, end: 蒉壍, baselineStart: 灧壍[灧壍.length - 1] as number, baselineEnd: 灧壍[0] as number, onsetIndex: 蒉壍 };
}
function 粬壍(鮛壍: EntitySeries, 梊壍: MonitoredDef, 蝹壍: Deviation, 周壍: AnomalySettings["minVolume"]): boolean {
    const 獗壍 = sumWindow(鮛壍, 蝹壍.baselineStart, 蝹壍.baselineEnd);
    const 鉆壍 = 獗壍.n || 1;
    if (獗壍.impressions / 鉆壍 < 周壍.imprPerDay)
        return false;
    if ((梊壍.volume === "clicks" || 梊壍.volume === "conv") && 獗壍.clicks / 鉆壍 < 周壍.clicksPerDay)
        return false;
    if (梊壍.volume === "conv" && 獗壍.conversions / 鉆壍 < 周壍.convPerDay)
        return false;
    return true;
}
const 張壍: ReadonlySet<MonitoredMetric> = new Set(["conversions", "cpa", "cvr", "roas"]);
function 縤壍(鴓壍: EntitySeries, 樂壍: Deviation): {
    cpc: number;
    cvr: number;
} | null {
    const 裱壍 = (嗠壍: number, 瓏壍: number) => {
        const 鎾壍 = { cost: 0, clicks: 0, conv: 0 };
        for (let 悭壍 = Math.max(0, 嗠壍); 悭壍 <= 瓏壍; 悭壍++) {
            const 羜壍 = 鴓壍.days[悭壍];
            if (!羜壍)
                continue;
            鎾壍.cost += 羜壍.cost;
            鎾壍.clicks += 羜壍.clicks;
            鎾壍.conv += 羜壍.conversions;
        }
        return 鎾壍;
    };
    const 麋壍 = 裱壍(樂壍.recentStart, 樂壍.end);
    const 歺壍 = 裱壍(樂壍.baselineStart, 樂壍.baselineEnd);
    if (!麋壍.clicks || !歺壍.clicks || !麋壍.conv || !歺壍.conv || !麋壍.cost || !歺壍.cost)
        return null;
    return { cpc: 麋壍.cost / 麋壍.clicks / (歺壍.cost / 歺壍.clicks) - 1, cvr: 麋壍.conv / 麋壍.clicks / (歺壍.conv / 歺壍.clicks) - 1 };
}
function 詩壍(坘壍: DetectorContext, 癇壍: EntitySeries, 锶壍: MonitoredDef, 戥壍: "zscore" | "robust" | "seasonal", 脔壍: Deviation, 七壍: number, 泲壍: Severity, 诡壍: string): Signal {
    const 壐壍 = 泲壍 !== "info";
    const 瞿壍 = 脔壍.z > 0;
    const 隮壍 = 蹣壍(脔壍.observed, 脔壍.expected);
    const 掝壍 = (芌壍: number) => fmt(锶壍.format, 芌壍, 坘壍.currency);
    const 佻壍 = 锶壍.key === "spend" || 锶壍.key === "conversions";
    const 湪壍 = 脔壍.end - 脔壍.recentStart + 1;
    const 赙壍 = 脔壍.baselineEnd - 脔壍.baselineStart + 1;
    const 婈壍 = dateAt(癇壍, 脔壍.onsetIndex);
    const 礷壍 = 戥壍 === "robust" ? "Robust z" : "z-score";
    const 頦壍 = 锶壍.key === "cpa" && 戥壍 !== "seasonal" ? 縤壍(癇壍, 脔壍) : null;
    let 攕壍: string;
    if (戥壍 === "seasonal") {
        攕壍 = `${锶壍.label} was ${掝壍(脔壍.observed)} on ${formatShort(dateAt(癇壍, 脔壍.end))} vs ${掝壍(脔壍.expected)} on the same weekday over the previous ${plural(Math.round((脔壍.baselineEnd - 脔壍.baselineStart) / 7) + 1, "week")} (z ${脔壍.z.toFixed(1)}).`;
    }
    else {
        const 萄壍 = 佻壍 ? "averaged" : "was";
        const 僳壍 = 佻壍 ? "/day" : "";
        const 濢壍 = 戥壍 === "robust" ? "median of the" : "the";
        攕壍 = `${锶壍.label} ${萄壍} ${掝壍(脔壍.observed)}${僳壍} over the last ${plural(湪壍, "day")} vs ${掝壍(脔壍.expected)}${僳壍} expected from ${濢壍} ${赙壍}-day baseline (${戥壍 === "robust" ? "robust " : ""}z ${脔壍.z.toFixed(1)}).`;
        if (脔壍.onsetIndex < 脔壍.recentStart)
            攕壍 += ` The shift started ${formatShort(婈壍)}.`;
    }
    攕壍 += 诡壍;
    return makeSignal(坘壍, {
        entity: 烬壍(癇壍),
        kind: "metric_deviation",
        detector: 戥壍,
        metric: 锶壍.key,
        direction: 瞿壍 ? "up" : "down",
        polarity: 壐壍 ? "bad" : "good",
        severity: 泲壍,
        strength: Math.abs(脔壍.z),
        observed: 脔壍.observed,
        expected: 脔壍.expected,
        changePct: 隮壍,
        z: 脔壍.z,
        band: { lo: Math.max(0, 脔壍.expected - 七壍 * 脔壍.sd), hi: 脔壍.expected + 七壍 * 脔壍.sd },
        window: { recentStart: dateAt(癇壍, 脔壍.recentStart), recentEnd: dateAt(癇壍, 脔壍.end), baselineStart: dateAt(癇壍, 脔壍.baselineStart), baselineEnd: dateAt(癇壍, 脔壍.baselineEnd) },
        onsetDate: 婈壍,
        series: displaySeries(癇壍, 锶壍.display),
        title: deviationTitle(锶壍.label, 隮壍),
        summary: 攕壍,
        recommendation: 頦壍 && 壐壍 && cpaDrivenByCvr(頦壍) ? RECOMMENDATIONS.cpaFromCvr : metricRecommendation(锶壍.key, 壐壍),
        evidence: [
            { label: "Observed", value: 掝壍(脔壍.observed) },
            { label: "Expected", value: 掝壍(脔壍.expected) },
            { label: 礷壍, value: 脔壍.z.toFixed(1) },
            { label: "Change", value: signedPct(隮壍, 1) },
            ...(頦壍 ? [{ label: "CPC", value: signedPct(頦壍.cpc, 0) }, { label: "Conv. rate", value: signedPct(頦壍.cvr, 0) }] : []),
            { label: "Baseline", value: `${峊壍(癇壍, 脔壍.baselineStart, 脔壍.baselineEnd)} (${plural(戥壍 === "seasonal" ? Math.round((脔壍.baselineEnd - 脔壍.baselineStart) / 7) + 1 : 赙壍, 戥壍 === "seasonal" ? "week" : "day")})` },
        ],
        ...(頦壍 ? { cpaDrivers: 頦壍 } : {}),
        format: 锶壍.format,
    });
}
type DeviationFn = (軑壍: EntitySeries, 寀壍: MonitoredDef, 窯壍?: number) => Deviation | null;
function 馞壍(暍壍: DetectorContext, 蕼壍: readonly EntitySeries[], 剫壍: "zscore" | "robust" | "seasonal", 煚壍: number, 遉壍: DeviationFn, 崸壍: Signal[]): void {
    const 簧壍 = MONITORED_METRICS.filter((鬖壍) => 暍壍.settings.zscore.metrics[鬖壍]);
    for (const 栅壍 of 蕼壍) {
        const 蛴壍 = 遉壍(栅壍, MONITORED.spend);
        for (const 口壍 of 簧壍) {
            const 狒壍 = MONITORED[口壍];
            const 釁壍 = 口壍 === "spend" ? 蛴壍 : 遉壍(栅壍, 狒壍);
            if (!釁壍 || !粬壍(栅壍, 狒壍, 釁壍, 暍壍.settings.minVolume))
                continue;
            if (Math.abs(釁壍.z) < 煚壍)
                continue;
            const 庰壍 = 釁壍.z > 0;
            const 綟壍 = 狒壍.badUp ? 庰壍 : !庰壍;
            if (!綟壍 && 口壍 === "spend")
                continue;
            if (!綟壍 && 口壍 === "conversions" && 蛴壍 && 蛴壍.z >= 煚壍)
                continue;
            let 鲎壍: Severity = !綟壍 ? "info" : Math.abs(釁壍.z) >= 煚壍 * 1.8 ? "critical" : "warning";
            let 楽壍 = "";
            if (綟壍 && 暍壍.conversionLag && 張壍.has(口壍) && 釁壍.end - 釁壍.recentStart >= 1) {
                const 衬壍 = 遉壍(栅壍, 狒壍, 釁壍.end - 1);
                if (!衬壍 || Math.abs(衬壍.z) < 煚壍 || Math.sign(衬壍.z) !== Math.sign(釁壍.z)) {
                    if (鲎壍 === "warning")
                        continue;
                    鲎壍 = "warning";
                    楽壍 = " Severity is reduced because conversions for the most recent day may still be arriving.";
                }
            }
            崸壍.push(詩壍(暍壍, 栅壍, 狒壍, 剫壍, 釁壍, 煚壍, 鲎壍, 楽壍));
        }
    }
}
export function detectZscore(啛壍: DetectorContext, 瑊壍: readonly EntitySeries[], 錹壍: Signal[]): void {
    const 怨壍 = 啛壍.settings.zscore;
    if (!怨壍.enabled)
        return;
    馞壍(啛壍, 瑊壍, "zscore", 怨壍.threshold, (缗壍, 鸆壍, 櫵壍) => zDeviation(缗壍, 鸆壍, 怨壍.recentDays, 怨壍.baselineDays, 怨壍.threshold, 櫵壍), 錹壍);
}
export function detectRobust(觤壍: DetectorContext, 囓壍: readonly EntitySeries[], 痂壍: Signal[]): void {
    const 钱壍 = 觤壍.settings.robust;
    if (!钱壍.enabled)
        return;
    const 憠壍 = 觤壍.settings.zscore.recentDays;
    馞壍(觤壍, 囓壍, "robust", 钱壍.threshold, (肏壍, 齾壍, 汭壍) => robustDeviation(肏壍, 齾壍, 憠壍, 钱壍.baselineDays, 汭壍), 痂壍);
}
export function detectSeasonal(譜壍: DetectorContext, 塋壍: readonly EntitySeries[], 眺壍: Signal[]): void {
    const 阩壍 = 譜壍.settings.seasonal;
    if (!阩壍.enabled)
        return;
    馞壍(譜壍, 塋壍, "seasonal", 阩壍.threshold, (挘壍, 與壍, 件壍) => seasonalDeviation(挘壍, 與壍, 阩壍.weeks, 件壍), 眺壍);
}
function 淥壍(賔壍: DayTotals): Aggregates {
    return {
        cost: 賔壍.cost,
        clicks: 賔壍.clicks,
        impressions: 賔壍.impressions,
        conversions: 賔壍.conversions,
        conv_value: 賔壍.conv_value,
        is_search_impr: 賔壍.is_search_impr,
        is_eligible: 賔壍.is_eligible,
        is_lost_budget: 賔壍.is_lost_budget,
        is_lost_rank: 賔壍.is_lost_rank,
    };
}
const 姃壍: Record<ThresholdRule["op"], string> = { gt: "above", gte: "at or above", lt: "below", lte: "at or below", change_pct_gt: "up more than", change_pct_lt: "down more than" };
function 碲壍(鞡壍: ThresholdRule["op"], 撐壍: number, 荿壍: number): boolean {
    switch (鞡壍) {
        case "gt":
        case "change_pct_gt":
            return 撐壍 > 荿壍;
        case "gte":
            return 撐壍 >= 荿壍;
        case "lt":
        case "change_pct_lt":
            return 撐壍 < 荿壍;
        case "lte":
            return 撐壍 <= 荿壍;
    }
}
const 偮壍: Record<string, MonitoredMetric> = { cost: "spend", conversions: "conversions", cpa: "cpa", ctr: "ctr", cpc: "cpc", cvr: "cvr", roas: "roas" };
export interface RuleHit {
    observed: number;
    expected: number;
    recentStart: number;
    end: number;
    baselineStart?: number;
    baselineEnd?: number;
}
export function evaluateRule(潝壍: ThresholdRule, 蹌壍: EntitySeries, 嬻壍: MetricRegistry, 稪壍 = 蹌壍.days.length - 1): RuleHit | null {
    const 餙壍 = (昈壍: number, 蓷壍: number): number | null => {
        const 処壍 = sumWindow(蹌壍, 昈壍, 蓷壍);
        if (処壍.n === 0)
            return null;
        return 嬻壍.computeValue(潝壍.metric, 淥壍(処壍));
    };
    const 烕壍 = 潝壍.window.days;
    const 迄壍 = 潝壍.op === "change_pct_gt" || 潝壍.op === "change_pct_lt";
    const 岳壍 = firstDataIndex(蹌壍);
    if (稪壍 - 烕壍 + 1 < 岳壍)
        return null;
    if (潝壍.window.kind === "last_n_days") {
        const 箢壍 = 餙壍(稪壍 - 烕壍 + 1, 稪壍);
        if (箢壍 === null)
            return null;
        if (!迄壍)
            return 碲壍(潝壍.op, 箢壍, 潝壍.value) ? { observed: 箢壍, expected: 潝壍.value, recentStart: 稪壍 - 烕壍 + 1, end: 稪壍 } : null;
        if (稪壍 - 2 * 烕壍 + 1 < 岳壍)
            return null;
        const 骑壍 = 餙壍(稪壍 - 2 * 烕壍 + 1, 稪壍 - 烕壍);
        if (骑壍 === null || 骑壍 === 0)
            return null;
        return 碲壍(潝壍.op, 箢壍 / 骑壍 - 1, 潝壍.value) ? { observed: 箢壍, expected: 骑壍, recentStart: 稪壍 - 烕壍 + 1, end: 稪壍, baselineStart: 稪壍 - 2 * 烕壍 + 1, baselineEnd: 稪壍 - 烕壍 } : null;
    }
    const 枀壍 = 稪壍 - 烕壍;
    const 虯壍 = Math.max(岳壍, 枀壍 - 13);
    const 卞壍 = 迄壍 ? 餙壍(虯壍, 枀壍) : null;
    if (迄壍 && (卞壍 === null || 卞壍 === 0))
        return null;
    for (let 牍壍 = 稪壍 - 烕壍 + 1; 牍壍 <= 稪壍; 牍壍++) {
        const 鄼壍 = 餙壍(牍壍, 牍壍);
        if (鄼壍 === null)
            return null;
        if (!碲壍(潝壍.op, 迄壍 ? 鄼壍 / (卞壍 as number) - 1 : 鄼壍, 潝壍.value))
            return null;
    }
    const 師壍 = 餙壍(稪壍 - 烕壍 + 1, 稪壍);
    if (師壍 === null)
        return null;
    return 迄壍 ? { observed: 師壍, expected: 卞壍 as number, recentStart: 稪壍 - 烕壍 + 1, end: 稪壍, baselineStart: 虯壍, baselineEnd: 枀壍 } : { observed: 師壍, expected: 潝壍.value, recentStart: 稪壍 - 烕壍 + 1, end: 稪壍 };
}
export function ruleEntities(級壍: ThresholdRule, 鰉壍: readonly EntitySeries[], 棸壍: EntitySeries): EntitySeries[] {
    if (級壍.scope.level === "account")
        return [棸壍];
    return 鰉壍.filter((蟧壍) => {
        if (級壍.scope.campaignIds?.length && !級壍.scope.campaignIds.includes(蟧壍.id))
            return false;
        if (級壍.scope.campaignTypes?.length && !級壍.scope.campaignTypes.includes(蟧壍.campaign?.type ?? "Other"))
            return false;
        return true;
    });
}
export function detectThreshold(哖壍: DetectorContext, 珅壍: readonly EntitySeries[], 銴壍: EntitySeries, 徣壍: Signal[], 纒壍: string[]): void {
    const 鶁壍 = 哖壍.registry;
    const 橰壍 = 哖壍.settings.thresholdRules.filter((襟壍) => 襟壍.enabled);
    if (!橰壍.length)
        return;
    if (!鶁壍) {
        纒壍.push("Threshold rules need the metric registry; skipped.");
        return;
    }
    for (const 噎壍 of 橰壍) {
        const 甽壍 = 鶁壍.get(噎壍.metric);
        if (!甽壍 || !鶁壍.availableIn(噎壍.metric).includes("campaign_daily")) {
            纒壍.push(`Rule “${噎壍.name}” uses ${噎壍.metric}, which is not available from daily campaign data; skipped.`);
            continue;
        }
        const 鐬壍 = 噎壍.op === "change_pct_gt" || 噎壍.op === "change_pct_lt";
        for (const 愛壍 of ruleEntities(噎壍, 珅壍, 銴壍)) {
            const 耊壍 = evaluateRule(噎壍, 愛壍, 鶁壍);
            if (!耊壍)
                continue;
            const 黹壍 = (毨壍: number) => fmt(甽壍.format, 毨壍, 哖壍.currency);
            const 諗壍 = 蹣壍(耊壍.observed, 耊壍.expected);
            const 埆壍 = 鐬壍 ? 噎壍.op === "change_pct_gt" : 噎壍.op === "gt" || 噎壍.op === "gte";
            const 皵壍 = 噎壍.window.kind === "last_n_days" ? `over the last ${plural(噎壍.window.days, "day")}` : `on each of the last ${plural(噎壍.window.days, "day")}`;
            const 閤壍 = 鐬壍 ? `${姃壍[噎壍.op]} ${Math.abs(噎壍.value * 100).toFixed(0)}% vs the previous period` : `${姃壍[噎壍.op]} ${黹壍(噎壍.value)}`;
            const 抓壍 = 偮壍[噎壍.metric];
            徣壍.push(makeSignal(哖壍, {
                entity: 愛壍 === 銴壍 ? { id: 哖壍.accountId, name: 哖壍.accountName } : 烬壍(愛壍),
                scope: 愛壍 === 銴壍 ? "account" : "campaign",
                kind: "threshold",
                detector: "threshold",
                ruleId: 噎壍.id,
                metric: 噎壍.metric,
                direction: 埆壍 ? "up" : "down",
                polarity: "bad",
                severity: 噎壍.severity,
                strength: 2.5 * (1 + Math.min(3, Math.abs(鐬壍 ? 諗壍 : 蹣壍(耊壍.observed, 噎壍.value)))),
                observed: 耊壍.observed,
                expected: 耊壍.expected,
                changePct: 諗壍,
                window: {
                    recentStart: dateAt(愛壍, 耊壍.recentStart),
                    recentEnd: dateAt(愛壍, 耊壍.end),
                    baselineStart: 耊壍.baselineStart !== undefined ? dateAt(愛壍, 耊壍.baselineStart) : undefined,
                    baselineEnd: 耊壍.baselineEnd !== undefined ? dateAt(愛壍, 耊壍.baselineEnd) : undefined,
                },
                onsetDate: dateAt(愛壍, 耊壍.recentStart),
                series: displaySeries(愛壍, (膂壍) => 鶁壍.computeValue(噎壍.metric, 淥壍(膂壍))),
                title: 噎壍.name,
                summary: `${甽壍.short} was ${黹壍(耊壍.observed)} ${皵壍} — rule: ${閤壍}.`,
                recommendation: 抓壍 && 抓壍 !== "spend" ? metricRecommendation(抓壍, true) : 抓壍 === "spend" ? RECOMMENDATIONS.spend : `Threshold rule “${噎壍.name}” fired. Review recent changes for this campaign and adjust budgets or targets.`,
                evidence: [
                    { label: "Observed", value: 黹壍(耊壍.observed) },
                    { label: "Expected", value: 鐬壍 ? 黹壍(耊壍.expected) : `${姃壍[噎壍.op]} ${黹壍(噎壍.value)}` },
                    { label: "Rule", value: `${甽壍.short} ${閤壍}` },
                    { label: "Window", value: `${峊壍(愛壍, 耊壍.recentStart, 耊壍.end)}` },
                ],
                format: 甽壍.format,
            }));
        }
    }
}
function 乱壍(浠壍: PacingRow, 豏壍: ReadonlyMap<string, EntitySeries>, 夾壍: CivilDate[]): EntitySeries {
    const 砭壍 = 浠壍.campaignIds.map((霜壍) => 豏壍.get(霜壍)).filter((搋壍): 搋壍 is EntitySeries => !!搋壍);
    if (砭壍.length === 1 && 砭壍[0])
        return 砭壍[0];
    return { ...combineSeries(浠壍.unitId, 浠壍.name, 砭壍, 夾壍), type: 浠壍.type };
}
export function detectPacing(苺壍: DetectorContext, 俩壍: PacingReport | null | undefined, 滘壍: ReadonlyMap<string, EntitySeries>, 跇壍: CivilDate[], 媶壍: ReadonlySet<string>, 禥壍: Signal[]): void {
    const 颔壍 = 苺壍.settings.pacing;
    if (!颔壍.enabled || !俩壍)
        return;
    const 斃壍 = (葲壍: number) => fmt("money", 葲壍, 苺壍.currency);
    const 兡壍 = 颔壍.dailyOver ?? DEFAULT_DAILY_OVER;
    const 灐壍 = 颔壍.dailyOverCritical ?? DEFAULT_DAILY_OVER_CRITICAL;
    const 輿壍 = 苺壍.settings.zscore.recentDays;
    for (const 尮壍 of 俩壍.rows) {
        if (尮壍.paused || !尮壍.campaignIds.some((笝壍) => 媶壍.has(笝壍)))
            continue;
        if (尮壍.status === "no_budget" || 尮壍.status === "unsupported_period")
            continue;
        const 騌壍 = 乱壍(尮壍, 滘壍, 跇壍);
        const 曻壍 = 騌壍.days.length - 1;
        const 藪壍 = { id: 尮壍.unitId, name: 尮壍.name, type: 尮壍.type };
        const 務壍 = displaySeries(騌壍, (燈壍) => 燈壍.cost);
        if (俩壍.remainingDays > 0 && 尮壍.monthlyTarget > 0 && 尮壍.paceRatio > 颔壍.over) {
            const 邷壍: Severity = 尮壍.paceRatio > 颔壍.overCritical ? "critical" : "warning";
            const 嶦壍 = 尮壍.monthlyTarget / 俩壍.daysInMonth;
            禥壍.push(makeSignal(苺壍, {
                entity: 藪壍,
                kind: "pacing",
                detector: "pacing",
                metric: "spend",
                direction: "up",
                polarity: "bad",
                severity: 邷壍,
                strength: 2.5 + 10 * (尮壍.paceRatio - 1),
                observed: 尮壍.projected,
                expected: 尮壍.monthlyTarget,
                changePct: 尮壍.paceRatio - 1,
                band: { lo: 嶦壍 * 0.9, hi: 嶦壍 * 1.1 },
                window: { recentStart: `${俩壍.month}-01`, recentEnd: 苺壍.dataThrough },
                series: 務壍,
                title: pacingTitle(尮壍.paceRatio),
                summary: `Month-to-date spend is ${斃壍(尮壍.mtdSpend)} after ${俩壍.elapsedDays} of ${俩壍.daysInMonth} days; at about ${斃壍(尮壍.expectedDaily)}/day the month ends near ${斃壍(尮壍.projected)} (${(尮壍.paceRatio * 100).toFixed(0)}% of the ${斃壍(尮壍.monthlyTarget)} budget).`,
                recommendation: pacingRecommendation(斃壍(尮壍.projected), 斃壍(尮壍.monthlyTarget), 斃壍(尮壍.recommendedDaily ?? 0), 俩壍.remainingDays),
                evidence: [
                    { label: "Observed", value: 斃壍(尮壍.projected) },
                    { label: "Expected", value: 斃壍(尮壍.monthlyTarget) },
                    { label: "Projected EOM", value: `${(尮壍.paceRatio * 100).toFixed(0)}% of budget` },
                    { label: "Spent to date", value: 斃壍(尮壍.mtdSpend) },
                    { label: "Days left", value: String(俩壍.remainingDays) },
                ],
                format: "money",
            }));
        }
        const 粕壍 = 尮壍.dailyBudget;
        if (!粕壍 || 粕壍 <= 0 || 曻壍 - 輿壍 + 1 < firstDataIndex(騌壍))
            continue;
        const 鮄壍 = sumWindow(騌壍, 曻壍 - 輿壍 + 1, 曻壍);
        if (鮄壍.n === 0)
            continue;
        const 桳壍 = 鮄壍.cost / 鮄壍.n;
        const 蝢壍 = 桳壍 / 粕壍;
        if (蝢壍 < 兡壍)
            continue;
        const 呑壍 = Math.max(曻壍 - 6, firstDataIndex(騌壍));
        let 獀壍 = 0;
        let 鈯壍 = 0;
        for (let 弞壍 = 呑壍; 弞壍 <= 曻壍; 弞壍++) {
            const 縍壍 = 騌壍.days[弞壍]?.cost ?? 0;
            獀壍 += 縍壍;
            if (縍壍 <= 0)
                鈯壍++;
        }
        const 鳼壍 = 獀壍 / (曻壍 - 呑壍 + 1);
        if (鈯壍 > 0 && 鳼壍 / 粕壍 < 兡壍)
            continue;
        let 槫壍 = 曻壍 - 輿壍 + 1;
        while (槫壍 - 1 >= firstDataIndex(騌壍) && 曻壍 - 槫壍 < 14 && (騌壍.days[槫壍 - 1]?.cost ?? 0) >= 粕壍 * 兡壍)
            槫壍--;
        let 裚壍 = 0;
        for (let 嗉壍 = Math.max(0, 曻壍 - 6); 嗉壍 <= 曻壍; 嗉壍++)
            if ((騌壍.days[嗉壍]?.cost ?? 0) > 粕壍)
                裚壍++;
        const 璸壍 = 粕壍 * MONTHLY_CAP_FACTOR;
        const 鎧壍 = 尮壍.mtdSpend + 桳壍 * 俩壍.remainingDays;
        const 悖壍 = 俩壍.remainingDays > 0 && 鎧壍 > 璸壍 ? ` At this rate the month would pass Google's ${斃壍(璸壍)} cap (30.4 × daily), so delivery would stop before month-end.` : "";
        禥壍.push(makeSignal(苺壍, {
            entity: 藪壍,
            kind: "overdelivery",
            detector: "pacing",
            metric: "spend",
            direction: "up",
            polarity: "bad",
            severity: 蝢壍 >= 灐壍 ? "critical" : "warning",
            strength: 2.5 + 10 * (蝢壍 - 1),
            observed: 桳壍,
            expected: 粕壍,
            changePct: 蝢壍 - 1,
            band: { lo: 0, hi: 粕壍 * 兡壍 },
            window: { recentStart: dateAt(騌壍, 曻壍 - 輿壍 + 1), recentEnd: dateAt(騌壍, 曻壍) },
            onsetDate: dateAt(騌壍, 槫壍),
            series: 務壍,
            title: `Overdelivering — ${(蝢壍 * 100).toFixed(0)}% of daily budget`,
            summary: `Spend averaged ${斃壍(桳壍)}/day over the last ${plural(輿壍, "day")} against a ${斃壍(粕壍)} daily budget (${(蝢壍 * 100).toFixed(0)}%), since ${formatShort(dateAt(騌壍, 槫壍))}.${悖壍}`,
            recommendation: `Google may spend up to ${DAILY_OVERDELIVERY_FACTOR}× the daily budget on a single day but caps the month at ${MONTHLY_CAP_FACTOR}× — sustained overdelivery like this usually follows a bid-strategy or budget change. Confirm it is intended, or lower the daily budget and tighten targets.`,
            evidence: [
                { label: "Observed", value: `${斃壍(桳壍)}/day` },
                { label: "Expected", value: `${斃壍(粕壍)}/day` },
                { label: "Run rate", value: `${(蝢壍 * 100).toFixed(0)}% of daily budget` },
                { label: "7-day calendar average", value: `${斃壍(鳼壍)}/day` },
                { label: "Days over budget", value: `${裚壍} of the last 7` },
            ],
            format: "money",
        }));
    }
}
export function detectTrackingBreak(羅壍: DetectorContext, 鹴壍: readonly EntitySeries[], 正壍: Signal[]): void {
    const 詒壍 = 羅壍.settings.trackingBreak;
    if (!詒壍.enabled)
        return;
    const 坁壍 = 羅壍.settings.zscore.recentDays;
    const 瘰壍 = 羅壍.settings.zscore.baselineDays;
    const 锟壍 = Math.min(2, 坁壍);
    for (const 戎壍 of 鹴壍) {
        const 能壍 = 戎壍.days.length - 1;
        const 鿬壍 = 能壍 - 坁壍 + 1;
        const 泛壍 = 鿬壍 - 1;
        const 诊壍 = 泛壍 - 瘰壍 + 1;
        if (诊壍 < firstDataIndex(戎壍))
            continue;
        let 墹壍 = 0;
        let 瞨壍 = -1;
        for (let 隗壍 = 鿬壍; 隗壍 <= 能壍; 隗壍++) {
            const 掆壍 = 戎壍.days[隗壍];
            if (掆壍 && 掆壍.conversions <= 0 && 掆壍.clicks >= 詒壍.minClicksPerDay) {
                墹壍++;
                if (瞨壍 < 0)
                    瞨壍 = 隗壍;
            }
        }
        if (墹壍 < 锟壍)
            continue;
        const 艵壍 = sumWindow(戎壍, 诊壍, 泛壍);
        const 佤壍 = 艵壍.n ? 艵壍.conversions / 艵壍.n : 0;
        if (佤壍 < 詒壍.minBaselineConvPerDay)
            continue;
        const 湓壍 = sumWindow(戎壍, 鿬壍, 能壍);
        const 赂壍 = 湓壍.n ? 湓壍.conversions / 湓壍.n : 0;
        const 娱壍 = 湓壍.n ? 湓壍.clicks / 湓壍.n : 0;
        const 礠壍 = std(dailyValues(戎壍, MONITORED.conversions, 诊壍, 泛壍)) || 莖壍;
        const 頏壍 = (擾壍: number) => fmt("decimal", 擾壍, 羅壍.currency);
        正壍.push(makeSignal(羅壍, {
            entity: 烬壍(戎壍),
            scope: 戎壍.id === 羅壍.accountId ? "account" : "campaign",
            kind: "tracking_break",
            detector: "tracking_break",
            metric: "conversions",
            direction: "down",
            polarity: "bad",
            severity: "critical",
            strength: 5 + 墹壍,
            observed: 赂壍,
            expected: 佤壍,
            z: (赂壍 - 佤壍) / 礠壍,
            band: { lo: Math.max(0, 佤壍 - 羅壍.settings.zscore.threshold * 礠壍), hi: 佤壍 + 羅壍.settings.zscore.threshold * 礠壍 },
            window: { recentStart: dateAt(戎壍, 鿬壍), recentEnd: dateAt(戎壍, 能壍), baselineStart: dateAt(戎壍, 诊壍), baselineEnd: dateAt(戎壍, 泛壍) },
            onsetDate: dateAt(戎壍, 瞨壍),
            series: displaySeries(戎壍, (菭壍) => 菭壍.conversions),
            title: `Tracking break — 0 conversions on ${墹壍} of ${坁壍} days`,
            summary: `Clicks kept coming (${Math.round(娱壍).toLocaleString("en-US")}/day) but conversions were zero on ${墹壍} of the last ${plural(坁壍, "day")}, against a baseline of ${頏壍(佤壍)}/day.`,
            recommendation: RECOMMENDATIONS.trackingBreak,
            evidence: [
                { label: "Observed", value: `${頏壍(赂壍)}/day` },
                { label: "Expected", value: `${頏壍(佤壍)}/day` },
                { label: "Zero-conversion days", value: `${墹壍} of ${坁壍}` },
                { label: "Clicks/day", value: Math.round(娱壍).toLocaleString("en-US") },
            ],
            format: "decimal",
        }));
    }
}
export function detectZeroDelivery(僜壍: DetectorContext, 濋壍: readonly EntitySeries[], 躺壍: Signal[]): void {
    const 宩壍 = 僜壍.settings.zeroDelivery;
    if (!宩壍.enabled)
        return;
    const 窘壍 = 僜壍.settings.zscore.baselineDays;
    for (const 馇壍 of 濋壍) {
        const 晶壍 = 馇壍.days.length - 1;
        const 蕥壍 = 馇壍.days[晶壍];
        if (!蕥壍 || 蕥壍.impressions > 0)
            continue;
        let 剔壍 = 1;
        while (晶壍 - 剔壍 >= 0 && 馇壍.days[晶壍 - 剔壍] && (馇壍.days[晶壍 - 剔壍]?.impressions ?? 0) === 0 && 剔壍 < 14)
            剔壍++;
        const 煃壍 = 晶壍 - 剔壍;
        const 進壍 = 煃壍 - 窘壍 + 1;
        if (進壍 < firstDataIndex(馇壍))
            continue;
        const 崡壍 = sumWindow(馇壍, 進壍, 煃壍);
        const 簐壍 = 崡壍.n ? 崡壍.impressions / 崡壍.n : 0;
        if (簐壍 < 宩壍.minBaselineImpr)
            continue;
        const 髿壍 = 晶壍 - 剔壍 + 1;
        躺壍.push(makeSignal(僜壍, {
            entity: 烬壍(馇壍),
            kind: "zero_delivery",
            detector: "zero_delivery",
            metric: "impressions",
            direction: "down",
            polarity: "bad",
            severity: "critical",
            strength: 5 + 剔壍,
            observed: 0,
            expected: 簐壍,
            changePct: -1,
            band: { lo: 簐壍 * 0.5, hi: 簐壍 * 1.5 },
            window: { recentStart: dateAt(馇壍, 髿壍), recentEnd: dateAt(馇壍, 晶壍), baselineStart: dateAt(馇壍, 進壍), baselineEnd: dateAt(馇壍, 煃壍) },
            onsetDate: dateAt(馇壍, 髿壍),
            series: displaySeries(馇壍, (柮壍) => 柮壍.impressions),
            title: 剔壍 > 1 ? `Zero delivery — no impressions for ${剔壍} days` : `Zero delivery — no impressions on ${formatShort(dateAt(馇壍, 晶壍))}`,
            summary: `The campaign is enabled but served 0 impressions ${剔壍 > 1 ? `for ${剔壍} days since ${formatShort(dateAt(馇壍, 髿壍))}` : `on ${formatShort(dateAt(馇壍, 晶壍))}`}, after averaging ${Math.round(簐壍).toLocaleString("en-US")} a day over the previous ${窘壍} days.`,
            recommendation: RECOMMENDATIONS.zeroDelivery,
            evidence: [
                { label: "Observed", value: "0 impressions" },
                { label: "Expected", value: `${Math.round(簐壍).toLocaleString("en-US")}/day` },
                { label: "Days without delivery", value: String(剔壍) },
            ],
            format: "number",
        }));
    }
}
export function detectBudgetLimited(蛝壍: DetectorContext, 双壍: readonly EntitySeries[], 犻壍: readonly EntitySeries[], 醪壍: Signal[]): void {
    const 庙壍 = 蛝壍.settings.budgetLimited;
    if (!庙壍.enabled)
        return;
    const 綈壍 = 潴壍;
    let 鱷壍 = 0;
    let 楦壍 = 0;
    for (const 衕壍 of 犻壍) {
        const 啄壍 = 衕壍.days.length - 1;
        const 琳壍 = sumWindow(衕壍, 啄壍 - 綈壍 + 1, 啄壍);
        鱷壍 += 琳壍.cost;
        楦壍 += 琳壍.conv_value;
    }
    const 錢壍 = 鱷壍 > 0 ? 楦壍 / 鱷壍 : null;
    if (錢壍 === null)
        return;
    const 怑壍 = (缀壍: number) => fmt("money", 缀壍, 蛝壍.currency);
    for (const 鷯壍 of 双壍) {
        const 櫞壍 = 鷯壍.campaign?.type;
        if (櫞壍 !== "Search" && 櫞壍 !== "Shopping")
            continue;
        const 觍壍 = 鷯壍.days.length - 1;
        const 嚼壍 = 觍壍 - 綈壍 + 1;
        if (嚼壍 < firstDataIndex(鷯壍))
            continue;
        const 疫壍 = sumWindow(鷯壍, 嚼壍, 觍壍);
        if (疫壍.is_eligible <= 0 || 疫壍.cost <= 0)
            continue;
        if (疫壍.conversions / 綈壍 < 蛝壍.settings.minVolume.convPerDay)
            continue;
        const 钚壍 = 疫壍.is_lost_budget / 疫壍.is_eligible;
        const 憉壍 = 疫壍.conv_value / 疫壍.cost;
        if (钚壍 < 庙壍.minLostIsBudget || 憉壍 < 庙壍.roasVsAccount * 錢壍)
            continue;
        const 聸壍 = 疫壍.is_search_impr / 疫壍.is_eligible;
        const 齧壍 = Math.min(1, 聸壍 > 0 ? 钚壍 / 聸壍 : 1);
        const 汖壍 = 鷯壍.campaign?.budget_daily ?? null;
        const 譅壍 = 汖壍 ? Math.round((汖壍 * (1 + 齧壍)) / 5) * 5 : null;
        醪壍.push(makeSignal(蛝壍, {
            entity: 烬壍(鷯壍),
            kind: "budget_limited",
            detector: "budget_limited",
            metric: "lost_is_budget",
            direction: "up",
            polarity: "good",
            severity: "info",
            strength: 2.5 * (钚壍 / 庙壍.minLostIsBudget) + 憉壍 / 錢壍 / 10,
            observed: 钚壍,
            expected: 庙壍.minLostIsBudget,
            band: { lo: 0, hi: 庙壍.minLostIsBudget },
            window: { recentStart: dateAt(鷯壍, 嚼壍), recentEnd: dateAt(鷯壍, 觍壍) },
            series: displaySeries(鷯壍, (場壍) => (場壍.is_eligible > 0 ? 場壍.is_lost_budget / 場壍.is_eligible : null)),
            title: `Budget-limited — ${(钚壍 * 100).toFixed(0)}% of impressions lost`,
            summary: `Lost ${(钚壍 * 100).toFixed(1)}% of eligible impressions to budget over the last ${綈壍} days while ROAS was ${憉壍.toFixed(2)}x (account ${錢壍.toFixed(2)}x).`,
            recommendation: `Raise the daily budget by about ${(齧壍 * 100).toFixed(0)}%${譅壍 ? ` (to ${怑壍(譅壍)})` : ""} to capture the missed demand — the lost-budget share suggests that much extra volume at similar efficiency.`,
            evidence: [
                { label: "Observed", value: `${(钚壍 * 100).toFixed(1)}% lost (budget)` },
                { label: "Expected", value: `< ${(庙壍.minLostIsBudget * 100).toFixed(0)}%` },
                { label: "ROAS vs account", value: `${憉壍.toFixed(2)}x vs ${錢壍.toFixed(2)}x` },
                { label: "Suggested daily", value: 譅壍 ? 怑壍(譅壍) : "—" },
            ],
            format: "percent",
        }));
    }
}
