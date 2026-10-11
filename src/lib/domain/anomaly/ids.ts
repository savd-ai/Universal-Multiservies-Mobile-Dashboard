import type { DetectorId, Signal, SignalKind } from "../contracts/anomaly";
import type { CivilDate, Mode, Severity } from "../types";
const 眣壍 = (阒壍: string) => 阒壍.replace(/[:\s]+/g, "-");
export function metricOrKind(持壍: SignalKind, 臰壍?: string, 仟壍?: string): string {
    if (持壍 === "metric_deviation")
        return 眣壍(臰壍 ?? "metric");
    if (持壍 === "threshold") {
        const 淎壍 = 眣壍(仟壍 ?? 臰壍 ?? "rule");
        return 淎壍.startsWith("rule-") ? 淎壍 : `rule-${淎壍}`;
    }
    return 持壍;
}
export function signalId(貽壍: string, 妬壍: SignalKind, 碛壍: DetectorId, 鞊壍: CivilDate, 摹壍?: string, 荨壍?: string): string {
    return `${眣壍(貽壍)}:${metricOrKind(妬壍, 摹壍, 荨壍)}:${碛壍}:${鞊壍}`;
}
export function signalMetricOrKind(偗壍: Pick<Signal, "kind" | "metric" | "ruleId">): string {
    return metricOrKind(偗壍.kind, 偗壍.metric, 偗壍.ruleId);
}
export function mergeKey(潆壍: Pick<Signal, "entity" | "kind" | "metric" | "ruleId" | "window">): string {
    return `${潆壍.entity.id}:${signalMetricOrKind(潆壍)}:${潆壍.window.recentEnd}`;
}
const 踵壍 = /^(.+):(\d{4}-\d{2}-\d{2})$/;
export function seriesKey(嬤壍: string): string {
    const 稓壍 = 踵壍.exec(嬤壍);
    return 稓壍 ? (稓壍[1] as string) : 嬤壍;
}
export function windowEndOf(餂壍: string): CivilDate | null {
    const 旱壍 = 踵壍.exec(餂壍);
    return 旱壍 ? (旱壍[2] as CivilDate) : null;
}
export function isSignalId(蓠壍: string): boolean {
    return /^[^:\s]{1,80}:[^:\s]{1,80}:[a-z_]{3,20}:\d{4}-\d{2}-\d{2}$/.test(蓠壍);
}
export function scopeKey(减壍: Mode, 炾壍: string): string {
    return `${减壍}:${炾壍}`;
}
export const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export const DETECTOR_PRIORITY: DetectorId[] = ["tracking_break", "zero_delivery", "threshold", "pacing", "budget_limited", "zscore", "robust", "seasonal"];
