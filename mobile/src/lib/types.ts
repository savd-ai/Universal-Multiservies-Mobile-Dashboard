/** Shapes of the dashboard API the app reads (mirrors src/lib/domain/contracts/{mobile,history,anomaly}.ts). */
export type Severity = "critical" | "warning" | "info";

export interface Kpis {
  cost: number;
  conversions: number;
  convValue: number;
  clicks: number;
  impressions: number;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
}

export interface MobileSignal {
  id: string;
  title: string;
  summary: string;
  recommendation: string;
  entityName: string;
  entityType: string | null;
  severity: Severity;
  polarity: "bad" | "good";
  status: string;
  observed: number;
  expected: number;
  changePct: number;
  format: string;
  firstSeenAt: string | null;
  evidence: { label: string; value: string }[];
  series: { date: string; value: number | null }[];
}

export interface Overview {
  account: { id: string; name: string; currency: string; timezone: string };
  accounts: { id: string; name: string }[];
  mode: "live" | "blank";
  demo: boolean;
  reasonText: string | null;
  dataThrough: string;
  range: { preset: RangePreset; start: string; end: string; compareStart: string | null; compareEnd: string | null };
  kpis: Kpis;
  previous: Kpis | null;
  daily: { date: string; cost: number; conversions: number }[];
  pacing: { monthLabel: string; mtdSpend: number; projected: number; target: number; ratio: number | null; overpacing: number; underpacing: number } | null;
  signals: { critical: number; warning: number; opportunity: number; top: MobileSignal[] };
}

export type RangePreset = "last_7d" | "last_14d" | "last_30d" | "mtd";

/** A signal as /api/anomalies returns it (SignalView). Only the fields the app shows. */
export interface SignalView {
  id: string;
  accountId: string;
  entity: { id: string; name: string; type?: string };
  kind: string;
  metric?: string;
  polarity: "bad" | "good";
  severity: Severity;
  observed: number;
  expected: number;
  changePct: number;
  band?: { lo: number; hi: number };
  series: { date: string; value: number | null }[];
  title: string;
  summary: string;
  recommendation: string;
  evidence: { label: string; value: string }[];
  format: "money" | "number" | "decimal" | "percent" | "ratio";
  status: "open" | "acknowledged" | "snoozed" | "resolved";
  firstSeenAt?: string;
  window: { recentStart: string; recentEnd: string; baselineStart?: string; baselineEnd?: string };
  changeContext?: { verdict: string; note: string; lagDays?: number };
}

export interface AnomalyFeed {
  signals: SignalView[];
  counts: { all: number; critical: number; warning: number; info: number };
}

export interface NotificationItem {
  id: number;
  mode: "live" | "demo";
  accountId: string;
  accountName: string;
  signalId: string;
  event: "new" | "escalated" | "resolved";
  severity: Severity;
  polarity: "bad" | "good";
  title: string;
  body: string;
  path: string;
  createdAt: string;
}

export interface NotificationFeed {
  mode: "live" | "demo";
  items: NotificationItem[];
  latestId: number;
  available: boolean;
  note: string | null;
}

export interface MobileDevice {
  id: string;
  platform: "ios" | "android";
  name: string;
  enabled: boolean;
  minSeverity: "warning" | "critical";
  includeOpportunities: boolean;
  hasPushToken: boolean;
  lastSeenAt: string;
}

export interface HistorySummary {
  mode: "live" | "demo";
  available: boolean;
  note: string | null;
  scope: "account" | "all";
  range: { from: string; to: string };
  totals: { signals: number; critical: number; warning: number; opportunity: number; resolved: number; open: number };
  byMonth: { month: string; critical: number; warning: number; opportunity: number }[];
  byMetric: { metric: string; signals: number; critical: number }[];
  topEntities: { entityId: string; entityName: string; accountName: string; signals: number; critical: number }[];
  timeToResolveHours: { median: number | null; p90: number | null; resolved: number };
  notifications: { created: number; delivered: number; opened: number; openRate: number | null; medianMinutesToOpen: number | null };
  runs: { count: number; lastRunAt: string | null };
}

export interface HistorySignal {
  signalId: string;
  accountName: string;
  entityName: string;
  polarity: "bad" | "good";
  peakSeverity: Severity;
  title: string;
  status: string;
  firstSeenAt: string;
  resolvedAt: string | null;
  observations: number;
}

export type LoginResponse =
  | { ok: true; token: string; expiresAt: string; deviceId: string | null; user: { name: string; email: string; role: string } }
  | { ok: false; mfa: { challenge: string } };
