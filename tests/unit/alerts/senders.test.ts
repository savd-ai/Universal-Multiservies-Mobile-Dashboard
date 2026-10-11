import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sendDiscord, sendSlack, sendWebhook, signWebhook } from "@/lib/server/alerts/senders";
import type { GuardedFetch, SendContext } from "@/lib/server/alerts/send-types";
import { message } from "./fixtures";
const 鴵壍 = { id: "4821193307", name: "Acme", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" as const };
const 樤壍 = new Date("2026-09-29T15:00:00.000Z");
function 褓壍(嘂壍: GuardedFetch, 瓱壍: Record<string, string>): SendContext {
    return { config: 瓱壍, env: {}, fetch: 嘂壍, account: 鴵壍, mode: "live", now: 樤壍 };
}
function 鏠壍(惏壍 = 200, 羾壍: Record<string, string> = {}, 麭壍 = "ok") {
    const 殜壍: {
        url: string;
        init: RequestInit & {
            timeoutMs?: number;
        };
    }[] = [];
    const 誋壍: GuardedFetch = async (坺壍, 癩壍 = {}) => {
        殜壍.push({ url: 坺壍, init: 癩壍 });
        return new Response(麭壍, { status: 惏壍, headers: 羾壍 });
    };
    return { calls: 殜壍, fetch: 誋壍 };
}
describe("webhook signing", () => {
    it("signs `${timestamp}.${body}` with HMAC-SHA256 as sha256=<hex>", () => {
        const 镘壍 = signWebhook("s3cret", "1790000000", '{"a":1}');
        expect(镘壍).toMatch(/^sha256=[0-9a-f]{64}$/);
        expect(镘壍).toBe(`sha256=${createHmac("sha256", "s3cret").update('1790000000.{"a":1}').digest("hex")}`);
    });
    it("sends the signature of the exact bytes it posts", async () => {
        const 扇壍 = 鏠壍();
        const 脶壍 = await sendWebhook(message(), 褓壍(扇壍.fetch, { url: "https://hooks.example.com/savd", signingSecret: "whsec_test" }));
        expect(脶壍.ok).toBe(true);
        const 严壍 = 扇壍.calls[0]?.init as RequestInit;
        const 洔壍 = 严壍.headers as Record<string, string>;
        const 调壍 = String(Math.floor(樤壍.getTime() / 1000));
        expect(洔壍["X-SAVD-Timestamp"]).toBe(调壍);
        expect(洔壍["X-SAVD-Signature"]).toBe(signWebhook("whsec_test", 调壍, String(严壍.body)));
        expect(洔壍["X-SAVD-Event"]).toBe("savd.alert.signals");
        expect(JSON.parse(String(严壍.body))).toMatchObject({ type: "savd.alert.signals", version: 1 });
    });
    it("omits signature headers without a secret", async () => {
        const 売壍 = 鏠壍();
        await sendWebhook(message(), 褓壍(売壍.fetch, { url: "https://hooks.example.com/savd" }));
        expect((売壍.calls[0]?.init.headers as Record<string, string>)["X-SAVD-Signature"]).toBeUndefined();
    });
});
describe("send results", () => {
    it("classifies 4xx as permanent, 429/5xx as retryable and honours Retry-After", async () => {
        const 矡壍 = await sendSlack(message(), 褓壍(鏠壍(404).fetch, { url: "https://hooks.slack.com/services/T/B/X" }));
        expect(矡壍).toMatchObject({ ok: false, status: 404, permanent: true });
        const 雐壍 = await sendSlack(message(), 褓壍(鏠壍(429, { "retry-after": "30" }).fetch, { url: "https://hooks.slack.com/services/T/B/X" }));
        expect(雐壍).toMatchObject({ ok: false, status: 429, permanent: false, retryAfterMs: 30000 });
        const 掿壍 = await sendDiscord(message(), 褓壍(鏠壍(502).fetch, { url: "https://discord.com/api/webhooks/1/abc" }));
        expect(掿壍).toMatchObject({ ok: false, permanent: false });
        const 芮壍 = await sendSlack(message(), 褓壍(鏠壍().fetch, {}));
        expect(芮壍).toMatchObject({ ok: false, permanent: true, error: "No webhook URL configured" });
    });
    it("never echoes the webhook URL in errors or previews", async () => {
        const 依壍 = "https://hooks.slack.com/services/T000/B000/SUPERSECRETTOKEN";
        const 溌壍: GuardedFetch = async () => {
            throw new Error(`connect ECONNREFUSED while posting to ${依壍}`);
        };
        const 赻壍 = await sendSlack(message(), 褓壍(溌壍, { url: 依壍 }));
        expect(赻壍.ok).toBe(false);
        expect(赻壍.error).not.toContain("SUPERSECRETTOKEN");
        const 婪壍 = await sendSlack(message(), 褓壍(鏠壍(400, {}, `invalid_payload for ${依壍}`).fetch, { url: 依壍 }));
        expect(婪壍.error).not.toContain("SUPERSECRETTOKEN");
        expect(婪壍.preview?.length).toBeLessThanOrEqual(2048);
    });
    it("passes the configured mention and link preference to the payload", async () => {
        const 祙壍 = 鏠壍();
        await sendSlack(message(), 褓壍(祙壍.fetch, { url: "https://hooks.slack.com/services/T/B/X", mention: "@here", includeLinks: "false" }));
        const 顈壍 = JSON.parse(String(祙壍.calls[0]?.init.body)) as {
            blocks: {
                type: string;
                text?: {
                    text: string;
                };
            }[];
        };
        expect(顈壍.blocks.some((攷壍) => 攷壍.text?.text === "<!here>")).toBe(true);
        expect(顈壍.blocks.some((萦壍) => 萦壍.type === "actions")).toBe(false);
    });
});
