import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { setClockForTests } from "@/lib/server/clock";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
export function fixture<T = unknown>(name: string): T {
    return JSON.parse(readFileSync(fileURLToPath(new URL(`../../fixtures/google-ads/${name}`, import.meta.url)), "utf8")) as T;
}
export const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
export const fixtureResponse = (name: string, status = 200): Response => jsonResponse(fixture(name), status);
export interface RecordedCall {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    query?: string;
    customerId?: string;
}
export type Handler = (call: RecordedCall, init?: RequestInit) => Response | Promise<Response> | undefined | Promise<Response | undefined>;
export function mockFetch(handler: Handler) {
    const calls: RecordedCall[] = [];
    const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = input instanceof Request ? input.url : String(input);
        const headers: Record<string, string> = {};
        new Headers(init?.headers).forEach((v, k) => {
            headers[k] = v;
        });
        const body = typeof init?.body === "string" ? init.body : "";
        let query: string | undefined;
        try {
            const parsed: unknown = JSON.parse(body);
            if (parsed && typeof parsed === "object" && "query" in parsed && typeof parsed.query === "string")
                query = parsed.query;
        }
        catch {
        }
        const call: RecordedCall = { url, method: init?.method ?? "GET", headers, body, query, customerId: /\/customers\/(\d+)\//.exec(url)?.[1] };
        calls.push(call);
        const res = await handler(call, init);
        if (!res)
            throw new Error(`Unmocked request: ${init?.method ?? "GET"} ${url} ${query ?? ""}`);
        return res;
    });
    return {
        fetch: fn as unknown as typeof fetch,
        calls,
        searches: () => calls.filter((c) => c.url.endsWith("googleAds:searchStream")),
        tokenCalls: () => calls.filter((c) => c.url === TOKEN_URL),
    };
}
const CUSTOMERS: Record<string, string> = {
    "1234567890": "customer.json",
    "2345678901": "customer-eu.json",
    "9876543210": "customer-manager.json",
};
export function googleAdsRouter(override?: Handler): Handler {
    return async (call, init) => {
        const custom = override ? await override(call, init) : undefined;
        if (custom)
            return custom;
        if (call.url === TOKEN_URL)
            return fixtureResponse("oauth-token.json");
        if (call.url.endsWith("/customers:listAccessibleCustomers"))
            return fixtureResponse("list-accessible-customers.json");
        const q = call.query ?? "";
        if (/ FROM customer_client /.test(q))
            return fixtureResponse("customer-client.json");
        if (/ FROM customer /.test(q))
            return fixtureResponse(CUSTOMERS[call.customerId ?? ""] ?? "customer.json");
        if (/ FROM geo_target_constant /.test(q))
            return fixtureResponse("geo-constants.json");
        if (/ FROM change_event /.test(q))
            return fixtureResponse("change-events.json");
        if (/ FROM search_term_view /.test(q))
            return fixtureResponse("search-terms.json");
        if (/ FROM user_location_view /.test(q))
            return fixtureResponse("geo.json");
        if (/ FROM keyword_view /.test(q))
            return fixtureResponse(q.includes("segments.date,") ? "keyword-daily.json" : "keywords.json");
        if (/ FROM ad_group WHERE ad_group\.id IN/.test(q))
            return fixtureResponse("ad-groups-removed.json");
        if (/ FROM ad_group /.test(q))
            return fixtureResponse(q.includes("segments.date") ? "ad-group-daily.json" : "ad-groups.json");
        if (/ FROM campaign_simulation /.test(q))
            return fixtureResponse("campaign-simulations.json");
        if (/ FROM recommendation /.test(q))
            return fixtureResponse("recommendations.json");
        if (/ FROM campaign WHERE segments\.date/.test(q)) {
            if (q.includes("segments.device"))
                return fixtureResponse("campaign-device.json");
            if (q.includes("segments.hour"))
                return fixtureResponse("campaign-hourly.json");
            return fixtureResponse("campaign-daily.json");
        }
        if (/ FROM campaign /.test(q))
            return fixtureResponse("campaigns.json");
        return undefined;
    };
}
export const TEST_ENV = {
    GOOGLE_ADS_CLIENT_ID: "000000000000-test.apps.googleusercontent.com",
    GOOGLE_ADS_CLIENT_SECRET: "test-client-secret-000",
    GOOGLE_ADS_REFRESH_TOKEN: "test-refresh-token-000",
    GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
} as const;
export const NOW = new Date("2026-09-29T15:00:00Z");
export function setupLiveEnv(extra: Record<string, string> = {}): void {
    resetSingletonsForTests("gads:");
    resetSingletonsForTests("resolver:");
    setClockForTests(() => NOW);
    vi.stubEnv("LOG_LEVEL", "error");
    vi.stubEnv("DASHBOARD_FORCE_DEMO", "");
    vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    for (const [k, v] of Object.entries({ ...TEST_ENV, ...extra }))
        vi.stubEnv(k, v);
}
export function teardownLiveEnv(): void {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setClockForTests(undefined);
    resetSingletonsForTests("gads:");
    resetSingletonsForTests("resolver:");
}
export function setClock(date: Date): void {
    setClockForTests(() => date);
}
