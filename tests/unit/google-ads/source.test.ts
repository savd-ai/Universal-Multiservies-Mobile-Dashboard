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
const ACCOUNT = "1234567890";
const WEEK: DateRange = { start: "2026-09-20", end: "2026-09-26" };
function live(opts: {
    override?: Handler;
    env?: Record<string, string>;
} = {}) {
    for (const [k, v] of Object.entries(opts.env ?? {}))
        vi.stubEnv(k, v);
    const m = mockFetch(googleAdsRouter(opts.override));
    vi.stubGlobal("fetch", m.fetch);
    const byQuery = (re: RegExp) => m.searches().filter((c) => re.test(c.query ?? ""));
    return { source: createLiveGoogleAdsSource(), byQuery, ...m };
}
const DAILY = / FROM campaign WHERE segments\.date/;
const between = (c: RecordedCall) => /BETWEEN '([\d-]+)' AND '([\d-]+)'/.exec(c.query ?? "")?.slice(1);
const onQuery = (re: RegExp, name: string, status: number): Handler => (call) => (re.test(call.query ?? "") ? fixtureResponse(name, status) : undefined);
const tick = () => new Promise((r) => setTimeout(r, 10));
beforeEach(() => setupLiveEnv());
afterEach(() => teardownLiveEnv());
describe("health check", () => {
    it("passes with a working token and customer query", async () => {
        const { source, searches } = live();
        const h = await source.healthCheck();
        expect(h).toMatchObject({ ok: true, checkedAt: NOW.toISOString(), account: { id: ACCOUNT, name: "Acme Outdoor" } });
        expect(h.latencyMs).toBeGreaterThanOrEqual(0);
        expect(searches()[0]!.query).toContain("FROM customer LIMIT 1");
    });
    it("explains a Cloud project with test-only access", async () => {
        const { source } = live({ override: onQuery(/ FROM customer /, "failure-cloud-project-test-access.json", 403) });
        const h = await source.healthCheck();
        expect(h).toMatchObject({ ok: false, errorCode: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" });
        expect(h.detail).toMatch(/only has Test access/);
        expect(h.detail).toContain("Google Ads API Overview page");
    });
    it("reports an expired refresh token with the 7-day hint", async () => {
        const { source } = live({ override: (call) => (call.url === TOKEN_URL ? fixtureResponse("oauth-invalid-grant.json", 400) : undefined) });
        const h = await source.healthCheck();
        expect(h).toMatchObject({ ok: false, errorCode: "AUTH_REFRESH_TOKEN_INVALID" });
        expect(h.detail).toMatch(/expire after 7 days/);
    });
    it("rejects a manager as the data account unless its clients are reachable", async () => {
        const plain = live({ env: { GOOGLE_ADS_CUSTOMER_ID: "9876543210" } });
        await expect(plain.source.healthCheck()).resolves.toMatchObject({ ok: false, errorCode: "REQUESTED_METRICS_FOR_MANAGER" });
        setupLiveEnv();
        const mcc = live({ env: { GOOGLE_ADS_CUSTOMER_ID: "9876543210", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9876543210" } });
        await expect(mcc.source.healthCheck()).resolves.toMatchObject({ ok: true, account: { id: "9876543210" } });
    });
});
describe("resolver integration (mocked network)", () => {
    it("falls back to demo data (cause auth_failed) when the refresh token is rejected", async () => {
        live({ override: (call) => (call.url === TOKEN_URL ? fixtureResponse("oauth-invalid-grant.json", 400) : undefined) });
        const r = await resolveGoogleAds({ fresh: true });
        expect(r.source.mode).toBe("blank");
        expect(r.source.reason).toMatchObject({ code: "demo", cause: { code: "auth_failed", errorCode: "AUTH_REFRESH_TOKEN_INVALID" } });
        expect(r.source.apiVersion).toBe("demo");
    });
    it("classifies permission problems as auth failures and account problems as API errors", async () => {
        live({ override: onQuery(/ FROM customer /, "failure-user-permission-denied.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "auth_failed", errorCode: "USER_PERMISSION_DENIED" } } } });
        setupLiveEnv();
        live({ override: onQuery(/ FROM customer /, "failure-customer-not-enabled.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "api_error", errorCode: "CUSTOMER_NOT_ENABLED" } } } });
    });
    it("goes live with the four required keys and no developer token", async () => {
        const { calls } = live();
        const r = await resolveGoogleAds({ fresh: true });
        expect(r.source).toMatchObject({ mode: "live", reason: null, apiVersion: "v25" });
        expect(r.health).toMatchObject({ ok: true });
        const api = calls.filter((c) => c.url !== TOKEN_URL);
        expect(api.length).toBeGreaterThan(0);
        expect(api.every((c) => !("developer-token" in c.headers))).toBe(true);
    });
    it("still sends a configured developer token (ignored by Google, harmless)", async () => {
        const { searches } = live({ env: { GOOGLE_ADS_DEVELOPER_TOKEN: "legacy-dev-token-1" } });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "live" } });
        expect(searches()[0]!.headers["developer-token"]).toBe("legacy-dev-token-1");
    });
    it("counts four required keys: none → no_env, some → missing_keys (the developer token is never listed)", async () => {
        const none = { GOOGLE_ADS_CLIENT_ID: "", GOOGLE_ADS_CLIENT_SECRET: "", GOOGLE_ADS_REFRESH_TOKEN: "", GOOGLE_ADS_CUSTOMER_ID: "" };
        setupLiveEnv({ ...none, GOOGLE_ADS_DEVELOPER_TOKEN: "legacy-dev-token-1" });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({ source: { mode: "blank", reason: { code: "demo", cause: { code: "no_env" } } } });
        setupLiveEnv({ GOOGLE_ADS_REFRESH_TOKEN: "", GOOGLE_ADS_CUSTOMER_ID: "" });
        const r = await resolveGoogleAds({ fresh: true });
        expect(r.source.reason).toEqual({ code: "demo", cause: { code: "missing_keys", missing: ["GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"] } });
        const selected = r.source.reason?.code === "demo" ? r.source.reason.cause : null;
        expect(describeBlankReason(r.source.reason)).toMatch(/^Demo data: .*\.env is missing 2 of 4 required keys/);
        expect(describeBlankReason(selected)).toBe(".env is missing 2 of 4 required keys (REFRESH_TOKEN, CUSTOMER_ID). The dashboard stays blank.");
    });
    it("treats a Cloud project without production access as an auth failure", async () => {
        live({ override: onQuery(/ FROM customer /, "failure-cloud-project-test-access.json", 403) });
        await expect(resolveGoogleAds({ fresh: true })).resolves.toMatchObject({
            source: { mode: "blank", reason: { code: "demo", cause: { code: "auth_failed", errorCode: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" } } },
        });
    });
});
describe("accounts", () => {
    it("lists a manager's enabled, visible client accounts via customer_client", async () => {
        const { source, searches } = live({ env: { GOOGLE_ADS_LOGIN_CUSTOMER_ID: "987-654-3210" } });
        const accounts = await source.listAccounts();
        expect(accounts.map((a) => a.id)).toEqual([ACCOUNT, "2345678901"]);
        expect(accounts[0]).toEqual({ id: ACCOUNT, name: "Acme Outdoor", currency: "USD", timezone: "America/New_York", isManager: false, parentId: "9876543210", mode: "live" });
        await expect(source.manager()).resolves.toEqual({ id: "9876543210", name: "Acme Agency MCC" });
        expect(searches()[0]!.customerId).toBe("9876543210");
        expect(searches().every((c) => c.headers["login-customer-id"] === "9876543210")).toBe(true);
        const n = searches().length;
        await source.listAccounts();
        expect(searches()).toHaveLength(n);
    });
    it("lists directly accessible accounts without a manager", async () => {
        const { source, calls } = live();
        const accounts = await source.listAccounts();
        expect(accounts.map((a) => [a.id, a.currency, a.parentId])).toEqual([
            [ACCOUNT, "USD", undefined],
            ["2345678901", "EUR", undefined],
        ]);
        await expect(source.manager()).resolves.toBeNull();
        expect(source.defaultAccountId()).toBe(ACCOUNT);
        expect(calls.find((c) => c.url.endsWith("customers:listAccessibleCustomers"))!.headers["login-customer-id"]).toBeUndefined();
    });
    it("computes today and data-through in each account's time zone", async () => {
        setClock(new Date("2026-09-29T02:00:00Z"));
        const { source } = live();
        await expect(source.today(ACCOUNT)).resolves.toBe("2026-09-28");
        await expect(source.dataThrough(ACCOUNT)).resolves.toBe("2026-09-27");
        await expect(source.today("2345678901")).resolves.toBe("2026-09-29");
    });
    it("refuses accounts outside the directory and malformed ids", async () => {
        const { source, searches } = live();
        await expect(source.account("5555555555")).rejects.toMatchObject({ code: "NOT_FOUND" });
        const bad = await source.getTable("12; DROP", "campaign_daily", WEEK).catch((e: unknown) => e);
        expect(bad).toBeInstanceOf(AppError);
        expect(bad).toMatchObject({ code: "VALIDATION_ERROR" });
        await expect(source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-01' OR 1=1", end: "2026-09-02" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
        expect(searches().some((c) => DAILY.test(c.query ?? ""))).toBe(false);
    });
});
describe("getTable", () => {
    it("filters to the requested range and serves repeats from the cache", async () => {
        const { source, byQuery } = live();
        const slice = await source.getTable(ACCOUNT, "campaign_daily", WEEK);
        expect(slice.grain).toBe("daily");
        expect(slice.coverage).toEqual({ start: "2023-09-29", end: "2026-09-29" });
        expect(slice.rows).toHaveLength(5);
        expect(slice.rows.every((r) => String(r.date) >= WEEK.start && String(r.date) <= WEEK.end)).toBe(true);
        expect(byQuery(DAILY).map(between)).toEqual([["2026-09-20", "2026-09-26"]]);
        await source.getTable(ACCOUNT, "campaign_daily", WEEK);
        const sub = await source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-21", end: "2026-09-22" });
        expect(sub.rows).toHaveLength(2);
        expect(byQuery(DAILY)).toHaveLength(1);
        const wider = await source.getTable(ACCOUNT, "campaign_daily", { start: "2026-09-18", end: "2026-09-27" });
        expect(wider.rows).toHaveLength(7);
        expect(byQuery(DAILY)
            .slice(1)
            .map(between)
            .sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
            ["2026-09-18", "2026-09-19"],
            ["2026-09-27", "2026-09-27"],
        ]);
    });
    it("serves stale hot days while one background refresh runs", async () => {
        const { source, byQuery } = live();
        await source.getTable(ACCOUNT, "campaign_daily", WEEK);
        setClock(new Date(NOW.getTime() + 901000));
        const [a, b] = await Promise.all([source.getTable(ACCOUNT, "campaign_daily", WEEK), source.getTable(ACCOUNT, "campaign_daily", WEEK)]);
        expect(a.rows).toHaveLength(5);
        expect(b.rows).toHaveLength(5);
        await vi.waitFor(() => expect(byQuery(DAILY)).toHaveLength(2));
        await tick();
        expect(byQuery(DAILY)).toHaveLength(2);
    });
    it("keeps days older than the restatement window for 24 h", async () => {
        const { source, byQuery } = live();
        const august = { start: "2026-08-01", end: "2026-08-05" };
        await source.getTable(ACCOUNT, "campaign_daily", august);
        setClock(new Date(NOW.getTime() + 2 * 3600000));
        await source.getTable(ACCOUNT, "campaign_daily", august);
        await tick();
        expect(byQuery(DAILY)).toHaveLength(1);
    });
    it("clamps hourly data to the last 92 days", async () => {
        const { source, byQuery } = live();
        const slice = await source.getTable(ACCOUNT, "campaign_hourly", { start: "2026-01-01", end: "2026-09-28" });
        expect(slice.coverage).toEqual({ start: "2026-06-30", end: "2026-09-29" });
        const runs = byQuery(/segments\.hour/).map(between);
        expect(runs.map((r) => r?.[0]).sort()[0]).toBe("2026-06-30");
        expect(slice.rows.map((r) => r.hour)).toEqual([0, 9, 23]);
        await expect(source.coverage(ACCOUNT, "campaign_hourly")).resolves.toEqual({ start: "2026-06-30", end: "2026-09-29" });
    });
    it("returns search terms as a range-grain slice cached per range", async () => {
        const { source, byQuery } = live();
        const range = { start: "2026-09-01", end: "2026-09-28" };
        const slice = await source.getTable(ACCOUNT, "search_term_daily", range);
        expect(slice.grain).toBe("range");
        expect(slice.rows).toHaveLength(5);
        expect(slice.rows.every((r) => r.date === null)).toBe(true);
        await source.getTable(ACCOUNT, "search_term_daily", range);
        expect(byQuery(/ FROM search_term_view /)).toHaveLength(1);
        await source.getTable(ACCOUNT, "search_term_daily", { start: "2026-09-02", end: "2026-09-28" });
        expect(byQuery(/ FROM search_term_view /)).toHaveLength(2);
    });
    it("resolves geo countries once and reuses them", async () => {
        const { source, byQuery } = live();
        const first = await source.getTable(ACCOUNT, "campaign_geo_daily", { start: "2026-09-20", end: "2026-09-20" });
        expect(first.rows.map((r) => r.country).sort()).toEqual(["CA", "US", "VN", "ZZ"]);
        await source.getTable(ACCOUNT, "campaign_geo_daily", { start: "2026-09-19", end: "2026-09-19" });
        const lookups = byQuery(/ FROM geo_target_constant /);
        expect(lookups).toHaveLength(1);
        expect(lookups[0]!.query).toContain("WHERE geo_target_constant.id IN (2840, 2704, 2999, 2124)");
        expect(byQuery(/ FROM user_location_view /)).toHaveLength(2);
    });
    it("maps every fact table end to end", async () => {
        const { source } = live();
        const tables: GoogleTableId[] = ["campaign_daily", "campaign_device_daily", "campaign_geo_daily", "campaign_hourly", "ad_group_daily", "keyword_daily", "search_term_daily"];
        for (const t of tables) {
            const slice = await source.getTable(ACCOUNT, t, WEEK);
            expect(slice.rows.length, t).toBeGreaterThan(0);
            expect(slice.rows.every((r) => r.account_id === ACCOUNT), t).toBe(true);
        }
    });
    it("surfaces upstream failures as GOOGLE_ADS_ERROR with the Google code", async () => {
        const { source } = live({ override: onQuery(DAILY, "failure-user-permission-denied.json", 403) });
        const err = await source.getTable(ACCOUNT, "campaign_daily", WEEK).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ code: "GOOGLE_ADS_ERROR", details: { googleAdsCode: "USER_PERMISSION_DENIED", requestId: "fixture-req-perm" } });
    });
    it("refetches after invalidate()", async () => {
        const { source, byQuery } = live();
        await source.getTable(ACCOUNT, "campaign_daily", WEEK);
        await source.invalidate(ACCOUNT);
        await source.getTable(ACCOUNT, "campaign_daily", WEEK);
        expect(byQuery(DAILY)).toHaveLength(2);
    });
});
describe("dimensions and change history", () => {
    it("loads campaigns, ad groups and keywords once per TTL", async () => {
        const { source, searches } = live();
        const dims = await source.getDims(ACCOUNT);
        expect([...dims.campaigns.keys()]).toEqual(["111", "222", "333", "444", "555", "666", "777"]);
        expect(dims.adGroups.get("5002")).toMatchObject({ name: "Brand - Misspellings", status: "Paused" });
        expect(dims.keywords.get("5002~7001")).toMatchObject({ text: "acme boots", qs: 6 });
        const n = searches().length;
        await source.getDims(ACCOUNT);
        expect(searches()).toHaveLength(n);
    });
    it("names removed entities that still have history, asking only once", async () => {
        const { source, byQuery } = live();
        await source.getTable(ACCOUNT, "ad_group_daily", { start: "2026-09-20", end: "2026-09-20" });
        const dims = await source.getDims(ACCOUNT);
        expect(dims.adGroups.get("5099")).toEqual({ id: "5099", campaign_id: "111", name: "Old promo", status: "Removed" });
        await source.getDims(ACCOUNT);
        expect(byQuery(/WHERE ad_group\.id IN \(5099\)/)).toHaveLength(1);
    });
    it("reads the last 30 days of change events, masked and summarized", async () => {
        const { source, byQuery } = live();
        const events = await source.getChangeEvents(ACCOUNT, { start: "2026-08-01", end: "2026-09-29" });
        const q = byQuery(/ FROM change_event /)[0]!.query!;
        expect(q).toContain("change_event.change_date_time >= '2026-08-31' AND change_event.change_date_time <= '2026-09-30'");
        expect(q).toContain("LIMIT 10000");
        expect(events.map((e) => e.date)).toEqual(["2026-09-25", "2026-09-24", "2026-09-22", "2026-09-20", "2026-09-18", "2026-09-10", "2026-09-09"]);
        expect(events[0]).toMatchObject({ summary: "Budget changed from $420.00 to $455.00", campaign_id: "111", actor: "j•••@acme.example" });
        expect(events.every((e) => e.actor === undefined || e.actor.includes("•••"))).toBe(true);
        await source.getChangeEvents(ACCOUNT, { start: "2026-08-01", end: "2026-09-29" });
        expect(byQuery(/ FROM change_event /)).toHaveLength(1);
        await expect(source.getChangeEvents(ACCOUNT, { start: "2026-07-01", end: "2026-07-31" })).resolves.toEqual([]);
    });
    it("only ever calls the token endpoint and read-only Google Ads methods", async () => {
        const { source, calls } = live({ env: { GOOGLE_ADS_LOGIN_CUSTOMER_ID: "9876543210" } });
        await source.healthCheck();
        await source.listAccounts();
        await source.getDims(ACCOUNT);
        await source.getChangeEvents(ACCOUNT, WEEK);
        for (const t of ["campaign_daily", "campaign_geo_daily", "keyword_daily", "search_term_daily"] as const)
            await source.getTable(ACCOUNT, t, WEEK);
        expect(calls.length).toBeGreaterThan(8);
        for (const c of calls) {
            if (c.url === TOKEN_URL)
                continue;
            expect(() => assertReadOnlyUrl(c.url), c.url).not.toThrow();
        }
    });
});
