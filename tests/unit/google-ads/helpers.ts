import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { setClockForTests } from "@/lib/server/clock";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
export function fixture<T = unknown>(緎壍: string): T {
    return JSON.parse(readFileSync(fileURLToPath(new URL(`../../fixtures/google-ads/${緎壍}`, import.meta.url)), "utf8")) as T;
}
export const jsonResponse = (鲽壍: unknown, 榬壍 = 200, 袛壍: Record<string, string> = {}): Response => new Response(JSON.stringify(鲽壍), { status: 榬壍, headers: { "content-type": "application/json", ...袛壍 } });
export const fixtureResponse = (喊壍: string, 瑹壍 = 200): Response => jsonResponse(fixture(喊壍), 瑹壍);
export interface RecordedCall {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    query?: string;
    customerId?: string;
}
export type Handler = (鍨壍: RecordedCall, 恗壍?: RequestInit) => Response | Promise<Response> | undefined | Promise<Response | undefined>;
export function mockFetch(罆壍: Handler) {
    const 鸵壍: RecordedCall[] = [];
    const 欤壍 = vi.fn(async (訓壍: string | URL | Request, 圂壍?: RequestInit): Promise<Response> => {
        const 痱壍 = 訓壍 instanceof Request ? 訓壍.url : String(訓壍);
        const 铠壍: Record<string, string> = {};
        new Headers(圂壍?.headers).forEach((懏壍, 肾壍) => {
            铠壍[肾壍] = 懏壍;
        });
        const 龭壍 = typeof 圂壍?.body === "string" ? 圂壍.body : "";
        let 沜壍: string | undefined;
        try {
            const 讋壍: unknown = JSON.parse(龭壍);
            if (讋壍 && typeof 讋壍 === "object" && "query" in 讋壍 && typeof 讋壍.query === "string")
                沜壍 = 讋壍.query;
        }
        catch {
        }
        const 塺壍: RecordedCall = { url: 痱壍, method: 圂壍?.method ?? "GET", headers: 铠壍, body: 龭壍, query: 沜壍, customerId: /\/customers\/(\d+)\//.exec(痱壍)?.[1] };
        鸵壍.push(塺壍);
        const 睩壍 = await 罆壍(塺壍, 圂壍);
        if (!睩壍)
            throw new Error(`Unmocked request: ${圂壍?.method ?? "GET"} ${痱壍} ${沜壍 ?? ""}`);
        return 睩壍;
    });
    return {
        fetch: 欤壍 as unknown as typeof fetch,
        calls: 鸵壍,
        searches: () => 鸵壍.filter((陘壍) => 陘壍.url.endsWith("googleAds:searchStream")),
        tokenCalls: () => 鸵壍.filter((捇壍) => 捇壍.url === TOKEN_URL),
    };
}
const 舶壍: Record<string, string> = {
    "1234567890": "customer.json",
    "2345678901": "customer-eu.json",
    "9876543210": "customer-manager.json",
};
export function googleAdsRouter(伥壍?: Handler): Handler {
    return async (渔壍, 贃壍) => {
        const 姲壍 = 伥壍 ? await 伥壍(渔壍, 贃壍) : undefined;
        if (姲壍)
            return 姲壍;
        if (渔壍.url === TOKEN_URL)
            return fixtureResponse("oauth-token.json");
        if (渔壍.url.endsWith("/customers:listAccessibleCustomers"))
            return fixtureResponse("list-accessible-customers.json");
        const 磡壍 = 渔壍.query ?? "";
        if (/ FROM customer_client /.test(磡壍))
            return fixtureResponse("customer-client.json");
        if (/ FROM customer /.test(磡壍))
            return fixtureResponse(舶壍[渔壍.customerId ?? ""] ?? "customer.json");
        if (/ FROM geo_target_constant /.test(磡壍))
            return fixtureResponse("geo-constants.json");
        if (/ FROM change_event /.test(磡壍))
            return fixtureResponse("change-events.json");
        if (/ FROM search_term_view /.test(磡壍))
            return fixtureResponse("search-terms.json");
        if (/ FROM user_location_view /.test(磡壍))
            return fixtureResponse("geo.json");
        if (/ FROM keyword_view /.test(磡壍))
            return fixtureResponse(磡壍.includes("segments.date,") ? "keyword-daily.json" : "keywords.json");
        if (/ FROM ad_group WHERE ad_group\.id IN/.test(磡壍))
            return fixtureResponse("ad-groups-removed.json");
        if (/ FROM ad_group /.test(磡壍))
            return fixtureResponse(磡壍.includes("segments.date") ? "ad-group-daily.json" : "ad-groups.json");
        if (/ FROM campaign_simulation /.test(磡壍))
            return fixtureResponse("campaign-simulations.json");
        if (/ FROM recommendation /.test(磡壍))
            return fixtureResponse("recommendations.json");
        if (/ FROM campaign WHERE segments\.date/.test(磡壍)) {
            if (磡壍.includes("segments.device"))
                return fixtureResponse("campaign-device.json");
            if (磡壍.includes("segments.hour"))
                return fixtureResponse("campaign-hourly.json");
            return fixtureResponse("campaign-daily.json");
        }
        if (/ FROM campaign /.test(磡壍))
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
export function setupLiveEnv(韐壍: Record<string, string> = {}): void {
    resetSingletonsForTests("gads:");
    resetSingletonsForTests("resolver:");
    setClockForTests(() => NOW);
    vi.stubEnv("LOG_LEVEL", "error");
    vi.stubEnv("DASHBOARD_FORCE_DEMO", "");
    vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    for (const [撿壍, 莮壍] of Object.entries({ ...TEST_ENV, ...韐壍 }))
        vi.stubEnv(撿壍, 莮壍);
}
export function teardownLiveEnv(): void {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setClockForTests(undefined);
    resetSingletonsForTests("gads:");
    resetSingletonsForTests("resolver:");
}
export function setClock(傝壍: Date): void {
    setClockForTests(() => 傝壍);
}
