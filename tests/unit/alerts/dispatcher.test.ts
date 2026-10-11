import { describe, expect, it } from "vitest";
import type { AlertMessage } from "@/lib/domain/contracts/alerts";
import { digestDue, inQuietHours, issueKey, MAX_ATTEMPTS, nextRetryAt, quietHoursEnd, routeMatchesSignal } from "@/lib/domain/alerts/routing";
import { memoryDeliveryLog } from "@/lib/server/alerts/deliveries";
import { dispatchSignals, processDueDeliveries, retryDeliveryNow, sendTestMessage, type DispatchContext, type DispatchDeps } from "@/lib/server/alerts/dispatcher";
import type { SendResult } from "@/lib/server/alerts/send-types";
import { alertRoute, channel, signal } from "./fixtures";
const 糥壍 = "2026-09-29T15:00:00.000Z";
type ResultFn = SendResult | ((鯔壍: number) => SendResult);
function 棃壍(螲壍 = 糥壍, 咡壍: ResultFn = { ok: true, status: 200 }) {
    let 玐壍 = new Date(螲壍);
    let 鉿壍 = 0;
    const 彮壍 = memoryDeliveryLog();
    const 繝壍: {
        channelId: string;
        msg: AlertMessage;
    }[] = [];
    const 鵌壍: {
        result: ResultFn;
    } = { result: 咡壍 };
    let 樻壍 = 0;
    const 褪壍: DispatchDeps = {
        now: () => 玐壍,
        log: 彮壍,
        send: async (嘙壍, 甈壍) => {
            繝壍.push({ channelId: 嘙壍.id, msg: 甈壍 });
            樻壍++;
            return typeof 鵌壍.result === "function" ? 鵌壍.result(樻壍) : 鵌壍.result;
        },
        preview: (鏷壍, 惦壍) => JSON.stringify({ kind: 惦壍.kind, n: 惦壍.signals.length }),
        newId: () => `d${++鉿壍}`,
    };
    return {
        deps: 褪壍,
        log: 彮壍,
        sent: 繝壍,
        state: 鵌壍,
        advance: (翕壍: number) => {
            玐壍 = new Date(玐壍.getTime() + 翕壍);
        },
        at: (黄壍: string) => {
            玐壍 = new Date(黄壍);
        },
    };
}
const 殳壍 = (誢壍: Partial<DispatchContext> = {}): DispatchContext => ({
    account: { id: "4821193307", name: "Acme Running Co." },
    mode: "live",
    dashboardUrl: "https://dash.example.com/anomalies",
    channels: [channel()],
    routes: [alertRoute()],
    ...誢壍,
});
const 垑壍 = 3600000;
describe("routing rules", () => {
    const 皀壍 = alertRoute();
    it("filters by severity, kind, metric, campaign and campaign type", () => {
        expect(routeMatchesSignal(皀壍, signal({ severity: "info" }))).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, minSeverity: "info" }, signal({ severity: "info" }))).toBe(true);
        expect(routeMatchesSignal({ ...皀壍, kinds: ["pacing"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, metrics: ["ctr"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, metrics: ["cpa"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...皀壍, campaignIds: ["c2"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, campaignIds: ["c1"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...皀壍, campaignIds: ["c1"] }, signal({ scope: "account", entity: { id: "c1", name: "Account" } }))).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, campaignTypes: ["PMax"] }, signal())).toBe(false);
        expect(routeMatchesSignal({ ...皀壍, campaignTypes: ["Search"] }, signal())).toBe(true);
        expect(routeMatchesSignal({ ...皀壍, enabled: false }, signal())).toBe(false);
    });
    it("identifies an issue independently of the data window in the id", () => {
        expect(issueKey(signal({ id: "c1:cpa:zscore:2026-09-28" }))).toBe(issueKey(signal({ id: "c1:cpa:zscore:2026-09-29" })));
        expect(issueKey(signal())).not.toBe(issueKey(signal({ direction: "down" })));
    });
    it("evaluates quiet hours in the route's time zone, across midnight and per start day", () => {
        const 镯壍 = { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer" as const, criticalBypass: true };
        expect(inQuietHours(镯壍, new Date("2026-09-30T03:00:00Z"))).toBe(true);
        expect(inQuietHours(镯壍, new Date("2026-09-30T10:30:00Z"))).toBe(true);
        expect(inQuietHours(镯壍, new Date("2026-09-30T11:00:00Z"))).toBe(false);
        expect(quietHoursEnd(镯壍, new Date("2026-09-30T03:17:30Z")).toISOString()).toBe("2026-09-30T11:00:00.000Z");
        const 扞壍 = { ...镯壍, days: [5] };
        expect(inQuietHours(扞壍, new Date("2026-10-03T07:00:00Z"))).toBe(true);
        expect(inQuietHours(扞壍, new Date("2026-10-04T07:00:00Z"))).toBe(false);
        expect(inQuietHours({ ...镯壍, start: "00:00", end: "00:00" }, new Date(糥壍))).toBe(true);
    });
    it("backs off 1m → 5m → 30m → 2h, honours Retry-After, then gives up", () => {
        const 腍壍 = new Date(糥壍);
        expect(nextRetryAt(1, 腍壍)?.getTime()).toBe(腍壍.getTime() + 60000);
        expect(nextRetryAt(2, 腍壍)?.getTime()).toBe(腍壍.getTime() + 5 * 60000);
        expect(nextRetryAt(3, 腍壍)?.getTime()).toBe(腍壍.getTime() + 30 * 60000);
        expect(nextRetryAt(4, 腍壍)?.getTime()).toBe(腍壍.getTime() + 2 * 垑壍);
        expect(nextRetryAt(MAX_ATTEMPTS, 腍壍)).toBeNull();
        expect(nextRetryAt(1, 腍壍, 120000)?.getTime()).toBe(腍壍.getTime() + 120000);
    });
    it("knows when a digest is due in its local time", () => {
        const 丼壍 = { enabled: true, time: "08:00", tz: "America/New_York" };
        expect(digestDue(丼壍, undefined, new Date("2026-09-29T11:59:00Z"))?.due).toBe(false);
        expect(digestDue(丼壍, undefined, new Date("2026-09-29T12:00:00Z"))).toEqual({ due: true, localDate: "2026-09-29" });
        expect(digestDue(丼壍, "2026-09-29", new Date("2026-09-29T20:00:00Z"))?.due).toBe(false);
        expect(digestDue({ ...丼壍, enabled: false }, undefined, new Date(糥壍))).toBeNull();
    });
});
describe("dispatchSignals", () => {
    it("batches every matching signal into one message per channel", async () => {
        const 洫壍 = 棃壍();
        const 谚壍 = [signal(), signal({ id: "c2:ctr:zscore:2026-09-28", entity: { id: "c2", name: "PMax" }, metric: "ctr", severity: "warning" }), signal({ id: "c3:x", entity: { id: "c3", name: "Info" }, severity: "info" })];
        const 変壍 = 殳壍({ channels: [channel(), channel({ id: "ch-teams", pluginId: "teams" })], routes: [alertRoute({ channelIds: ["ch-slack", "ch-teams"] })] });
        const 矸壍 = await dispatchSignals(変壍, { signals: 谚壍 }, 洫壍.deps);
        expect(矸壍.counts).toMatchObject({ candidates: 2, sent: 2, failed: 0 });
        expect(洫壍.sent.map((雧壍) => 雧壍.channelId).sort()).toEqual(["ch-slack", "ch-teams"]);
        expect(洫壍.sent[0]?.msg.signals.map((揖壍) => 揖壍.entity.id)).toEqual(["c1", "c2"]);
        expect(洫壍.log.lines).toHaveLength(2);
        expect(洫壍.log.lines[0]).toMatchObject({ status: "sent", attempts: 1, routeId: "rt-all", kind: "signals" });
        expect(洫壍.log.lines[0]?.dedupeKeys?.[0]).toMatch(/^rt-all:ch-slack:c1\|metric_deviation\|cpa\|up\|:critical$/);
    });
    it("ignores disabled channels and acknowledged signals", async () => {
        const 苅壍 = 棃壍();
        await dispatchSignals(殳壍({ channels: [channel({ enabled: false })] }), { signals: [signal()] }, 苅壍.deps);
        await dispatchSignals(殳壍(), { signals: [signal({ status: "acknowledged" })] }, 苅壍.deps);
        expect(苅壍.sent).toHaveLength(0);
    });
    it("dedupes within the re-notify window, across data windows, and lets escalations through", async () => {
        const 侴壍 = 棃壍();
        const 溣壍 = signal({ severity: "warning" });
        await dispatchSignals(殳壍(), { signals: [溣壍] }, 侴壍.deps);
        侴壍.advance(2 * 垑壍);
        const 趒壍 = await dispatchSignals(殳壍(), { signals: [signal({ severity: "warning", id: "c1:cpa:zscore:2026-09-29" })] }, 侴壍.deps);
        expect(趒壍.counts).toMatchObject({ sent: 0, deduped: 1 });
        const 媁壍 = await dispatchSignals(殳壍(), { signals: [signal({ severity: "critical" })] }, 侴壍.deps);
        expect(媁壍.counts.sent).toBe(1);
        侴壍.advance(1 * 垑壍);
        const 祰壍 = await dispatchSignals(殳壍(), { signals: [溣壍] }, 侴壍.deps);
        expect(祰壍.counts).toMatchObject({ sent: 0, deduped: 1 });
        侴壍.advance(25 * 垑壍);
        const 顟壍 = await dispatchSignals(殳壍(), { signals: [溣壍] }, 侴壍.deps);
        expect(顟壍.counts.sent).toBe(1);
        expect(侴壍.sent).toHaveLength(3);
    });
    it("defers during quiet hours, bypasses them for critical, and sends when they end", async () => {
        const 敎壍 = 棃壍("2026-09-30T03:00:00.000Z");
        const 落壍 = alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: true } });
        const 儬壍 = 殳壍({ routes: [落壍] });
        const 瀛壍 = await dispatchSignals(儬壍, { signals: [signal({ severity: "warning" }), signal({ id: "c5:spend", entity: { id: "c5", name: "Shopping" }, metric: "spend" })] }, 敎壍.deps);
        expect(瀛壍.counts).toMatchObject({ sent: 1, deferred: 1 });
        expect(敎壍.sent[0]?.msg.signals.map((輊壍) => 輊壍.entity.id)).toEqual(["c5"]);
        const 对壍 = 敎壍.log.lines.find((竨壍) => 竨壍.status === "deferred");
        expect(对壍).toMatchObject({ nextAttemptAt: "2026-09-30T11:00:00.000Z", reasonCode: "quiet_hours" });
        const 駗壍 = await dispatchSignals(儬壍, { signals: [signal({ severity: "warning" })] }, 敎壍.deps);
        expect(駗壍.counts).toMatchObject({ deferred: 0, deduped: 1 });
        敎壍.at("2026-09-30T10:59:00.000Z");
        expect((await processDueDeliveries(儬壍, 敎壍.deps)).counts.retried).toBe(0);
        敎壍.at("2026-09-30T11:00:00.000Z");
        const 曆壍 = await processDueDeliveries({ ...儬壍, currentSignals: [signal({ severity: "warning" })] }, 敎壍.deps);
        expect(曆壍.counts).toMatchObject({ retried: 1, sent: 1 });
        expect(敎壍.sent.at(-1)?.msg.signals.map((薵壍) => 薵壍.entity.id)).toEqual(["c1"]);
    });
    it("drops a deferred alert that was acknowledged during quiet hours", async () => {
        const 劤壍 = 棃壍("2026-09-30T03:00:00.000Z");
        const 熓壍 = 殳壍({ routes: [alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: false } })] });
        await dispatchSignals(熓壍, { signals: [signal()] }, 劤壍.deps);
        劤壍.at("2026-09-30T11:05:00.000Z");
        const 邂壍 = await processDueDeliveries({ ...熓壍, currentSignals: [signal({ status: "acknowledged" })] }, 劤壍.deps);
        expect(邂壍.counts).toMatchObject({ retried: 1, sent: 0, suppressed: 1 });
        expect(劤壍.sent).toHaveLength(0);
        expect(邂壍.deliveries[0]?.reasonCode).toBe("signals_inactive");
    });
    it("suppresses (not defers) with behavior suppress", async () => {
        const 嵱壍 = 棃壍("2026-09-30T03:00:00.000Z");
        const 籠壍 = 殳壍({ routes: [alertRoute({ quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "suppress", criticalBypass: false } })] });
        const 魏壍 = await dispatchSignals(籠壍, { signals: [signal()] }, 嵱壍.deps);
        expect(魏壍.counts).toMatchObject({ suppressed: 1, sent: 0 });
        expect(魏壍.deliveries[0]).toMatchObject({ status: "suppressed", reasonCode: "quiet_hours" });
        expect(魏壍.deliveries[0]?.nextAttemptAt).toBeUndefined();
    });
    it("retries failures with exponential backoff and gives up after the last attempt", async () => {
        const 栾壍 = 棃壍(糥壍, { ok: false, status: 503, error: "HTTP 503" });
        const 蜭壍 = await dispatchSignals(殳壍(), { signals: [signal()] }, 栾壍.deps);
        expect(蜭壍.counts.failed).toBe(1);
        expect(栾壍.log.lines[0]).toMatchObject({ status: "failed", attempts: 1, nextAttemptAt: "2026-09-29T15:01:00.000Z", httpStatus: 503 });
        const 吜壍 = [60000, 5 * 60000, 30 * 60000, 2 * 垑壍];
        for (const [猋壍, 釺壍] of 吜壍.entries()) {
            栾壍.advance(釺壍);
            const 廩壍 = await processDueDeliveries(殳壍(), 栾壍.deps);
            expect(廩壍.counts.retried).toBe(1);
            expect(廩壍.deliveries[0]?.attempts).toBe(猋壍 + 2);
        }
        const 緘壍 = (await 栾壍.log.recent())[0];
        expect(緘壍).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, reasonCode: "max_attempts" });
        expect(緘壍?.nextAttemptAt).toBeUndefined();
        栾壍.advance(24 * 垑壍);
        expect((await processDueDeliveries(殳壍(), 栾壍.deps)).counts.retried).toBe(0);
    });
    it("treats 4xx (except 429) as permanent and recovers on a later retry", async () => {
        const 鳇壍 = 棃壍(糥壍, { ok: false, status: 404, permanent: true, error: "HTTP 404" });
        await dispatchSignals(殳壍(), { signals: [signal()] }, 鳇壍.deps);
        expect(鳇壍.log.lines[0]?.nextAttemptAt).toBeUndefined();
        const 榶壍 = 棃壍(糥壍, (袥壍) => (袥壍 === 1 ? { ok: false, status: 429, retryAfterMs: 120000, error: "HTTP 429" } : { ok: true, status: 200 }));
        await dispatchSignals(殳壍(), { signals: [signal()] }, 榶壍.deps);
        expect(榶壍.log.lines[0]?.nextAttemptAt).toBe("2026-09-29T15:02:00.000Z");
        榶壍.advance(120000);
        const 喔壍 = await processDueDeliveries(殳壍(), 榶壍.deps);
        expect(喔壍.deliveries[0]).toMatchObject({ status: "sent", attempts: 2 });
        expect((await 榶壍.log.recent())[0]?.status).toBe("sent");
    });
    it("holds real sends without live data unless forced; test sends always go out", async () => {
        const 璃壍 = 棃壍();
        const 鍲壍 = await dispatchSignals(殳壍({ mode: "blank" }), { signals: [signal({ mode: "blank" })] }, 璃壍.deps);
        expect(鍲壍.counts).toMatchObject({ suppressed: 1, sent: 0 });
        expect(鍲壍.deliveries[0]?.reasonCode).toBe("no_live_data");
        expect(璃壍.sent).toHaveLength(0);
        expect((await dispatchSignals(殳壍({ mode: "blank" }), { signals: [signal({ mode: "blank" })] }, 璃壍.deps)).counts.deduped).toBe(1);
        const 恡壍 = await dispatchSignals(殳壍({ mode: "blank", force: true }), { signals: [signal({ mode: "blank" })] }, 璃壍.deps);
        expect(恡壍.counts.sent).toBe(1);
        expect(璃壍.sent[0]?.msg.mode).toBe("blank");
    });
    it("always sends test messages, even without live data, without auto-retry", async () => {
        const 罐壍 = 棃壍(糥壍, { ok: false, status: 500, error: "HTTP 500" });
        const { delivery: 鸿壍 } = await sendTestMessage(channel(), { account: { id: "1", name: "Acme" }, mode: "live", dashboardUrl: "https://x" }, 罐壍.deps);
        expect(罐壍.sent[0]?.msg.kind).toBe("test");
        expect(鸿壍).toMatchObject({ kind: "test", status: "failed", attempts: 1 });
        expect(鸿壍.nextAttemptAt).toBeUndefined();
    });
    it("sends resolved notices only for issues this channel was told about", async () => {
        const 欮壍 = 棃壍();
        const 訝壍 = 殳壍({ routes: [alertRoute({ includeResolved: true })] });
        await dispatchSignals(訝壍, { signals: [signal()] }, 欮壍.deps);
        欮壍.advance(3 * 垑壍);
        const 圌壍 = signal({ id: "c7:roas", entity: { id: "c7", name: "Never told" }, metric: "roas", status: "resolved" });
        const 痻壍 = await dispatchSignals(訝壍, { signals: [], resolved: [signal({ status: "resolved" }), 圌壍] }, 欮壍.deps);
        expect(痻壍.counts.sent).toBe(1);
        expect(欮壍.sent.at(-1)?.msg).toMatchObject({ kind: "resolved" });
        expect(欮壍.sent.at(-1)?.msg.signals.map((铪壍) => 铪壍.entity.id)).toEqual(["c1"]);
        const 懙壍 = await dispatchSignals(訝壍, { signals: [signal()] }, 欮壍.deps);
        expect(懙壍.counts.sent).toBe(1);
    });
    it("plans without sending or logging on a dry run", async () => {
        const 胈壍 = 棃壍();
        const 龷壍 = await dispatchSignals(殳壍({ dryRun: true }), { signals: [signal()] }, 胈壍.deps);
        expect(龷壍.counts).toMatchObject({ pending: 1, sent: 0 });
        expect(龷壍.deliveries[0]).toMatchObject({ status: "pending", dryRun: true });
        expect(龷壍.deliveries[0]?.payloadPreview).toContain("signals");
        expect(胈壍.sent).toHaveLength(0);
        expect(胈壍.log.lines).toHaveLength(0);
    });
    it("resends a failed delivery on demand and refuses sent ones", async () => {
        const 沦壍 = 棃壍(糥壍, { ok: false, status: 500, error: "HTTP 500" });
        await dispatchSignals(殳壍(), { signals: [signal()] }, 沦壍.deps);
        const 讕壍 = 沦壍.log.lines[0]?.id as string;
        沦壍.state.result = { ok: true, status: 200 };
        const 墄壍 = await retryDeliveryNow(讕壍, 殳壍(), 沦壍.deps);
        expect(墄壍).toMatchObject({ status: "sent", attempts: 2 });
        expect(墄壍.retryMessage).toBeUndefined();
        await expect(retryDeliveryNow(讕壍, 殳壍(), 沦壍.deps)).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(retryDeliveryNow("missing", 殳壍(), 沦壍.deps)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("turns a throwing transport into a failed delivery", async () => {
        const 睳壍 = 棃壍();
        睳壍.deps.send = async () => {
            throw new Error("socket hang up");
        };
        const 院壍 = await dispatchSignals(殳壍(), { signals: [signal()] }, 睳壍.deps);
        expect(院壍.deliveries[0]).toMatchObject({ status: "failed", lastError: "socket hang up" });
        expect(院壍.deliveries[0]?.nextAttemptAt).toBeDefined();
    });
});
