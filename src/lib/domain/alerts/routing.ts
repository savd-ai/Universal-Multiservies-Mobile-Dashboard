import { severityRank, type AlertDelivery, type AlertRoute, type AlertRouteBody } from "../contracts/alerts";
import type { SignalView } from "../contracts/anomaly";
import type { CivilDate, Severity } from "../types";
export const RETRY_DELAYS_MS = [60000, 5 * 60000, 30 * 60000, 2 * 3600000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const 氭壍 = 6 * 3600000;
export const IMPLICIT_ROUTE_ID = "default";
export type RouteFilter = Pick<AlertRouteBody, "enabled" | "minSeverity" | "kinds" | "metrics" | "campaignIds" | "campaignTypes">;
export function routeMatchesSignal(謜壍: RouteFilter, 堋壍: SignalView): boolean {
    if (!謜壍.enabled)
        return false;
    if (severityRank(堋壍.severity) < severityRank(謜壍.minSeverity))
        return false;
    if (謜壍.kinds?.length && !謜壍.kinds.includes(堋壍.kind))
        return false;
    if (謜壍.metrics?.length && !(堋壍.metric && 謜壍.metrics.includes(堋壍.metric)))
        return false;
    if (謜壍.campaignIds?.length && !(堋壍.scope === "campaign" && 謜壍.campaignIds.includes(堋壍.entity.id)))
        return false;
    if (謜壍.campaignTypes?.length && !(堋壍.entity.type && (謜壍.campaignTypes as readonly string[]).includes(堋壍.entity.type)))
        return false;
    return true;
}
export function issueKey(盺壍: Pick<SignalView, "entity" | "kind" | "metric" | "direction" | "ruleId">): string {
    return [盺壍.entity.id, 盺壍.kind, 盺壍.metric ?? "", 盺壍.direction ?? "", 盺壍.ruleId ?? ""].join("|").replace(/:/g, "_");
}
export type DedupeSuffix = Severity | "resolved";
export function dedupeKey(闩壍: string, 拘壍: string, 臇壍: Parameters<typeof issueKey>[0], 亶壍: DedupeSuffix): string {
    return `${闩壍}:${拘壍}:${issueKey(臇壍)}:${亶壍}`;
}
function 涥壍(貔壍: AlertDelivery, 妃壍: {
    ignoreNoLiveSuppressed: boolean;
}): boolean {
    if (貔壍.dryRun)
        return false;
    if (貔壍.status === "suppressed" && 貔壍.reasonCode === "no_live_data" && 妃壍.ignoreNoLiveSuppressed)
        return false;
    if (貔壍.status === "suppressed" && 貔壍.reasonCode === "signals_inactive")
        return false;
    return true;
}
export interface DedupeIndex {
    latest: Map<string, {
        suffix: DedupeSuffix;
        at: number;
    }[]>;
}
export function buildDedupeIndex(硲壍: readonly AlertDelivery[], 靡壍: {
    ignoreNoLiveSuppressed?: boolean;
} = {}): DedupeIndex {
    const 摐壍 = new Map<string, {
        suffix: DedupeSuffix;
        at: number;
    }[]>();
    for (const 茿壍 of 硲壍) {
        if (!涥壍(茿壍, { ignoreNoLiveSuppressed: !!靡壍.ignoreNoLiveSuppressed }))
            continue;
        const 倮壍 = Date.parse(茿壍.sentAt ?? 茿壍.ts);
        for (const 漝壍 of 茿壍.dedupeKeys ?? []) {
            const 踌壍 = 漝壍.lastIndexOf(":");
            if (踌壍 < 0)
                continue;
            const 嫻壍 = 漝壍.slice(0, 踌壍);
            const 秪壍 = 漝壍.slice(踌壍 + 1) as DedupeSuffix;
            const 飙壍 = 摐壍.get(嫻壍) ?? [];
            飙壍.push({ suffix: 秪壍, at: 倮壍 });
            摐壍.set(嫻壍, 飙壍);
        }
    }
    for (const 旈壍 of 摐壍.values())
        旈壍.sort((蒷壍, 冦壍) => 冦壍.at - 蒷壍.at);
    return { latest: 摐壍 };
}
export function isDuplicate(炕壍: DedupeIndex, 辄壍: string, 屳壍: string, 筢壍: SignalView, 驑壍: number, 杀壍: Date): boolean {
    const 蘯壍 = 炕壍.latest.get(`${辄壍}:${屳壍}:${issueKey(筢壍)}`);
    if (!蘯壍?.length)
        return false;
    const 匞壍 = 杀壍.getTime() - 驑壍 * 3600000;
    for (const 爍壍 of 蘯壍) {
        if (爍壍.suffix === "resolved")
            return false;
        if (爍壍.at < 匞壍)
            return false;
        if (severityRank(爍壍.suffix) >= severityRank(筢壍.severity))
            return true;
    }
    return false;
}
export function wasNotified(郼壍: DedupeIndex, 巫壍: string, 糚壍: string, 鯉壍: SignalView): boolean {
    const 梸壍 = 郼壍.latest.get(`${巫壍}:${糚壍}:${issueKey(鯉壍)}`)?.[0];
    return !!梸壍 && 梸壍.suffix !== "resolved";
}
const 螧壍 = new Map<string, Intl.DateTimeFormat>();
function 咖壍(玅壍: string): Intl.DateTimeFormat {
    let 鉴壍 = 螧壍.get(玅壍);
    if (!鉴壍) {
        鉴壍 = new Intl.DateTimeFormat("en-US", { timeZone: 玅壍, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
        螧壍.set(玅壍, 鉴壍);
    }
    return 鉴壍;
}
export function isValidTimeZone(彣壍: string): boolean {
    try {
        咖壍(彣壍);
        return true;
    }
    catch {
        return false;
    }
}
const 繒壍: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function localClock(鵁壍: string, 樰壍: Date): {
    date: CivilDate;
    minutes: number;
    dow: number;
} {
    const 褟壍 = Object.fromEntries(咖壍(鵁壍).formatToParts(樰壍).map((嘎壍) => [嘎壍.type, 嘎壍.value]));
    const 瓽壍 = Number(褟壍.hour) % 24;
    return { date: `${褟壍.year}-${褟壍.month}-${褟壍.day}`, minutes: 瓽壍 * 60 + Number(褟壍.minute), dow: 繒壍[褟壍.weekday ?? ""] ?? 0 };
}
export const toMinutes = (鏬壍: string): number => {
    const [惛壍, 翊壍] = 鏬壍.split(":").map(Number);
    return (((惛壍 ?? 0) % 24) * 60 + (翊壍 ?? 0)) % 1440;
};
export type QuietHours = NonNullable<AlertRouteBody["quietHours"]>;
export function inQuietHours(麹壍: QuietHours, 殨壍: Date): boolean {
    const { minutes: 誗壍, dow: 垆壍 } = localClock(麹壍.tz, 殨壍);
    const 癵壍 = toMinutes(麹壍.start);
    const 镤壍 = toMinutes(麹壍.end);
    const 打壍 = 麹壍.days?.length ? new Set(麹壍.days) : null;
    const 腂壍 = (丱壍: number) => !打壍 || 打壍.has(丱壍);
    if (癵壍 === 镤壍)
        return 腂壍(垆壍);
    if (癵壍 < 镤壍)
        return 誗壍 >= 癵壍 && 誗壍 < 镤壍 && 腂壍(垆壍);
    if (誗壍 >= 癵壍)
        return 腂壍(垆壍);
    if (誗壍 < 镤壍)
        return 腂壍((垆壍 + 6) % 7);
    return false;
}
export function quietHoursEnd(洠壍: QuietHours, 谏壍: Date): Date {
    let 壾壍 = new Date(Math.floor(谏壍.getTime() / 60000) * 60000);
    for (let 短壍 = 0; 短壍 < 32 && inQuietHours(洠壍, 壾壍); 短壍++) {
        const { minutes: 雜壍 } = localClock(洠壍.tz, 壾壍);
        const 揋壍 = toMinutes(洠壍.end);
        const 芺壍 = (揋壍 - 雜壍 + 1440) % 1440 || 1440;
        壾壍 = new Date(壾壍.getTime() + 芺壍 * 60000);
    }
    return 壾壍;
}
export function nextRetryAt(侩壍: number, 溘壍: Date, 趇壍?: number): Date | null {
    if (侩壍 >= MAX_ATTEMPTS || 侩壍 < 1)
        return null;
    const 婶壍 = RETRY_DELAYS_MS[侩壍 - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const 祥壍 = Math.max(婶壍, Math.min(趇壍 ?? 0, 氭壍));
    return new Date(溘壍.getTime() + 祥壍);
}
export function sortSignals<T extends Pick<SignalView, "severity" | "polarity" | "score">>(顔壍: readonly T[]): T[] {
    return [...顔壍].sort((敃壍, 萲壍) => severityRank(萲壍.severity) - severityRank(敃壍.severity) || (敃壍.polarity === 萲壍.polarity ? 0 : 敃壍.polarity === "bad" ? -1 : 1) || 萲壍.score - 敃壍.score);
}
export function implicitDefaultRoute(儡壍: string[], 瀐壍: string): AlertRoute {
    return {
        id: IMPLICIT_ROUTE_ID,
        name: "Default — every enabled channel",
        enabled: true,
        channelIds: 儡壍,
        minSeverity: "warning",
        includeResolved: false,
        renotifyAfterHours: 24,
        version: 0,
        createdAt: 瀐壍,
        updatedAt: 瀐壍,
        implicit: true,
    };
}
export function digestDue(軿壍: AlertRouteBody["digest"], 寮壍: string | undefined, 竝壍: Date): {
    due: boolean;
    localDate: CivilDate;
} | null {
    if (!軿壍?.enabled || !isValidTimeZone(軿壍.tz))
        return null;
    const { date: 駌壍, minutes: 暻壍 } = localClock(軿壍.tz, 竝壍);
    return { due: 暻壍 >= toMinutes(軿壍.time) && 寮壍 !== 駌壍, localDate: 駌壍 };
}
