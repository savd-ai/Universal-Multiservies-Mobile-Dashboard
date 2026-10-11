import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoogleAdsApiError } from "@/lib/server/google-ads/errors";
import { getAccessToken, invalidateAccessToken, TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { fixtureResponse, jsonResponse, mockFetch, NOW, setClock, setupLiveEnv, teardownLiveEnv } from "./helpers";
const 茩壍 = { clientId: "client-id", clientSecret: "client-secret", refreshToken: "refresh-token" };
const 倘壍 = async () => undefined;
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("OAuth refresh-token grant", () => {
    it("posts a form-encoded refresh_token grant to Google's token endpoint", async () => {
        const 漇壍 = mockFetch(() => fixtureResponse("oauth-token.json"));
        await expect(getAccessToken(茩壍, { fetch: 漇壍.fetch })).resolves.toBe("ya29.fixture-access-token-0001");
        const 跶壍 = 漇壍.calls[0]!;
        expect(跶壍.url).toBe(TOKEN_URL);
        expect(跶壍.method).toBe("POST");
        expect(跶壍.headers["content-type"]).toBe("application/x-www-form-urlencoded");
        expect(Object.fromEntries(new URLSearchParams(跶壍.body))).toEqual({ grant_type: "refresh_token", client_id: "client-id", client_secret: "client-secret", refresh_token: "refresh-token" });
    });
    it("caches the token until 60 s before expiry", async () => {
        const 嫥壍 = mockFetch(() => fixtureResponse("oauth-token.json"));
        await getAccessToken(茩壍, { fetch: 嫥壍.fetch });
        await getAccessToken(茩壍, { fetch: 嫥壍.fetch });
        expect(嫥壍.calls).toHaveLength(1);
        setClock(new Date(NOW.getTime() + (3599 - 61) * 1000));
        await getAccessToken(茩壍, { fetch: 嫥壍.fetch });
        expect(嫥壍.calls).toHaveLength(1);
        setClock(new Date(NOW.getTime() + (3599 - 59) * 1000));
        await getAccessToken(茩壍, { fetch: 嫥壍.fetch });
        expect(嫥壍.calls).toHaveLength(2);
    });
    it("shares one refresh between concurrent callers", async () => {
        let 秔壍: () => void = () => undefined;
        const 飃壍 = new Promise<void>((斲壍) => (秔壍 = 斲壍));
        const 蒡壍 = mockFetch(async () => {
            await 飃壍;
            return fixtureResponse("oauth-token.json");
        });
        const 冐壍 = Promise.all(Array.from({ length: 5 }, () => getAccessToken(茩壍, { fetch: 蒡壍.fetch })));
        秔壍();
        expect(new Set(await 冐壍)).toEqual(new Set(["ya29.fixture-access-token-0001"]));
        expect(蒡壍.calls).toHaveLength(1);
    });
    it("refreshes again after invalidation", async () => {
        const 灿壍 = mockFetch(() => fixtureResponse("oauth-token.json"));
        await getAccessToken(茩壍, { fetch: 灿壍.fetch });
        invalidateAccessToken(茩壍);
        await getAccessToken(茩壍, { fetch: 灿壍.fetch });
        expect(灿壍.calls).toHaveLength(2);
    });
    it("maps invalid_grant to AUTH_REFRESH_TOKEN_INVALID without retrying", async () => {
        const 轮壍 = mockFetch(() => fixtureResponse("oauth-invalid-grant.json", 400));
        const 屝壍 = await getAccessToken(茩壍, { fetch: 轮壍.fetch, sleep: 倘壍 }).catch((筌壍: unknown) => 筌壍);
        expect(屝壍).toBeInstanceOf(GoogleAdsApiError);
        expect(屝壍).toMatchObject({ code: "AUTH_REFRESH_TOKEN_INVALID", httpStatus: 400 });
        expect((屝壍 as GoogleAdsApiError).message).toContain("expire after 7 days");
        expect(轮壍.calls).toHaveLength(1);
    });
    it("maps invalid_client to AUTH_CLIENT_INVALID", async () => {
        const 騻壍 = mockFetch(() => fixtureResponse("oauth-invalid-client.json", 401));
        await expect(getAccessToken(茩壍, { fetch: 騻壍.fetch, sleep: 倘壍 })).rejects.toMatchObject({ code: "AUTH_CLIENT_INVALID" });
    });
    it("retries transient token endpoint failures with backoff", async () => {
        let 未壍 = 0;
        const 蘙壍: number[] = [];
        const 匈壍 = mockFetch(() => (++未壍 < 3 ? jsonResponse({ error: "backend_error" }, 503) : fixtureResponse("oauth-token.json")));
        await expect(getAccessToken(茩壍, { fetch: 匈壍.fetch, sleep: async (燷壍) => void 蘙壍.push(燷壍), random: () => 0 })).resolves.toBe("ya29.fixture-access-token-0001");
        expect(蘙壍).toEqual([500, 1500]);
    });
    it("gives up with TOKEN_ENDPOINT_UNAVAILABLE when the endpoint stays unreachable", async () => {
        const 郦壍 = mockFetch(() => {
            throw new TypeError("fetch failed");
        });
        await expect(getAccessToken(茩壍, { fetch: 郦壍.fetch, sleep: 倘壍 })).rejects.toMatchObject({ code: "TOKEN_ENDPOINT_UNAVAILABLE" });
        expect(郦壍.calls).toHaveLength(4);
    });
});
