import "server-only";
import type { MobileDevicePrefs, MobileDeviceView, NotificationFeed } from "@/lib/domain/contracts/history";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { getHistory, historyMode, historyUnavailableReason } from "../history";
import type { DeviceRecord } from "../history/repo";
import { AppError } from "../http/errors";
import type { Principal } from "../scope";

const visibleAccountIds = (ctx: RequestContext) => ctx.accounts.filter((account) => !account.isManager).map((account) => account.id);

function deviceOf(principal: Principal): DeviceRecord | null {
  if (!principal.sessionId) return null;
  return getHistory()?.deviceForSession(principal.sessionId) ?? null;
}

function publicDevice(device: DeviceRecord): MobileDeviceView {
  const { userId: _userId, sessionId: _sessionId, ...view } = device;
  return view;
}

/**
 * The phone's inbox: notifications for every account this person can open (same rule as the web app), newer than
 * `since`, filtered by the device's settings, newest first. Fetching marks them delivered for this device, which is
 * what the delivery and open rates in the history summary count.
 */
export function notificationFeed(ctx: RequestContext, principal: Principal, options: { since?: number; limit?: number }): NotificationFeed {
  const history = getHistory();
  const mode = historyMode(ctx.source);
  if (!history) return { mode, items: [], latestId: 0, available: false, note: historyUnavailableReason() };
  const accounts = visibleAccountIds(ctx);
  const device = deviceOf(principal);
  const latestId = history.latestNotificationId(mode, accounts);
  if (device && !device.enabled) return { mode, items: [], latestId, available: true, note: "Notifications are turned off for this device." };
  const items = history.notifications(mode, accounts, {
    since: options.since ?? 0,
    limit: options.limit ?? 50,
    filter: device ? { minSeverity: device.minSeverity, includeOpportunities: device.includeOpportunities } : undefined,
  });
  if (device) {
    const at = now().toISOString();
    history.touchDevice(device.id, at);
    if (items.length) history.markReceipts(device.id, mode, accounts, items.map((item) => item.id), at, false);
  }
  return { mode, items, latestId, available: true, note: null };
}

export function acknowledgeNotifications(ctx: RequestContext, principal: Principal, ids: number[], opened: boolean): { updated: number } {
  const history = getHistory();
  const device = deviceOf(principal);
  if (!history || !device) return { updated: 0 };
  return { updated: history.markReceipts(device.id, historyMode(ctx.source), visibleAccountIds(ctx), ids, now().toISOString(), opened) };
}

export function currentDevice(principal: Principal): MobileDeviceView | null {
  const device = deviceOf(principal);
  return device ? publicDevice(device) : null;
}

export function updateCurrentDevice(principal: Principal, prefs: MobileDevicePrefs): MobileDeviceView {
  const device = deviceOf(principal);
  if (!device) throw new AppError("NOT_FOUND", "This session has no mobile device. Sign in from the app.");
  const updated = getHistory()!.updateDevice(device.id, prefs, now().toISOString());
  return publicDevice(updated!);
}
