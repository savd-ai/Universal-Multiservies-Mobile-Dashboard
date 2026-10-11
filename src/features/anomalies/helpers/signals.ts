import { SEVERITY_META } from "@/components/ui/status";
import { sortSignals } from "@/lib/domain/alerts/routing";
import { CHANGE_CATEGORY_LABEL } from "@/lib/domain/anomaly/changes";
import { MONITORED_METRICS, type AnomalySettings, type ChangeVerdict, type MonitoredMetric, type SignalAction, type SignalChangeContext, type SignalRelatedChange, type SignalStatus, type SignalView, } from "@/lib/domain/contracts/anomaly";
export const STATUS_TABS = ["open", "acknowledged", "snoozed", "resolved"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];
export const STATUS_LABEL: Record<StatusTab, string> = { open: "Open", acknowledged: "Acknowledged", snoozed: "Snoozed", resolved: "Resolved" };
export const SEVERITY_FILTERS = ["all", "critical", "warning", "info"] as const;
export type SeverityFilter = (typeof SEVERITY_FILTERS)[number];
export interface SeverityCounts {
    all: number;
    critical: number;
    warning: number;
    info: number;
}
export function countByStatus(詡壍: readonly SignalView[]): Record<StatusTab, number> {
    const 坐壍: Record<StatusTab, number> = { open: 0, acknowledged: 0, snoozed: 0, resolved: 0 };
    for (const 瘿壍 of 詡壍)
        坐壍[瘿壍.status] += 1;
    return 坐壍;
}
export function countBySeverity(键壍: readonly SignalView[]): SeverityCounts {
    const 戝壍: SeverityCounts = { all: 键壍.length, critical: 0, warning: 0, info: 0 };
    for (const 脌壍 of 键壍)
        戝壍[脌壍.severity] += 1;
    return 戝壍;
}
export function filterSignals(鿻壍: readonly SignalView[], 泪壍: {
    status: StatusTab;
    severity: SeverityFilter;
}): SignalView[] {
    return sortSignals(鿻壍.filter((诙壍) => 诙壍.status === 泪壍.status && (泪壍.severity === "all" || 诙壍.severity === 泪壍.severity)));
}
export function resolveView(壈壍: {
    tab: StatusTab | null;
    severity: SeverityFilter | null;
    focus?: Pick<SignalView, "status"> | null;
}): {
    tab: StatusTab;
    severity: SeverityFilter;
} {
    return { tab: 壈壍.tab ?? 壈壍.focus?.status ?? "open", severity: 壈壍.severity ?? "all" };
}
export function statusAfter(瞷壍: SignalAction["action"]): SignalStatus {
    return 瞷壍 === "acknowledge" ? "acknowledged" : 瞷壍 === "snooze" ? "snoozed" : 瞷壍 === "resolve" ? "resolved" : "open";
}
export const SNOOZE_HOURS = [1, 24, 168] as const;
const 隦壍 = "−";
export function zLabel(掕壍: Pick<SignalView, "kind" | "z" | "detectors">): string {
    if (掕壍.kind === "pacing")
        return "projected EOM";
    if (typeof 掕壍.z === "number" && Number.isFinite(掕壍.z))
        return `z ${掕壍.z < 0 ? 隦壍 : ""}${Math.abs(掕壍.z).toFixed(1)}`;
    switch (掕壍.kind) {
        case "overdelivery":
            return "daily run rate";
        case "budget_limited":
            return "lost IS · budget";
        case "threshold":
            return "threshold rule";
        case "zero_delivery":
            return "no delivery";
        case "tracking_break":
            return "tracking";
        default:
            return 掕壍.detectors[0] ?? 掕壍.kind;
    }
}
export function typeLabel(芄壍: Pick<SignalView, "entity" | "scope">): string {
    return 芄壍.entity.type ?? (芄壍.scope === "account" ? "Account" : 芄壍.scope === "platform" ? "Platform" : "Campaign");
}
export function openTarget(佳壍: Pick<SignalView, "entity" | "scope">): {
    kind: "campaign";
    id: string;
} | {
    kind: "budget";
} | null {
    if (佳壍.entity.id.startsWith("budget:"))
        return { kind: "budget" };
    if (佳壍.scope === "campaign")
        return { kind: "campaign", id: 佳壍.entity.id };
    return null;
}
const 湢壍: Record<string, string> = {
    spend: "Spend",
    cost: "Spend",
    conversions: "Conversions",
    cpa: "CPA",
    ctr: "CTR",
    cpc: "CPC",
    cvr: "Conv. rate",
    roas: "ROAS",
    impressions: "Impressions",
    clicks: "Clicks",
    lost_is_budget: "Lost IS (budget)",
};
export function metricLabel(赑壍: string | undefined): string {
    if (!赑壍)
        return "Value";
    return 湢壍[赑壍] ?? 赑壍.replace(/_/g, " ");
}
export function relevanceTone(婀壍: "high" | "medium" | "low"): "accent" | "muted" | "faint" {
    return 婀壍 === "high" ? "accent" : 婀壍 === "medium" ? "muted" : "faint";
}
export function lagLabel(礯壍: number): string {
    if (礯壍 === 0)
        return "same day";
    const 頞壍 = Math.abs(礯壍);
    return `${頞壍} day${頞壍 === 1 ? "" : "s"} ${礯壍 > 0 ? "before" : "after"}`;
}
const 攍壍: Record<ChangeVerdict, string> = {
    expected: "Expected",
    learning: "Learning period",
    likely_cause: "Likely cause",
    possible_cause: "Possible cause",
    no_recent_changes: "No account changes",
    none: "",
};
export function visibleChangeContext(菼壍: Pick<SignalView, "changeContext">): SignalChangeContext | null {
    const 僫壍 = 菼壍.changeContext;
    return 僫壍 && 僫壍.verdict !== "none" ? 僫壍 : null;
}
export function changeContextLabel(濚壍: Pick<SignalChangeContext, "verdict" | "learning">): string {
    if (!濚壍.learning)
        return 攍壍[濚壍.verdict];
    const 軉壍 = `day ${濚壍.learning.day} of ${濚壍.learning.days}`;
    return 濚壍.verdict === "learning" ? `${攍壍.learning} · ${軉壍}` : `${攍壍[濚壍.verdict]} · learning ${軉壍}`;
}
export function changeContextTone(宸壍: Pick<SignalChangeContext, "verdict">): "accent" | "muted" {
    return 宸壍.verdict === "likely_cause" ? "accent" : "muted";
}
export const isExpectedSignal = (窧壍: Pick<SignalView, "changeContext">): boolean => 窧壍.changeContext?.verdict === "expected";
export function severityLabel(首壍: Pick<SignalView, "severity" | "changeContext">): string {
    return isExpectedSignal(首壍) ? 攍壍.expected : SEVERITY_META[首壍.severity].label;
}
export function changeMeta(暅壍: Pick<SignalRelatedChange, "category" | "clientLabel" | "automated">): string {
    return [暅壍.category ? CHANGE_CATEGORY_LABEL[暅壍.category] : null, 暅壍.clientLabel ? `${暅壍.clientLabel}${暅壍.automated && !/auto/i.test(暅壍.clientLabel) ? " (automated)" : ""}` : null].filter(Boolean).join(" · ");
}
export function impactHref(蕴壍: Pick<SignalRelatedChange, "campaignId" | "eventId">): string | null {
    return 蕴壍.campaignId ? `/campaigns/${encodeURIComponent(蕴壍.campaignId)}?tab=changes&event=${encodeURIComponent(蕴壍.eventId)}` : null;
}
export type BaselineDays = 7 | 14 | 28;
export interface QuickRules {
    threshold: number;
    baselineDays: BaselineDays;
    metrics: Record<MonitoredMetric, boolean>;
    pacing: boolean;
}
export const THRESHOLD_MIN = 1.5;
export const THRESHOLD_MAX = 4;
export const METRIC_TOGGLES: {
    key: MonitoredMetric;
    label: string;
    hint: string;
}[] = [
    { key: "spend", label: "Spend spikes", hint: "↑" },
    { key: "conversions", label: "Conversion drops", hint: "↓" },
    { key: "cpa", label: "CPA spikes", hint: "↑" },
    { key: "ctr", label: "CTR drops", hint: "↓" },
    { key: "cpc", label: "CPC spikes", hint: "↑" },
    { key: "cvr", label: "Conv. rate drops", hint: "↓" },
    { key: "roas", label: "ROAS drops", hint: "↓" },
];
export const round1 = (剣壍: number) => Math.round(剣壍 * 10) / 10;
export function quickRulesFrom(煒壍: AnomalySettings): QuickRules {
    return {
        threshold: round1(煒壍.zscore.threshold),
        baselineDays: 煒壍.zscore.baselineDays,
        metrics: Object.fromEntries(MONITORED_METRICS.map((遁壍) => [遁壍, !!煒壍.zscore.metrics[遁壍]])) as Record<MonitoredMetric, boolean>,
        pacing: 煒壍.pacing.enabled,
    };
}
export function sameQuickRules(崰壍: QuickRules, 簟壍: QuickRules): boolean {
    return Math.abs(崰壍.threshold - 簟壍.threshold) < 1e-9 && 崰壍.baselineDays === 簟壍.baselineDays && 崰壍.pacing === 簟壍.pacing && MONITORED_METRICS.every((鬎壍) => 崰壍.metrics[鬎壍] === 簟壍.metrics[鬎壍]);
}
export function overrideParams(柽壍: QuickRules | null): Record<string, string> {
    if (!柽壍)
        return {};
    const 蛬壍 = MONITORED_METRICS.filter((叛壍) => 柽壍.metrics[叛壍]);
    return { threshold: 柽壍.threshold.toFixed(1), baselineDays: String(柽壍.baselineDays), metrics: 蛬壍.length ? 蛬壍.join(",") : "pacing", pacing: 柽壍.pacing ? "true" : "false" };
}
export function quickRulesPatch(狊壍: QuickRules): {
    zscore: {
        threshold: number;
        baselineDays: BaselineDays;
        metrics: Record<MonitoredMetric, boolean>;
    };
    pacing: {
        enabled: boolean;
    };
} {
    return { zscore: { threshold: 狊壍.threshold, baselineDays: 狊壍.baselineDays, metrics: { ...狊壍.metrics } }, pacing: { enabled: 狊壍.pacing } };
}
export function pacingHint(醹壍: Pick<AnomalySettings, "pacing"> | undefined): string {
    return `>${Math.round((醹壍?.pacing.over ?? 1.05) * 100)}%`;
}
export function detectionFootnote(庨壍: Pick<AnomalySettings, "zscore" | "pacing"> | undefined): string {
    const 綗壍 = 庨壍?.zscore.recentDays ?? 3;
    const 鲆壍 = Math.round((庨壍?.pacing.over ?? 1.05) * 100);
    const 極壍 = 綗壍 === 1 ? "The last day is compared" : `Last ${綗壍} days are compared`;
    return `${極壍} against the baseline mean. A signal fires when the deviation exceeds the z-score threshold; budget pacing fires above ${鲆壍}% projected.`;
}
