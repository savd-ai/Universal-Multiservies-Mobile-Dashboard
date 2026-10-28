import type { DetectorId, Signal, SignalKind } from "../contracts/anomaly";
import type { CivilDate, Mode, Severity } from "../types";
const clean = (s: string) => s.replace(/[:\s]+/g, "-");
export function metricOrKind(kind: SignalKind, metric?: string, ruleId?: string): string {
    if (kind === "metric_deviation")
        return clean(metric ?? "metric");
    if (kind === "threshold") {
        const r = clean(ruleId ?? metric ?? "rule");
        return r.startsWith("rule-") ? r : `rule-${r}`;
    }
    return kind;
}
export function signalId(entityId: string, kind: SignalKind, detector: DetectorId, windowEnd: CivilDate, metric?: string, ruleId?: string): string {
    return `${clean(entityId)}:${metricOrKind(kind, metric, ruleId)}:${detector}:${windowEnd}`;
}
export function signalMetricOrKind(s: Pick<Signal, "kind" | "metric" | "ruleId">): string {
    return metricOrKind(s.kind, s.metric, s.ruleId);
}
export function mergeKey(s: Pick<Signal, "entity" | "kind" | "metric" | "ruleId" | "window">): string {
    return `${s.entity.id}:${signalMetricOrKind(s)}:${s.window.recentEnd}`;
}
const ID_RE = /^(.+):(\d{4}-\d{2}-\d{2})$/;
export function seriesKey(id: string): string {
    const m = ID_RE.exec(id);
    return m ? (m[1] as string) : id;
}
export function windowEndOf(id: string): CivilDate | null {
    const m = ID_RE.exec(id);
    return m ? (m[2] as CivilDate) : null;
}
export function isSignalId(id: string): boolean {
    return /^[^:\s]{1,80}:[^:\s]{1,80}:[a-z_]{3,20}:\d{4}-\d{2}-\d{2}$/.test(id);
}
export function scopeKey(mode: Mode, accountId: string): string {
    return `${mode}:${accountId}`;
}
export const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export const DETECTOR_PRIORITY: DetectorId[] = ["tracking_break", "zero_delivery", "threshold", "pacing", "budget_limited", "zscore", "robust", "seasonal"];
