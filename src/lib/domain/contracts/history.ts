import { z } from "zod";
import type { Severity } from "../types";

/** Mode of a stored record: live Google Ads data, or the generated demo accounts. Never mixed in one answer. */
export type HistoryMode = "live" | "demo";
export type NotificationEvent = "new" | "escalated" | "resolved";

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

export interface NotificationItem {
  id: number;
  mode: HistoryMode;
  accountId: string;
  accountName: string;
  signalId: string;
  event: NotificationEvent;
  severity: Severity;
  polarity: "bad" | "good";
  title: string;
  body: string;
  /** Path in the web dashboard (without origin). */
  path: string;
  createdAt: string;
}

export interface NotificationFeed {
  mode: HistoryMode;
  items: NotificationItem[];
  /** Highest notification id visible to this viewer, whatever the filters: a fresh device starts from here. */
  latestId: number;
  available: boolean;
  note: string | null;
}

export const notificationFeedQuerySchema = z.object({
  since: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const notificationAckSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1).max(200),
  opened: z.boolean().optional(),
});

export const MOBILE_PLATFORMS = ["ios", "android"] as const;
export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];

export const mobileDeviceInfoSchema = z.object({
  platform: z.enum(MOBILE_PLATFORMS),
  name: z.string().trim().min(1).max(80),
  appVersion: z.string().trim().min(1).max(32),
  osVersion: z.string().trim().min(1).max(32),
});
export type MobileDeviceInfo = z.infer<typeof mobileDeviceInfoSchema>;

export const mobileDevicePrefsSchema = z.object({
  enabled: z.boolean().optional(),
  minSeverity: z.enum(["warning", "critical"]).optional(),
  includeOpportunities: z.boolean().optional(),
  /** APNs / FCM token, once the app is built with remote push credentials. */
  pushToken: z.string().trim().min(8).max(4096).nullable().optional(),
});
export type MobileDevicePrefs = z.infer<typeof mobileDevicePrefsSchema>;

export interface MobileDeviceView {
  id: string;
  platform: MobilePlatform;
  name: string;
  appVersion: string;
  osVersion: string;
  enabled: boolean;
  minSeverity: "warning" | "critical";
  includeOpportunities: boolean;
  hasPushToken: boolean;
  createdAt: string;
  lastSeenAt: string;
}

export const historySummaryQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).optional(),
  scope: z.enum(["account", "all"]).optional(),
});

export interface HistorySummary {
  mode: HistoryMode;
  available: boolean;
  note: string | null;
  scope: "account" | "all";
  accountIds: string[];
  range: { from: string; to: string };
  totals: { signals: number; critical: number; warning: number; opportunity: number; resolved: number; open: number };
  byMonth: { month: string; critical: number; warning: number; opportunity: number }[];
  byMetric: { metric: string; signals: number; critical: number }[];
  topEntities: { entityId: string; entityName: string; accountName: string; signals: number; critical: number }[];
  timeToResolveHours: { median: number | null; p90: number | null; resolved: number };
  notifications: { created: number; delivered: number; opened: number; openRate: number | null; medianMinutesToOpen: number | null };
  runs: { count: number; lastRunAt: string | null };
}

export const historySignalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().max(40).optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
});

export interface HistorySignal {
  signalId: string;
  accountId: string;
  accountName: string;
  entityName: string;
  entityType: string | null;
  kind: string;
  metric: string | null;
  polarity: "bad" | "good";
  severity: Severity;
  peakSeverity: Severity;
  title: string;
  summary: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  observations: number;
}
