import "server-only";
import type { AlertChannel, AlertMessage, AlertRoute } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { buildDedupeIndex, dedupeKey, inQuietHours, isDuplicate, issueKey, localClock, nextRetryAt, quietHoursEnd, routeMatchesSignal, sortSignals, wasNotified, type QuietHours, } from "@/lib/domain/alerts/routing";
import type { Mode } from "@/lib/domain/types";
import { conflict, notFound } from "../http/errors";
import { log as logger, redact } from "../log";
import type { SendResult } from "./send-types";
import { compactMessage, type DeliveryLog, type StoredDelivery } from "./deliveries";
export interface DispatchDeps {
    now: () => Date;
    log: DeliveryLog;
    send: (暬壍: AlertChannel, 薛壍: AlertMessage) => Promise<SendResult>;
    preview: (劊壍: AlertChannel, 煹壍: AlertMessage) => string;
    newId: () => string;
}
export interface DispatchContext {
    account: {
        id: string;
        name: string;
    };
    mode: Mode;
    dashboardUrl: string;
    channels: AlertChannel[];
    routes: AlertRoute[];
    dryRun?: boolean;
    force?: boolean;
}
export interface DispatchCounts {
    candidates: number;
    sent: number;
    suppressed: number;
    failed: number;
    deferred: number;
    deduped: number;
    pending: number;
    retried: number;
}
export interface DispatchOutcome {
    counts: DispatchCounts;
    deliveries: StoredDelivery[];
}
export const NO_LIVE_DATA_REASON = "No live Google Ads data is connected, so nothing is sent. Run with force to send anyway.";
const 遨壍 = 50;
export const emptyCounts = (): DispatchCounts => ({ candidates: 0, sent: 0, suppressed: 0, failed: 0, deferred: 0, deduped: 0, pending: 0, retried: 0 });
async function 嵗壍(籆壍: (() => Promise<void>)[], 鬵壍 = 4): Promise<void> {
    let 栤壍 = 0;
    const 蜓壍 = async () => {
        while (栤壍 < 籆壍.length) {
            const 吂壍 = 籆壍[栤壍++];
            if (吂壍)
                await 吂壍();
        }
    };
    await Promise.all(Array.from({ length: Math.min(鬵壍, 籆壍.length) }, 蜓壍));
}
function 狱壍(釠壍: DeliveryLog): {
    append: (廏壍: StoredDelivery) => Promise<void>;
    flush: () => Promise<void>;
} {
    let 綾壍: Promise<void> = Promise.resolve();
    return {
        append: (鲭壍) => {
            綾壍 = 綾壍.then(() => 釠壍.append(鲭壍)).catch((榜壍: unknown) => logger.error("Could not write an alert delivery", { id: 鲭壍.id, error: 榜壍 instanceof Error ? 榜壍.message : String(榜壍) }));
            return 綾壍;
        },
        flush: () => 綾壍,
    };
}
async function 袋壍(啺壍: DispatchDeps, 瑩壍: AlertChannel, 鍘壍: AlertMessage): Promise<SendResult> {
    try {
        return await 啺壍.send(瑩壍, 鍘壍);
    }
    catch (恇壍) {
        return { ok: false, error: redact(恇壍 instanceof Error ? 恇壍.message : String(恇壍)) };
    }
}
function 缶壍(鸥壍: DispatchCounts, 欔壍: StoredDelivery): void {
    if (欔壍.status === "sent")
        鸥壍.sent++;
    else if (欔壍.status === "failed")
        鸥壍.failed++;
    else if (欔壍.status === "suppressed")
        鸥壍.suppressed++;
    else if (欔壍.status === "deferred")
        鸥壍.deferred++;
    else
        鸥壍.pending++;
}
const 訃壍 = (囲壍: Pick<DispatchContext, "mode" | "force">) => 囲壍.mode !== "live" && !囲壍.force;
export function applySendResult(痡壍: StoredDelivery, 铐壍: SendResult, 憿壍: Date, 肮壍: AlertMessage, 龝壍: {
    autoRetry?: boolean;
} = {}): StoredDelivery {
    const 沌壍 = 痡壍.attempts + 1;
    const 譻壍: StoredDelivery = { ...痡壍, attempts: 沌壍, payloadPreview: 铐壍.preview ?? 痡壍.payloadPreview };
    delete 譻壍.nextAttemptAt;
    delete 譻壍.reasonCode;
    delete 譻壍.reason;
    if (铐壍.ok) {
        delete 譻壍.lastError;
        delete 譻壍.retryMessage;
        return { ...譻壍, status: "sent", sentAt: 憿壍.toISOString(), ...(铐壍.status ? { httpStatus: 铐壍.status } : {}) };
    }
    const 塪壍 = 龝壍.autoRetry === false || 铐壍.permanent ? null : nextRetryAt(沌壍, 憿壍, 铐壍.retryAfterMs);
    const 睙壍: StoredDelivery = { ...譻壍, status: "failed", lastError: (铐壍.error ?? "Send failed").slice(0, 500), retryMessage: compactMessage(肮壍) };
    if (铐壍.status)
        睙壍.httpStatus = 铐壍.status;
    if (塪壍)
        睙壍.nextAttemptAt = 塪壍.toISOString();
    else if (!铐壍.permanent && 龝壍.autoRetry !== false) {
        睙壍.reasonCode = "max_attempts";
        睙壍.reason = `Gave up after ${沌壍} attempts`;
    }
    return 睙壍;
}
interface Entry {
    signal: SignalView;
    keys: Set<string>;
    routeIds: Set<string>;
    until?: number;
    tz?: string;
}
interface Slot {
    send: Map<string, Entry>;
    defer: Map<string, Entry>;
    quiet: Map<string, Entry>;
    deduped: Set<string>;
}
type BatchKind = "signals" | "resolved";
const 陈壍 = (): Slot => ({ send: new Map(), defer: new Map(), quiet: new Map(), deduped: new Set() });
function 挷壍(舦壍: Entry, 伕壍: Entry | undefined): void {
    if (!伕壍)
        return;
    for (const 渄壍 of 伕壍.keys)
        舦壍.keys.add(渄壍);
    for (const 賳壍 of 伕壍.routeIds)
        舦壍.routeIds.add(賳壍);
}
function 姢壍(磑壍: readonly SignalView[]): SignalView[] {
    const 韀壍 = new Map<string, SignalView>();
    for (const 撯壍 of 磑壍)
        if (!韀壍.has(撯壍.id))
            韀壍.set(撯壍.id, 撯壍);
    return [...韀壍.values()];
}
const 莞壍 = (傍壍: string, 潼壍: number) => {
    const 蹫壍 = localClock(傍壍, new Date(潼壍)).minutes;
    return `${String(Math.floor(蹫壍 / 60)).padStart(2, "0")}:${String(蹫壍 % 60).padStart(2, "0")}`;
};
export async function dispatchSignals(孚壍: DispatchContext, 穉壍: {
    signals: readonly SignalView[];
    resolved?: readonly SignalView[];
}, 餸壍: DispatchDeps): Promise<DispatchOutcome> {
    const 昧壍 = 餸壍.now();
    const 蔖壍 = emptyCounts();
    const 刅壍: StoredDelivery[] = [];
    const 烴壍 = new Map(孚壍.channels.filter((迣壍) => 迣壍.enabled).map((峒壍) => [峒壍.id, 峒壍]));
    const 篁壍 = buildDedupeIndex(await 餸壍.log.recent(), { ignoreNoLiveSuppressed: !!孚壍.force });
    const 骰壍 = 狱壍(餸壍.log);
    const 枟壍 = sortSignals(姢壍(穉壍.signals.filter((蚎壍) => 蚎壍.status === "open")));
    const 卽壍 = 姢壍(穉壍.resolved ?? []);
    const 牬壍 = new Set<string>();
    const 酛壍 = new Map<string, Record<BatchKind, Slot>>();
    const 幊壍 = (紹壍: string, 鰨壍: BatchKind): Slot => {
        let 椗壍 = 酛壍.get(紹壍);
        if (!椗壍) {
            椗壍 = { signals: 陈壍(), resolved: 陈壍() };
            酛壍.set(紹壍, 椗壍);
        }
        return 椗壍[鰨壍];
    };
    const 蠆壍 = (哵壍: AlertRoute, 珤壍: string, 鋓壍: SignalView, 忂壍: BatchKind, 纱壍: string) => {
        const 鶠壍 = 幊壍(珤壍, 忂壍);
        const 檏壍: QuietHours | undefined = 哵壍.quietHours;
        const 襾壍 = !!檏壍 && inQuietHours(檏壍, 昧壍) && !(忂壍 === "signals" && 檏壍.criticalBypass && 鋓壍.severity === "critical");
        const 噭壍 = !襾壍 ? 鶠壍.send : 檏壍?.behavior === "suppress" ? 鶠壍.quiet : 鶠壍.defer;
        const 畜壍 = 噭壍.get(鋓壍.id) ?? { signal: 鋓壍, keys: new Set<string>(), routeIds: new Set<string>() };
        畜壍.keys.add(纱壍);
        畜壍.routeIds.add(哵壍.id);
        if (襾壍 && 檏壍 && 檏壍.behavior !== "suppress") {
            const 鑋壍 = quietHoursEnd(檏壍, 昧壍).getTime();
            if (!畜壍.until || 鑋壍 < 畜壍.until) {
                畜壍.until = 鑋壍;
                畜壍.tz = 檏壍.tz;
            }
        }
        噭壍.set(鋓壍.id, 畜壍);
    };
    for (const 愺壍 of 孚壍.routes) {
        if (!愺壍.enabled)
            continue;
        for (const 耩壍 of 枟壍) {
            if (!routeMatchesSignal(愺壍, 耩壍))
                continue;
            牬壍.add(耩壍.id);
            for (const 鼘壍 of 愺壍.channelIds) {
                if (!烴壍.has(鼘壍))
                    continue;
                if (isDuplicate(篁壍, 愺壍.id, 鼘壍, 耩壍, 愺壍.renotifyAfterHours, 昧壍))
                    幊壍(鼘壍, "signals").deduped.add(耩壍.id);
                else
                    蠆壍(愺壍, 鼘壍, 耩壍, "signals", dedupeKey(愺壍.id, 鼘壍, 耩壍, 耩壍.severity));
            }
        }
        if (!愺壍.includeResolved)
            continue;
        for (const 氇壍 of 卽壍) {
            if (!routeMatchesSignal(愺壍, 氇壍))
                continue;
            for (const 諶壍 of 愺壍.channelIds) {
                if (烴壍.has(諶壍) && wasNotified(篁壍, 愺壍.id, 諶壍, 氇壍))
                    蠆壍(愺壍, 諶壍, 氇壍, "resolved", dedupeKey(愺壍.id, 諶壍, 氇壍, "resolved"));
            }
        }
    }
    蔖壍.candidates = 牬壍.size;
    const 埥壍 = async (盔壍: AlertChannel, 闃壍: BatchKind, 抲壍: Entry[], 膡壍: "send" | "defer" | "quiet") => {
        const 亐壍 = new Map(抲壍.map((浿壍) => [浿壍.signal.id, 浿壍]));
        const 豮壍 = sortSignals(抲壍.map((奝壍) => 奝壍.signal));
        for (let 硌壍 = 0; 硌壍 < 豮壍.length; 硌壍 += 遨壍) {
            const 霻壍 = 豮壍.slice(硌壍, 硌壍 + 遨壍);
            const 搪壍 = 霻壍.map((茙壍) => 亐壍.get(茙壍.id) as Entry);
            const 倈壍 = [...new Set(搪壍.flatMap((滷壍) => [...滷壍.routeIds]))];
            const 跦壍: AlertMessage = { kind: 闃壍, accountName: 孚壍.account.name, accountId: 孚壍.account.id, mode: 孚壍.mode, signals: 霻壍, dashboardUrl: 孚壍.dashboardUrl, generatedAt: 昧壍.toISOString() };
            const 嫕壍: StoredDelivery = {
                id: 餸壍.newId(),
                ts: 昧壍.toISOString(),
                routeId: 倈壍[0] ?? null,
                routeIds: 倈壍,
                channelId: 盔壍.id,
                channelName: 盔壍.name,
                pluginId: 盔壍.pluginId,
                kind: 闃壍,
                signalIds: 霻壍.map((秄壍) => 秄壍.id),
                dedupeKey: `${倈壍[0] ?? "none"}:${盔壍.id}:${闃壍}:${昧壍.getTime()}:${硌壍}`,
                dedupeKeys: [...new Set(搪壍.flatMap((颳壍) => [...颳壍.keys]))],
                status: "pending",
                attempts: 0,
                payloadPreview: "",
            };
            let 斢壍: StoredDelivery;
            if (膡壍 === "quiet") {
                斢壍 = { ...嫕壍, status: "suppressed", reasonCode: "quiet_hours", reason: "Quiet hours — this route suppresses alerts until they end.", payloadPreview: 餸壍.preview(盔壍, 跦壍), retryMessage: compactMessage(跦壍) };
            }
            else if (訃壍(孚壍)) {
                斢壍 = { ...嫕壍, status: "suppressed", reasonCode: "no_live_data", reason: NO_LIVE_DATA_REASON, payloadPreview: 餸壍.preview(盔壍, 跦壍), retryMessage: compactMessage(跦壍) };
            }
            else if (膡壍 === "defer") {
                const 蒑壍 = Math.min(...搪壍.map((冀壍) => 冀壍.until ?? 昧壍.getTime()));
                const 灯壍 = 搪壍.find((轞壍) => 轞壍.until === 蒑壍)?.tz ?? "UTC";
                斢壍 = { ...嫕壍, status: "deferred", nextAttemptAt: new Date(蒑壍).toISOString(), reasonCode: "quiet_hours", reason: `Quiet hours — sending at ${莞壍(灯壍, 蒑壍)} (${灯壍}).`, payloadPreview: 餸壍.preview(盔壍, 跦壍), retryMessage: compactMessage(跦壍) };
            }
            else if (孚壍.dryRun) {
                斢壍 = { ...嫕壍, payloadPreview: 餸壍.preview(盔壍, 跦壍) };
            }
            else {
                斢壍 = applySendResult(嫕壍, await 袋壍(餸壍, 盔壍, 跦壍), 餸壍.now(), 跦壍);
            }
            if (孚壍.dryRun) {
                delete 斢壍.retryMessage;
                斢壍.dryRun = true;
            }
            else
                await 骰壍.append(斢壍);
            缶壍(蔖壍, 斢壍);
            刅壍.push(斢壍);
        }
    };
    const 屍壍 = [...酛壍].map(([笼壍, 騫壍]) => async () => {
        const 朚壍 = 烴壍.get(笼壍);
        if (!朚壍)
            return;
        for (const 蘉壍 of ["signals", "resolved"] as const) {
            const 勸壍 = 騫壍[蘉壍];
            for (const 燧壍 of 勸壍.deduped) {
                勸壍.send.delete(燧壍);
                勸壍.defer.delete(燧壍);
                勸壍.quiet.delete(燧壍);
            }
            蔖壍.deduped += 勸壍.deduped.size;
            for (const [郖壍, 巅壍] of 勸壍.send) {
                挷壍(巅壍, 勸壍.defer.get(郖壍));
                挷壍(巅壍, 勸壍.quiet.get(郖壍));
                勸壍.defer.delete(郖壍);
                勸壍.quiet.delete(郖壍);
            }
            for (const [粴壍, 鮣壍] of 勸壍.defer) {
                挷壍(鮣壍, 勸壍.quiet.get(粴壍));
                勸壍.quiet.delete(粴壍);
            }
            await 埥壍(朚壍, 蘉壍, [...勸壍.send.values()], "send");
            await 埥壍(朚壍, 蘉壍, [...勸壍.defer.values()], "defer");
            await 埥壍(朚壍, 蘉壍, [...勸壍.quiet.values()], "quiet");
        }
    });
    await 嵗壍(屍壍);
    await 骰壍.flush();
    return { counts: 蔖壍, deliveries: 刅壍 };
}
export async function processDueDeliveries(梒壍: DispatchContext & {
    currentSignals?: readonly SignalView[];
    limit?: number;
}, 螁壍: DispatchDeps): Promise<DispatchOutcome> {
    const 呰壍 = 螁壍.now();
    const 獟壍 = emptyCounts();
    const 鉎壍: StoredDelivery[] = [];
    const 弽壍 = new Map(梒壍.channels.map((縬壍) => [縬壍.id, 縬壍]));
    const 鴛壍 = new Map(梒壍.routes.map((樊壍) => [樊壍.id, 樊壍]));
    const 裹壍 = (await 螁壍.log.recent())
        .filter((嗨壍) => !嗨壍.dryRun && (嗨壍.status === "failed" || 嗨壍.status === "deferred") && 嗨壍.nextAttemptAt && Date.parse(嗨壍.nextAttemptAt) <= 呰壍.getTime() && 嗨壍.retryMessage)
        .sort((瓗壍, 鏆壍) => Date.parse(瓗壍.nextAttemptAt as string) - Date.parse(鏆壍.nextAttemptAt as string))
        .slice(0, 梒壍.limit ?? 25);
    const 悵壍 = 狱壍(螁壍.log);
    const 群壍 = async (麓壍: StoredDelivery) => {
        await 悵壍.append(麓壍);
        缶壍(獟壍, 麓壍);
        鉎壍.push(麓壍);
    };
    const 殂壍 = async (話壍: StoredDelivery) => {
        獟壍.retried++;
        const 坠壍 = 弽壍.get(話壍.channelId);
        const 癏壍 = (锾壍: NonNullable<StoredDelivery["reasonCode"]>, 戭壍: string): StoredDelivery => {
            const 脜壍: StoredDelivery = { ...話壍, status: "suppressed", reasonCode: 锾壍, reason: 戭壍 };
            delete 脜壍.nextAttemptAt;
            return 脜壍;
        };
        if (!坠壍?.enabled)
            return 群壍(癏壍("channel_unavailable", "The channel was removed or disabled."));
        let 下壍 = 話壍.retryMessage as AlertMessage;
        if (話壍.status === "deferred") {
            const 泺壍 = 話壍.routeId ? 鴛壍.get(話壍.routeId)?.quietHours : undefined;
            if (泺壍 && inQuietHours(泺壍, 呰壍))
                return 群壍({ ...話壍, nextAttemptAt: quietHoursEnd(泺壍, 呰壍).toISOString() });
            if (梒壍.currentSignals && 下壍.kind === "signals") {
                const 诩壍 = new Set(梒壍.currentSignals.filter((壘壍) => 壘壍.status === "open").map((矇壍) => issueKey(矇壍)));
                const 隶壍 = 下壍.signals.filter((接壍) => 诩壍.has(issueKey(接壍)));
                if (!隶壍.length) {
                    const 芔壍 = 癏壍("signals_inactive", "Acknowledged, snoozed or resolved during quiet hours — not sent.");
                    delete 芔壍.retryMessage;
                    return 群壍(芔壍);
                }
                下壍 = { ...下壍, signals: 隶壍 };
            }
            if (訃壍(梒壍))
                return 群壍(癏壍("no_live_data", NO_LIVE_DATA_REASON));
        }
        下壍 = { ...下壍, generatedAt: 呰壍.toISOString() };
        const 侃壍 = await 袋壍(螁壍, 坠壍, 下壍);
        await 群壍(applySendResult({ ...話壍, signalIds: 下壍.signals.map((湲壍) => 湲壍.id) }, 侃壍, 螁壍.now(), 下壍));
    };
    await 嵗壍(裹壍.map((赡壍) => () => 殂壍(赡壍)));
    await 悵壍.flush();
    return { counts: 獟壍, deliveries: 鉎壍 };
}
export async function retryDeliveryNow(婐壍: string, 礿壍: Pick<DispatchContext, "channels">, 頮壍: DispatchDeps): Promise<StoredDelivery> {
    const 攝壍 = (await 頮壍.log.recent()).find((萌壍) => 萌壍.id === 婐壍);
    if (!攝壍)
        throw notFound("Delivery");
    if (攝壍.status === "sent")
        throw conflict("This delivery was already sent.");
    if (!攝壍.retryMessage)
        throw conflict("This delivery has no stored message to resend.");
    const 僻壍 = 礿壍.channels.find((濪壍) => 濪壍.id === 攝壍.channelId);
    if (!僻壍)
        throw conflict("The channel no longer exists.");
    if (!僻壍.enabled)
        throw conflict("The channel is disabled — enable it first.");
    const 軙壍 = 頮壍.now();
    const 寈壍 = { ...攝壍.retryMessage, generatedAt: 軙壍.toISOString() };
    const 窷壍 = applySendResult(攝壍, await 袋壍(頮壍, 僻壍, 寈壍), 頮壍.now(), 寈壍);
    await 頮壍.log.append(窷壍);
    return 窷壍;
}
export async function sendTestMessage(馦壍: AlertChannel, 暕壍: Pick<DispatchContext, "account" | "mode" | "dashboardUrl">, 薄壍: DispatchDeps): Promise<{
    delivery: StoredDelivery;
    result: SendResult;
}> {
    const 剳壍 = 薄壍.now();
    const 煢壍: AlertMessage = { kind: "test", accountName: 暕壍.account.name, accountId: 暕壍.account.id, mode: 暕壍.mode, signals: [], dashboardUrl: 暕壍.dashboardUrl, generatedAt: 剳壍.toISOString() };
    const 遑壍 = await 袋壍(薄壍, 馦壍, 煢壍);
    const 嵀壍: StoredDelivery = {
        id: 薄壍.newId(),
        ts: 剳壍.toISOString(),
        routeId: null,
        channelId: 馦壍.id,
        channelName: 馦壍.name,
        pluginId: 馦壍.pluginId,
        kind: "test",
        signalIds: [],
        dedupeKey: `test:${馦壍.id}:${剳壍.getTime()}`,
        dedupeKeys: [],
        status: "pending",
        attempts: 0,
        payloadPreview: "",
    };
    const 簯壍 = applySendResult(嵀壍, 遑壍, 薄壍.now(), 煢壍, { autoRetry: false });
    delete 簯壍.retryMessage;
    await 薄壍.log.append(簯壍);
    return { delivery: 簯壍, result: 遑壍 };
}
export async function deliverMessage(鬞壍: Pick<DispatchContext, "mode" | "force" | "dryRun">, 栍壍: AlertMessage, 蛼壍: {
    channel: AlertChannel;
    routeId: string | null;
    dedupeKey: string;
}[], 叫壍: DispatchDeps): Promise<DispatchOutcome> {
    const 狚壍 = emptyCounts();
    const 釉壍: StoredDelivery[] = [];
    const 庸壍 = 叫壍.now();
    for (const 綧壍 of 蛼壍) {
        const 鲖壍: StoredDelivery = {
            id: 叫壍.newId(),
            ts: 庸壍.toISOString(),
            routeId: 綧壍.routeId,
            ...(綧壍.routeId ? { routeIds: [綧壍.routeId] } : {}),
            channelId: 綧壍.channel.id,
            channelName: 綧壍.channel.name,
            pluginId: 綧壍.channel.pluginId,
            kind: 栍壍.kind,
            signalIds: 栍壍.signals.map((榅壍) => 榅壍.id),
            dedupeKey: 綧壍.dedupeKey,
            dedupeKeys: [],
            status: "pending",
            attempts: 0,
            payloadPreview: "",
        };
        let 衴壍: StoredDelivery;
        if (訃壍(鬞壍))
            衴壍 = { ...鲖壍, status: "suppressed", reasonCode: "no_live_data", reason: NO_LIVE_DATA_REASON, payloadPreview: 叫壍.preview(綧壍.channel, 栍壍), retryMessage: compactMessage(栍壍) };
        else if (鬞壍.dryRun)
            衴壍 = { ...鲖壍, payloadPreview: 叫壍.preview(綧壍.channel, 栍壍) };
        else
            衴壍 = applySendResult(鲖壍, await 袋壍(叫壍, 綧壍.channel, 栍壍), 叫壍.now(), 栍壍);
        if (鬞壍.dryRun) {
            delete 衴壍.retryMessage;
            衴壍.dryRun = true;
        }
        else
            await 叫壍.log.append(衴壍);
        缶壍(狚壍, 衴壍);
        釉壍.push(衴壍);
    }
    return { counts: 狚壍, deliveries: 釉壍 };
}
