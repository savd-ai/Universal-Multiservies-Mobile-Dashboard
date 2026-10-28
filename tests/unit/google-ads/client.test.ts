import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoogleAdsClient, type GoogleAdsClientConfig } from "@/lib/server/google-ads/client";
import { GoogleAdsApiError } from "@/lib/server/google-ads/errors";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { fixtureResponse, jsonResponse, mockFetch, setupLiveEnv, teardownLiveEnv, type Handler } from "./helpers";
const CFG: GoogleAdsClientConfig = {
    apiVersion: "v25",
    developerToken: "dev-token",
    loginCustomerId: "9876543210",
    timeoutMs: 60000,
    maxConcurrency: 5,
    credentials: { clientId: "cid", clientSecret: "secret", refreshToken: "refresh" },
};
const QUERY = "SELECT campaign.id FROM campaign";
function setup(handler: Handler, cfg: Partial<GoogleAdsClientConfig> = {}) {
    const delays: number[] = [];
    const m = mockFetch((call, init) => (call.url === TOKEN_URL ? fixtureResponse("oauth-token.json") : handler(call, init)));
    const client = new GoogleAdsClient({ ...CFG, ...cfg }, { fetch: m.fetch, sleep: async (ms) => void delays.push(ms), random: () => 0 });
    return { client, delays, ...m };
}
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("GoogleAdsClient.search (searchStream)", () => {
    it("posts the query with auth, login-customer-id and the optional developer-token headers", async () => {
        const { client, searches } = setup(() => fixtureResponse("campaign-daily.json"));
        const rows = await client.search("1234567890", QUERY);
        const call = searches()[0]!;
        expect(call.url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream");
        expect(call.method).toBe("POST");
        expect(JSON.parse(call.body)).toEqual({ query: QUERY });
        expect(call.headers).toMatchObject({ authorization: "Bearer ya29.fixture-access-token-0001", "developer-token": "dev-token", "login-customer-id": "9876543210", "content-type": "application/json" });
        expect(rows).toHaveLength(7);
    });
    it("omits developer-token when none is configured (sunset by Google on 2026-09-09)", async () => {
        const { client, calls } = setup(() => fixtureResponse("customer.json"), { developerToken: undefined });
        await client.search("1234567890", QUERY);
        await client.listAccessibleCustomers().catch(() => undefined);
        const api = calls.filter((c) => c.url !== TOKEN_URL);
        expect(api.length).toBeGreaterThan(0);
        for (const call of api) {
            expect(call.headers.authorization).toBe("Bearer ya29.fixture-access-token-0001");
            expect(call.headers).not.toHaveProperty("developer-token");
        }
    });
    it("omits login-customer-id when no manager is configured", async () => {
        const { client, searches } = setup(() => fixtureResponse("customer.json"), { loginCustomerId: undefined });
        await client.search("1234567890", QUERY);
        expect(searches()[0]!.headers["login-customer-id"]).toBeUndefined();
    });
    it("rejects non-numeric customer ids before any request", async () => {
        const { client, calls } = setup(() => fixtureResponse("customer.json"));
        await expect(client.search("123-456-7890", QUERY)).rejects.toMatchObject({ code: "INVALID_CUSTOMER_ID" });
        await expect(client.search("1/../../x", QUERY)).rejects.toMatchObject({ code: "INVALID_CUSTOMER_ID" });
        expect(calls).toHaveLength(0);
    });
    it("retries a 429 after the quota retryDelay, then succeeds", async () => {
        let n = 0;
        const { client, delays, searches } = setup(() => (++n === 1 ? fixtureResponse("failure-quota.json", 429) : fixtureResponse("customer.json")));
        await expect(client.search("1234567890", QUERY)).resolves.toHaveLength(1);
        expect(delays).toEqual([2000]);
        expect(searches()).toHaveLength(2);
    });
    it("backs off 0.5 s, 1.5 s, 4 s on 5xx and gives up after three retries", async () => {
        const { client, delays, searches } = setup(() => fixtureResponse("failure-unavailable.json", 503));
        const err = await client.search("1234567890", QUERY).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(GoogleAdsApiError);
        expect(err).toMatchObject({ code: "UNAVAILABLE", httpStatus: 503 });
        expect(delays).toEqual([500, 1500, 4000]);
        expect(searches()).toHaveLength(4);
    });
    it("recovers from transient 5xx", async () => {
        let n = 0;
        const { client, delays } = setup(() => (++n <= 2 ? fixtureResponse("failure-internal.json", 500) : fixtureResponse("customer.json")));
        await expect(client.search("1234567890", QUERY)).resolves.toHaveLength(1);
        expect(delays).toEqual([500, 1500]);
    });
    it("fails fast when the quota asks to wait for hours", async () => {
        const { client, delays, searches } = setup(() => fixtureResponse("failure-quota-daily.json", 429));
        await expect(client.search("1234567890", QUERY)).rejects.toMatchObject({ code: "RESOURCE_EXHAUSTED", retryAfterMs: 43200000 });
        expect(delays).toEqual([]);
        expect(searches()).toHaveLength(1);
    });
    it("does not retry permission errors", async () => {
        const { client, searches } = setup(() => fixtureResponse("failure-developer-token-not-approved.json", 403));
        await expect(client.search("1234567890", QUERY)).rejects.toMatchObject({ code: "DEVELOPER_TOKEN_NOT_APPROVED", requestId: "fixture-req-dt-not-approved" });
        expect(searches()).toHaveLength(1);
    });
    it("refreshes the access token once on 401 and retries", async () => {
        let n = 0;
        const { client, tokenCalls, searches } = setup(() => (++n === 1 ? fixtureResponse("failure-unauthenticated.json", 401) : fixtureResponse("customer.json")));
        await expect(client.search("1234567890", QUERY)).resolves.toHaveLength(1);
        expect(tokenCalls()).toHaveLength(2);
        expect(searches()).toHaveLength(2);
    });
    it("does not loop on a persistent 401", async () => {
        const { client, tokenCalls, searches } = setup(() => fixtureResponse("failure-unauthenticated.json", 401));
        await expect(client.search("1234567890", QUERY)).rejects.toMatchObject({ code: "UNAUTHENTICATED", httpStatus: 401 });
        expect(tokenCalls()).toHaveLength(2);
        expect(searches()).toHaveLength(2);
    });
    it("treats an error element inside the stream as a failure (and retries it)", async () => {
        let n = 0;
        const { client, delays } = setup(() => (++n === 1 ? fixtureResponse("failure-stream-error.json") : fixtureResponse("customer.json")));
        await expect(client.search("1234567890", QUERY)).resolves.toHaveLength(1);
        expect(delays).toEqual([1000]);
    });
    it("times out slow requests as DEADLINE_EXCEEDED", async () => {
        const { client, searches } = setup((_call, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }), { timeoutMs: 20 });
        await expect(client.search("1234567890", QUERY)).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
        expect(searches()).toHaveLength(4);
    });
    it("collapses identical in-flight queries", async () => {
        const { client, searches } = setup(async () => {
            await new Promise((r) => setTimeout(r, 5));
            return fixtureResponse("customer.json");
        });
        const [a, b] = await Promise.all([client.search("1234567890", QUERY), client.search("1234567890", QUERY)]);
        expect(a).toBe(b);
        expect(searches()).toHaveLength(1);
    });
    it("limits concurrent requests to maxConcurrency", async () => {
        let active = 0;
        let peak = 0;
        const { client } = setup(async () => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => setTimeout(r, 5));
            active--;
            return fixtureResponse("customer.json");
        }, { maxConcurrency: 2 });
        await Promise.all(Array.from({ length: 6 }, (_, i) => client.search("1234567890", `${QUERY} LIMIT ${i + 1}`)));
        expect(peak).toBe(2);
    });
});
describe("GoogleAdsClient.listAccessibleCustomers", () => {
    it("returns ids without sending login-customer-id", async () => {
        const { client, calls } = setup(() => fixtureResponse("list-accessible-customers.json"));
        await expect(client.listAccessibleCustomers()).resolves.toEqual(["1234567890", "2345678901", "9876543210"]);
        const call = calls.find((c) => c.url.endsWith("customers:listAccessibleCustomers"))!;
        expect(call.method).toBe("GET");
        expect(call.headers["login-customer-id"]).toBeUndefined();
        expect(call.headers["developer-token"]).toBe("dev-token");
    });
    it("rejects an invalid API version at construction", () => {
        expect(() => new GoogleAdsClient({ ...CFG, apiVersion: "v25/../../x" })).toThrow(/GOOGLE_ADS_API_VERSION/);
    });
    it("ignores malformed resource names", async () => {
        const { client } = setup(() => jsonResponse({ resourceNames: ["customers/123", "bogus", 42] }));
        await expect(client.listAccessibleCustomers()).resolves.toEqual(["123"]);
    });
});
