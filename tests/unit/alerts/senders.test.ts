import { createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sendDiscord, sendSlack, sendWebhook, signWebhook } from "@/lib/server/alerts/senders";
import { guardedFetch } from "@/lib/server/net/guarded-fetch";
import type { GuardedFetch, PluginContext } from "@/lib/server/plugins/define";
import { message } from "./fixtures";

const account = { id: "4821193307", name: "Acme", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" as const };
const NOW = new Date("2026-09-29T15:00:00.000Z");

function ctxWith(fetch: GuardedFetch, config: Record<string, string>): PluginContext {
  return { config, env: {}, fetch, account, mode: "live", now: NOW };
}

function recorder(status = 200, headers: Record<string, string> = {}, body = "ok") {
  const calls: { url: string; init: RequestInit & { timeoutMs?: number } }[] = [];
  const fetch: GuardedFetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  };
  return { calls, fetch };
}

describe("webhook signing", () => {
  it("signs `${timestamp}.${body}` with HMAC-SHA256 as sha256=<hex>", () => {
    const sig = signWebhook("s3cret", "1790000000", '{"a":1}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(sig).toBe(`sha256=${createHmac("sha256", "s3cret").update('1790000000.{"a":1}').digest("hex")}`);
  });

  it("sends the signature of the exact bytes it posts", async () => {
    const r = recorder();
    const res = await sendWebhook(message(), ctxWith(r.fetch, { url: "https://hooks.example.com/savd", signingSecret: "whsec_test" }));
    expect(res.ok).toBe(true);
    const init = r.calls[0]?.init as RequestInit;
    const headers = init.headers as Record<string, string>;
    const ts = String(Math.floor(NOW.getTime() / 1000));
    expect(headers["X-SAVD-Timestamp"]).toBe(ts);
    expect(headers["X-SAVD-Signature"]).toBe(signWebhook("whsec_test", ts, String(init.body)));
    expect(headers["X-SAVD-Event"]).toBe("savd.alert.signals");
    expect(JSON.parse(String(init.body))).toMatchObject({ type: "savd.alert.signals", version: 1 });
  });

  it("omits signature headers without a secret", async () => {
    const r = recorder();
    await sendWebhook(message(), ctxWith(r.fetch, { url: "https://hooks.example.com/savd" }));
    expect((r.calls[0]?.init.headers as Record<string, string>)["X-SAVD-Signature"]).toBeUndefined();
  });
});

describe("send results", () => {
  it("classifies 4xx as permanent, 429/5xx as retryable and honours Retry-After", async () => {
    const notFound = await sendSlack(message(), ctxWith(recorder(404).fetch, { url: "https://hooks.slack.com/services/T/B/X" }));
    expect(notFound).toMatchObject({ ok: false, status: 404, permanent: true });
    const limited = await sendSlack(message(), ctxWith(recorder(429, { "retry-after": "30" }).fetch, { url: "https://hooks.slack.com/services/T/B/X" }));
    expect(limited).toMatchObject({ ok: false, status: 429, permanent: false, retryAfterMs: 30_000 });
    const down = await sendDiscord(message(), ctxWith(recorder(502).fetch, { url: "https://discord.com/api/webhooks/1/abc" }));
    expect(down).toMatchObject({ ok: false, permanent: false });
    const noUrl = await sendSlack(message(), ctxWith(recorder().fetch, {}));
    expect(noUrl).toMatchObject({ ok: false, permanent: true, error: "No webhook URL configured" });
  });

  it("never echoes the webhook URL in errors or previews", async () => {
    const url = "https://hooks.slack.com/services/T000/B000/SUPERSECRETTOKEN";
    const failing: GuardedFetch = async () => {
      throw new Error(`connect ECONNREFUSED while posting to ${url}`);
    };
    const res = await sendSlack(message(), ctxWith(failing, { url }));
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain("SUPERSECRETTOKEN");
    const echo = await sendSlack(message(), ctxWith(recorder(400, {}, `invalid_payload for ${url}`).fetch, { url }));
    expect(echo.error).not.toContain("SUPERSECRETTOKEN");
    expect(echo.preview?.length).toBeLessThanOrEqual(2048);
  });

  it("passes the configured mention and link preference to the payload", async () => {
    const r = recorder();
    await sendSlack(message(), ctxWith(r.fetch, { url: "https://hooks.slack.com/services/T/B/X", mention: "@here", includeLinks: "false" }));
    const body = JSON.parse(String(r.calls[0]?.init.body)) as { blocks: { type: string; text?: { text: string } }[] };
    expect(body.blocks.some((b) => b.text?.text === "<!here>")).toBe(true);
    expect(body.blocks.some((b) => b.type === "actions")).toBe(false);
  });
});

describe("end to end through guardedFetch (local receivers)", () => {
  const received: { path: string; headers: http.IncomingHttpHeaders; body: string }[] = [];
  let receiver: http.Server;
  let redirector: http.Server;
  let receiverUrl = "";
  let redirectorUrl = "";

  const listen = (s: http.Server) => new Promise<string>((resolve) => s.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)));

  beforeAll(async () => {
    receiver = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        received.push({ path: req.url ?? "", headers: req.headers, body });
        res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
      });
    });
    receiverUrl = await listen(receiver);
    redirector = http.createServer((req, res) => {
      res.writeHead(307, { location: `${receiverUrl}/landed` }).end();
    });
    redirectorUrl = await listen(redirector);
  });

  afterAll(() => {
    receiver.close();
    redirector.close();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    received.length = 0;
  });

  it("is blocked by the SSRF guard by default", async () => {
    const res = await sendWebhook(message(), ctxWith(guardedFetch, { url: `${receiverUrl}/hook` }));
    expect(res).toMatchObject({ ok: false, permanent: true });
    expect(received).toHaveLength(0);
  });

  it("delivers a verifiable signed body when private networks are allowed", async () => {
    vi.stubEnv("PLUGINS_ALLOW_PRIVATE_NETWORK", "true");
    const res = await sendWebhook(message(), ctxWith(guardedFetch, { url: `${receiverUrl}/hook`, signingSecret: "whsec_e2e" }));
    expect(res).toMatchObject({ ok: true, status: 200 });
    const got = received[0];
    expect(got?.path).toBe("/hook");
    const ts = String(got?.headers["x-savd-timestamp"]);
    expect(got?.headers["x-savd-signature"]).toBe(signWebhook("whsec_e2e", ts, got?.body ?? ""));
  });

  it("never forwards credentials across a cross-origin redirect", async () => {
    vi.stubEnv("PLUGINS_ALLOW_PRIVATE_NETWORK", "true");
    const res = await guardedFetch(`${redirectorUrl}/start`, { method: "POST", headers: { "x-api-key": "k-123", Authorization: "Bearer t-456", "Content-Type": "application/json" }, body: '{"a":1}' });
    expect(res.status).toBe(200);
    const got = received[0];
    expect(got?.path).toBe("/landed");
    expect(got?.headers["x-api-key"]).toBeUndefined();
    expect(got?.headers.authorization).toBeUndefined();
    expect(got?.body).toBe('{"a":1}'); // 307 keeps method and body
  });
});
