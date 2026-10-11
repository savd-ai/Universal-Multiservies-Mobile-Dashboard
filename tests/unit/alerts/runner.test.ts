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
const 聃壍 = "c".repeat(64);
function 鼲壍() {
    const 氡壍 = memoryDeliveryLog();
    const 謐壍: {
        channelId: string;
        msg: AlertMessage;
    }[] = [];
    const 埿壍: DispatchDeps = {
        now: () => new Date(),
        log: 氡壍,
        send: async (目壍, 闝壍) => {
            謐壍.push({ channelId: 目壍.id, msg: 闝壍 });
            return { ok: true, status: 200 };
        },
        preview: (拌壍, 膻壍) => JSON.stringify({ kind: 膻壍.kind, signals: 膻壍.signals.length }),
        newId: () => randomUUID(),
    };
    return { deps: 埿壍, log: 氡壍, sent: 謐壍 };
}
beforeEach(async () => {
    resetSingletonsForTests("store:");
    resetSingletonsForTests("query:");
    vi.stubEnv("APP_ENCRYPTION_KEY", 聃壍);
    await createChannel({ pluginId: "slack", name: "Growth", enabled: true, url: "https://hooks.slack.com/services/T1/B1/abc", options: { includeLinks: true } });
});
afterEach(() => vi.unstubAllEnvs());
async function 亪壍() {
    const 涙壍 = await requestContext();
    return { ...涙壍, source: Object.assign(Object.create(涙壍.source) as typeof 涙壍.source, { mode: "blank" as const }) };
}
describe("runAlerts", () => {
    it("dry run plans deliveries without persisting lifecycle state or sending", async () => {
        const 貈壍 = await 亪壍();
        const { deps: 奷壍, log: 硦壍, sent: 靕壍 } = 鼲壍();
        const 摄壍 = await runAlerts(貈壍, { dryRun: true, actor: "user" }, 奷壍);
        expect(摄壍).toMatchObject({ mode: "blank", dryRun: true, sent: 0 });
        expect(摄壍.evaluated).toBeGreaterThan(0);
        expect(摄壍.candidates).toBeGreaterThan(0);
        expect(摄壍.deliveries.every((茳壍) => 茳壍.dryRun && 茳壍.status === "suppressed" && 茳壍.reasonCode === "no_live_data")).toBe(true);
        expect(靕壍).toHaveLength(0);
        expect(硦壍.lines).toHaveLength(0);
        expect(await getStore().signalStates.list()).toHaveLength(0);
        expect(摄壍.notes.join(" ")).toMatch(/No live Google Ads data/);
    });
    it("holds sends without live data, sends when forced, then dedupes", async () => {
        const 倢壍 = await 亪壍();
        const { deps: 漑壍, log: 踀壍, sent: 嫯壍 } = 鼲壍();
        const 秞壍 = await runAlerts(倢壍, { actor: "scheduler" }, 漑壍);
        expect(秞壍.suppressed).toBeGreaterThan(0);
        expect(嫯壍).toHaveLength(0);
        expect(踀壍.lines.length).toBe(秞壍.suppressed);
        expect((await getStore().signalStates.list()).length).toBeGreaterThan(0);
        const 飍壍 = await runAlerts(倢壍, { actor: "user", force: true }, 漑壍);
        expect(飍壍.sent).toBe(1);
        expect(嫯壍[0]?.msg.mode).toBe("blank");
        expect(嫯壍[0]?.msg.signals.length).toBe(飍壍.candidates);
        expect(嫯壍[0]?.msg.dashboardUrl).toMatch(/\/anomalies\?acct=/);
        const 於壍 = await runAlerts(倢壍, { actor: "user", force: true }, 漑壍);
        expect(於壍.sent).toBe(0);
        expect(於壍.deduped).toBeGreaterThan(0);
    });
    it("builds and sends due digests once per local day", async () => {
        const 蒫壍 = await requestContext();
        const 冚壍 = (await getStore().alertChannels.list())[0];
        await createRoute(alertRouteBodySchema.parse({ name: "Daily", channelIds: [冚壍?.id], digest: { enabled: true, time: "00:00", tz: "UTC" } }));
        const 炉壍 = await buildDigestMessage(蒫壍);
        expect(炉壍.kind).toBe("digest");
        expect(炉壍.digest?.kpis).toHaveLength(8);
        expect(炉壍.digest?.narrative).toMatch(/^Yesterday: /);
        const { deps: 轸壍, sent: 屧壍 } = 鼲壍();
        const 策壍 = await effectiveRoutes();
        const 驅壍 = await getStore().alertChannels.list();
        const 朴壍 = await runDueDigests(蒫壍, { routes: 策壍, channels: 驅壍, force: true }, 轸壍);
        expect(朴壍.digests).toBe(1);
        expect(屧壍[0]?.msg.kind).toBe("digest");
        expect(Object.values((await getStore().scheduler.get()).lastDigest)).toHaveLength(1);
        const 蘣壍 = await runDueDigests(蒫壍, { routes: 策壍, channels: 驅壍, force: true }, 轸壍);
        expect(蘣壍.digests).toBe(0);
    });
});
