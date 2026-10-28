import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoogleAdsApiError } from "@/lib/server/google-ads/errors";
import { getAccessToken, invalidateAccessToken, TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { fixtureResponse, jsonResponse, mockFetch, NOW, setClock, setupLiveEnv, teardownLiveEnv } from "./helpers";
const creds = { clientId: "client-id", clientSecret: "client-secret", refreshToken: "refresh-token" };
const noSleep = async () => undefined;
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("OAuth refresh-token grant", () => {
    it("posts a form-encoded refresh_token grant to Google's token endpoint", async () => {
        const m = mockFetch(() => fixtureResponse("oauth-token.json"));
        await expect(getAccessToken(creds, { fetch: m.fetch })).resolves.toBe("ya29.fixture-access-token-0001");
        const call = m.calls[0]!;
        expect(call.url).toBe(TOKEN_URL);
        expect(call.method).toBe("POST");
        expect(call.headers["content-type"]).toBe("application/x-www-form-urlencoded");
        expect(Object.fromEntries(new URLSearchParams(call.body))).toEqual({ grant_type: "refresh_token", client_id: "client-id", client_secret: "client-secret", refresh_token: "refresh-token" });
    });
    it("caches the token until 60 s before expiry", async () => {
        const m = mockFetch(() => fixtureResponse("oauth-token.json"));
        await getAccessToken(creds, { fetch: m.fetch });
        await getAccessToken(creds, { fetch: m.fetch });
        expect(m.calls).toHaveLength(1);
        setClock(new Date(NOW.getTime() + (3599 - 61) * 1000));
        await getAccessToken(creds, { fetch: m.fetch });
        expect(m.calls).toHaveLength(1);
        setClock(new Date(NOW.getTime() + (3599 - 59) * 1000));
        await getAccessToken(creds, { fetch: m.fetch });
        expect(m.calls).toHaveLength(2);
    });
    it("shares one refresh between concurrent callers", async () => {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((r) => (release = r));
        const m = mockFetch(async () => {
            await gate;
            return fixtureResponse("oauth-token.json");
        });
        const all = Promise.all(Array.from({ length: 5 }, () => getAccessToken(creds, { fetch: m.fetch })));
        release();
        expect(new Set(await all)).toEqual(new Set(["ya29.fixture-access-token-0001"]));
        expect(m.calls).toHaveLength(1);
    });
    it("refreshes again after invalidation", async () => {
        const m = mockFetch(() => fixtureResponse("oauth-token.json"));
        await getAccessToken(creds, { fetch: m.fetch });
        invalidateAccessToken(creds);
        await getAccessToken(creds, { fetch: m.fetch });
        expect(m.calls).toHaveLength(2);
    });
    it("maps invalid_grant to AUTH_REFRESH_TOKEN_INVALID without retrying", async () => {
        const m = mockFetch(() => fixtureResponse("oauth-invalid-grant.json", 400));
        const err = await getAccessToken(creds, { fetch: m.fetch, sleep: noSleep }).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(GoogleAdsApiError);
        expect(err).toMatchObject({ code: "AUTH_REFRESH_TOKEN_INVALID", httpStatus: 400 });
        expect((err as GoogleAdsApiError).message).toContain("expire after 7 days");
        expect(m.calls).toHaveLength(1);
    });
    it("maps invalid_client to AUTH_CLIENT_INVALID", async () => {
        const m = mockFetch(() => fixtureResponse("oauth-invalid-client.json", 401));
        await expect(getAccessToken(creds, { fetch: m.fetch, sleep: noSleep })).rejects.toMatchObject({ code: "AUTH_CLIENT_INVALID" });
    });
    it("retries transient token endpoint failures with backoff", async () => {
        let n = 0;
        const delays: number[] = [];
        const m = mockFetch(() => (++n < 3 ? jsonResponse({ error: "backend_error" }, 503) : fixtureResponse("oauth-token.json")));
        await expect(getAccessToken(creds, { fetch: m.fetch, sleep: async (ms) => void delays.push(ms), random: () => 0 })).resolves.toBe("ya29.fixture-access-token-0001");
        expect(delays).toEqual([500, 1500]);
    });
    it("gives up with TOKEN_ENDPOINT_UNAVAILABLE when the endpoint stays unreachable", async () => {
        const m = mockFetch(() => {
            throw new TypeError("fetch failed");
        });
        await expect(getAccessToken(creds, { fetch: m.fetch, sleep: noSleep })).rejects.toMatchObject({ code: "TOKEN_ENDPOINT_UNAVAILABLE" });
        expect(m.calls).toHaveLength(4);
    });
});
