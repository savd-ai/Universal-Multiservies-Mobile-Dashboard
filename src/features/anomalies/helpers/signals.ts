import { SEVERITY_META } from "@/components/ui/status";
import { sortSignals } from "@/lib/domain/alerts/routing";
import { CHANGE_CATEGORY_LABEL } from "@/lib/domain/anomaly/changes";
import {
  MONITORED_METRICS,
  type AnomalySettings,
  type ChangeVerdict,
  type MonitoredMetric,
  type SignalAction,
  type SignalChangeContext,
  type SignalRelatedChange,
  type SignalStatus,
  type SignalView,
} from "@/lib/domain/contracts/anomaly";

// Pure view logic for the Signals page: status tabs and severity chips (counts + filtering), the card's meta
// labels (incl. the change-history context and related-change links), and the quick-rules draft that previews
// detection through GET /api/anomalies query overrides.

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

export function countByStatus(signals: readonly SignalView[]): Record<StatusTab, number> {
  const out: Record<StatusTab, number> = { open: 0, acknowledged: 0, snoozed: 0, resolved: 0 };
  for (const s of signals) out[s.status] += 1;
  return out;
}

export function countBySeverity(signals: readonly SignalView[]): SeverityCounts {
  const out: SeverityCounts = { all: signals.length, critical: 0, warning: 0, info: 0 };
  for (const s of signals) out[s.severity] += 1;
  return out;
}

/** Signals in one status tab (and severity), most important first. */
export function filterSignals(signals: readonly SignalView[], opts: { status: StatusTab; severity: SeverityFilter }): SignalView[] {
  return sortSignals(signals.filter((s) => s.status === opts.status && (opts.severity === "all" || s.severity === opts.severity)));
}

/**
 * Which tab/chip to show. An explicit URL choice wins; a `?focus=` deep link opens the tab its signal lives in.
 */
export function resolveView(opts: { tab: StatusTab | null; severity: SeverityFilter | null; focus?: Pick<SignalView, "status"> | null }): { tab: StatusTab; severity: SeverityFilter } {
  return { tab: opts.tab ?? opts.focus?.status ?? "open", severity: opts.severity ?? "all" };
}

export function statusAfter(action: SignalAction["action"]): SignalStatus {
  return action === "acknowledge" ? "acknowledged" : action === "snooze" ? "snoozed" : action === "resolve" ? "resolved" : "open";
}

export const SNOOZE_HOURS = [1, 24, 168] as const;

// ── Card labels ─────────────────────────────────────────────────────────────────────────────────────

const MINUS = "−";

/** The mono label after the campaign type: "z 14.3" (prototype), "projected EOM" for month pacing, … */
export function zLabel(s: Pick<SignalView, "kind" | "z" | "detectors">): string {
  if (s.kind === "pacing") return "projected EOM";
  if (typeof s.z === "number" && Number.isFinite(s.z)) return `z ${s.z < 0 ? MINUS : ""}${Math.abs(s.z).toFixed(1)}`;
  switch (s.kind) {
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
      return s.detectors[0] ?? s.kind;
  }
}

export function typeLabel(s: Pick<SignalView, "entity" | "scope">): string {
  return s.entity.type ?? (s.scope === "account" ? "Account" : s.scope === "platform" ? "Platform" : "Campaign");
}

/** Where "Open campaign" goes: the campaign drawer, the budget planner (shared budgets) or nowhere. */
export function openTarget(s: Pick<SignalView, "entity" | "scope">): { kind: "campaign"; id: string } | { kind: "budget" } | null {
  if (s.entity.id.startsWith("budget:")) return { kind: "budget" };
  if (s.scope === "campaign") return { kind: "campaign", id: s.entity.id };
  return null;
}

const METRIC_LABELS: Record<string, string> = {
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

export function metricLabel(metric: string | undefined): string {
  if (!metric) return "Value";
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, " ");
}

export function relevanceTone(r: "high" | "medium" | "low"): "accent" | "muted" | "faint" {
  return r === "high" ? "accent" : r === "medium" ? "muted" : "faint";
}

/** "1 day before" · "same day" · "2 days after" (relative to the start of the shift) */
export function lagLabel(days: number): string {
  if (days === 0) return "same day";
  const n = Math.abs(days);
  return `${n} day${n === 1 ? "" : "s"} ${days > 0 ? "before" : "after"}`;
}

// ── Change history ───────────────────────────────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<ChangeVerdict, string> = {
  expected: "Expected",
  learning: "Learning period",
  likely_cause: "Likely cause",
  possible_cause: "Possible cause",
  no_recent_changes: "No account changes",
  none: "",
};

/** The card shows the change context for every verdict except "none" (the related changes speak for themselves). */
export function visibleChangeContext(s: Pick<SignalView, "changeContext">): SignalChangeContext | null {
  const c = s.changeContext;
  return c && c.verdict !== "none" ? c : null;
}

/** Pill text: "Expected", "Learning period · day 3 of 7", "Likely cause · learning day 5 of 7", "No account changes", … */
export function changeContextLabel(c: Pick<SignalChangeContext, "verdict" | "learning">): string {
  if (!c.learning) return VERDICT_LABEL[c.verdict];
  const progress = `day ${c.learning.day} of ${c.learning.days}`;
  return c.verdict === "learning" ? `${VERDICT_LABEL.learning} · ${progress}` : `${VERDICT_LABEL[c.verdict]} · learning ${progress}`;
}

export function changeContextTone(c: Pick<SignalChangeContext, "verdict">): "accent" | "muted" {
  return c.verdict === "likely_cause" ? "accent" : "muted";
}

/** The shift is the intended effect of the account's own change: shown muted, labelled "Expected". */
export const isExpectedSignal = (s: Pick<SignalView, "changeContext">): boolean => s.changeContext?.verdict === "expected";

/** "Expected" for signals explained by the account's own change, else Critical / Warning / Opportunity. */
export function severityLabel(s: Pick<SignalView, "severity" | "changeContext">): string {
  return isExpectedSignal(s) ? VERDICT_LABEL.expected : SEVERITY_META[s.severity].label;
}

/** "Budget · Google Ads web" — what kind of change and who made it. */
export function changeMeta(c: Pick<SignalRelatedChange, "category" | "clientLabel" | "automated">): string {
  return [c.category ? CHANGE_CATEGORY_LABEL[c.category] : null, c.clientLabel ? `${c.clientLabel}${c.automated && !/auto/i.test(c.clientLabel) ? " (automated)" : ""}` : null].filter(Boolean).join(" · ");
}

/** The campaign's Changes tab with the before/after impact of this change open. */
export function impactHref(c: Pick<SignalRelatedChange, "campaignId" | "eventId">): string | null {
  return c.campaignId ? `/campaigns/${encodeURIComponent(c.campaignId)}?tab=changes&event=${encodeURIComponent(c.eventId)}` : null;
}

// ── Quick rules (left panel) ─────────────────────────────────────────────────────────────────────────

export type BaselineDays = 7 | 14 | 28;

export interface QuickRules {
  threshold: number;
  baselineDays: BaselineDays;
  metrics: Record<MonitoredMetric, boolean>;
  pacing: boolean;
}

export const THRESHOLD_MIN = 1.5;
export const THRESHOLD_MAX = 4;

export const METRIC_TOGGLES: { key: MonitoredMetric; label: string; hint: string }[] = [
  { key: "spend", label: "Spend spikes", hint: "↑" },
  { key: "conversions", label: "Conversion drops", hint: "↓" },
  { key: "cpa", label: "CPA spikes", hint: "↑" },
  { key: "ctr", label: "CTR drops", hint: "↓" },
  { key: "cpc", label: "CPC spikes", hint: "↑" },
  { key: "cvr", label: "Conv. rate drops", hint: "↓" },
  { key: "roas", label: "ROAS drops", hint: "↓" },
];

export const round1 = (v: number) => Math.round(v * 10) / 10;

export function quickRulesFrom(s: AnomalySettings): QuickRules {
  return {
    threshold: round1(s.zscore.threshold),
    baselineDays: s.zscore.baselineDays,
    metrics: Object.fromEntries(MONITORED_METRICS.map((m) => [m, !!s.zscore.metrics[m]])) as Record<MonitoredMetric, boolean>,
    pacing: s.pacing.enabled,
  };
}

export function sameQuickRules(a: QuickRules, b: QuickRules): boolean {
  return Math.abs(a.threshold - b.threshold) < 1e-9 && a.baselineDays === b.baselineDays && a.pacing === b.pacing && MONITORED_METRICS.every((m) => a.metrics[m] === b.metrics[m]);
}

/**
 * GET /api/anomalies preview overrides for an unsaved draft ({} = saved settings). The API client drops empty
 * query values, so "no z-score metric" is sent as `metrics=pacing` — the explicit `pacing` flag still decides
 * whether pacing runs.
 */
export function overrideParams(draft: QuickRules | null): Record<string, string> {
  if (!draft) return {};
  const on = MONITORED_METRICS.filter((m) => draft.metrics[m]);
  return { threshold: draft.threshold.toFixed(1), baselineDays: String(draft.baselineDays), metrics: on.length ? on.join(",") : "pacing", pacing: draft.pacing ? "true" : "false" };
}

/** PUT /api/anomalies/settings body for "Save as default" (deep-merged over the stored settings). */
export function quickRulesPatch(draft: QuickRules): { zscore: { threshold: number; baselineDays: BaselineDays; metrics: Record<MonitoredMetric, boolean> }; pacing: { enabled: boolean } } {
  return { zscore: { threshold: draft.threshold, baselineDays: draft.baselineDays, metrics: { ...draft.metrics } }, pacing: { enabled: draft.pacing } };
}

export function pacingHint(settings: Pick<AnomalySettings, "pacing"> | undefined): string {
  return `>${Math.round((settings?.pacing.over ?? 1.05) * 100)}%`;
}

/** The panel footnote (prototype copy with the saved windows and thresholds). */
export function detectionFootnote(settings: Pick<AnomalySettings, "zscore" | "pacing"> | undefined): string {
  const n = settings?.zscore.recentDays ?? 3;
  const over = Math.round((settings?.pacing.over ?? 1.05) * 100);
  const lead = n === 1 ? "The last day is compared" : `Last ${n} days are compared`;
  return `${lead} against the baseline mean. A signal fires when the deviation exceeds the z-score threshold; budget pacing fires above ${over}% projected.`;
}
