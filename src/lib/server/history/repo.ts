import "server-only";
import type { Signal, SignalStatus } from "@/lib/domain/contracts/anomaly";
import { SEVERITY_RANK, type HistoryMode, type HistorySignal, type MobileDeviceInfo, type MobileDevicePrefs, type MobileDeviceView, type NotificationEvent, type NotificationItem } from "@/lib/domain/contracts/history";
import type { SummaryNotificationRow, SummarySignalRow } from "@/lib/domain/history/summary";
import type { Severity } from "@/lib/domain/types";
import { transaction, type Db } from "../warehouse/sqlite";

export interface RunRecord {
  id: string;
  mode: HistoryMode;
  accountId: string;
  accountName: string;
  dataThrough: string;
  startedAt: string;
  finishedAt: string;
  signals: number;
  newOrEscalated: number;
  resolved: number;
}

export interface ObservedSignal {
  signal: Omit<Signal, "series">;
  status: SignalStatus;
  firstSeenAt: string;
}

export interface NotificationDraft {
  accountId: string;
  accountName: string;
  signalId: string;
  event: NotificationEvent;
  severity: Severity;
  polarity: "bad" | "good";
  title: string;
  body: string;
  path: string;
}

export interface DeviceFilter {
  minSeverity: "warning" | "critical";
  includeOpportunities: boolean;
}

interface DeviceRow {
  id: string;
  user_id: string;
  session_id: string | null;
  platform: "ios" | "android";
  name: string;
  app_version: string;
  os_version: string;
  push_token: string | null;
  enabled: number;
  min_severity: "warning" | "critical";
  include_opportunities: number;
  created_at: string;
  last_seen_at: string;
  signed_out_at: string | null;
}

export interface DeviceRecord extends MobileDeviceView {
  userId: string;
  sessionId: string | null;
}

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");
const maxSeverity = (a: Severity, b: Severity): Severity => (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b);

function toDevice(row: DeviceRow): DeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    platform: row.platform,
    name: row.name,
    appVersion: row.app_version,
    osVersion: row.os_version,
    enabled: row.enabled === 1,
    minSeverity: row.min_severity,
    includeOpportunities: row.include_opportunities === 1,
    hasPushToken: !!row.push_token,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/** Severity filter for a device: bad signals at or above its threshold, plus opportunities when it asked for them. */
function severityClause(filter: DeviceFilter | undefined): { sql: string; params: string[] } {
  if (!filter) return { sql: "", params: [] };
  const bad = filter.minSeverity === "critical" ? ["critical"] : ["warning", "critical"];
  const parts = [`(polarity = 'bad' AND severity IN (${placeholders(bad.length)}))`];
  if (filter.includeOpportunities) parts.push("(polarity = 'good')");
  // Resolved notices follow the severity the signal had, so a device that only wants critical only hears about those.
  return { sql: ` AND (${parts.join(" OR ")})`, params: bad };
}

export class HistoryRepo {
  constructor(readonly db: Db) {}

  getMeta(key: string): string | null {
    return (this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  /** Signal ids of this account already stored, with the severity they peaked at. */
  knownSignals(mode: HistoryMode, ids: readonly string[]): Map<string, Severity> {
    const known = new Map<string, Severity>();
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const rows = this.db.prepare(`SELECT signal_id, peak_severity FROM signal WHERE mode = ? AND signal_id IN (${placeholders(chunk.length)})`).all(mode, ...chunk) as { signal_id: string; peak_severity: Severity }[];
      for (const row of rows) known.set(row.signal_id, row.peak_severity);
    }
    return known;
  }

  /** One evaluation in one transaction: the run, every signal it saw, the ones it resolved and the notifications. */
  recordRun(run: RunRecord, observed: readonly ObservedSignal[], resolvedIds: readonly string[], notifications: readonly NotificationDraft[]): number[] {
    return transaction(this.db, () => {
      this.db
        .prepare("INSERT INTO evaluation_run (id, mode, account_id, account_name, data_through, started_at, finished_at, signals, new_or_escalated, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(run.id, run.mode, run.accountId, run.accountName, run.dataThrough, run.startedAt, run.finishedAt, run.signals, run.newOrEscalated, run.resolved);
      const known = this.knownSignals(run.mode, observed.map((item) => item.signal.id));
      const upsert = this.db.prepare(`
        INSERT INTO signal (mode, signal_id, account_id, account_name, scope, entity_id, entity_name, entity_type, kind, metric, direction, polarity,
          severity, peak_severity, title, summary, recommendation, format, observed, expected, change_pct, z, onset_date, window_end, status,
          first_seen_at, last_seen_at, resolved_at, observations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)
        ON CONFLICT (mode, signal_id) DO UPDATE SET
          account_name = excluded.account_name, entity_name = excluded.entity_name, severity = excluded.severity,
          peak_severity = excluded.peak_severity, title = excluded.title, summary = excluded.summary,
          recommendation = excluded.recommendation, observed = excluded.observed, expected = excluded.expected,
          change_pct = excluded.change_pct, z = excluded.z, status = excluded.status, last_seen_at = excluded.last_seen_at,
          resolved_at = CASE WHEN excluded.status = 'resolved' THEN signal.resolved_at ELSE NULL END,
          observations = signal.observations + 1`);
      const observation = this.db.prepare("INSERT OR REPLACE INTO signal_observation (run_id, signal_id, severity, observed, expected, z) VALUES (?, ?, ?, ?, ?, ?)");
      for (const { signal, status, firstSeenAt } of observed) {
        const peak = maxSeverity(known.get(signal.id) ?? signal.severity, signal.severity);
        upsert.run(
          run.mode, signal.id, run.accountId, run.accountName, signal.scope, signal.entity.id, signal.entity.name, signal.entity.type ?? null,
          signal.kind, signal.metric ?? null, signal.direction ?? null, signal.polarity, signal.severity, peak, signal.title, signal.summary,
          signal.recommendation, signal.format, signal.observed, signal.expected, signal.changePct, signal.z ?? null, signal.onsetDate ?? null,
          signal.window.recentEnd, status, firstSeenAt, run.finishedAt,
        );
        observation.run(run.id, signal.id, signal.severity, signal.observed, signal.expected, signal.z ?? null);
      }
      const resolve = this.db.prepare("UPDATE signal SET status = 'resolved', resolved_at = COALESCE(resolved_at, ?), last_seen_at = ? WHERE mode = ? AND signal_id = ?");
      for (const id of resolvedIds) resolve.run(run.finishedAt, run.finishedAt, run.mode, id);
      const insert = this.db.prepare("INSERT INTO notification (mode, account_id, account_name, signal_id, event, severity, polarity, title, body, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      return notifications.map((item) => Number(insert.run(run.mode, item.accountId, item.accountName, item.signalId, item.event, item.severity, item.polarity, item.title, item.body, item.path, run.finishedAt).lastInsertRowid));
    });
  }

  notifications(mode: HistoryMode, accountIds: readonly string[], options: { since: number; limit: number; filter?: DeviceFilter }): NotificationItem[] {
    if (!accountIds.length) return [];
    const severity = severityClause(options.filter);
    const rows = this.db
      .prepare(`SELECT * FROM notification WHERE mode = ? AND account_id IN (${placeholders(accountIds.length)}) AND id > ?${severity.sql} ORDER BY id DESC LIMIT ?`)
      .all(mode, ...accountIds, options.since, ...severity.params, options.limit) as Record<string, string | number>[];
    return rows.map((row) => ({
      id: Number(row.id),
      mode: row.mode as HistoryMode,
      accountId: String(row.account_id),
      accountName: String(row.account_name),
      signalId: String(row.signal_id),
      event: row.event as NotificationEvent,
      severity: row.severity as Severity,
      polarity: row.polarity as "bad" | "good",
      title: String(row.title),
      body: String(row.body),
      path: String(row.path),
      createdAt: String(row.created_at),
    }));
  }

  latestNotificationId(mode: HistoryMode, accountIds: readonly string[]): number {
    if (!accountIds.length) return 0;
    const row = this.db.prepare(`SELECT MAX(id) AS id FROM notification WHERE mode = ? AND account_id IN (${placeholders(accountIds.length)})`).get(mode, ...accountIds) as { id: number | null };
    return Number(row.id ?? 0);
  }

  /** Receipts only for notifications the viewer can see; returns how many rows changed. */
  markReceipts(deviceId: string, mode: HistoryMode, accountIds: readonly string[], ids: readonly number[], at: string, opened: boolean): number {
    if (!ids.length || !accountIds.length) return 0;
    return transaction(this.db, () => {
      const visible = this.db
        .prepare(`SELECT id FROM notification WHERE mode = ? AND account_id IN (${placeholders(accountIds.length)}) AND id IN (${placeholders(ids.length)})`)
        .all(mode, ...accountIds, ...ids) as { id: number }[];
      const statement = opened
        ? this.db.prepare("INSERT INTO notification_receipt (notification_id, device_id, delivered_at, opened_at) VALUES (?, ?, ?, ?) ON CONFLICT (notification_id, device_id) DO UPDATE SET opened_at = COALESCE(opened_at, excluded.opened_at)")
        : this.db.prepare("INSERT OR IGNORE INTO notification_receipt (notification_id, device_id, delivered_at, opened_at) VALUES (?, ?, ?, NULL)");
      let changed = 0;
      for (const { id } of visible) changed += Number((opened ? statement.run(id, deviceId, at, at) : statement.run(id, deviceId, at)).changes);
      return changed;
    });
  }

  registerDevice(input: { id: string; userId: string; sessionId: string; info: MobileDeviceInfo; at: string }): DeviceRecord {
    this.db
      .prepare(`INSERT INTO mobile_device (id, user_id, session_id, platform, name, app_version, os_version, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id, session_id = excluded.session_id, platform = excluded.platform, name = excluded.name,
          app_version = excluded.app_version, os_version = excluded.os_version, last_seen_at = excluded.last_seen_at, signed_out_at = NULL`)
      .run(input.id, input.userId, input.sessionId, input.info.platform, input.info.name, input.info.appVersion, input.info.osVersion, input.at, input.at);
    return this.device(input.id)!;
  }

  device(id: string): DeviceRecord | null {
    const row = this.db.prepare("SELECT * FROM mobile_device WHERE id = ?").get(id) as DeviceRow | undefined;
    return row ? toDevice(row) : null;
  }

  deviceForSession(sessionId: string): DeviceRecord | null {
    const row = this.db.prepare("SELECT * FROM mobile_device WHERE session_id = ? AND signed_out_at IS NULL").get(sessionId) as DeviceRow | undefined;
    return row ? toDevice(row) : null;
  }

  touchDevice(id: string, at: string): void {
    this.db.prepare("UPDATE mobile_device SET last_seen_at = ? WHERE id = ?").run(at, id);
  }

  updateDevice(id: string, prefs: MobileDevicePrefs, at: string): DeviceRecord | null {
    const sets: string[] = ["last_seen_at = ?"];
    const params: (string | number | null)[] = [at];
    const set = (column: string, value: string | number | null) => {
      sets.push(`${column} = ?`);
      params.push(value);
    };
    if (prefs.enabled !== undefined) set("enabled", prefs.enabled ? 1 : 0);
    if (prefs.minSeverity !== undefined) set("min_severity", prefs.minSeverity);
    if (prefs.includeOpportunities !== undefined) set("include_opportunities", prefs.includeOpportunities ? 1 : 0);
    if (prefs.pushToken !== undefined) set("push_token", prefs.pushToken);
    this.db.prepare(`UPDATE mobile_device SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    return this.device(id);
  }

  signOutSession(sessionId: string, at: string): void {
    this.db.prepare("UPDATE mobile_device SET signed_out_at = ?, session_id = NULL, push_token = NULL WHERE session_id = ?").run(at, sessionId);
  }

  devicesOf(userId: string): DeviceRecord[] {
    return (this.db.prepare("SELECT * FROM mobile_device WHERE user_id = ? AND signed_out_at IS NULL ORDER BY last_seen_at DESC").all(userId) as unknown as DeviceRow[]).map(toDevice);
  }

  summarySignals(mode: HistoryMode, accountIds: readonly string[], from: string): SummarySignalRow[] {
    if (!accountIds.length) return [];
    const rows = this.db
      .prepare(`SELECT entity_id, entity_name, account_name, metric, peak_severity, status, first_seen_at, resolved_at FROM signal WHERE mode = ? AND account_id IN (${placeholders(accountIds.length)}) AND first_seen_at >= ?`)
      .all(mode, ...accountIds, from) as Record<string, string | null>[];
    return rows.map((row) => ({
      entityId: String(row.entity_id),
      entityName: String(row.entity_name),
      accountName: String(row.account_name),
      metric: row.metric,
      peakSeverity: row.peak_severity as Severity,
      status: String(row.status),
      firstSeenAt: String(row.first_seen_at),
      resolvedAt: row.resolved_at,
    }));
  }

  summaryNotifications(mode: HistoryMode, accountIds: readonly string[], from: string): SummaryNotificationRow[] {
    if (!accountIds.length) return [];
    const rows = this.db
      .prepare(`SELECT n.created_at, MIN(r.delivered_at) AS delivered_at, MIN(r.opened_at) AS opened_at FROM notification n
        LEFT JOIN notification_receipt r ON r.notification_id = n.id
        WHERE n.mode = ? AND n.account_id IN (${placeholders(accountIds.length)}) AND n.created_at >= ? GROUP BY n.id`)
      .all(mode, ...accountIds, from) as { created_at: string; delivered_at: string | null; opened_at: string | null }[];
    return rows.map((row) => ({ createdAt: row.created_at, deliveredAt: row.delivered_at, openedAt: row.opened_at }));
  }

  summaryRuns(mode: HistoryMode, accountIds: readonly string[], from: string): { count: number; lastRunAt: string | null } {
    if (!accountIds.length) return { count: 0, lastRunAt: null };
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count, MAX(finished_at) AS last FROM evaluation_run WHERE mode = ? AND account_id IN (${placeholders(accountIds.length)}) AND started_at >= ?`)
      .get(mode, ...accountIds, from) as { count: number; last: string | null };
    return { count: Number(row.count), lastRunAt: row.last };
  }

  signals(mode: HistoryMode, accountIds: readonly string[], options: { limit: number; before?: string; severity?: Severity }): HistorySignal[] {
    if (!accountIds.length) return [];
    const params: (string | number)[] = [mode, ...accountIds];
    let where = `mode = ? AND account_id IN (${placeholders(accountIds.length)})`;
    if (options.before) {
      where += " AND first_seen_at < ?";
      params.push(options.before);
    }
    if (options.severity) {
      where += " AND peak_severity = ?";
      params.push(options.severity);
    }
    const rows = this.db.prepare(`SELECT * FROM signal WHERE ${where} ORDER BY first_seen_at DESC, signal_id LIMIT ?`).all(...params, options.limit) as Record<string, string | number | null>[];
    return rows.map((row) => ({
      signalId: String(row.signal_id),
      accountId: String(row.account_id),
      accountName: String(row.account_name),
      entityName: String(row.entity_name),
      entityType: row.entity_type === null ? null : String(row.entity_type),
      kind: String(row.kind),
      metric: row.metric === null ? null : String(row.metric),
      polarity: row.polarity as "bad" | "good",
      severity: row.severity as Severity,
      peakSeverity: row.peak_severity as Severity,
      title: String(row.title),
      summary: String(row.summary),
      status: String(row.status),
      firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at),
      resolvedAt: row.resolved_at === null ? null : String(row.resolved_at),
      observations: Number(row.observations),
    }));
  }

  /** Retention: drop old runs (their observations cascade) and old notifications (receipts cascade). Signals stay. */
  prune(before: string): { runs: number; notifications: number } {
    return transaction(this.db, () => ({
      runs: Number(this.db.prepare("DELETE FROM evaluation_run WHERE started_at < ?").run(before).changes),
      notifications: Number(this.db.prepare("DELETE FROM notification WHERE created_at < ?").run(before).changes),
    }));
  }

  counts(): Record<string, number> {
    const tables = ["evaluation_run", "signal", "signal_observation", "notification", "mobile_device", "notification_receipt"];
    return Object.fromEntries(tables.map((table) => [table, Number((this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n)]));
  }
}
