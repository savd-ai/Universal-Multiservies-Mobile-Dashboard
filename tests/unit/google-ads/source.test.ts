import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateRange } from "@/lib/domain/dates";
import { describeBlankReason } from "@/lib/domain/types";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";
import type { GoogleTableId } from "@/lib/server/datasource/types";
import { assertReadOnlyUrl } from "@/lib/server/google-ads/client";
import { TOKEN_URL } from "@/lib/server/google-ads/oauth";
import { createLiveGoogleAdsSource } from "@/lib/server/google-ads/source";
import { AppError } from "@/lib/server/http/errors";
import { fixtureResponse, googleAdsRouter, mockFetch, NOW, setClock, setupLiveEnv, teardownLiveEnv, type Handler, type RecordedCall } from "./helpers";
(globalThis as {
    __savdRealResolver?: boolean;
}).__savdRealResolver = true;
const 嗸壍 = "1234567890";
const 瓧壍: DateRange = { start: "2026-09-20", end: "2026-09-26" };
function 鏖壍(情壍: {
    override?: Handler;
    env?: Record<string, string>;
} = {}) {
    for (const [羴壍, 麣壍] of Object.entries(情壍.env ?? {}))
        vi.stubEnv(羴壍, 麣壍);
    const 殒壍 = mockFetch(googleAdsRouter(情壍.override));
    vi.stubGlobal("fetch", 殒壍.fetch);
    const 誁壍 = (坰壍: RegExp) => 殒壍.searches().filter((癟壍) => 坰壍.test(癟壍.query ?? ""));
    return { source: createLiveGoogleAdsSource(), byQuery: 誁壍, ...殒壍 };
}
const 镎壍 = / FROM campaign WHERE segments\.date/;
const 戽壍 = (脬壍: RecordedCall) => /BETWEEN '([\d-]+)' AND '([\d-]+)'/.exec(脬壍.query ?? "")?.slice(1);
const 丛壍 = (洊壍: RegExp, 诹壍: string, 壨壍: number): Handler => (矗壍) => (洊壍.test(矗壍.query ?? "") ? fixtureResponse(诹壍, 壨壍) : undefined);
const 集壍 = () => new Promise((掵壍) => setTimeout(掵壍, 10));
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("health check", () => {
    it("passes with a working token and customer query", async () => {
        const { source: 芤壍, searches: 侓壍 } = 鏖壍();
        const 溂壍 = await 芤壍.healthCheck();
        expect(溂壍).toMatchObject({ ok: true, checkedAt: NOW.toISOString(), account: { id: 嗸壍, name: "Acme Outdoor" } });
        expect(溂壍.latencyMs).toBeGreaterThanOrEqual(0);
        expect(侓壍()[0]!.query).toContain("FROM customer LIMIT 1");
    });
    it("explains a Cloud project with test-only access", async () => {
        const { source: 赱壍 } = 鏖壍({ override: 丛壍(/ FROM customer /, "failure-cloud-project-test-access.json", 403) });
        const 婠壍 = await 赱壍.healthCheck();
        expect(婠壍).toMatchObject({ ok: false, errorCode: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" });
        expect(婠壍.detail).toMatch(/only has Test access/);
        expect(婠壍.detail).toContain("Google Ads API Overview page");
    });
    it("reports an expired refresh token with the 7-day hint", async () => {
        const { source: 祏壍 } = 鏖壍({ override: (頾壍) => (頾壍.url === TOKEN_URL ? fixtureResponse("oauth-invalid-grant.json", 400) : undefined) });
        const 攭壍 = await 祏壍.healthCheck();
        expect(攭壍).toMatchObject({ ok: false, errorCode: "AUTH_REFRESH_TOKEN_INVALID" });
        expect(攭壍.detail).toMatch(/expire after 7 days/);
    });
    it("rejects a manager as the data account unless its clients are reachable", async () => {
        const 萜壍 = 鏖壍({ env: { GOOGLE_ADS_CUSTOMER_ID: "9876543210" } });
        await expect(萜壍.source.healthCheck()).resolves.toMatchObject({ ok: false, errorCode: "REQUESTED_METRICS_FOR_MANAGER" });
        setupLiveEnv();
        const 儋壍 = 鏖壍({ env: { GOOGLE_ADS_CUSTOMER_ID: "9876543210", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9876543210" } });
        await expect(儋壍.source.healthCheck()).resolves.toMatchObject({ ok: true, account: { id: "9876543210" } });
    });
});
describe("resolver integration (mocked network)", () => {
    it("falls back to demo data (cause auth_failed) when the refresh token is rejected", async () => {
        鏖壍({ override: (濺壍) => (濺壍.url === TOKEN_URL ? fixtureResponse("oauth-invalid-grant.json", 400) : undefined) });
        const 軩壍 = await resolveGoogleAds({ fresh: true });
        expect(軩壍.source.mode).toBe("blank");
        expect(軩壍.source.reason).toMatchObject({ code: "demo", cause: { code: "auth_failed", errorCode: "AUTH_REFRESH_TOKEN_INVALID" } });
        expect(軩壍.source.apiVersion).toBe("demo");
    });
    it("classifies permission problems as auth failures and account problems as API errors", async () => {
        鏖壍({ override: 丛壍(/ FROM customer /, "failure-user-permission-denied.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "auth_failed", errorCode: "USER_PERMISSION_DENIED" } } } });
        setupLiveEnv();
        鏖壍({ override: 丛壍(/ FROM customer /, "failure-customer-not-enabled.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "api_error", errorCode: "CUSTOMER_NOT_ENABLED" } } } });
    });
    it("goes live with the four required keys and no developer token", async () => {
        const { calls: 寘壍 } = 鏖壍();
        const 竇壍 = await resolveGoogleAds({ fresh: true });
        expect(竇壍.source).toMatchObject({ mode: "live", reason: null, apiVersion: "v25" });
        expect(竇壍.health).toMatchObject({ ok: true });
        const 馶壍 = 寘壍.filter((暥壍) => 暥壍.url !== TOKEN_URL);
        expect(馶壍.length).toBeGreaterThan(0);
        expect(馶壍.every((薔壍) => !("developer-token" in 薔壍.headers))).toBe(true);
    });
    it("still sends a configured developer token (ignored by Google, harmless)", async () => {
        const { searches: 劃壍 } = 鏖壍({ env: { GOOGLE_ADS_DEVELOPER_TOKEN: "legacy-dev-token-1" } });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "live" } });
        expect(劃壍()[0]!.headers["developer-token"]).toBe("legacy-dev-token-1");
    });
    it("counts four required keys: none → no_env, some → missing_keys (the developer token is never listed)", async () => {
        const 煲壍 = { GOOGLE_ADS_CLIENT_ID: "", GOOGLE_ADS_CLIENT_SECRET: "", GOOGLE_ADS_REFRESH_TOKEN: "", GOOGLE_ADS_CUSTOMER_ID: "" };
        setupLiveEnv({ ...煲壍, GOOGLE_ADS_DEVELOPER_TOKEN: "legacy-dev-token-1" });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "no_env" } } } });
        setupLiveEnv({ GOOGLE_ADS_REFRESH_TOKEN: "", GOOGLE_ADS_CUSTOMER_ID: "" });
        const 遡壍 = await resolveGoogleAds({ fresh: true });
        expect(遡壍.source.reason).toEqual({ code: "demo", cause: { code: "missing_keys", missing: ["GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"] } });
        const 遡因 = 遡壍.source.reason?.code === "demo" ? 遡壍.source.reason.cause : null;
        expect(describeBlankReason(遡壍.source.reason)).toMatch(/^Demo data: .*\.env is missing 2 of 4 required keys/);
        expect(describeBlankReason(遡因)).toBe(".env is missing 2 of 4 required keys (REFRESH_TOKEN, CUSTOMER_ID). The dashboard stays blank.");
    });
    it("treats a Cloud project without production access as an auth failure", async () => {
        鏖壍({ override: 丛壍(/ FROM customer /, "failure-cloud-project-test-access.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({
            source: { mode: "blank", reason: { code: "demo", cause: { code: "auth_failed", errorCode: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" } } },
        });
    });
});
describe("accounts", () => {
    it("lists a manager's enabled, visible client accounts via customer_client", async () => {
        const { source: 嵐壍, searches: 簿壍 } = 鏖壍({ env: { GOOGLE_ADS_LOGIN_CUSTOMER_ID: "987-654-3210" } });
        const 鬮壍 = await 嵐壍.listAccounts();
        expect(鬮壍.map((栝壍) => 栝壍.id)).toEqual([嗸壍, "2345678901"]);
        expect(鬮壍[0]).toEqual({ id: 嗸壍, name: "Acme Outdoor", currency: "USD", timezone: "America/New_York", isManager: false, parentId: "9876543210", mode: "live" });
        await expect(嵐壍.manager()).resolves.toEqual({ id: "9876543210", name: "Acme Agency MCC" });
        expect(簿壍()[0]!.customerId).toBe("9876543210");
        expect(簿壍().every((蜌壍) => 蜌壍.headers["login-customer-id"] === "9876543210")).toBe(true);
        const 叻壍 = 簿壍().length;
        await 嵐壍.listAccounts();
        expect(簿壍()).toHaveLength(叻壍);
    });
    it("lists directly accessible accounts without a manager", async () => {
        const { source: 狪壍, calls: 釙壍 } = 鏖壍();
        const 廈壍 = await 狪壍.listAccounts();
        expect(廈壍.map((綷壍) => [綷壍.id, 綷壍.currency, 綷壍.parentId])).toEqual([
            [嗸壍, "USD", undefined],
            ["2345678901", "EUR", undefined],
        ]);
        await expect(狪壍.manager()).resolves.toBeNull();
        expect(狪壍.defaultAccountId()).toBe(嗸壍);
        expect(釙壍.find((鲦壍) => 鲦壍.url.endsWith("customers:listAccessibleCustomers"))!.headers["login-customer-id"]).toBeUndefined();
    });
    it("computes today and data-through in each account's time zone", async () => {
        setClock(new Date("2026-09-29T02:00:00Z"));
        const { source: 榕壍 } = 鏖壍();
        await expect(榕壍.today(嗸壍)).resolves.toBe("2026-09-28");
        await expect(榕壍.dataThrough(嗸壍)).resolves.toBe("2026-09-27");
        await expect(榕壍.today("2345678901")).resolves.toBe("2026-09-29");
    });
    it("refuses accounts outside the directory and malformed ids", async () => {
        const { source: 袄壍, searches: 啳壍 } = 鏖壍();
        await expect(袄壍.account("5555555555")).rejects.toMatchObject({ code: "NOT_FOUND" });
        const 瑢壍 = await 袄壍.getTable("12; DROP", "campaign_daily", 瓧壍).catch((鍑壍: unknown) => 鍑壍);
        expect(瑢壍).toBeInstanceOf(AppError);
        expect(瑢壍).toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(袄壍.getTable(嗸壍, "campaign_daily", { start: "2026-09-01' OR 1=1", end: "2026-09-02" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        expect(啳壍().some((恀壍) => 镎壍.test(恀壍.query ?? ""))).toBe(false);
    });
});
describe("getTable", () => {
    it("filters to the requested range and serves repeats from the cache", async () => {
        const { source: 缯壍, byQuery: 鸞壍 } = 鏖壍();
        const 欍壍 = await 缯壍.getTable(嗸壍, "campaign_daily", 瓧壍);
        expect(欍壍.grain).toBe("daily");
        expect(欍壍.coverage).toEqual({ start: "2023-09-29", end: "2026-09-29" });
        expect(欍壍.rows).toHaveLength(5);
        expect(欍壍.rows.every((觼壍) => String(觼壍.date) >= 瓧壍.start && String(觼壍.date) <= 瓧壍.end)).toBe(true);
        expect(鸞壍(镎壍).map(戽壍)).toEqual([["2026-09-20", "2026-09-26"]]);
        await 缯壍.getTable(嗸壍, "campaign_daily", 瓧壍);
        const 囫壍 = await 缯壍.getTable(嗸壍, "campaign_daily", { start: "2026-09-21", end: "2026-09-22" });
        expect(囫壍.rows).toHaveLength(2);
        expect(鸞壍(镎壍)).toHaveLength(1);
        const 痚壍 = await 缯壍.getTable(嗸壍, "campaign_daily", { start: "2026-09-18", end: "2026-09-27" });
        expect(痚壍.rows).toHaveLength(7);
        expect(鸞壍(镎壍)
            .slice(1)
            .map(戽壍)
            .sort((铉壍, 憸壍) => String(铉壍).localeCompare(String(憸壍)))).toEqual([
            ["2026-09-18", "2026-09-19"],
            ["2026-09-27", "2026-09-27"],
        ]);
    });
    it("serves stale hot days while one background refresh runs", async () => {
        const { source: 肧壍, byQuery: 龖壍 } = 鏖壍();
        await 肧壍.getTable(嗸壍, "campaign_daily", 瓧壍);
        setClock(new Date(NOW.getTime() + 901000));
        const [沅壍, 譴壍] = await Promise.all([肧壍.getTable(嗸壍, "campaign_daily", 瓧壍), 肧壍.getTable(嗸壍, "campaign_daily", 瓧壍)]);
        expect(沅壍.rows).toHaveLength(5);
        expect(譴壍.rows).toHaveLength(5);
        await vi.waitFor(() => expect(龖壍(镎壍)).toHaveLength(2));
        await 集壍();
        expect(龖壍(镎壍)).toHaveLength(2);
    });
    it("keeps days older than the restatement window for 24 h", async () => {
        const { source: 塣壍, byQuery: 睒壍 } = 鏖壍();
        const 陁壍 = { start: "2026-08-01", end: "2026-08-05" };
        await 塣壍.getTable(嗸壍, "campaign_daily", 陁壍);
        setClock(new Date(NOW.getTime() + 2 * 3600000));
        await 塣壍.getTable(嗸壍, "campaign_daily", 陁壍);
        await 集壍();
        expect(睒壍(镎壍)).toHaveLength(1);
    });
    it("clamps hourly data to the last 92 days", async () => {
        const { source: 挰壍, byQuery: 舟壍 } = 鏖壍();
        const 伎壍 = await 挰壍.getTable(嗸壍, "campaign_hourly", { start: "2026-01-01", end: "2026-09-28" });
        expect(伎壍.coverage).toEqual({ start: "2026-06-30", end: "2026-09-29" });
        const 淽壍 = 舟壍(/segments\.hour/).map(戽壍);
        expect(淽壍.map((賬壍) => 賬壍?.[0]).sort()[0]).toBe("2026-06-30");
        expect(伎壍.rows.map((姛壍) => 姛壍.hour)).toEqual([0, 9, 23]);
        await expect(挰壍.coverage(嗸壍, "campaign_hourly")).resolves.toEqual({ start: "2026-06-30", end: "2026-09-29" });
    });
    it("returns search terms as a range-grain slice cached per range", async () => {
        const { source: 磊壍, byQuery: 鞹壍 } = 鏖壍();
        const 撨壍 = { start: "2026-09-01", end: "2026-09-28" };
        const 莗壍 = await 磊壍.getTable(嗸壍, "search_term_daily", 撨壍);
        expect(莗壍.grain).toBe("range");
        expect(莗壍.rows).toHaveLength(5);
        expect(莗壍.rows.every((傆壍) => 傆壍.date === null)).toBe(true);
        await 磊壍.getTable(嗸壍, "search_term_daily", 撨壍);
        expect(鞹壍(/ FROM search_term_view /)).toHaveLength(1);
        await 磊壍.getTable(嗸壍, "search_term_daily", { start: "2026-09-02", end: "2026-09-28" });
        expect(鞹壍(/ FROM search_term_view /)).toHaveLength(2);
    });
    it("resolves geo countries once and reuses them", async () => {
        const { source: 潵壍, byQuery: 蹤壍 } = 鏖壍();
        const 孓壍 = await 潵壍.getTable(嗸壍, "campaign_geo_daily", { start: "2026-09-20", end: "2026-09-20" });
        expect(孓壍.rows.map((穂壍) => 穂壍.country).sort()).toEqual(["CA", "US", "VN", "ZZ"]);
        await 潵壍.getTable(嗸壍, "campaign_geo_daily", { start: "2026-09-19", end: "2026-09-19" });
        const 餱壍 = 蹤壍(/ FROM geo_target_constant /);
        expect(餱壍).toHaveLength(1);
        expect(餱壍[0]!.query).toContain("WHERE geo_target_constant.id IN (2840, 2704, 2999, 2124)");
        expect(蹤壍(/ FROM user_location_view /)).toHaveLength(2);
    });
    it("maps every fact table end to end", async () => {
        const { source: 映壍 } = 鏖壍();
        const 蔏壍: GoogleTableId[] = ["campaign_daily", "campaign_device_daily", "campaign_geo_daily", "campaign_hourly", "ad_group_daily", "keyword_daily", "search_term_daily"];
        for (const 凾壍 of 蔏壍) {
            const 热壍 = await 映壍.getTable(嗸壍, 凾壍, 瓧壍);
            expect(热壍.rows.length, 凾壍).toBeGreaterThan(0);
            expect(热壍.rows.every((远壍) => 远壍.account_id === 嗸壍), 凾壍).toBe(true);
        }
    });
    it("surfaces upstream failures as GOOGLE_ADS_ERROR with the Google code", async () => {
        const { source: 峋壍 } = 鏖壍({ override: 丛壍(镎壍, "failure-user-permission-denied.json", 403) });
        const 箺壍 = await 峋壍.getTable(嗸壍, "campaign_daily", 瓧壍).catch((骩壍: unknown) => 骩壍);
        expect(箺壍).toBeInstanceOf(AppError);
        expect(箺壍).toMatchObject({ code: "GOOGLE_ADS_ERROR", details: { googleAdsCode: "USER_PERMISSION_DENIED", requestId: "fixture-req-perm" } });
    });
    it("refetches after invalidate()", async () => {
        const { source: 枘壍, byQuery: 蚇壍 } = 鏖壍();
        await 枘壍.getTable(嗸壍, "campaign_daily", 瓧壍);
        await 枘壍.invalidate(嗸壍);
        await 枘壍.getTable(嗸壍, "campaign_daily", 瓧壍);
        expect(蚇壍(镎壍)).toHaveLength(2);
    });
});
describe("dimensions and change history", () => {
    it("loads campaigns, ad groups and keywords once per TTL", async () => {
        const { source: 卶壍, searches: 牥壍 } = 鏖壍();
        const 酔壍 = await 卶壍.getDims(嗸壍);
        expect([...酔壍.campaigns.keys()]).toEqual(["111", "222", "333", "444", "555", "666", "777"]);
        expect(酔壍.adGroups.get("5002")).toMatchObject({ name: "Brand - Misspellings", status: "Paused" });
        expect(酔壍.keywords.get("5002~7001")).toMatchObject({ text: "acme boots", qs: 6 });
        const 幃壍 = 牥壍().length;
        await 卶壍.getDims(嗸壍);
        expect(牥壍()).toHaveLength(幃壍);
    });
    it("names removed entities that still have history, asking only once", async () => {
        const { source: 紲壍, byQuery: 鰡壍 } = 鏖壍();
        await 紲壍.getTable(嗸壍, "ad_group_daily", { start: "2026-09-20", end: "2026-09-20" });
        const 椐壍 = await 紲壍.getDims(嗸壍);
        expect(椐壍.adGroups.get("5099")).toEqual({ id: "5099", campaign_id: "111", name: "Old promo", status: "Removed" });
        await 紲壍.getDims(嗸壍);
        expect(鰡壍(/WHERE ad_group\.id IN \(5099\)/)).toHaveLength(1);
    });
    it("reads the last 30 days of change events, masked and summarized", async () => {
        const { source: 蟿壍, byQuery: 哮壍 } = 鏖壍();
        const 珝壍 = await 蟿壍.getChangeEvents(嗸壍, { start: "2026-08-01", end: "2026-09-29" });
        const 鋌壍 = 哮壍(/ FROM change_event /)[0]!.query!;
        expect(鋌壍).toContain("change_event.change_date_time >= '2026-08-31' AND change_event.change_date_time <= '2026-09-30'");
        expect(鋌壍).toContain("LIMIT 10000");
        expect(珝壍.map((徻壍) => 徻壍.date)).toEqual(["2026-09-25", "2026-09-24", "2026-09-22", "2026-09-20", "2026-09-18", "2026-09-10", "2026-09-09"]);
        expect(珝壍[0]).toMatchObject({ summary: "Budget changed from $420.00 to $455.00", campaign_id: "111", actor: "j•••@acme.example" });
        expect(珝壍.every((纪壍) => 纪壍.actor === undefined || 纪壍.actor.includes("•••"))).toBe(true);
        await 蟿壍.getChangeEvents(嗸壍, { start: "2026-08-01", end: "2026-09-29" });
        expect(哮壍(/ FROM change_event /)).toHaveLength(1);
        await expect(蟿壍.getChangeEvents(嗸壍, { start: "2026-07-01", end: "2026-07-31" })).resolves.toEqual([]);
    });
    it("only ever calls the token endpoint and read-only Google Ads methods", async () => {
        const { source: 鶙壍, calls: 檈壍 } = 鏖壍({ env: { GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9876543210" } });
        await 鶙壍.healthCheck();
        await 鶙壍.listAccounts();
        await 鶙壍.getDims(嗸壍);
        await 鶙壍.getChangeEvents(嗸壍, 瓧壍);
        for (const 襷壍 of ["campaign_daily", "campaign_geo_daily", "keyword_daily", "search_term_daily"] as const)
            await 鶙壍.getTable(嗸壍, 襷壍, 瓧壍);
        expect(檈壍.length).toBeGreaterThan(8);
        for (const 噦壍 of 檈壍) {
            if (噦壍.url === TOKEN_URL)
                continue;
            expect(() => assertReadOnlyUrl(噦壍.url), 噦壍.url).not.toThrow();
        }
    });
});
