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
    send: (channel: AlertChannel, msg: AlertMessage) => Promise<SendResult>;
    preview: (channel: AlertChannel, msg: AlertMessage) => string;
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
const MAX_SIGNALS_PER_MESSAGE = 50;
export const emptyCounts = (): DispatchCounts => ({ candidates: 0, sent: 0, suppressed: 0, failed: 0, deferred: 0, deduped: 0, pending: 0, retried: 0 });
async function runLimited(jobs: (() => Promise<void>)[], limit = 4): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < jobs.length) {
            const job = jobs[next++];
            if (job)
                await job();
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
}
function serialAppender(log: DeliveryLog): {
    append: (d: StoredDelivery) => Promise<void>;
    flush: () => Promise<void>;
} {
    let chain: Promise<void> = Promise.resolve();
    return {
        append: (d) => {
            chain = chain.then(() => log.append(d)).catch((err: unknown) => logger.error("Could not write an alert delivery", { id: d.id, error: err instanceof Error ? err.message : String(err) }));
            return chain;
        },
        flush: () => chain,
    };
}
async function safeSend(deps: DispatchDeps, channel: AlertChannel, msg: AlertMessage): Promise<SendResult> {
    try {
        return await deps.send(channel, msg);
    }
    catch (err) {
        return { ok: false, error: redact(err instanceof Error ? err.message : String(err)) };
    }
}
function tally(counts: DispatchCounts, d: StoredDelivery): void {
    if (d.status === "sent")
        counts.sent++;
    else if (d.status === "failed")
        counts.failed++;
    else if (d.status === "suppressed")
        counts.suppressed++;
    else if (d.status === "deferred")
        counts.deferred++;
    else
        counts.pending++;
}
const demoBlocked = (ctx: Pick<DispatchContext, "mode" | "force">) => ctx.mode !== "live" && !ctx.force;
export function applySendResult(d: StoredDelivery, res: SendResult, now: Date, msg: AlertMessage, opts: {
    autoRetry?: boolean;
} = {}): StoredDelivery {
    const attempts = d.attempts + 1;
    const base: StoredDelivery = { ...d, attempts, payloadPreview: res.preview ?? d.payloadPreview };
    delete base.nextAttemptAt;
    delete base.reasonCode;
    delete base.reason;
    if (res.ok) {
        delete base.lastError;
        delete base.retryMessage;
        return { ...base, status: "sent", sentAt: now.toISOString(), ...(res.status ? { httpStatus: res.status } : {}) };
    }
    const retryAt = opts.autoRetry === false || res.permanent ? null : nextRetryAt(attempts, now, res.retryAfterMs);
    const out: StoredDelivery = { ...base, status: "failed", lastError: (res.error ?? "Send failed").slice(0, 500), retryMessage: compactMessage(msg) };
    if (res.status)
        out.httpStatus = res.status;
    if (retryAt)
        out.nextAttemptAt = retryAt.toISOString();
    else if (!res.permanent && opts.autoRetry !== false) {
        out.reasonCode = "max_attempts";
        out.reason = `Gave up after ${attempts} attempts`;
    }
    return out;
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
const newSlot = (): Slot => ({ send: new Map(), defer: new Map(), quiet: new Map(), deduped: new Set() });
function merge(into: Entry, second: Entry | undefined): void {
    if (!second)
        return;
    for (const k of second.keys)
        into.keys.add(k);
    for (const r of second.routeIds)
        into.routeIds.add(r);
}
function uniqueById(signals: readonly SignalView[]): SignalView[] {
    const seen = new Map<string, SignalView>();
    for (const s of signals)
        if (!seen.has(s.id))
            seen.set(s.id, s);
    return [...seen.values()];
}
const hhmm = (tz: string, at: number) => {
    const m = localClock(tz, new Date(at)).minutes;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export async function dispatchSignals(ctx: DispatchContext, input: {
    signals: readonly SignalView[];
    resolved?: readonly SignalView[];
}, deps: DispatchDeps): Promise<DispatchOutcome> {
    const now = deps.now();
    const counts = emptyCounts();
    const deliveries: StoredDelivery[] = [];
    const channels = new Map(ctx.channels.filter((c) => c.enabled).map((c) => [c.id, c]));
    const index = buildDedupeIndex(await deps.log.recent(), { ignoreNoLiveSuppressed: !!ctx.force });
    const writer = serialAppender(deps.log);
    const open = sortSignals(uniqueById(input.signals.filter((s) => s.status === "open")));
    const resolved = uniqueById(input.resolved ?? []);
    const matched = new Set<string>();
    const slots = new Map<string, Record<BatchKind, Slot>>();
    const slotFor = (channelId: string, kind: BatchKind): Slot => {
        let s = slots.get(channelId);
        if (!s) {
            s = { signals: newSlot(), resolved: newSlot() };
            slots.set(channelId, s);
        }
        return s[kind];
    };
    const place = (route: AlertRoute, channelId: string, s: SignalView, kind: BatchKind, key: string) => {
        const slot = slotFor(channelId, kind);
        const qh: QuietHours | undefined = route.quietHours;
        const quiet = !!qh && inQuietHours(qh, now) && !(kind === "signals" && qh.criticalBypass && s.severity === "critical");
        const bucket = !quiet ? slot.send : qh?.behavior === "suppress" ? slot.quiet : slot.defer;
        const e = bucket.get(s.id) ?? { signal: s, keys: new Set<string>(), routeIds: new Set<string>() };
        e.keys.add(key);
        e.routeIds.add(route.id);
        if (quiet && qh && qh.behavior !== "suppress") {
            const until = quietHoursEnd(qh, now).getTime();
            if (!e.until || until < e.until) {
                e.until = until;
                e.tz = qh.tz;
            }
        }
        bucket.set(s.id, e);
    };
    for (const route of ctx.routes) {
        if (!route.enabled)
            continue;
        for (const s of open) {
            if (!routeMatchesSignal(route, s))
                continue;
            matched.add(s.id);
            for (const channelId of route.channelIds) {
                if (!channels.has(channelId))
                    continue;
                if (isDuplicate(index, route.id, channelId, s, route.renotifyAfterHours, now))
                    slotFor(channelId, "signals").deduped.add(s.id);
                else
                    place(route, channelId, s, "signals", dedupeKey(route.id, channelId, s, s.severity));
            }
        }
        if (!route.includeResolved)
            continue;
        for (const s of resolved) {
            if (!routeMatchesSignal(route, s))
                continue;
            for (const channelId of route.channelIds) {
                if (channels.has(channelId) && wasNotified(index, route.id, channelId, s))
                    place(route, channelId, s, "resolved", dedupeKey(route.id, channelId, s, "resolved"));
            }
        }
    }
    counts.candidates = matched.size;
    const emit = async (channel: AlertChannel, kind: BatchKind, entries: Entry[], how: "send" | "defer" | "quiet") => {
        const byId = new Map(entries.map((e) => [e.signal.id, e]));
        const ordered = sortSignals(entries.map((e) => e.signal));
        for (let i = 0; i < ordered.length; i += MAX_SIGNALS_PER_MESSAGE) {
            const chunk = ordered.slice(i, i + MAX_SIGNALS_PER_MESSAGE);
            const chunkEntries = chunk.map((s) => byId.get(s.id) as Entry);
            const routeIds = [...new Set(chunkEntries.flatMap((e) => [...e.routeIds]))];
            const msg: AlertMessage = { kind, accountName: ctx.account.name, accountId: ctx.account.id, mode: ctx.mode, signals: chunk, dashboardUrl: ctx.dashboardUrl, generatedAt: now.toISOString() };
            const base: StoredDelivery = {
                id: deps.newId(),
                ts: now.toISOString(),
                routeId: routeIds[0] ?? null,
                routeIds,
                channelId: channel.id,
                channelName: channel.name,
                pluginId: channel.pluginId,
                kind,
                signalIds: chunk.map((s) => s.id),
                dedupeKey: `${routeIds[0] ?? "none"}:${channel.id}:${kind}:${now.getTime()}:${i}`,
                dedupeKeys: [...new Set(chunkEntries.flatMap((e) => [...e.keys]))],
                status: "pending",
                attempts: 0,
                payloadPreview: "",
            };
            let d: StoredDelivery;
            if (how === "quiet") {
                d = { ...base, status: "suppressed", reasonCode: "quiet_hours", reason: "Quiet hours — this route suppresses alerts until they end.", payloadPreview: deps.preview(channel, msg), retryMessage: compactMessage(msg) };
            }
            else if (demoBlocked(ctx)) {
                d = { ...base, status: "suppressed", reasonCode: "no_live_data", reason: NO_LIVE_DATA_REASON, payloadPreview: deps.preview(channel, msg), retryMessage: compactMessage(msg) };
            }
            else if (how === "defer") {
                const until = Math.min(...chunkEntries.map((e) => e.until ?? now.getTime()));
                const tz = chunkEntries.find((e) => e.until === until)?.tz ?? "UTC";
                d = { ...base, status: "deferred", nextAttemptAt: new Date(until).toISOString(), reasonCode: "quiet_hours", reason: `Quiet hours — sending at ${hhmm(tz, until)} (${tz}).`, payloadPreview: deps.preview(channel, msg), retryMessage: compactMessage(msg) };
            }
            else if (ctx.dryRun) {
                d = { ...base, payloadPreview: deps.preview(channel, msg) };
            }
            else {
                d = applySendResult(base, await safeSend(deps, channel, msg), deps.now(), msg);
            }
            if (ctx.dryRun) {
                delete d.retryMessage;
                d.dryRun = true;
            }
            else
                await writer.append(d);
            tally(counts, d);
            deliveries.push(d);
        }
    };
    const jobs = [...slots].map(([channelId, kinds]) => async () => {
        const channel = channels.get(channelId);
        if (!channel)
            return;
        for (const kind of ["signals", "resolved"] as const) {
            const slot = kinds[kind];
            for (const id of slot.deduped) {
                slot.send.delete(id);
                slot.defer.delete(id);
                slot.quiet.delete(id);
            }
            counts.deduped += slot.deduped.size;
            for (const [id, e] of slot.send) {
                merge(e, slot.defer.get(id));
                merge(e, slot.quiet.get(id));
                slot.defer.delete(id);
                slot.quiet.delete(id);
            }
            for (const [id, e] of slot.defer) {
                merge(e, slot.quiet.get(id));
                slot.quiet.delete(id);
            }
            await emit(channel, kind, [...slot.send.values()], "send");
            await emit(channel, kind, [...slot.defer.values()], "defer");
            await emit(channel, kind, [...slot.quiet.values()], "quiet");
        }
    });
    await runLimited(jobs);
    await writer.flush();
    return { counts, deliveries };
}
export async function processDueDeliveries(ctx: DispatchContext & {
    currentSignals?: readonly SignalView[];
    limit?: number;
}, deps: DispatchDeps): Promise<DispatchOutcome> {
    const now = deps.now();
    const counts = emptyCounts();
    const deliveries: StoredDelivery[] = [];
    const channels = new Map(ctx.channels.map((c) => [c.id, c]));
    const routes = new Map(ctx.routes.map((r) => [r.id, r]));
    const due = (await deps.log.recent())
        .filter((d) => !d.dryRun && (d.status === "failed" || d.status === "deferred") && d.nextAttemptAt && Date.parse(d.nextAttemptAt) <= now.getTime() && d.retryMessage)
        .sort((a, b) => Date.parse(a.nextAttemptAt as string) - Date.parse(b.nextAttemptAt as string))
        .slice(0, ctx.limit ?? 25);
    const writer = serialAppender(deps.log);
    const record = async (d: StoredDelivery) => {
        await writer.append(d);
        tally(counts, d);
        deliveries.push(d);
    };
    const retryOne = async (d: StoredDelivery) => {
        counts.retried++;
        const channel = channels.get(d.channelId);
        const stop = (reasonCode: NonNullable<StoredDelivery["reasonCode"]>, reason: string): StoredDelivery => {
            const out: StoredDelivery = { ...d, status: "suppressed", reasonCode, reason };
            delete out.nextAttemptAt;
            return out;
        };
        if (!channel?.enabled)
            return record(stop("channel_unavailable", "The channel was removed or disabled."));
        let msg = d.retryMessage as AlertMessage;
        if (d.status === "deferred") {
            const qh = d.routeId ? routes.get(d.routeId)?.quietHours : undefined;
            if (qh && inQuietHours(qh, now))
                return record({ ...d, nextAttemptAt: quietHoursEnd(qh, now).toISOString() });
            if (ctx.currentSignals && msg.kind === "signals") {
                const stillOpen = new Set(ctx.currentSignals.filter((s) => s.status === "open").map((s) => issueKey(s)));
                const signals = msg.signals.filter((s) => stillOpen.has(issueKey(s)));
                if (!signals.length) {
                    const out = stop("signals_inactive", "Acknowledged, snoozed or resolved during quiet hours — not sent.");
                    delete out.retryMessage;
                    return record(out);
                }
                msg = { ...msg, signals };
            }
            if (demoBlocked(ctx))
                return record(stop("no_live_data", NO_LIVE_DATA_REASON));
        }
        msg = { ...msg, generatedAt: now.toISOString() };
        const res = await safeSend(deps, channel, msg);
        await record(applySendResult({ ...d, signalIds: msg.signals.map((s) => s.id) }, res, deps.now(), msg));
    };
    await runLimited(due.map((d) => () => retryOne(d)));
    await writer.flush();
    return { counts, deliveries };
}
export async function retryDeliveryNow(id: string, ctx: Pick<DispatchContext, "channels">, deps: DispatchDeps): Promise<StoredDelivery> {
    const d = (await deps.log.recent()).find((x) => x.id === id);
    if (!d)
        throw notFound("Delivery");
    if (d.status === "sent")
        throw conflict("This delivery was already sent.");
    if (!d.retryMessage)
        throw conflict("This delivery has no stored message to resend.");
    const channel = ctx.channels.find((c) => c.id === d.channelId);
    if (!channel)
        throw conflict("The channel no longer exists.");
    if (!channel.enabled)
        throw conflict("The channel is disabled — enable it first.");
    const now = deps.now();
    const msg = { ...d.retryMessage, generatedAt: now.toISOString() };
    const updated = applySendResult(d, await safeSend(deps, channel, msg), deps.now(), msg);
    await deps.log.append(updated);
    return updated;
}
export async function sendTestMessage(channel: AlertChannel, ctx: Pick<DispatchContext, "account" | "mode" | "dashboardUrl">, deps: DispatchDeps): Promise<{
    delivery: StoredDelivery;
    result: SendResult;
}> {
    const now = deps.now();
    const msg: AlertMessage = { kind: "test", accountName: ctx.account.name, accountId: ctx.account.id, mode: ctx.mode, signals: [], dashboardUrl: ctx.dashboardUrl, generatedAt: now.toISOString() };
    const result = await safeSend(deps, channel, msg);
    const base: StoredDelivery = {
        id: deps.newId(),
        ts: now.toISOString(),
        routeId: null,
        channelId: channel.id,
        channelName: channel.name,
        pluginId: channel.pluginId,
        kind: "test",
        signalIds: [],
        dedupeKey: `test:${channel.id}:${now.getTime()}`,
        dedupeKeys: [],
        status: "pending",
        attempts: 0,
        payloadPreview: "",
    };
    const delivery = applySendResult(base, result, deps.now(), msg, { autoRetry: false });
    delete delivery.retryMessage;
    await deps.log.append(delivery);
    return { delivery, result };
}
export async function deliverMessage(ctx: Pick<DispatchContext, "mode" | "force" | "dryRun">, msg: AlertMessage, targets: {
    channel: AlertChannel;
    routeId: string | null;
    dedupeKey: string;
}[], deps: DispatchDeps): Promise<DispatchOutcome> {
    const counts = emptyCounts();
    const deliveries: StoredDelivery[] = [];
    const now = deps.now();
    for (const t of targets) {
        const base: StoredDelivery = {
            id: deps.newId(),
            ts: now.toISOString(),
            routeId: t.routeId,
            ...(t.routeId ? { routeIds: [t.routeId] } : {}),
            channelId: t.channel.id,
            channelName: t.channel.name,
            pluginId: t.channel.pluginId,
            kind: msg.kind,
            signalIds: msg.signals.map((s) => s.id),
            dedupeKey: t.dedupeKey,
            dedupeKeys: [],
            status: "pending",
            attempts: 0,
            payloadPreview: "",
        };
        let d: StoredDelivery;
        if (demoBlocked(ctx))
            d = { ...base, status: "suppressed", reasonCode: "no_live_data", reason: NO_LIVE_DATA_REASON, payloadPreview: deps.preview(t.channel, msg), retryMessage: compactMessage(msg) };
        else if (ctx.dryRun)
            d = { ...base, payloadPreview: deps.preview(t.channel, msg) };
        else
            d = applySendResult(base, await safeSend(deps, t.channel, msg), deps.now(), msg);
        if (ctx.dryRun) {
            delete d.retryMessage;
            d.dryRun = true;
        }
        else
            await deps.log.append(d);
        tally(counts, d);
        deliveries.push(d);
    }
    return { counts, deliveries };
}
