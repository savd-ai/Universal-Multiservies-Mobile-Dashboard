import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertRouteBodySchema, type AlertMessage } from "@/lib/domain/contracts/alerts";
import { createChannel } from "@/lib/server/alerts/channels";
import { memoryDeliveryLog } from "@/lib/server/alerts/deliveries";
import { buildDigestMessage, runDueDigests } from "@/lib/server/alerts/digest";
import type { DispatchDeps } from "@/lib/server/alerts/dispatcher";
import { createRoute, effectiveRoutes } from "@/lib/server/alerts/routes";
import { runAlerts } from "@/lib/server/alerts/runner";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { requestContext } from "@/lib/server/context";
import { getStore } from "@/lib/server/store";
const KEY = "c".repeat(64);
function fakeDeps() {
    const log = memoryDeliveryLog();
    const sent: {
        channelId: string;
        msg: AlertMessage;
    }[] = [];
    const deps: DispatchDeps = {
        now: () => new Date(),
        log,
        send: async (ch, msg) => {
            sent.push({ channelId: ch.id, msg });
            return { ok: true, status: 200 };
        },
        preview: (_ch, msg) => JSON.stringify({ kind: msg.kind, signals: msg.signals.length }),
        newId: () => randomUUID(),
    };
    return { deps, log, sent };
}
beforeEach(async () => {
    resetSingletonsForTests("store:");
    resetSingletonsForTests("query:");
    vi.stubEnv("APP_ENCRYPTION_KEY", KEY);
    await createChannel({ pluginId: "slack", name: "Growth", enabled: true, url: "https://hooks.slack.com/services/T1/B1/abc", options: { includeLinks: true } });
});
afterEach(() => vi.unstubAllEnvs());
async function requestContext2() {
    const requestContext3 = await requestContext();
    return { ...requestContext3, source: Object.assign(Object.create(requestContext3.source) as typeof requestContext3.source, { mode: "blank" as const }) };
}
describe("runAlerts", () => {
    it("dry run plans deliveries without persisting lifecycle state or sending", async () => {
        const ctx = await requestContext2();
        const { deps, log, sent } = fakeDeps();
        const res = await runAlerts(ctx, { dryRun: true, actor: "user" }, deps);
        expect(res).toMatchObject({ mode: "blank", dryRun: true, sent: 0 });
        expect(res.evaluated).toBeGreaterThan(0);
        expect(res.candidates).toBeGreaterThan(0);
        expect(res.deliveries.every((d) => d.dryRun && d.status === "suppressed" && d.reasonCode === "no_live_data")).toBe(true);
        expect(sent).toHaveLength(0);
        expect(log.lines).toHaveLength(0);
        expect(await getStore().signalStates.list()).toHaveLength(0);
        expect(res.notes.join(" ")).toMatch(/No live Google Ads data/);
    });
    it("holds sends without live data, sends when forced, then dedupes", async () => {
        const ctx = await requestContext2();
        const { deps, log, sent } = fakeDeps();
        const normal = await runAlerts(ctx, { actor: "scheduler" }, deps);
        expect(normal.suppressed).toBeGreaterThan(0);
        expect(sent).toHaveLength(0);
        expect(log.lines.length).toBe(normal.suppressed);
        expect((await getStore().signalStates.list()).length).toBeGreaterThan(0);
        const forced = await runAlerts(ctx, { actor: "user", force: true }, deps);
        expect(forced.sent).toBe(1);
        expect(sent[0]?.msg.mode).toBe("blank");
        expect(sent[0]?.msg.signals.length).toBe(forced.candidates);
        expect(sent[0]?.msg.dashboardUrl).toMatch(/\/anomalies\?acct=/);
        const again = await runAlerts(ctx, { actor: "user", force: true }, deps);
        expect(again.sent).toBe(0);
        expect(again.deduped).toBeGreaterThan(0);
    });
    it("builds and sends due digests once per local day", async () => {
        const ctx = await requestContext();
        const ch = (await getStore().alertChannels.list())[0];
        await createRoute(alertRouteBodySchema.parse({ name: "Daily", channelIds: [ch?.id], digest: { enabled: true, time: "00:00", tz: "UTC" } }));
        const msg = await buildDigestMessage(ctx);
        expect(msg.kind).toBe("digest");
        expect(msg.digest?.kpis).toHaveLength(8);
        expect(msg.digest?.narrative).toMatch(/^Yesterday: /);
        const { deps, sent } = fakeDeps();
        const routes = await effectiveRoutes();
        const channels = await getStore().alertChannels.list();
        const first = await runDueDigests(ctx, { routes, channels, force: true }, deps);
        expect(first.digests).toBe(1);
        expect(sent[0]?.msg.kind).toBe("digest");
        expect(Object.values((await getStore().scheduler.get()).lastDigest)).toHaveLength(1);
        const second = await runDueDigests(ctx, { routes, channels, force: true }, deps);
        expect(second.digests).toBe(0);
    });
});
