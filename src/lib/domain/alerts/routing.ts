import { severityRank, type AlertDelivery, type AlertRoute, type AlertRouteBody } from "../contracts/alerts";
import type { SignalView } from "../contracts/anomaly";
import type { CivilDate, Severity } from "../types";
export const RETRY_DELAYS_MS = [60000, 5 * 60000, 30 * 60000, 2 * 3600000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const MAX_RETRY_AFTER_MS = 6 * 3600000;
export const IMPLICIT_ROUTE_ID = "default";
export type RouteFilter = Pick<AlertRouteBody, "enabled" | "minSeverity" | "kinds" | "metrics" | "campaignIds" | "campaignTypes">;
export function routeMatchesSignal(route: RouteFilter, s: SignalView): boolean {
    if (!route.enabled)
        return false;
    if (severityRank(s.severity) < severityRank(route.minSeverity))
        return false;
    if (route.kinds?.length && !route.kinds.includes(s.kind))
        return false;
    if (route.metrics?.length && !(s.metric && route.metrics.includes(s.metric)))
        return false;
    if (route.campaignIds?.length && !(s.scope === "campaign" && route.campaignIds.includes(s.entity.id)))
        return false;
    if (route.campaignTypes?.length && !(s.entity.type && (route.campaignTypes as readonly string[]).includes(s.entity.type)))
        return false;
    return true;
}
export function issueKey(s: Pick<SignalView, "entity" | "kind" | "metric" | "direction" | "ruleId">): string {
    return [s.entity.id, s.kind, s.metric ?? "", s.direction ?? "", s.ruleId ?? ""].join("|").replace(/:/g, "_");
}
export type DedupeSuffix = Severity | "resolved";
export function dedupeKey(routeId: string, channelId: string, s: Parameters<typeof issueKey>[0], suffix: DedupeSuffix): string {
    return `${routeId}:${channelId}:${issueKey(s)}:${suffix}`;
}
function countsForDedupe(d: AlertDelivery, opts: {
    ignoreNoLiveSuppressed: boolean;
}): boolean {
    if (d.dryRun)
        return false;
    if (d.status === "suppressed" && d.reasonCode === "no_live_data" && opts.ignoreNoLiveSuppressed)
        return false;
    if (d.status === "suppressed" && d.reasonCode === "signals_inactive")
        return false;
    return true;
}
export interface DedupeIndex {
    latest: Map<string, {
        suffix: DedupeSuffix;
        at: number;
    }[]>;
}
export function buildDedupeIndex(deliveries: readonly AlertDelivery[], opts: {
    ignoreNoLiveSuppressed?: boolean;
} = {}): DedupeIndex {
    const latest = new Map<string, {
        suffix: DedupeSuffix;
        at: number;
    }[]>();
    for (const d of deliveries) {
        if (!countsForDedupe(d, { ignoreNoLiveSuppressed: !!opts.ignoreNoLiveSuppressed }))
            continue;
        const at = Date.parse(d.sentAt ?? d.ts);
        for (const key of d.dedupeKeys ?? []) {
            const cut = key.lastIndexOf(":");
            if (cut < 0)
                continue;
            const prefix = key.slice(0, cut);
            const suffix = key.slice(cut + 1) as DedupeSuffix;
            const list = latest.get(prefix) ?? [];
            list.push({ suffix, at });
            latest.set(prefix, list);
        }
    }
    for (const list of latest.values())
        list.sort((a, b) => b.at - a.at);
    return { latest };
}
export function isDuplicate(index: DedupeIndex, routeId: string, channelId: string, s: SignalView, renotifyAfterHours: number, now: Date): boolean {
    const list = index.latest.get(`${routeId}:${channelId}:${issueKey(s)}`);
    if (!list?.length)
        return false;
    const windowStart = now.getTime() - renotifyAfterHours * 3600000;
    for (const e of list) {
        if (e.suffix === "resolved")
            return false;
        if (e.at < windowStart)
            return false;
        if (severityRank(e.suffix) >= severityRank(s.severity))
            return true;
    }
    return false;
}
export function wasNotified(index: DedupeIndex, routeId: string, channelId: string, s: SignalView): boolean {
    const latest = index.latest.get(`${routeId}:${channelId}:${issueKey(s)}`)?.[0];
    return !!latest && latest.suffix !== "resolved";
}
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
    }
    catch {
        return false;
    }
}
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function localClock(tz: string, at: Date): {
    date: CivilDate;
    minutes: number;
    dow: number;
} {
    const parts = Object.fromEntries(formatter(tz).formatToParts(at).map((p) => [p.type, p.value]));
    const hour = Number(parts.hour) % 24;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute), dow: WEEKDAYS[parts.weekday ?? ""] ?? 0 };
}
export const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return (((h ?? 0) % 24) * 60 + (m ?? 0)) % 1440;
};
export type QuietHours = NonNullable<AlertRouteBody["quietHours"]>;
export function inQuietHours(qh: QuietHours, at: Date): boolean {
    const { minutes: t, dow } = localClock(qh.tz, at);
    const s = toMinutes(qh.start);
    const e = toMinutes(qh.end);
    const days = qh.days?.length ? new Set(qh.days) : null;
    const on = (d: number) => !days || days.has(d);
    if (s === e)
        return on(dow);
    if (s < e)
        return t >= s && t < e && on(dow);
    if (t >= s)
        return on(dow);
    if (t < e)
        return on((dow + 6) % 7);
    return false;
}
export function quietHoursEnd(qh: QuietHours, at: Date): Date {
    let t = new Date(Math.floor(at.getTime() / 60000) * 60000);
    for (let i = 0; i < 32 && inQuietHours(qh, t); i++) {
        const { minutes } = localClock(qh.tz, t);
        const e = toMinutes(qh.end);
        const delta = (e - minutes + 1440) % 1440 || 1440;
        t = new Date(t.getTime() + delta * 60000);
    }
    return t;
}
export function nextRetryAt(attempts: number, now: Date, retryAfterMs?: number): Date | null {
    if (attempts >= MAX_ATTEMPTS || attempts < 1)
        return null;
    const base = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const delay = Math.max(base, Math.min(retryAfterMs ?? 0, MAX_RETRY_AFTER_MS));
    return new Date(now.getTime() + delay);
}
export function sortSignals<T extends Pick<SignalView, "severity" | "polarity" | "score">>(signals: readonly T[]): T[] {
    return [...signals].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (a.polarity === b.polarity ? 0 : a.polarity === "bad" ? -1 : 1) || b.score - a.score);
}
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
export function digestDue(digest: AlertRouteBody["digest"], lastSentLocalDate: string | undefined, at: Date): {
    due: boolean;
    localDate: CivilDate;
} | null {
    if (!digest?.enabled || !isValidTimeZone(digest.tz))
        return null;
    const { date, minutes } = localClock(digest.tz, at);
    return { due: minutes >= toMinutes(digest.time) && lastSentLocalDate !== date, localDate: date };
}
