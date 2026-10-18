import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "./api";
import { loadCursor, loadPrefs, saveCursor, type NotificationPrefs, type StoredSession } from "./storage";
import type { NotificationFeed, NotificationItem } from "./types";

/**
 * How an anomaly reaches the phone:
 *   server evaluation (scheduler / cron / "Evaluate now") → history DB `notification` rows → this inbox sync
 *   (foreground every minute, background every ≥15 min via expo-background-task) → a local notification.
 * The inbox is pull-based so it works without Apple/Google push credentials; remote push (APNs/FCM) can later wake
 * the same sync. A fresh install starts at the newest id instead of replaying the backlog, and a burst of signals
 * becomes one summary notification instead of a buzzing phone.
 */
export const CHANNELS = {
  critical: { id: "critical", name: "Critical signals", importance: Notifications.AndroidImportance.HIGH },
  signals: { id: "signals", name: "Warnings and opportunities", importance: Notifications.AndroidImportance.DEFAULT },
  resolved: { id: "resolved", name: "Back to normal", importance: Notifications.AndroidImportance.LOW },
} as const;

/** More than this many new items in one sync → one summary notification. */
export const BURST_LIMIT = 3;

export interface SignalNotificationData extends Record<string, unknown> {
  kind: "signal" | "summary";
  notificationIds: number[];
  signalId?: string;
  accountId?: string;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Partial<SignalNotificationData> & { severity?: string };
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: data.severity === "critical", shouldSetBadge: true };
  },
});

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  for (const channel of Object.values(CHANNELS)) {
    await Notifications.setNotificationChannelAsync(channel.id, { name: channel.name, importance: channel.importance, lightColor: "#04bf9d" });
  }
}

export async function permissionState(): Promise<"granted" | "denied" | "undetermined"> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return settings.canAskAgain ? "undetermined" : "denied";
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannels();
  const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

const channelFor = (item: NotificationItem) => (item.event === "resolved" ? CHANNELS.resolved.id : item.severity === "critical" && item.polarity === "bad" ? CHANNELS.critical.id : CHANNELS.signals.id);

/** The device's own filter, applied again here so a change in Settings takes effect before the server knows. */
export function wanted(item: NotificationItem, prefs: NotificationPrefs): boolean {
  if (item.polarity === "good") return prefs.includeOpportunities;
  return prefs.minSeverity === "critical" ? item.severity === "critical" : item.severity !== "info";
}

/** What to show for a batch (oldest first). Pure, so the copy and the burst rule are easy to reason about. */
export function present(items: NotificationItem[]): { title: string; body: string; data: SignalNotificationData; channelId: string; severity: string }[] {
  if (!items.length) return [];
  const demo = items[0]!.mode === "demo" ? "Demo · " : "";
  if (items.length <= BURST_LIMIT) {
    return items.map((item) => ({
      title: `${demo}${item.title}`,
      body: `${item.accountName} — ${item.body}`,
      channelId: channelFor(item),
      severity: item.severity,
      data: { kind: "signal", notificationIds: [item.id], signalId: item.signalId, accountId: item.accountId },
    }));
  }
  const critical = items.filter((item) => item.severity === "critical" && item.polarity === "bad" && item.event !== "resolved").length;
  const accounts = [...new Set(items.map((item) => item.accountName))];
  const where = accounts.length === 1 ? accounts[0]! : `${accounts.length} accounts`;
  const headline = critical ? `${critical} critical of ${items.length} new signals` : `${items.length} new signals`;
  const top = items.filter((item) => item.event !== "resolved").slice(-2).reverse().map((item) => item.title.replace(/^[^·]+·\s*/, ""));
  return [
    {
      title: `${demo}${headline} · ${where}`,
      body: top.length ? `${top.join(" · ")}${items.length > top.length ? " …" : ""}` : "Open the app to see them.",
      channelId: critical ? CHANNELS.critical.id : CHANNELS.signals.id,
      severity: critical ? "critical" : "warning",
      data: { kind: "summary", notificationIds: items.map((item) => item.id) },
    },
  ];
}

export interface SyncResult {
  shown: number;
  received: number;
  firstRun: boolean;
  note: string | null;
}

/** Fetch the inbox since the stored cursor and show what's new. Safe to call from the background task. */
export async function syncInbox(session: StoredSession, options: { prefs?: NotificationPrefs } = {}): Promise<SyncResult> {
  const prefs = options.prefs ?? (await loadPrefs());
  const scope = `${session.server}|${session.user.email}`;
  const cursor = await loadCursor(scope);
  const credentials = { server: session.server, token: session.token };
  if (cursor === null) {
    const feed = await apiRequest<NotificationFeed>(credentials, "/api/mobile/notifications?limit=1");
    await saveCursor(scope, feed.latestId);
    return { shown: 0, received: 0, firstRun: true, note: feed.note };
  }
  const feed = await apiRequest<NotificationFeed>(credentials, `/api/mobile/notifications?since=${cursor}&limit=50`);
  await saveCursor(scope, Math.max(cursor, feed.latestId, ...feed.items.map((item) => item.id)));
  if (!prefs.enabled) return { shown: 0, received: feed.items.length, firstRun: false, note: "Notifications are off in Settings." };
  const fresh = feed.items.filter((item) => wanted(item, prefs)).sort((a, b) => a.id - b.id);
  const toShow = present(fresh);
  if (toShow.length && (await permissionState()) === "granted") {
    await ensureChannels();
    for (const notification of toShow) {
      await Notifications.scheduleNotificationAsync({
        content: { title: notification.title, body: notification.body, data: { ...notification.data, severity: notification.severity }, sound: notification.severity === "critical" ? "default" : undefined },
        trigger: Platform.OS === "android" ? { channelId: notification.channelId } : null,
      });
    }
  }
  return { shown: toShow.length, received: feed.items.length, firstRun: false, note: feed.note };
}

/** Tell the server a notification was opened (feeds the open-rate and time-to-open in History). */
export async function markOpened(session: StoredSession, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await apiRequest(session, "/api/mobile/notifications/ack", { body: { ids: ids.slice(0, 200), opened: true } }).catch(() => undefined);
}

export async function sendTestNotification(): Promise<boolean> {
  if ((await permissionState()) !== "granted" && !(await requestPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Test · Notifications work", body: "This is what a signal looks like when the dashboard spots an anomaly.", data: { kind: "summary", notificationIds: [] } },
    trigger: Platform.OS === "android" ? { channelId: CHANNELS.signals.id } : null,
  });
  return true;
}
