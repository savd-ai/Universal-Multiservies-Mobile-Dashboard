import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { channelView, channelViews, createChannel, deleteChannel, listChannels, resolveChannelConfig, updateChannel, } from "@/lib/server/alerts/channels";
import { createRoute, effectiveRoutes } from "@/lib/server/alerts/routes";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { getStore } from "@/lib/server/store";
const KEY = "b".repeat(64);
const SLACK = "https://hooks.slack.com/services/T0001/B0001/abcdefSECRET1234";
beforeEach(() => resetSingletonsForTests("store:"));
afterEach(() => vi.unstubAllEnvs());
describe(".env channels", () => {
    it("appear read-only with a masked URL", async () => {
        vi.stubEnv("SLACK_WEBHOOK_URL", SLACK);
        vi.stubEnv("ALERT_WEBHOOK_URL", "https://example.com/hook");
        vi.stubEnv("ALERT_WEBHOOK_SECRET", "whsec_1");
        const all = await listChannels();
        expect(all.map((c) => c.id)).toEqual(["env-slack", "env-webhook"]);
        const views = await channelViews();
        expect(views[0]).toMatchObject({ id: "env-slack", origin: "env", url: { hasValue: true, masked: "••••1234", source: "env" }, signing: false });
        expect(views[1]).toMatchObject({ id: "env-webhook", signing: true });
        expect(JSON.stringify(views)).not.toContain("abcdefSECRET");
        expect(resolveChannelConfig(all[0]!).url).toBe(SLACK);
        await expect(updateChannel("env-slack", { name: "x" })).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(deleteChannel("env-slack")).rejects.toMatchObject({ code: "CONFLICT" });
    });
});
describe("stored channels", () => {
    it("need APP_ENCRYPTION_KEY and point to the env var instead", async () => {
        await expect(createChannel({ pluginId: "slack", name: "Growth", enabled: true, url: SLACK, options: { includeLinks: true } })).rejects.toMatchObject({ code: "SECRETS_DISABLED", message: expect.stringContaining("SLACK_WEBHOOK_URL") });
    });
    it("validate URLs before storing (SSRF, retired Teams connectors)", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", KEY);
        await expect(createChannel({ pluginId: "webhook", name: "x", enabled: true, url: "https://10.0.0.8/hook", options: { includeLinks: true } })).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
        await expect(createChannel({ pluginId: "teams", name: "x", enabled: true, url: "https://contoso.webhook.office.com/webhookb2/abc", options: { includeLinks: true } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(createChannel({ pluginId: "slack", name: "x", enabled: true, options: { includeLinks: true } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
    it("encrypt URL and signing secret per field; the API only sees descriptions", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", KEY);
        const ch = await createChannel({ pluginId: "webhook", name: "Ops", enabled: true, url: "https://ops.example.com/savd", signingSecret: "whsec_2", options: { includeLinks: false } });
        expect("enc" in ch.url).toBe(true);
        const view = channelView(ch);
        expect(view).toMatchObject({ url: { hasValue: true, masked: "••••savd", source: "stored" }, signing: true, options: { includeLinks: false } });
        expect(JSON.stringify(view)).not.toContain("ops.example.com");
        expect(resolveChannelConfig(ch)).toMatchObject({ url: "https://ops.example.com/savd", signingSecret: "whsec_2", includeLinks: false });
        const swapped = { ...ch, url: ch.signingSecret! };
        expect(resolveChannelConfig(swapped).url).toBeUndefined();
        expect(resolveChannelConfig(swapped).error).toBeTruthy();
    });
    it("update partially, clear the signing secret and respect versions", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", KEY);
        const ch = await createChannel({ pluginId: "webhook", name: "Ops", enabled: true, url: "https://ops.example.com/savd", signingSecret: "whsec_2", options: { includeLinks: true, mention: "x" } });
        const renamed = await updateChannel(ch.id, { name: "Ops 2", options: { includeLinks: false } });
        expect(renamed).toMatchObject({ name: "Ops 2", enabled: true, options: { includeLinks: false, mention: "x" } });
        expect(resolveChannelConfig(renamed).url).toBe("https://ops.example.com/savd");
        const cleared = await updateChannel(ch.id, { signingSecret: "" });
        expect(cleared.signingSecret).toBeUndefined();
        await expect(updateChannel(ch.id, { name: "late", version: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(updateChannel(ch.id, { pluginId: "slack" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
    it("deleting a channel removes it from routes and disables routes left empty", async () => {
        vi.stubEnv("APP_ENCRYPTION_KEY", KEY);
        const a = await createChannel({ pluginId: "slack", name: "A", enabled: true, url: SLACK, options: { includeLinks: true } });
        const b = await createChannel({ pluginId: "discord", name: "B", enabled: true, url: "https://discord.com/api/webhooks/1/abc", options: { includeLinks: true } });
        expect((await effectiveRoutes())[0]).toMatchObject({ id: "default", implicit: true, channelIds: [a.id, b.id], minSeverity: "warning" });
        const solo = await createRoute(alertRouteBodySchema.parse({ name: "Solo", channelIds: [a.id] }));
        const both = await createRoute(alertRouteBodySchema.parse({ name: "Both", channelIds: [a.id, b.id] }));
        await expect(createRoute(alertRouteBodySchema.parse({ name: "Bad", channelIds: ["nope"] }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(createRoute(alertRouteBodySchema.parse({ name: "Bad tz", channelIds: [a.id], quietHours: { start: "22:00", end: "07:00", tz: "Mars/Olympus" } }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        const res = await deleteChannel(a.id);
        expect(res.updatedRoutes.sort()).toEqual([solo.id, both.id].sort());
        expect(await getStore().alertRoutes.get(solo.id)).toMatchObject({ channelIds: [], enabled: false });
        expect(await getStore().alertRoutes.get(both.id)).toMatchObject({ channelIds: [b.id], enabled: true });
        expect((await effectiveRoutes()).some((r) => r.implicit)).toBe(false);
    });
});
