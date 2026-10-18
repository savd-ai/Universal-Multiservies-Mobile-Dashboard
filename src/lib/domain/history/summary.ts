import type { HistorySummary } from "../contracts/history";
import type { Severity } from "../types";

/** One stored signal, as the summary needs it (peak severity: what it got to at its worst). */
export interface SummarySignalRow {
  entityId: string;
  entityName: string;
  accountName: string;
  metric: string | null;
  peakSeverity: Severity;
  status: string;
  firstSeenAt: string;
  resolvedAt: string | null;
}

/** One notification with its earliest receipt across devices (null when no device fetched or opened it). */
export interface SummaryNotificationRow {
  createdAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
}

export type SummaryBody = Pick<HistorySummary, "range" | "totals" | "byMonth" | "byMetric" | "topEntities" | "timeToResolveHours" | "notifications" | "runs">;

/** Months from `from` to `to` (YYYY-MM-DD or ISO timestamps), inclusive, as YYYY-MM. */
export function monthsBetween(from: string, to: string): string[] {
  let [year, month] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const end = to.slice(0, 7);
  const months: string[] = [];
  for (let guard = 0; guard < 600; guard++) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > end) break;
    months.push(key);
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
  return months;
}

/** Linear-interpolated quantile of an ascending list; null when empty. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const value = sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
  return Math.round(value * 100) / 100;
}

const hoursBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 3600000;

/**
 * Long-term view of what the anomaly engine found: signals per month and severity, which metrics and campaigns keep
 * coming back, how long problems stayed open, and whether phones saw the notifications. Opportunities are the
 * `info` severity (the web app labels them that way). Pure: rows in, numbers out.
 */
export function summarizeHistory(input: {
  from: string;
  to: string;
  signals: readonly SummarySignalRow[];
  notifications: readonly SummaryNotificationRow[];
  runs: { count: number; lastRunAt: string | null };
}): SummaryBody {
  const months = monthsBetween(input.from, input.to);
  const byMonth = new Map(months.map((month) => [month, { month, critical: 0, warning: 0, opportunity: 0 }]));
  const byMetric = new Map<string, { metric: string; signals: number; critical: number }>();
  const byEntity = new Map<string, { entityId: string; entityName: string; accountName: string; signals: number; critical: number }>();
  const totals = { signals: 0, critical: 0, warning: 0, opportunity: 0, resolved: 0, open: 0 };
  const resolveHours: number[] = [];

  for (const signal of input.signals) {
    totals.signals += 1;
    const critical = signal.peakSeverity === "critical" ? 1 : 0;
    if (signal.peakSeverity === "critical") totals.critical += 1;
    else if (signal.peakSeverity === "warning") totals.warning += 1;
    else totals.opportunity += 1;
    if (signal.resolvedAt) {
      totals.resolved += 1;
      const hours = hoursBetween(signal.firstSeenAt, signal.resolvedAt);
      if (Number.isFinite(hours) && hours >= 0) resolveHours.push(hours);
    } else if (signal.status === "open") totals.open += 1;

    const month = byMonth.get(signal.firstSeenAt.slice(0, 7));
    if (month) {
      if (signal.peakSeverity === "critical") month.critical += 1;
      else if (signal.peakSeverity === "warning") month.warning += 1;
      else month.opportunity += 1;
    }
    const metricKey = signal.metric ?? "other";
    const metric = byMetric.get(metricKey) ?? { metric: metricKey, signals: 0, critical: 0 };
    metric.signals += 1;
    metric.critical += critical;
    byMetric.set(metricKey, metric);
    const entityKey = `${signal.accountName}|${signal.entityId}`;
    const entity = byEntity.get(entityKey) ?? { entityId: signal.entityId, entityName: signal.entityName, accountName: signal.accountName, signals: 0, critical: 0 };
    entity.signals += 1;
    entity.critical += critical;
    byEntity.set(entityKey, entity);
  }

  resolveHours.sort((a, b) => a - b);
  const delivered = input.notifications.filter((row) => row.deliveredAt !== null).length;
  const openMinutes = input.notifications
    .filter((row) => row.openedAt !== null)
    .map((row) => (Date.parse(row.openedAt!) - Date.parse(row.createdAt)) / 60000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0)
    .sort((a, b) => a - b);
  const opened = input.notifications.filter((row) => row.openedAt !== null).length;
  const byCount = <T extends { signals: number; critical: number }>(a: T, b: T) => b.signals - a.signals || b.critical - a.critical;

  return {
    range: { from: input.from, to: input.to },
    totals,
    byMonth: [...byMonth.values()],
    byMetric: [...byMetric.values()].sort(byCount).slice(0, 8),
    topEntities: [...byEntity.values()].sort(byCount).slice(0, 5),
    timeToResolveHours: { median: quantile(resolveHours, 0.5), p90: quantile(resolveHours, 0.9), resolved: resolveHours.length },
    notifications: {
      created: input.notifications.length,
      delivered,
      opened,
      openRate: delivered ? Math.round((opened / delivered) * 1000) / 1000 : null,
      medianMinutesToOpen: quantile(openMinutes, 0.5),
    },
    runs: input.runs,
  };
}
