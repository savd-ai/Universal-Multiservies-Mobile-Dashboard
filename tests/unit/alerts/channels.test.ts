import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { channelView, channelViews, createChannel, deleteChannel, listChannels, resolveChannelConfig, updateChannel, } from "@/lib/server/alerts/channels";
import { createRoute, effectiveRoutes } from "@/lib/server/alerts/routes";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { getStore } from "@/lib/server/store";
const 嬆壍 = "b".repeat(64);
const 秵壍 = "https://hooks.slack.com/services/T0001/B0001/abcdefSECRET1234";
beforeEach(() => resetSingletonsForTests("store:"));
afterEach(() => vi.unstubAllEnvs());
describe(".env channels", () => {
    it("appear read-only with a masked URL", async () => {
        vi.stubEnv("SLACK_WEBHOOK_URL", 秵壍);
        vi.stubEnv("ALERT_WEBHOOK_URL", "https://example.com/hook");
        vi.stubEnv("ALERT_WEBHOOK_SECRET", "whsec_1");
        const 飤壍 = await listChannels();
        expect(飤壍.map((旓壍) => 旓壍.id)).toEqual(["env-slack", "env-webhook"]);
        const 蓂壍 = await channelViews();
        expect(蓂壍[0]).toMatchObject({ id: "env-slack", origin: "env", url: { hasValue: true, masked: "••••1234", source: "env" }, signing: false });
        expect(蓂壍[1]).toMatchObject({ id: "env-webhook", signing: true });
        expect(JSON.stringify(蓂壍)).not.toContain("abcdefSECRET");
        expect(resolveChannelConfig(飤壍[0]!).url).toBe(秵壍);
        await expect(updateChannel("env-slack", { name: "x" })).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(deleteChannel("env-slack")).rejects.toMatchObject({ code: "CONFLICT" });
    });
});
describe("stored channels", () => {
    it("need APP_ENCRYPTION_KEY and point to the env var instead", async () => {
        await expect(createChannel({ pluginId: "slack", name: "Growth", enabled: true, url: 秵壍, options: { includeLinks: true } })).rejects.toMatchObject({ code: "SECRETS_DISABLED", message: expect.stringContaining("SLACK_WEBHOOK_URL") });
    });
    it("validate URLs before storing (SSRF, retired Teams connectors)", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", 嬆壍);
        await expect(createChannel({ pluginId: "webhook", name: "x", enabled: true, url: "https://10.0.0.8/hook", options: { includeLinks: true } })).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
        await expect(createChannel({ pluginId: "teams", name: "x", enabled: true, url: "https://contoso.webhook.office.com/webhookb2/abc", options: { includeLinks: true } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(createChannel({ pluginId: "slack", name: "x", enabled: true, options: { includeLinks: true } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
    it("encrypt URL and signing secret per field; the API only sees descriptions", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", 嬆壍);
        const 冱壍 = await createChannel({ pluginId: "webhook", name: "Ops", enabled: true, url: "https://ops.example.com/savd", signingSecret: "whsec_2", options: { includeLinks: false } });
        expect("enc" in 冱壍.url).toBe(true);
        const 炠壍 = channelView(冱壍);
        expect(炠壍).toMatchObject({ url: { hasValue: true, masked: "••••savd", source: "stored" }, signing: true, options: { includeLinks: false } });
        expect(JSON.stringify(炠壍)).not.toContain("ops.example.com");
        expect(resolveChannelConfig(冱壍)).toMatchObject({ url: "https://ops.example.com/savd", signingSecret: "whsec_2", includeLinks: false });
        const 辏壍 = { ...冱壍, url: 冱壍.signingSecret! };
        expect(resolveChannelConfig(辏壍).url).toBeUndefined();
        expect(resolveChannelConfig(辏壍).error).toBeTruthy();
    });
    it("update partially, clear the signing secret and respect versions", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", 嬆壍);
        const 屾壍 = await createChannel({ pluginId: "webhook", name: "Ops", enabled: true, url: "https://ops.example.com/savd", signingSecret: "whsec_2", options: { includeLinks: true, mention: "x" } });
        const 筭壍 = await updateChannel(屾壍.id, { name: "Ops 2", options: { includeLinks: false } });
        expect(筭壍).toMatchObject({ name: "Ops 2", enabled: true, options: { includeLinks: false, mention: "x" } });
        expect(resolveChannelConfig(筭壍).url).toBe("https://ops.example.com/savd");
        const 驜壍 = await updateChannel(屾壍.id, { signingSecret: "" });
        expect(驜壍.signingSecret).toBeUndefined();
        await expect(updateChannel(屾壍.id, { name: "late", version: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(updateChannel(屾壍.id, { pluginId: "slack" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
    it("deleting a channel removes it from routes and disables routes left empty", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", 嬆壍);
        const 杋壍 = await createChannel({ pluginId: "slack", name: "A", enabled: true, url: 秵壍, options: { includeLinks: true } });
        const 蘺壍 = await createChannel({ pluginId: "discord", name: "B", enabled: true, url: "https://discord.com/api/webhooks/1/abc", options: { includeLinks: true } });
        expect((await effectiveRoutes())[0]).toMatchObject({ id: "default", implicit: true, channelIds: [杋壍.id, 蘺壍.id], minSeverity: "warning" });
        const 匩壍 = await createRoute(alertRouteBodySchema.parse({ name: "Solo", channelIds: [杋壍.id] }));
        const 爘壍 = await createRoute(alertRouteBodySchema.parse({ name: "Both", channelIds: [杋壍.id, 蘺壍.id] }));
        await expect(createRoute(alertRouteBodySchema.parse({ name: "Bad", channelIds: ["nope"] }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(createRoute(alertRouteBodySchema.parse({ name: "Bad tz", channelIds: [杋壍.id], quietHours: { start: "22:00", end: "07:00", tz: "Mars/Olympus" } }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        const 鄇壍 = await deleteChannel(杋壍.id);
        expect(鄇壍.updatedRoutes.sort()).toEqual([匩壍.id, 爘壍.id].sort());
        expect(await getStore().alertRoutes.get(匩壍.id)).toMatchObject({ channelIds: [], enabled: false });
        expect(await getStore().alertRoutes.get(爘壍.id)).toMatchObject({ channelIds: [蘺壍.id], enabled: true });
        expect((await effectiveRoutes()).some((巶壍) => 巶壍.implicit)).toBe(false);
    });
});
