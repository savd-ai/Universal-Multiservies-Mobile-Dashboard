import { severityRank, type AlertDelivery, type AlertRoute, type AlertRouteBody } from "../contracts/alerts";
import type { SignalView } from "../contracts/anomaly";
import type { CivilDate, Severity } from "../types";

// Pure alert-routing rules: route matching, quiet hours in the route's time zone, dedupe keys with a re-notify
// window, retry backoff and digest timing. The dispatcher (server) supplies the clock, store and transport.

/** Retry delays after attempt 1, 2, 3, 4 (then give up): 1 initial send + 4 retries. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** A Retry-After header is honoured up to this long. */
const MAX_RETRY_AFTER_MS = 6 * 3_600_000;

export const IMPLICIT_ROUTE_ID = "default";

export type RouteFilter = Pick<AlertRouteBody, "enabled" | "minSeverity" | "kinds" | "metrics" | "campaignIds" | "campaignTypes">;

/** Does a route want this signal? Empty/absent filters match everything. */
export function routeMatchesSignal(route: RouteFilter, s: SignalView): boolean {
  if (!route.enabled) return false;
  if (severityRank(s.severity) < severityRank(route.minSeverity)) return false;
  if (route.kinds?.length && !route.kinds.includes(s.kind)) return false;
  if (route.metrics?.length && !(s.metric && route.metrics.includes(s.metric))) return false;
  if (route.campaignIds?.length && !(s.scope === "campaign" && route.campaignIds.includes(s.entity.id))) return false;
  if (route.campaignTypes?.length && !(s.entity.type && (route.campaignTypes as readonly string[]).includes(s.entity.type))) return false;
  return true;
}

/**
 * Window-independent identity of an issue. Signal ids embed the data window, so a continuing issue gets a new id
 * every day; dedupe keys use this instead so re-notify windows longer than a day work.
 */
export function issueKey(s: Pick<SignalView, "entity" | "kind" | "metric" | "direction" | "ruleId">): string {
  return [s.entity.id, s.kind, s.metric ?? "", s.direction ?? "", s.ruleId ?? ""].join("|").replace(/:/g, "_");
}

export type DedupeSuffix = Severity | "resolved";

/** `${routeId}:${channelId}:${issue}:${severity|resolved}` */
export function dedupeKey(routeId: string, channelId: string, s: Parameters<typeof issueKey>[0], suffix: DedupeSuffix): string {
  return `${routeId}:${channelId}:${issueKey(s)}:${suffix}`;
}

/** Deliveries that count as "already told this channel" for dedupe. */
function countsForDedupe(d: AlertDelivery, opts: { ignoreDemoSuppressed: boolean }): boolean {
  if (d.dryRun) return false;
  if (d.status === "suppressed" && d.reasonCode === "demo_mode" && opts.ignoreDemoSuppressed) return false;
  if (d.status === "suppressed" && d.reasonCode === "signals_inactive") return false;
  return true;
}

export interface DedupeIndex {
  /** latest (by ts) delivery key per `${routeId}:${channelId}:${issue}` prefix */
  latest: Map<string, { suffix: DedupeSuffix; at: number }[]>;
}

/** Index recent deliveries by dedupe prefix (newest entries first per prefix). */
export function buildDedupeIndex(deliveries: readonly AlertDelivery[], opts: { ignoreDemoSuppressed?: boolean } = {}): DedupeIndex {
  const latest = new Map<string, { suffix: DedupeSuffix; at: number }[]>();
  for (const d of deliveries) {
    if (!countsForDedupe(d, { ignoreDemoSuppressed: !!opts.ignoreDemoSuppressed })) continue;
    const at = Date.parse(d.sentAt ?? d.ts);
    for (const key of d.dedupeKeys ?? []) {
      const cut = key.lastIndexOf(":");
      if (cut < 0) continue;
      const prefix = key.slice(0, cut);
      const suffix = key.slice(cut + 1) as DedupeSuffix;
      const list = latest.get(prefix) ?? [];
      list.push({ suffix, at });
      latest.set(prefix, list);
    }
  }
  for (const list of latest.values()) list.sort((a, b) => b.at - a.at);
  return { latest };
}

/**
 * Deduped when the channel heard about this issue (at this severity or higher) within the re-notify window and
 * the issue hasn't been resolved since. Escalations and re-opened issues go out immediately.
 */
export function isDuplicate(index: DedupeIndex, routeId: string, channelId: string, s: SignalView, renotifyAfterHours: number, now: Date): boolean {
  const list = index.latest.get(`${routeId}:${channelId}:${issueKey(s)}`);
  if (!list?.length) return false;
  const windowStart = now.getTime() - renotifyAfterHours * 3_600_000;
  for (const e of list) {
    if (e.suffix === "resolved") return false;
    if (e.at < windowStart) return false;
    if (severityRank(e.suffix) >= severityRank(s.severity)) return true;
  }
  return false;
}

/** For resolved notices: only when this channel was told about the issue (and not already told it resolved). */
export function wasNotified(index: DedupeIndex, routeId: string, channelId: string, s: SignalView): boolean {
  const latest = index.latest.get(`${routeId}:${channelId}:${issueKey(s)}`)?.[0];
  return !!latest && latest.suffix !== "resolved";
}

// ── Time zones & quiet hours ─────────────────────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock reading of an instant in a time zone. */
export function localClock(tz: string, at: Date): { date: CivilDate; minutes: number; dow: number } {
  const parts = Object.fromEntries(formatter(tz).formatToParts(at).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute), dow: WEEKDAYS[parts.weekday ?? ""] ?? 0 };
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (((h ?? 0) % 24) * 60 + (m ?? 0)) % 1440;
};

export type QuietHours = NonNullable<AlertRouteBody["quietHours"]>;

/**
 * Inside quiet hours? `start === end` means all day. Windows may wrap midnight (22:00–07:00); `days` (0 = Sunday)
 * name the day a window starts on, so Friday 22:00–07:00 covers Saturday 03:00.
 */
export function inQuietHours(qh: QuietHours, at: Date): boolean {
  const { minutes: t, dow } = localClock(qh.tz, at);
  const s = toMinutes(qh.start);
  const e = toMinutes(qh.end);
  const days = qh.days?.length ? new Set(qh.days) : null;
  const on = (d: number) => !days || days.has(d);
  if (s === e) return on(dow);
  if (s < e) return t >= s && t < e && on(dow);
  if (t >= s) return on(dow);
  if (t < e) return on((dow + 6) % 7);
  return false;
}

/** The first minute after `at` that is outside quiet hours (DST-safe: re-checked after every jump). */
export function quietHoursEnd(qh: QuietHours, at: Date): Date {
  let t = new Date(Math.floor(at.getTime() / 60_000) * 60_000);
  for (let i = 0; i < 32 && inQuietHours(qh, t); i++) {
    const { minutes } = localClock(qh.tz, t);
    const e = toMinutes(qh.end);
    const delta = (e - minutes + 1440) % 1440 || 1440;
    t = new Date(t.getTime() + delta * 60_000);
  }
  return t;
}

/** When to try again after `attempts` failed sends, or null to give up. */
export function nextRetryAt(attempts: number, now: Date, retryAfterMs?: number): Date | null {
  if (attempts >= MAX_ATTEMPTS || attempts < 1) return null;
  const base = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const delay = Math.max(base, Math.min(retryAfterMs ?? 0, MAX_RETRY_AFTER_MS));
  return new Date(now.getTime() + delay);
}

/** Most important first: severity, then needs-attention before opportunities, then score. */
export function sortSignals<T extends Pick<SignalView, "severity" | "polarity" | "score">>(signals: readonly T[]): T[] {
  return [...signals].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (a.polarity === b.polarity ? 0 : a.polarity === "bad" ? -1 : 1) || b.score - a.score);
}

/** Applies while no routes exist: every enabled channel, warning and above. */
export function implicitDefaultRoute(channelIds: string[], createdAt: string): AlertRoute {
  return {
    id: IMPLICIT_ROUTE_ID,
    name: "Default — every enabled channel",
    enabled: true,
    channelIds,
    minSeverity: "warning",
    includeResolved: false,
    renotifyAfterHours: 24,
    version: 0,
    createdAt,
    updatedAt: createdAt,
    implicit: true,
  };
}

/** Is the route's daily digest due at `at` (local time reached and not yet sent for that local date)? */
export function digestDue(digest: AlertRouteBody["digest"], lastSentLocalDate: string | undefined, at: Date): { due: boolean; localDate: CivilDate } | null {
  if (!digest?.enabled || !isValidTimeZone(digest.tz)) return null;
  const { date, minutes } = localClock(digest.tz, at);
  return { due: minutes >= toMinutes(digest.time) && lastSentLocalDate !== date, localDate: date };
}
