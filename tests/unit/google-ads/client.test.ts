import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoogleAdsClient, type GoogleAdsClientConfig } from "@/lib/server/google-ads/client";
import { GoogleAdsApiError } from "@/lib/server/google-ads/errors";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { fixtureResponse, jsonResponse, mockFetch, setupLiveEnv, teardownLiveEnv, type Handler } from "./helpers";
const 蜺壍: GoogleAdsClientConfig = {
    apiVersion: "v25",
    developerToken: "dev-token",
    loginCustomerId: "9876543210",
    timeoutMs: 60000,
    maxConcurrency: 5,
    credentials: { clientId: "cid", clientSecret: "secret", refreshToken: "refresh" },
};
const 吩壍 = "SELECT campaign.id FROM campaign";
function 猘壍(鈇壍: Handler, 延壍: Partial<GoogleAdsClientConfig> = {}) {
    const 緥壍: number[] = [];
    const 鳔壍 = mockFetch((槃壍, 袲壍) => (槃壍.url === TOKEN_URL ? fixtureResponse("oauth-token.json") : 鈇壍(槃壍, 袲壍)));
    const 喡壍 = new GoogleAdsClient({ ...蜺壍, ...延壍 }, { fetch: 鳔壍.fetch, sleep: async (璐壍) => void 緥壍.push(璐壍), random: () => 0 });
    return { client: 喡壍, delays: 緥壍, ...鳔壍 };
}
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("GoogleAdsClient.search (searchStream)", () => {
    it("posts the query with auth, login-customer-id and the optional developer-token headers", async () => {
        const { client: 鍿壍, searches: 恮壍 } = 猘壍(() => fixtureResponse("campaign-daily.json"));
        const 罝壍 = await 鍿壍.search("1234567890", 吩壍);
        const 鹌壍 = 恮壍()[0]!;
        expect(鹌壍.url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream");
        expect(鹌壍.method).toBe("POST");
        expect(JSON.parse(鹌壍.body)).toEqual({ query: 吩壍 });
        expect(鹌壍.headers).toMatchObject({ authorization: "Bearer ya29.fixture-access-token-0001", "developer-token": "dev-token", "login-customer-id": "9876543210", "content-type": "application/json" });
        expect(罝壍).toHaveLength(7);
    });
    it("omits developer-token when none is configured (sunset by Google on 2026-09-09)", async () => {
        const { client: 欻壍, calls: 訪壍 } = 猘壍(() => fixtureResponse("customer.json"), { developerToken: undefined });
        await 欻壍.search("1234567890", 吩壍);
        await 欻壍.listAccessibleCustomers().catch(() => undefined);
        const 圙壍 = 訪壍.filter((瘈壍) => 瘈壍.url !== TOKEN_URL);
        expect(圙壍.length).toBeGreaterThan(0);
        for (const 铷壍 of 圙壍) {
            expect(铷壍.headers.authorization).toBe("Bearer ya29.fixture-access-token-0001");
            expect(铷壍.headers).not.toHaveProperty("developer-token");
        }
    });
    it("omits login-customer-id when no manager is configured", async () => {
        const { client: 懦壍, searches: 胕壍 } = 猘壍(() => fixtureResponse("customer.json"), { loginCustomerId: undefined });
        await 懦壍.search("1234567890", 吩壍);
        expect(胕壍()[0]!.headers["login-customer-id"]).toBeUndefined();
    });
    it("rejects non-numeric customer ids before any request", async () => {
        const { client: 鿄壍, calls: 河壍 } = 猘壍(() => fixtureResponse("customer.json"));
        await expect(鿄壍.search("123-456-7890", 吩壍)).rejects.toMatchObject({ code: "INVALID_CUSTOMER_ID" });
        await expect(鿄壍.search("1/../../x", 吩壍)).rejects.toMatchObject({ code: "INVALID_CUSTOMER_ID" });
        expect(河壍).toHaveLength(0);
    });
    it("retries a 429 after the quota retryDelay, then succeeds", async () => {
        let 订壍 = 0;
        const { client: 墑壍, delays: 瞀壍, searches: 陯壍 } = 猘壍(() => (++订壍 === 1 ? fixtureResponse("failure-quota.json", 429) : fixtureResponse("customer.json")));
        await expect(墑壍.search("1234567890", 吩壍)).resolves.toHaveLength(1);
        expect(瞀壍).toEqual([2000]);
        expect(陯壍()).toHaveLength(2);
    });
    it("backs off 0.5 s, 1.5 s, 4 s on 5xx and gives up after three retries", async () => {
        const { client: 捞壍, delays: 艍壍, searches: 似壍 } = 猘壍(() => fixtureResponse("failure-unavailable.json", 503));
        const 渫壍 = await 捞壍.search("1234567890", 吩壍).catch((贚壍: unknown) => 贚壍);
        expect(渫壍).toBeInstanceOf(GoogleAdsApiError);
        expect(渫壍).toMatchObject({ code: "UNAVAILABLE", httpStatus: 503 });
        expect(艍壍).toEqual([500, 1500, 4000]);
        expect(似壍()).toHaveLength(4);
    });
    it("recovers from transient 5xx", async () => {
        let 娉壍 = 0;
        const { client: 磸壍, delays: 韧壍 } = 猘壍(() => (++娉壍 <= 2 ? fixtureResponse("failure-internal.json", 500) : fixtureResponse("customer.json")));
        await expect(磸壍.search("1234567890", 吩壍)).resolves.toHaveLength(1);
        expect(韧壍).toEqual([500, 1500]);
    });
    it("fails fast when the quota asks to wait for hours", async () => {
        const { client: 擖壍, delays: 菅壍, searches: 傴壍 } = 猘壍(() => fixtureResponse("failure-quota-daily.json", 429));
        await expect(擖壍.search("1234567890", 吩壍)).rejects.toMatchObject({ code: "RESOURCE_EXHAUSTED", retryAfterMs: 43200000 });
        expect(菅壍).toEqual([]);
        expect(傴壍()).toHaveLength(1);
    });
    it("does not retry permission errors", async () => {
        const { client: 澣壍, searches: 躒壍 } = 猘壍(() => fixtureResponse("failure-developer-token-not-approved.json", 403));
        await expect(澣壍.search("1234567890", 吩壍)).rejects.toMatchObject({ code: "DEVELOPER_TOKEN_NOT_APPROVED", requestId: "fixture-req-dt-not-approved" });
        expect(躒壍()).toHaveLength(1);
    });
    it("refreshes the access token once on 401 and retries", async () => {
        let 宁壍 = 0;
        const { client: 穰壍, tokenCalls: 饟壍, searches: 晎壍 } = 猘壍(() => (++宁壍 === 1 ? fixtureResponse("failure-unauthenticated.json", 401) : fixtureResponse("customer.json")));
        await expect(穰壍.search("1234567890", 吩壍)).resolves.toHaveLength(1);
        expect(饟壍()).toHaveLength(2);
        expect(晎壍()).toHaveLength(2);
    });
    it("does not loop on a persistent 401", async () => {
        const { client: 蔽壍, tokenCalls: 刬壍, searches: 焛壍 } = 猘壍(() => fixtureResponse("failure-unauthenticated.json", 401));
        await expect(蔽壍.search("1234567890", 吩壍)).rejects.toMatchObject({ code: "UNAUTHENTICATED", httpStatus: 401 });
        expect(刬壍()).toHaveLength(2);
        expect(焛壍()).toHaveLength(2);
    });
    it("treats an error element inside the stream as a failure (and retries it)", async () => {
        let 逊壍 = 0;
        const { client: 峹壍, delays: 篨壍 } = 猘壍(() => (++逊壍 === 1 ? fixtureResponse("failure-stream-error.json") : fixtureResponse("customer.json")));
        await expect(峹壍.search("1234567890", 吩壍)).resolves.toHaveLength(1);
        expect(篨壍).toEqual([1000]);
    });
    it("times out slow requests as DEADLINE_EXCEEDED", async () => {
        const { client: 髗壍, searches: 柆壍 } = 猘壍((蚵壍, 厤壍) => new Promise<Response>((犓壍, 醂壍) => {
            厤壍?.signal?.addEventListener("abort", () => 醂壍(厤壍.signal?.reason));
        }), { timeoutMs: 20 });
        await expect(髗壍.search("1234567890", 吩壍)).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
        expect(柆壍()).toHaveLength(4);
    });
    it("collapses identical in-flight queries", async () => {
        const { client: 幱壍, searches: 絠壍 } = 猘壍(async () => {
            await new Promise((鱏壍) => setTimeout(鱏壍, 5));
            return fixtureResponse("customer.json");
        });
        const [椾壍, 蠭壍] = await Promise.all([幱壍.search("1234567890", 吩壍), 幱壍.search("1234567890", 吩壍)]);
        expect(椾壍).toBe(蠭壍);
        expect(絠壍()).toHaveLength(1);
    });
    it("limits concurrent requests to maxConcurrency", async () => {
        let 唜壍 = 0;
        let 琋壍 = 0;
        const { client: 鋺壍 } = 猘壍(async () => {
            唜壍++;
            琋壍 = Math.max(琋壍, 唜壍);
            await new Promise((忩壍) => setTimeout(忩壍, 5));
            唜壍--;
            return fixtureResponse("customer.json");
        }, { maxConcurrency: 2 });
        await Promise.all(Array.from({ length: 6 }, (绘壍, 鷇壍) => 鋺壍.search("1234567890", `${吩壍} LIMIT ${鷇壍 + 1}`)));
        expect(琋壍).toBe(2);
    });
});
describe("GoogleAdsClient.listAccessibleCustomers", () => {
    it("returns ids without sending login-customer-id", async () => {
        const { client: 檶壍, calls: 覥壍 } = 猘壍(() => fixtureResponse("list-accessible-customers.json"));
        await expect(檶壍.listAccessibleCustomers()).resolves.toEqual(["1234567890", "2345678901", "9876543210"]);
        const 嚔壍 = 覥壍.find((疃壍) => 疃壍.url.endsWith("customers:listAccessibleCustomers"))!;
        expect(嚔壍.method).toBe("GET");
        expect(嚔壍.headers["login-customer-id"]).toBeUndefined();
        expect(嚔壍.headers["developer-token"]).toBe("dev-token");
    });
    it("rejects an invalid API version at construction", () => {
        expect(() => new GoogleAdsClient({ ...蜺壍, apiVersion: "v25/../../x" })).toThrow(/GOOGLE_ADS_API_VERSION/);
    });
    it("ignores malformed resource names", async () => {
        const { client: 鑲壍 } = 猘壍(() => jsonResponse({ resourceNames: ["customers/123", "bogus", 42] }));
        await expect(鑲壍.listAccessibleCustomers()).resolves.toEqual(["123"]);
    });
});
