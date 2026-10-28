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
const EPS = 1e-9;
export const MAX_ONSET_LOOKBACK = 7;
const MIN_BASELINE_POINTS = 5;
export const DEFAULT_DAILY_OVER = 1.2;
export const DEFAULT_DAILY_OVER_CRITICAL = 1.5;
const BUDGET_LIMITED_DAYS = 7;
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
function relChange(observed: number, expected: number): number {
    if (expected === 0)
        return observed === 0 ? 0 : observed > 0 ? 1 : -1;
    const v = observed / expected - 1;
    return Number.isFinite(v) ? v : 0;
}
export function makeSignal(ctx: DetectorContext, d: Draft): Signal {
    const changePct = d.changePct ?? relChange(d.observed, d.expected);
    return {
        id: signalId(d.entity.id, d.kind, d.detector, d.window.recentEnd, d.metric, d.ruleId),
        accountId: ctx.accountId,
        mode: ctx.mode,
        scope: d.scope ?? "campaign",
        entity: d.entity,
        kind: d.kind,
        detectors: [d.detector],
        ruleId: d.ruleId,
        metric: d.metric,
        direction: d.direction,
        polarity: d.polarity,
        severity: d.severity,
        score: round(Math.max(0, d.strength) * SEVERITY_WEIGHT[d.severity], 3),
        observed: d.observed,
        expected: d.expected,
        changePct,
        z: d.z,
        band: d.band,
        window: d.window,
        onsetDate: d.onsetDate,
        series: d.series,
        title: d.title,
        summary: d.summary,
        recommendation: d.recommendation,
        evidence: d.evidence,
        relatedChanges: [],
        ...(d.cpaDrivers ? { cpaDrivers: d.cpaDrivers } : {}),
        format: d.format,
        dataAsOf: ctx.dataThrough,
        detectedAt: ctx.now,
    };
}
const entityOf = (s: EntitySeries): Signal["entity"] => ({ id: s.id, name: s.name, type: s.type });
function range(s: EntitySeries, value: number, to: number): string {
    return `${formatShort(dateAt(s, value))} – ${formatShort(dateAt(s, to))}`;
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
export function zDeviation(s: EntitySeries, def: MonitoredDef, recentDays: number, baselineDays: number, thr: number, end = s.days.length - 1): Deviation | null {
    const rStart = end - recentDays + 1;
    const first = firstDataIndex(s);
    if (rStart <= first)
        return null;
    const observed = def.window(sumWindow(s, rStart, end));
    if (observed === null)
        return null;
    let extra = 0;
    while (extra < MAX_ONSET_LOOKBACK) {
        const cand = rStart - extra - 1;
        const bEnd = cand - 1;
        const bStart = bEnd - baselineDays + 1;
        if (bStart < first)
            break;
        const vals2 = dailyValues(s, def, bStart, bEnd);
        const m = def.window(sumWindow(s, bStart, bEnd));
        const day = s.days[cand];
        const v = day ? def.daily(day) : null;
        if (vals2.length < MIN_BASELINE_POINTS || m === null || v === null)
            break;
        const sd2 = std(vals2) || EPS;
        const dir = Math.sign(observed - m);
        if (dir !== 0 && ((v - m) / sd2) * dir >= thr)
            extra++;
        else
            break;
    }
    const baselineEnd = rStart - extra - 1;
    const baselineStart = Math.max(first, baselineEnd - baselineDays + 1);
    const vals = dailyValues(s, def, baselineStart, baselineEnd);
    if (vals.length < MIN_BASELINE_POINTS)
        return null;
    const expected = def.window(sumWindow(s, baselineStart, baselineEnd));
    if (expected === null)
        return null;
    const sd = std(vals) || EPS;
    const z = (observed - expected) / sd;
    let onsetIndex = rStart - extra;
    if (extra === 0) {
        const dir = Math.sign(z);
        for (let i = rStart; i <= end; i++) {
            const d = s.days[i];
            const v = d ? def.daily(d) : null;
            if (v !== null && ((v - expected) / sd) * dir >= thr) {
                onsetIndex = i;
                break;
            }
        }
    }
    return { observed, expected, sd, z, recentStart: rStart, end, baselineStart, baselineEnd, onsetIndex };
}
export function robustDeviation(s: EntitySeries, def: MonitoredDef, recentDays: number, baselineDays: number, end = s.days.length - 1): Deviation | null {
    const rStart = end - recentDays + 1;
    const baselineEnd = rStart - 1;
    const baselineStart = Math.max(firstDataIndex(s), baselineEnd - baselineDays + 1);
    const vals = dailyValues(s, def, baselineStart, baselineEnd);
    const observed = def.window(sumWindow(s, rStart, end));
    if (vals.length < MIN_BASELINE_POINTS || observed === null)
        return null;
    const expected = median(vals);
    const sd = mad(vals) || EPS;
    return { observed, expected, sd, z: (observed - expected) / sd, recentStart: rStart, end, baselineStart, baselineEnd, onsetIndex: rStart };
}
export function seasonalDeviation(s: EntitySeries, def: MonitoredDef, weeks: number, end = s.days.length - 1): Deviation | null {
    const first = firstDataIndex(s);
    const idx: number[] = [];
    for (let k = 1; k <= weeks; k++)
        if (end - 7 * k >= first)
            idx.push(end - 7 * k);
    if (idx.length < 2)
        return null;
    const day = s.days[end];
    const observed = day ? def.daily(day) : null;
    if (observed === null)
        return null;
    const w: WindowSum = { ...emptyDay(), n: 0 };
    const vals: number[] = [];
    for (const i of idx) {
        const d = s.days[i];
        if (!d)
            continue;
        const v = def.daily(d);
        if (v !== null)
            vals.push(v);
        w.cost += d.cost;
        w.clicks += d.clicks;
        w.impressions += d.impressions;
        w.conversions += d.conversions;
        w.conv_value += d.conv_value;
        w.n++;
    }
    const expected = def.window(w);
    if (expected === null || vals.length < 2)
        return null;
    const sd = std(vals) || EPS;
    return { observed, expected, sd, z: (observed - expected) / sd, recentStart: end, end, baselineStart: idx[idx.length - 1] as number, baselineEnd: idx[0] as number, onsetIndex: end };
}
function volumeOk(s: EntitySeries, def: MonitoredDef, dev: Deviation, mv: AnomalySettings["minVolume"]): boolean {
    const b = sumWindow(s, dev.baselineStart, dev.baselineEnd);
    const n = b.n || 1;
    if (b.impressions / n < mv.imprPerDay)
        return false;
    if ((def.volume === "clicks" || def.volume === "conv") && b.clicks / n < mv.clicksPerDay)
        return false;
    if (def.volume === "conv" && b.conversions / n < mv.convPerDay)
        return false;
    return true;
}
const CONVERSION_METRICS: ReadonlySet<MonitoredMetric> = new Set(["conversions", "cpa", "cvr", "roas"]);
function cpaDrivers(s: EntitySeries, dev: Deviation): {
    cpc: number;
    cvr: number;
} | null {
    const sum = (a: number, b2: number) => {
        const t = { cost: 0, clicks: 0, conv: 0 };
        for (let i = Math.max(0, a); i <= b2; i++) {
            const d = s.days[i];
            if (!d)
                continue;
            t.cost += d.cost;
            t.clicks += d.clicks;
            t.conv += d.conversions;
        }
        return t;
    };
    const r = sum(dev.recentStart, dev.end);
    const b = sum(dev.baselineStart, dev.baselineEnd);
    if (!r.clicks || !b.clicks || !r.conv || !b.conv || !r.cost || !b.cost)
        return null;
    return { cpc: r.cost / r.clicks / (b.cost / b.clicks) - 1, cvr: r.conv / r.clicks / (b.conv / b.clicks) - 1 };
}
function deviationSignal(ctx: DetectorContext, s: EntitySeries, def: MonitoredDef, detector: "zscore" | "robust" | "seasonal", dev: Deviation, thr: number, severity: Severity, note: string): Signal {
    const bad = severity !== "info";
    const up = dev.z > 0;
    const changePct = relChange(dev.observed, dev.expected);
    const f = (v: number) => fmt(def.format, v, ctx.currency);
    const additive = def.key === "spend" || def.key === "conversions";
    const recentDays = dev.end - dev.recentStart + 1;
    const baseDays = dev.baselineEnd - dev.baselineStart + 1;
    const onset = dateAt(s, dev.onsetIndex);
    const zLabel = detector === "robust" ? "Robust z" : "z-score";
    const drivers = def.key === "cpa" && detector !== "seasonal" ? cpaDrivers(s, dev) : null;
    let summary: string;
    if (detector === "seasonal") {
        summary = `${def.label} was ${f(dev.observed)} on ${formatShort(dateAt(s, dev.end))} vs ${f(dev.expected)} on the same weekday over the previous ${plural(Math.round((dev.baselineEnd - dev.baselineStart) / 7) + 1, "week")} (z ${dev.z.toFixed(1)}).`;
    }
    else {
        const verb = additive ? "averaged" : "was";
        const unit = additive ? "/day" : "";
        const method = detector === "robust" ? "median of the" : "the";
        summary = `${def.label} ${verb} ${f(dev.observed)}${unit} over the last ${plural(recentDays, "day")} vs ${f(dev.expected)}${unit} expected from ${method} ${baseDays}-day baseline (${detector === "robust" ? "robust " : ""}z ${dev.z.toFixed(1)}).`;
        if (dev.onsetIndex < dev.recentStart)
            summary += ` The shift started ${formatShort(onset)}.`;
    }
    summary += note;
    return makeSignal(ctx, {
        entity: entityOf(s),
        kind: "metric_deviation",
        detector,
        metric: def.key,
        direction: up ? "up" : "down",
        polarity: bad ? "bad" : "good",
        severity,
        strength: Math.abs(dev.z),
        observed: dev.observed,
        expected: dev.expected,
        changePct,
        z: dev.z,
        band: { lo: Math.max(0, dev.expected - thr * dev.sd), hi: dev.expected + thr * dev.sd },
        window: { recentStart: dateAt(s, dev.recentStart), recentEnd: dateAt(s, dev.end), baselineStart: dateAt(s, dev.baselineStart), baselineEnd: dateAt(s, dev.baselineEnd) },
        onsetDate: onset,
        series: displaySeries(s, def.display),
        title: deviationTitle(def.label, changePct),
        summary,
        recommendation: drivers && bad && cpaDrivenByCvr(drivers) ? RECOMMENDATIONS.cpaFromCvr : metricRecommendation(def.key, bad),
        evidence: [
            { label: "Observed", value: f(dev.observed) },
            { label: "Expected", value: f(dev.expected) },
            { label: zLabel, value: dev.z.toFixed(1) },
            { label: "Change", value: signedPct(changePct, 1) },
            ...(drivers ? [{ label: "CPC", value: signedPct(drivers.cpc, 0) }, { label: "Conv. rate", value: signedPct(drivers.cvr, 0) }] : []),
            { label: "Baseline", value: `${range(s, dev.baselineStart, dev.baselineEnd)} (${plural(detector === "seasonal" ? Math.round((dev.baselineEnd - dev.baselineStart) / 7) + 1 : baseDays, detector === "seasonal" ? "week" : "day")})` },
        ],
        ...(drivers ? { cpaDrivers: drivers } : {}),
        format: def.format,
    });
}
type DeviationFn = (s: EntitySeries, def: MonitoredDef, end?: number) => Deviation | null;
function detectDeviations(ctx: DetectorContext, series: readonly EntitySeries[], detector: "zscore" | "robust" | "seasonal", thr: number, compute: DeviationFn, out: Signal[]): void {
    const metrics = MONITORED_METRICS.filter((m) => ctx.settings.zscore.metrics[m]);
    for (const s of series) {
        const spendDev = compute(s, MONITORED.spend);
        for (const metric of metrics) {
            const def = MONITORED[metric];
            const dev = metric === "spend" ? spendDev : compute(s, def);
            if (!dev || !volumeOk(s, def, dev, ctx.settings.minVolume))
                continue;
            if (Math.abs(dev.z) < thr)
                continue;
            const up = dev.z > 0;
            const bad = def.badUp ? up : !up;
            if (!bad && metric === "spend")
                continue;
            if (!bad && metric === "conversions" && spendDev && spendDev.z >= thr)
                continue;
            let severity: Severity = !bad ? "info" : Math.abs(dev.z) >= thr * 1.8 ? "critical" : "warning";
            let note = "";
            if (bad && ctx.conversionLag && CONVERSION_METRICS.has(metric) && dev.end - dev.recentStart >= 1) {
                const lagFree = compute(s, def, dev.end - 1);
                if (!lagFree || Math.abs(lagFree.z) < thr || Math.sign(lagFree.z) !== Math.sign(dev.z)) {
                    if (severity === "warning")
                        continue;
                    severity = "warning";
                    note = " Severity is reduced because conversions for the most recent day may still be arriving.";
                }
            }
            out.push(deviationSignal(ctx, s, def, detector, dev, thr, severity, note));
        }
    }
}
export function detectZscore(ctx: DetectorContext, series: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.zscore;
    if (!cfg.enabled)
        return;
    detectDeviations(ctx, series, "zscore", cfg.threshold, (s, def, end) => zDeviation(s, def, cfg.recentDays, cfg.baselineDays, cfg.threshold, end), out);
}
export function detectRobust(ctx: DetectorContext, series: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.robust;
    if (!cfg.enabled)
        return;
    const recent = ctx.settings.zscore.recentDays;
    detectDeviations(ctx, series, "robust", cfg.threshold, (s, def, end) => robustDeviation(s, def, recent, cfg.baselineDays, end), out);
}
export function detectSeasonal(ctx: DetectorContext, series: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.seasonal;
    if (!cfg.enabled)
        return;
    detectDeviations(ctx, series, "seasonal", cfg.threshold, (s, def, end) => seasonalDeviation(s, def, cfg.weeks, end), out);
}
function aggregates(w: DayTotals): Aggregates {
    return {
        cost: w.cost,
        clicks: w.clicks,
        impressions: w.impressions,
        conversions: w.conversions,
        conv_value: w.conv_value,
        is_search_impr: w.is_search_impr,
        is_eligible: w.is_eligible,
        is_lost_budget: w.is_lost_budget,
        is_lost_rank: w.is_lost_rank,
    };
}
const OP_TEXT: Record<ThresholdRule["op"], string> = { gt: "above", gte: "at or above", lt: "below", lte: "at or below", change_pct_gt: "up more than", change_pct_lt: "down more than" };
function compare(op: ThresholdRule["op"], v: number, threshold: number): boolean {
    switch (op) {
        case "gt":
        case "change_pct_gt":
            return v > threshold;
        case "gte":
            return v >= threshold;
        case "lt":
        case "change_pct_lt":
            return v < threshold;
        case "lte":
            return v <= threshold;
    }
}
const REC_BY_METRIC: Record<string, MonitoredMetric> = { cost: "spend", conversions: "conversions", cpa: "cpa", ctr: "ctr", cpc: "cpc", cvr: "cvr", roas: "roas" };
export interface RuleHit {
    observed: number;
    expected: number;
    recentStart: number;
    end: number;
    baselineStart?: number;
    baselineEnd?: number;
}
export function evaluateRule(rule: ThresholdRule, s: EntitySeries, registry: MetricRegistry, end = s.days.length - 1): RuleHit | null {
    const value = (value2: number, to: number): number | null => {
        const w = sumWindow(s, value2, to);
        if (w.n === 0)
            return null;
        return registry.computeValue(rule.metric, aggregates(w));
    };
    const n = rule.window.days;
    const change = rule.op === "change_pct_gt" || rule.op === "change_pct_lt";
    const first = firstDataIndex(s);
    if (end - n + 1 < first)
        return null;
    if (rule.window.kind === "last_n_days") {
        const cur2 = value(end - n + 1, end);
        if (cur2 === null)
            return null;
        if (!change)
            return compare(rule.op, cur2, rule.value) ? { observed: cur2, expected: rule.value, recentStart: end - n + 1, end } : null;
        if (end - 2 * n + 1 < first)
            return null;
        const prev = value(end - 2 * n + 1, end - n);
        if (prev === null || prev === 0)
            return null;
        return compare(rule.op, cur2 / prev - 1, rule.value) ? { observed: cur2, expected: prev, recentStart: end - n + 1, end, baselineStart: end - 2 * n + 1, baselineEnd: end - n } : null;
    }
    const bEnd = end - n;
    const bStart = Math.max(first, bEnd - 13);
    const base = change ? value(bStart, bEnd) : null;
    if (change && (base === null || base === 0))
        return null;
    for (let i = end - n + 1; i <= end; i++) {
        const v = value(i, i);
        if (v === null)
            return null;
        if (!compare(rule.op, change ? v / (base as number) - 1 : v, rule.value))
            return null;
    }
    const cur = value(end - n + 1, end);
    if (cur === null)
        return null;
    return change ? { observed: cur, expected: base as number, recentStart: end - n + 1, end, baselineStart: bStart, baselineEnd: bEnd } : { observed: cur, expected: rule.value, recentStart: end - n + 1, end };
}
export function ruleEntities(rule: ThresholdRule, campaigns: readonly EntitySeries[], account: EntitySeries): EntitySeries[] {
    if (rule.scope.level === "account")
        return [account];
    return campaigns.filter((s) => {
        if (rule.scope.campaignIds?.length && !rule.scope.campaignIds.includes(s.id))
            return false;
        if (rule.scope.campaignTypes?.length && !rule.scope.campaignTypes.includes(s.campaign?.type ?? "Other"))
            return false;
        return true;
    });
}
export function detectThreshold(ctx: DetectorContext, campaigns: readonly EntitySeries[], account: EntitySeries, out: Signal[], warnings: string[]): void {
    const registry = ctx.registry;
    const rules = ctx.settings.thresholdRules.filter((r) => r.enabled);
    if (!rules.length)
        return;
    if (!registry) {
        warnings.push("Threshold rules need the metric registry; skipped.");
        return;
    }
    for (const rule of rules) {
        const def = registry.get(rule.metric);
        if (!def || !registry.availableIn(rule.metric).includes("campaign_daily")) {
            warnings.push(`Rule “${rule.name}” uses ${rule.metric}, which is not available from daily campaign data; skipped.`);
            continue;
        }
        const change = rule.op === "change_pct_gt" || rule.op === "change_pct_lt";
        for (const s of ruleEntities(rule, campaigns, account)) {
            const hit = evaluateRule(rule, s, registry);
            if (!hit)
                continue;
            const f = (v: number) => fmt(def.format, v, ctx.currency);
            const changePct = relChange(hit.observed, hit.expected);
            const up = change ? rule.op === "change_pct_gt" : rule.op === "gt" || rule.op === "gte";
            const windowText = rule.window.kind === "last_n_days" ? `over the last ${plural(rule.window.days, "day")}` : `on each of the last ${plural(rule.window.days, "day")}`;
            const condition = change ? `${OP_TEXT[rule.op]} ${Math.abs(rule.value * 100).toFixed(0)}% vs the previous period` : `${OP_TEXT[rule.op]} ${f(rule.value)}`;
            const monitored = REC_BY_METRIC[rule.metric];
            out.push(makeSignal(ctx, {
                entity: s === account ? { id: ctx.accountId, name: ctx.accountName } : entityOf(s),
                scope: s === account ? "account" : "campaign",
                kind: "threshold",
                detector: "threshold",
                ruleId: rule.id,
                metric: rule.metric,
                direction: up ? "up" : "down",
                polarity: "bad",
                severity: rule.severity,
                strength: 2.5 * (1 + Math.min(3, Math.abs(change ? changePct : relChange(hit.observed, rule.value)))),
                observed: hit.observed,
                expected: hit.expected,
                changePct,
                window: {
                    recentStart: dateAt(s, hit.recentStart),
                    recentEnd: dateAt(s, hit.end),
                    baselineStart: hit.baselineStart !== undefined ? dateAt(s, hit.baselineStart) : undefined,
                    baselineEnd: hit.baselineEnd !== undefined ? dateAt(s, hit.baselineEnd) : undefined,
                },
                onsetDate: dateAt(s, hit.recentStart),
                series: displaySeries(s, (d) => registry.computeValue(rule.metric, aggregates(d))),
                title: rule.name,
                summary: `${def.short} was ${f(hit.observed)} ${windowText} — rule: ${condition}.`,
                recommendation: monitored && monitored !== "spend" ? metricRecommendation(monitored, true) : monitored === "spend" ? RECOMMENDATIONS.spend : `Threshold rule “${rule.name}” fired. Review recent changes for this campaign and adjust budgets or targets.`,
                evidence: [
                    { label: "Observed", value: f(hit.observed) },
                    { label: "Expected", value: change ? f(hit.expected) : `${OP_TEXT[rule.op]} ${f(rule.value)}` },
                    { label: "Rule", value: `${def.short} ${condition}` },
                    { label: "Window", value: `${range(s, hit.recentStart, hit.end)}` },
                ],
                format: def.format,
            }));
        }
    }
}
function unitSeries(row: PacingRow, all: ReadonlyMap<string, EntitySeries>, dates: CivilDate[]): EntitySeries {
    const parts = row.campaignIds.map((id) => all.get(id)).filter((s): s is EntitySeries => !!s);
    if (parts.length === 1 && parts[0])
        return parts[0];
    return { ...combineSeries(row.unitId, row.name, parts, dates), type: row.type };
}
export function detectPacing(ctx: DetectorContext, report: PacingReport | null | undefined, all: ReadonlyMap<string, EntitySeries>, dates: CivilDate[], monitorable: ReadonlySet<string>, out: Signal[]): void {
    const cfg = ctx.settings.pacing;
    if (!cfg.enabled || !report)
        return;
    const money = (v: number) => fmt("money", v, ctx.currency);
    const dailyOver = cfg.dailyOver ?? DEFAULT_DAILY_OVER;
    const dailyCrit = cfg.dailyOverCritical ?? DEFAULT_DAILY_OVER_CRITICAL;
    const recentDays = ctx.settings.zscore.recentDays;
    for (const row of report.rows) {
        if (row.paused || !row.campaignIds.some((id) => monitorable.has(id)))
            continue;
        if (row.status === "no_budget" || row.status === "unsupported_period")
            continue;
        const s = unitSeries(row, all, dates);
        const end = s.days.length - 1;
        const entity = { id: row.unitId, name: row.name, type: row.type };
        const spendSeries = displaySeries(s, (d) => d.cost);
        if (report.remainingDays > 0 && row.monthlyTarget > 0 && row.paceRatio > cfg.over) {
            const severity: Severity = row.paceRatio > cfg.overCritical ? "critical" : "warning";
            const perDay = row.monthlyTarget / report.daysInMonth;
            out.push(makeSignal(ctx, {
                entity,
                kind: "pacing",
                detector: "pacing",
                metric: "spend",
                direction: "up",
                polarity: "bad",
                severity,
                strength: 2.5 + 10 * (row.paceRatio - 1),
                observed: row.projected,
                expected: row.monthlyTarget,
                changePct: row.paceRatio - 1,
                band: { lo: perDay * 0.9, hi: perDay * 1.1 },
                window: { recentStart: `${report.month}-01`, recentEnd: ctx.dataThrough },
                series: spendSeries,
                title: pacingTitle(row.paceRatio),
                summary: `Month-to-date spend is ${money(row.mtdSpend)} after ${report.elapsedDays} of ${report.daysInMonth} days; at about ${money(row.expectedDaily)}/day the month ends near ${money(row.projected)} (${(row.paceRatio * 100).toFixed(0)}% of the ${money(row.monthlyTarget)} budget).`,
                recommendation: pacingRecommendation(money(row.projected), money(row.monthlyTarget), money(row.recommendedDaily ?? 0), report.remainingDays),
                evidence: [
                    { label: "Observed", value: money(row.projected) },
                    { label: "Expected", value: money(row.monthlyTarget) },
                    { label: "Projected EOM", value: `${(row.paceRatio * 100).toFixed(0)}% of budget` },
                    { label: "Spent to date", value: money(row.mtdSpend) },
                    { label: "Days left", value: String(report.remainingDays) },
                ],
                format: "money",
            }));
        }
        const daily = row.dailyBudget;
        if (!daily || daily <= 0 || end - recentDays + 1 < firstDataIndex(s))
            continue;
        const w = sumWindow(s, end - recentDays + 1, end);
        if (w.n === 0)
            continue;
        const runRate = w.cost / w.n;
        const ratio = runRate / daily;
        if (ratio < dailyOver)
            continue;
        const weekFrom = Math.max(end - 6, firstDataIndex(s));
        let weekCost = 0;
        let idleDays = 0;
        for (let i = weekFrom; i <= end; i++) {
            const cost = s.days[i]?.cost ?? 0;
            weekCost += cost;
            if (cost <= 0)
                idleDays++;
        }
        const calendarRate = weekCost / (end - weekFrom + 1);
        if (idleDays > 0 && calendarRate / daily < dailyOver)
            continue;
        let onset = end - recentDays + 1;
        while (onset - 1 >= firstDataIndex(s) && end - onset < 14 && (s.days[onset - 1]?.cost ?? 0) >= daily * dailyOver)
            onset--;
        let overDays = 0;
        for (let i = Math.max(0, end - 6); i <= end; i++)
            if ((s.days[i]?.cost ?? 0) > daily)
                overDays++;
        const monthCap = daily * MONTHLY_CAP_FACTOR;
        const runRateMonth = row.mtdSpend + runRate * report.remainingDays;
        const capNote = report.remainingDays > 0 && runRateMonth > monthCap ? ` At this rate the month would pass Google's ${money(monthCap)} cap (30.4 × daily), so delivery would stop before month-end.` : "";
        out.push(makeSignal(ctx, {
            entity,
            kind: "overdelivery",
            detector: "pacing",
            metric: "spend",
            direction: "up",
            polarity: "bad",
            severity: ratio >= dailyCrit ? "critical" : "warning",
            strength: 2.5 + 10 * (ratio - 1),
            observed: runRate,
            expected: daily,
            changePct: ratio - 1,
            band: { lo: 0, hi: daily * dailyOver },
            window: { recentStart: dateAt(s, end - recentDays + 1), recentEnd: dateAt(s, end) },
            onsetDate: dateAt(s, onset),
            series: spendSeries,
            title: `Overdelivering — ${(ratio * 100).toFixed(0)}% of daily budget`,
            summary: `Spend averaged ${money(runRate)}/day over the last ${plural(recentDays, "day")} against a ${money(daily)} daily budget (${(ratio * 100).toFixed(0)}%), since ${formatShort(dateAt(s, onset))}.${capNote}`,
            recommendation: `Google may spend up to ${DAILY_OVERDELIVERY_FACTOR}× the daily budget on a single day but caps the month at ${MONTHLY_CAP_FACTOR}× — sustained overdelivery like this usually follows a bid-strategy or budget change. Confirm it is intended, or lower the daily budget and tighten targets.`,
            evidence: [
                { label: "Observed", value: `${money(runRate)}/day` },
                { label: "Expected", value: `${money(daily)}/day` },
                { label: "Run rate", value: `${(ratio * 100).toFixed(0)}% of daily budget` },
                { label: "7-day calendar average", value: `${money(calendarRate)}/day` },
                { label: "Days over budget", value: `${overDays} of the last 7` },
            ],
            format: "money",
        }));
    }
}
export function detectTrackingBreak(ctx: DetectorContext, series: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.trackingBreak;
    if (!cfg.enabled)
        return;
    const recentDays = ctx.settings.zscore.recentDays;
    const baselineDays = ctx.settings.zscore.baselineDays;
    const need = Math.min(2, recentDays);
    for (const s of series) {
        const end = s.days.length - 1;
        const rStart = end - recentDays + 1;
        const bEnd = rStart - 1;
        const bStart = bEnd - baselineDays + 1;
        if (bStart < firstDataIndex(s))
            continue;
        let zeroDays = 0;
        let onset = -1;
        for (let i = rStart; i <= end; i++) {
            const d = s.days[i];
            if (d && d.conversions <= 0 && d.clicks >= cfg.minClicksPerDay) {
                zeroDays++;
                if (onset < 0)
                    onset = i;
            }
        }
        if (zeroDays < need)
            continue;
        const base = sumWindow(s, bStart, bEnd);
        const baseConv = base.n ? base.conversions / base.n : 0;
        if (baseConv < cfg.minBaselineConvPerDay)
            continue;
        const recent = sumWindow(s, rStart, end);
        const observed = recent.n ? recent.conversions / recent.n : 0;
        const clicksPerDay = recent.n ? recent.clicks / recent.n : 0;
        const sd = std(dailyValues(s, MONITORED.conversions, bStart, bEnd)) || EPS;
        const f = (v: number) => fmt("decimal", v, ctx.currency);
        out.push(makeSignal(ctx, {
            entity: entityOf(s),
            scope: s.id === ctx.accountId ? "account" : "campaign",
            kind: "tracking_break",
            detector: "tracking_break",
            metric: "conversions",
            direction: "down",
            polarity: "bad",
            severity: "critical",
            strength: 5 + zeroDays,
            observed,
            expected: baseConv,
            z: (observed - baseConv) / sd,
            band: { lo: Math.max(0, baseConv - ctx.settings.zscore.threshold * sd), hi: baseConv + ctx.settings.zscore.threshold * sd },
            window: { recentStart: dateAt(s, rStart), recentEnd: dateAt(s, end), baselineStart: dateAt(s, bStart), baselineEnd: dateAt(s, bEnd) },
            onsetDate: dateAt(s, onset),
            series: displaySeries(s, (d) => d.conversions),
            title: `Tracking break — 0 conversions on ${zeroDays} of ${recentDays} days`,
            summary: `Clicks kept coming (${Math.round(clicksPerDay).toLocaleString("en-US")}/day) but conversions were zero on ${zeroDays} of the last ${plural(recentDays, "day")}, against a baseline of ${f(baseConv)}/day.`,
            recommendation: RECOMMENDATIONS.trackingBreak,
            evidence: [
                { label: "Observed", value: `${f(observed)}/day` },
                { label: "Expected", value: `${f(baseConv)}/day` },
                { label: "Zero-conversion days", value: `${zeroDays} of ${recentDays}` },
                { label: "Clicks/day", value: Math.round(clicksPerDay).toLocaleString("en-US") },
            ],
            format: "decimal",
        }));
    }
}
export function detectZeroDelivery(ctx: DetectorContext, series: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.zeroDelivery;
    if (!cfg.enabled)
        return;
    const baselineDays = ctx.settings.zscore.baselineDays;
    for (const s of series) {
        const end = s.days.length - 1;
        const last = s.days[end];
        if (!last || last.impressions > 0)
            continue;
        let zeroRun = 1;
        while (end - zeroRun >= 0 && s.days[end - zeroRun] && (s.days[end - zeroRun]?.impressions ?? 0) === 0 && zeroRun < 14)
            zeroRun++;
        const bEnd = end - zeroRun;
        const bStart = bEnd - baselineDays + 1;
        if (bStart < firstDataIndex(s))
            continue;
        const base = sumWindow(s, bStart, bEnd);
        const baseImpr = base.n ? base.impressions / base.n : 0;
        if (baseImpr < cfg.minBaselineImpr)
            continue;
        const onset = end - zeroRun + 1;
        out.push(makeSignal(ctx, {
            entity: entityOf(s),
            kind: "zero_delivery",
            detector: "zero_delivery",
            metric: "impressions",
            direction: "down",
            polarity: "bad",
            severity: "critical",
            strength: 5 + zeroRun,
            observed: 0,
            expected: baseImpr,
            changePct: -1,
            band: { lo: baseImpr * 0.5, hi: baseImpr * 1.5 },
            window: { recentStart: dateAt(s, onset), recentEnd: dateAt(s, end), baselineStart: dateAt(s, bStart), baselineEnd: dateAt(s, bEnd) },
            onsetDate: dateAt(s, onset),
            series: displaySeries(s, (d) => d.impressions),
            title: zeroRun > 1 ? `Zero delivery — no impressions for ${zeroRun} days` : `Zero delivery — no impressions on ${formatShort(dateAt(s, end))}`,
            summary: `The campaign is enabled but served 0 impressions ${zeroRun > 1 ? `for ${zeroRun} days since ${formatShort(dateAt(s, onset))}` : `on ${formatShort(dateAt(s, end))}`}, after averaging ${Math.round(baseImpr).toLocaleString("en-US")} a day over the previous ${baselineDays} days.`,
            recommendation: RECOMMENDATIONS.zeroDelivery,
            evidence: [
                { label: "Observed", value: "0 impressions" },
                { label: "Expected", value: `${Math.round(baseImpr).toLocaleString("en-US")}/day` },
                { label: "Days without delivery", value: String(zeroRun) },
            ],
            format: "number",
        }));
    }
}
export function detectBudgetLimited(ctx: DetectorContext, series: readonly EntitySeries[], accountParts: readonly EntitySeries[], out: Signal[]): void {
    const cfg = ctx.settings.budgetLimited;
    if (!cfg.enabled)
        return;
    const days = BUDGET_LIMITED_DAYS;
    let acctCost = 0;
    let acctValue = 0;
    for (const s of accountParts) {
        const end = s.days.length - 1;
        const w = sumWindow(s, end - days + 1, end);
        acctCost += w.cost;
        acctValue += w.conv_value;
    }
    const acctRoas = acctCost > 0 ? acctValue / acctCost : null;
    if (acctRoas === null)
        return;
    const money = (v: number) => fmt("money", v, ctx.currency);
    for (const s of series) {
        const value = s.campaign?.type;
        if (value !== "Search" && value !== "Shopping")
            continue;
        const end = s.days.length - 1;
        const start = end - days + 1;
        if (start < firstDataIndex(s))
            continue;
        const w = sumWindow(s, start, end);
        if (w.is_eligible <= 0 || w.cost <= 0)
            continue;
        if (w.conversions / days < ctx.settings.minVolume.convPerDay)
            continue;
        const lost = w.is_lost_budget / w.is_eligible;
        const roas = w.conv_value / w.cost;
        if (lost < cfg.minLostIsBudget || roas < cfg.roasVsAccount * acctRoas)
            continue;
        const share = w.is_search_impr / w.is_eligible;
        const raise = Math.min(1, share > 0 ? lost / share : 1);
        const daily = s.campaign?.budget_daily ?? null;
        const recommendedDaily = daily ? Math.round((daily * (1 + raise)) / 5) * 5 : null;
        out.push(makeSignal(ctx, {
            entity: entityOf(s),
            kind: "budget_limited",
            detector: "budget_limited",
            metric: "lost_is_budget",
            direction: "up",
            polarity: "good",
            severity: "info",
            strength: 2.5 * (lost / cfg.minLostIsBudget) + roas / acctRoas / 10,
            observed: lost,
            expected: cfg.minLostIsBudget,
            band: { lo: 0, hi: cfg.minLostIsBudget },
            window: { recentStart: dateAt(s, start), recentEnd: dateAt(s, end) },
            series: displaySeries(s, (d) => (d.is_eligible > 0 ? d.is_lost_budget / d.is_eligible : null)),
            title: `Budget-limited — ${(lost * 100).toFixed(0)}% of impressions lost`,
            summary: `Lost ${(lost * 100).toFixed(1)}% of eligible impressions to budget over the last ${days} days while ROAS was ${roas.toFixed(2)}x (account ${acctRoas.toFixed(2)}x).`,
            recommendation: `Raise the daily budget by about ${(raise * 100).toFixed(0)}%${recommendedDaily ? ` (to ${money(recommendedDaily)})` : ""} to capture the missed demand — the lost-budget share suggests that much extra volume at similar efficiency.`,
            evidence: [
                { label: "Observed", value: `${(lost * 100).toFixed(1)}% lost (budget)` },
                { label: "Expected", value: `< ${(cfg.minLostIsBudget * 100).toFixed(0)}%` },
                { label: "ROAS vs account", value: `${roas.toFixed(2)}x vs ${acctRoas.toFixed(2)}x` },
                { label: "Suggested daily", value: recommendedDaily ? money(recommendedDaily) : "—" },
            ],
            format: "percent",
        }));
    }
}
