import { describe, expect, it } from "vitest";
import type { AlertMessage } from "@/lib/domain/contracts/alerts";
import { digestDue, inQuietHours, issueKey, MAX_ATTEMPTS, nextRetryAt, quietHoursEnd, routeMatchesSignal } from "@/lib/domain/alerts/routing";
import { memoryDeliveryLog } from "@/lib/server/alerts/deliveries";
import { dispatchSignals, processDueDeliveries, retryDeliveryNow, sendTestMessage, type DispatchContext, type DispatchDeps } from "@/lib/server/alerts/dispatcher";
import type { SendResult } from "@/lib/server/alerts/send-types";
import { alertRoute, channel, signal } from "./fixtures";
const T0 = "2026-09-29T15:00:00.000Z";
type ResultFn = SendResult | ((attempt: number) => SendResult);
function harness(start = T0, initialResult: ResultFn = { ok: true, status: 200 }) {
    let now = new Date(start);
    let n = 0;
    const log = memoryDeliveryLog();
    const sent: {
        channelId: string;
        msg: AlertMessage;
    }[] = [];
    const state: {
        result: ResultFn;
    } = { result: initialResult };
    let attempt = 0;
    const deps: DispatchDeps = {
        now: () => now,
        log,
        send: async (ch, msg) => {
            sent.push({ channelId: ch.id, msg });
            attempt++;
            return typeof state.result === "function" ? state.result(attempt) : state.result;
        },
        preview: (_ch, msg) => JSON.stringify({ kind: msg.kind, n: msg.signals.length }),
        newId: () => `d${++n}`,
    };
    return {
        deps,
        log,
        sent,
        state,
        advance: (ms: number) => {
            now = new Date(now.getTime() + ms);
        },
        at: (iso: string) => {
            now = new Date(iso);
        },
    };
}
const ctx = (over: Partial<DispatchContext> = {}): DispatchContext => ({
    account: { id: "4821193307", name: "Acme Running Co." },
    mode: "live",
    dashboardUrl: "https://dash.example.com/anomalies",
    channels: [channel()],
    routes: [alertRoute()],
    ...over,
});
const H = 3600000;
describe("routing rules", () => {
    const base = alertRoute();
    it("filters by severity, kind, metric, campaign and campaign type", () => {
        expect(routeMatchesSignal(base, signal({ severity: "info" }))).toBe(false);
        expect(routeMatchesSignal({ ...base, minSeverity: "info" }, signal({ severity: "info" }))).toBe(true);
        expect(routeMatchesSignal({ ...base, kinds: ["pacing"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...base, metrics: ["ctr"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...base, metrics: ["cpa"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...base, campaignIds: ["c2"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...base, campaignIds: ["c1"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...base, campaignIds: ["c1"] }, signal({ scope: "account", entity: { id: "c1", name: "Account" } }))).toBe(false);
        expect(routeMatchesSignal({ ...base, campaignTypes: ["PMax"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...base, campaignTypes: ["Search"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...base, enabled: false }, signal())).toBe(false);
    });
    it("identifies an issue independently of the data window in the id", () => {
        expect(issueKey(signal({ id: "c1:cpa:zscore:2026-09-28" }))).toBe(issueKey(signal({ id: "c1:cpa:zscore:2026-09-29" })));
        expect(issueKey(signal())).not.toBe(issueKey(signal({ direction: "down" })));
    });
    it("evaluates quiet hours in the route's time zone, across midnight and per start day", () => {
        const qh = { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer" as const, criticalBypass: true };
        expect(inQuietHours(qh, new Date("2026-09-30T03:00:00Z"))).toBe(true);
        expect(inQuietHours(qh, new Date("2026-09-30T10:30:00Z"))).toBe(true);
        expect(inQuietHours(qh, new Date("2026-09-30T11:00:00Z"))).toBe(false);
        expect(quietHoursEnd(qh, new Date("2026-09-30T03:17:30Z")).toISOString()).toBe("2026-09-30T11:00:00.000Z");
        const fri = { ...qh, days: [5] };
        expect(inQuietHours(fri, new Date("2026-10-03T07:00:00Z"))).toBe(true);
        expect(inQuietHours(fri, new Date("2026-10-04T07:00:00Z"))).toBe(false);
        expect(inQuietHours({ ...qh, start: "00:00", end: "00:00" }, new Date(T0))).toBe(true);
    });
    it("backs off 1m → 5m → 30m → 2h, honours Retry-After, then gives up", () => {
        const now = new Date(T0);
        expect(nextRetryAt(1, now)?.getTime()).toBe(now.getTime() + 60000);
        expect(nextRetryAt(2, now)?.getTime()).toBe(now.getTime() + 5 * 60000);
        expect(nextRetryAt(3, now)?.getTime()).toBe(now.getTime() + 30 * 60000);
        expect(nextRetryAt(4, now)?.getTime()).toBe(now.getTime() + 2 * H);
        expect(nextRetryAt(MAX_ATTEMPTS, now)).toBeNull();
        expect(nextRetryAt(1, now, 120000)?.getTime()).toBe(now.getTime() + 120000);
    });
    it("knows when a digest is due in its local time", () => {
        const digest = { enabled: true, time: "08:00", tz: "America/New_York" };
        expect(digestDue(digest, undefined, new Date("2026-09-29T11:59:00Z"))?.due).toBe(false);
        expect(digestDue(digest, undefined, new Date("2026-09-29T12:00:00Z"))).toEqual({ due: true, localDate: "2026-09-29" });
        expect(digestDue(digest, "2026-09-29", new Date("2026-09-29T20:00:00Z"))?.due).toBe(false);
        expect(digestDue({ ...digest, enabled: false }, undefined, new Date(T0))).toBeNull();
    });
});
describe("dispatchSignals", () => {
    it("batches every matching signal into one message per channel", async () => {
        const h = harness();
        const signals = [signal(), signal({ id: "c2:ctr:zscore:2026-09-28", entity: { id: "c2", name: "PMax" }, metric: "ctr", severity: "warning" }), signal({ id: "c3:x", entity: { id: "c3", name: "Info" }, severity: "info" })];
        const two = ctx({ channels: [channel(), channel({ id: "ch-teams", pluginId: "teams" })], routes: [alertRoute({ channelIds: ["ch-slack", "ch-teams"] })] });
        const out = await dispatchSignals(two, { signals }, h.deps);
        expect(out.counts).toMatchObject({ candidates: 2, sent: 2, failed: 0 });
        expect(h.sent.map((s) => s.channelId).sort()).toEqual(["ch-slack", "ch-teams"]);
        expect(h.sent[0]?.msg.signals.map((s) => s.entity.id)).toEqual(["c1", "c2"]);
        expect(h.log.lines).toHaveLength(2);
        expect(h.log.lines[0]).toMatchObject({ status: "sent", attempts: 1, routeId: "rt-all", kind: "signals" });
        expect(h.log.lines[0]?.dedupeKeys?.[0]).toMatch(/^rt-all:ch-slack:c1\|metric_deviation\|cpa\|up\|:critical$/);
    });
    it("ignores disabled channels and acknowledged signals", async () => {
        const h = harness();
        await dispatchSignals(ctx({ channels: [channel({ enabled: false })] }), { signals: [signal()] }, h.deps);
        await dispatchSignals(ctx(), { signals: [signal({ status: "acknowledged" })] }, h.deps);
        expect(h.sent).toHaveLength(0);
    });
    it("dedupes within the re-notify window, across data windows, and lets escalations through", async () => {
        const h = harness();
        const warn = signal({ severity: "warning" });
        await dispatchSignals(ctx(), { signals: [warn] }, h.deps);
        h.advance(2 * H);
        const again = await dispatchSignals(ctx(), { signals: [signal({ severity: "warning", id: "c1:cpa:zscore:2026-09-29" })] }, h.deps);
        expect(again.counts).toMatchObject({ sent: 0, deduped: 1 });
        const escalated = await dispatchSignals(ctx(), { signals: [signal({ severity: "critical" })] }, h.deps);
        expect(escalated.counts.sent).toBe(1);
        h.advance(1 * H);
        const deescalated = await dispatchSignals(ctx(), { signals: [warn] }, h.deps);
        expect(deescalated.counts).toMatchObject({ sent: 0, deduped: 1 });
        h.advance(25 * H);
        const renotify = await dispatchSignals(ctx(), { signals: [warn] }, h.deps);
        expect(renotify.counts.sent).toBe(1);
        expect(h.sent).toHaveLength(3);
    });
    it("defers during quiet hours, bypasses them for critical, and sends when they end", async () => {
        const h = harness("2026-09-30T03:00:00.000Z");
        const route = alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: true } });
        const c = ctx({ routes: [route] });
        const out = await dispatchSignals(c, { signals: [signal({ severity: "warning" }), signal({ id: "c5:spend", entity: { id: "c5", name: "Shopping" }, metric: "spend" })] }, h.deps);
        expect(out.counts).toMatchObject({ sent: 1, deferred: 1 });
        expect(h.sent[0]?.msg.signals.map((s) => s.entity.id)).toEqual(["c5"]);
        const deferred = h.log.lines.find((d) => d.status === "deferred");
        expect(deferred).toMatchObject({ nextAttemptAt: "2026-09-30T11:00:00.000Z", reasonCode: "quiet_hours" });
        const again = await dispatchSignals(c, { signals: [signal({ severity: "warning" })] }, h.deps);
        expect(again.counts).toMatchObject({ deferred: 0, deduped: 1 });
        h.at("2026-09-30T10:59:00.000Z");
        expect((await processDueDeliveries(c, h.deps)).counts.retried).toBe(0);
        h.at("2026-09-30T11:00:00.000Z");
        const due = await processDueDeliveries({ ...c, currentSignals: [signal({ severity: "warning" })] }, h.deps);
        expect(due.counts).toMatchObject({ retried: 1, sent: 1 });
        expect(h.sent.at(-1)?.msg.signals.map((s) => s.entity.id)).toEqual(["c1"]);
    });
    it("drops a deferred alert that was acknowledged during quiet hours", async () => {
        const h = harness("2026-09-30T03:00:00.000Z");
        const c = ctx({ routes: [alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: false } })] });
        await dispatchSignals(c, { signals: [signal()] }, h.deps);
        h.at("2026-09-30T11:05:00.000Z");
        const due = await processDueDeliveries({ ...c, currentSignals: [signal({ status: "acknowledged" })] }, h.deps);
        expect(due.counts).toMatchObject({ retried: 1, sent: 0, suppressed: 1 });
        expect(h.sent).toHaveLength(0);
        expect(due.deliveries[0]?.reasonCode).toBe("signals_inactive");
    });
    it("suppresses (not defers) with behavior suppress", async () => {
        const h = harness("2026-09-30T03:00:00.000Z");
        const c = ctx({ routes: [alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "suppress", criticalBypass: false } })] });
        const out = await dispatchSignals(c, { signals: [signal()] }, h.deps);
        expect(out.counts).toMatchObject({ suppressed: 1, sent: 0 });
        expect(out.deliveries[0]).toMatchObject({ status: "suppressed", reasonCode: "quiet_hours" });
        expect(out.deliveries[0]?.nextAttemptAt).toBeUndefined();
    });
    it("retries failures with exponential backoff and gives up after the last attempt", async () => {
        const h = harness(T0, { ok: false, status: 503, error: "HTTP 503" });
        const out = await dispatchSignals(ctx(), { signals: [signal()] }, h.deps);
        expect(out.counts.failed).toBe(1);
        expect(h.log.lines[0]).toMatchObject({ status: "failed", attempts: 1, nextAttemptAt: "2026-09-29T15:01:00.000Z", httpStatus: 503 });
        const delays = [60000, 5 * 60000, 30 * 60000, 2 * H];
        for (const [i, d] of delays.entries()) {
            h.advance(d);
            const r = await processDueDeliveries(ctx(), h.deps);
            expect(r.counts.retried).toBe(1);
            expect(r.deliveries[0]?.attempts).toBe(i + 2);
        }
        const last = (await h.log.recent())[0];
        expect(last).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, reasonCode: "max_attempts" });
        expect(last?.nextAttemptAt).toBeUndefined();
        h.advance(24 * H);
        expect((await processDueDeliveries(ctx(), h.deps)).counts.retried).toBe(0);
    });
    it("treats 4xx (except 429) as permanent and recovers on a later retry", async () => {
        const h = harness(T0, { ok: false, status: 404, permanent: true, error: "HTTP 404" });
        await dispatchSignals(ctx(), { signals: [signal()] }, h.deps);
        expect(h.log.lines[0]?.nextAttemptAt).toBeUndefined();
        const h2 = harness(T0, (attempt) => (attempt === 1 ? { ok: false, status: 429, retryAfterMs: 120000, error: "HTTP 429" } : { ok: true, status: 200 }));
        await dispatchSignals(ctx(), { signals: [signal()] }, h2.deps);
        expect(h2.log.lines[0]?.nextAttemptAt).toBe("2026-09-29T15:02:00.000Z");
        h2.advance(120000);
        const r = await processDueDeliveries(ctx(), h2.deps);
        expect(r.deliveries[0]).toMatchObject({ status: "sent", attempts: 2 });
        expect((await h2.log.recent())[0]?.status).toBe("sent");
    });
    it("holds real sends without live data unless forced; test sends always go out", async () => {
        const h = harness();
        const demo = await dispatchSignals(ctx({ mode: "blank" }), { signals: [signal({ mode: "blank" })] }, h.deps);
        expect(demo.counts).toMatchObject({ suppressed: 1, sent: 0 });
        expect(demo.deliveries[0]?.reasonCode).toBe("no_live_data");
        expect(h.sent).toHaveLength(0);
        expect((await dispatchSignals(ctx({ mode: "blank" }), { signals: [signal({ mode: "blank" })] }, h.deps)).counts.deduped).toBe(1);
        const forced = await dispatchSignals(ctx({ mode: "blank", force: true }), { signals: [signal({ mode: "blank" })] }, h.deps);
        expect(forced.counts.sent).toBe(1);
        expect(h.sent[0]?.msg.mode).toBe("blank");
    });
    it("always sends test messages, even without live data, without auto-retry", async () => {
        const h = harness(T0, { ok: false, status: 500, error: "HTTP 500" });
        const { delivery } = await sendTestMessage(channel(), { account: { id: "1", name: "Acme" }, mode: "live", dashboardUrl: "https://x" }, h.deps);
        expect(h.sent[0]?.msg.kind).toBe("test");
        expect(delivery).toMatchObject({ kind: "test", status: "failed", attempts: 1 });
        expect(delivery.nextAttemptAt).toBeUndefined();
    });
    it("sends resolved notices only for issues this channel was told about", async () => {
        const h = harness();
        const c = ctx({ routes: [alertRoute({ includeResolved: true })] });
        await dispatchSignals(c, { signals: [signal()] }, h.deps);
        h.advance(3 * H);
        const other = signal({ id: "c7:roas", entity: { id: "c7", name: "Never told" }, metric: "roas", status: "resolved" });
        const out = await dispatchSignals(c, { signals: [], resolved: [signal({ status: "resolved" }), other] }, h.deps);
        expect(out.counts.sent).toBe(1);
        expect(h.sent.at(-1)?.msg).toMatchObject({ kind: "resolved" });
        expect(h.sent.at(-1)?.msg.signals.map((s) => s.entity.id)).toEqual(["c1"]);
        const reopened = await dispatchSignals(c, { signals: [signal()] }, h.deps);
        expect(reopened.counts.sent).toBe(1);
    });
    it("plans without sending or logging on a dry run", async () => {
        const h = harness();
        const out = await dispatchSignals(ctx({ dryRun: true }), { signals: [signal()] }, h.deps);
        expect(out.counts).toMatchObject({ pending: 1, sent: 0 });
        expect(out.deliveries[0]).toMatchObject({ status: "pending", dryRun: true });
        expect(out.deliveries[0]?.payloadPreview).toContain("signals");
        expect(h.sent).toHaveLength(0);
        expect(h.log.lines).toHaveLength(0);
    });
    it("resends a failed delivery on demand and refuses sent ones", async () => {
        const h = harness(T0, { ok: false, status: 500, error: "HTTP 500" });
        await dispatchSignals(ctx(), { signals: [signal()] }, h.deps);
        const id = h.log.lines[0]?.id as string;
        h.state.result = { ok: true, status: 200 };
        const d = await retryDeliveryNow(id, ctx(), h.deps);
        expect(d).toMatchObject({ status: "sent", attempts: 2 });
        expect(d.retryMessage).toBeUndefined();
        await expect(retryDeliveryNow(id, ctx(), h.deps)).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(retryDeliveryNow("missing", ctx(), h.deps)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("turns a throwing transport into a failed delivery", async () => {
        const h = harness();
        h.deps.send = async () => {
            throw new Error("socket hang up");
        };
        const out = await dispatchSignals(ctx(), { signals: [signal()] }, h.deps);
        expect(out.deliveries[0]).toMatchObject({ status: "failed", lastError: "socket hang up" });
        expect(out.deliveries[0]?.nextAttemptAt).toBeDefined();
    });
});
