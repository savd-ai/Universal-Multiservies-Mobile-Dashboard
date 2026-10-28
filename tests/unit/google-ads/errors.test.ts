import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/http/errors";
import { describeGoogleAdsError, failureFromJson, GoogleAdsApiError, parseGoogleAdsFailure, parseOAuthError, toAppError, transportError } from "@/lib/server/google-ads/errors";
import { fixture } from "./helpers";
const parse = (name: string, status: number, headers?: Headers) => parseGoogleAdsFailure(status, JSON.stringify(fixture(name)), headers);
afterEach(() => {
    vi.unstubAllEnvs();
});
describe("GoogleAdsFailure parsing", () => {
    it.each([
        ["failure-developer-token-not-approved.json", 403, "DEVELOPER_TOKEN_NOT_APPROVED", "authorizationError", "fixture-req-dt-not-approved", false],
        ["failure-cloud-project-test-access.json", 403, "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION", "authorizationError", "fixture-req-cloud-test", false],
        ["failure-user-permission-denied.json", 403, "USER_PERMISSION_DENIED", "authorizationError", "fixture-req-perm", false],
        ["failure-customer-not-enabled.json", 403, "CUSTOMER_NOT_ENABLED", "authorizationError", "fixture-req-not-enabled", false],
        ["failure-not-ads-user.json", 401, "NOT_ADS_USER", "authenticationError", "fixture-req-not-ads-user", false],
        ["failure-invalid-customer-id.json", 400, "INVALID_CUSTOMER_ID", "requestError", "fixture-req-invalid-cid", false],
        ["failure-quota.json", 429, "RESOURCE_EXHAUSTED", "quotaError", "fixture-req-quota", true],
        ["failure-internal.json", 500, "INTERNAL_ERROR", "internalError", "fixture-req-internal", true],
    ])("%s → %s", (name, status, code, category, requestId, retryable) => {
        const err = parse(name, status);
        expect(err).toBeInstanceOf(GoogleAdsApiError);
        expect(err).toMatchObject({ code, category, requestId, retryable, httpStatus: status });
        expect(err.message.length).toBeGreaterThan(10);
        expect(err.message.length).toBeLessThanOrEqual(240);
    });
    it("reads the quota retry delay", () => {
        expect(parse("failure-quota.json", 429).retryAfterMs).toBe(2000);
        expect(parse("failure-quota-daily.json", 429).retryAfterMs).toBe(43200000);
    });
    it("falls back to the gRPC status, then the HTTP status", () => {
        expect(parse("failure-unauthenticated.json", 401)).toMatchObject({ code: "UNAUTHENTICATED", category: "status", retryable: false });
        expect(parse("failure-unavailable.json", 503)).toMatchObject({ code: "UNAVAILABLE", retryable: true });
        const html = parseGoogleAdsFailure(502, "<html><body>Bad Gateway</body></html>", new Headers({ "request-id": "hdr-1", "retry-after": "3" }));
        expect(html).toMatchObject({ code: "HTTP_502", requestId: "hdr-1", retryable: true, retryAfterMs: 3000 });
        expect(parseGoogleAdsFailure(404, "")).toMatchObject({ code: "HTTP_404", retryable: false });
    });
    it("finds an error element inside a searchStream array", () => {
        const err = failureFromJson(200, fixture("failure-stream-error.json"));
        expect(err).toMatchObject({ code: "RESOURCE_TEMPORARILY_EXHAUSTED", httpStatus: 429, retryable: true, retryAfterMs: 1000, requestId: "fixture-req-stream" });
        expect(failureFromJson(200, fixture("campaign-daily.json"))).toBeNull();
    });
    it("redacts secrets and caps the message at 240 characters", () => {
        vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "super-secret-dev-token-42");
        const body = { error: { code: 400, status: "INVALID_ARGUMENT", message: `bad token super-secret-dev-token-42 with Bearer ya29.abcdefghijklmnop ${"x".repeat(400)}` } };
        const err = parseGoogleAdsFailure(400, JSON.stringify(body));
        expect(err.message).not.toContain("super-secret-dev-token-42");
        expect(err.message).not.toContain("ya29.abcdefghijklmnop");
        expect(err.message).toContain("[GOOGLE_ADS_DEVELOPER_TOKEN]");
        expect(err.message.length).toBeLessThanOrEqual(240);
    });
});
describe("OAuth and transport errors", () => {
    it("maps invalid_grant with the Testing-status hint", () => {
        const err = parseOAuthError(400, JSON.stringify(fixture("oauth-invalid-grant.json")));
        expect(err).toMatchObject({ code: "AUTH_REFRESH_TOKEN_INVALID", retryable: false, category: "oauth" });
        expect(err.message).toContain("OAuth apps in Testing status issue refresh tokens that expire after 7 days");
    });
    it("maps invalid_client and server failures", () => {
        expect(parseOAuthError(401, JSON.stringify(fixture("oauth-invalid-client.json"))).code).toBe("AUTH_CLIENT_INVALID");
        expect(parseOAuthError(400, JSON.stringify({ error: "unauthorized_client" })).code).toBe("AUTH_CLIENT_UNAUTHORIZED");
        expect(parseOAuthError(503, "")).toMatchObject({ code: "TOKEN_ENDPOINT_UNAVAILABLE", retryable: true });
    });
    it("maps timeouts and network failures", () => {
        const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
        expect(transportError(timeout, 60000)).toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: true, httpStatus: 0 });
        const net = new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
        expect(transportError(net, 60000)).toMatchObject({ code: "NETWORK_ERROR", message: "fetch failed (ENOTFOUND)" });
    });
});
describe("explanations and HTTP mapping", () => {
    it("explains test-only access as a Cloud project access level", () => {
        const cloud = describeGoogleAdsError(parse("failure-cloud-project-test-access.json", 403));
        expect(cloud).toMatch(/Google Cloud project that owns the OAuth client .* only has Test access/);
        expect(cloud).toContain("console.cloud.google.com/google/ads-apis/overview");
        expect(cloud).not.toMatch(/developer token/i);
        expect(describeGoogleAdsError(parse("failure-developer-token-not-approved.json", 403))).toBe(cloud);
    });
    it("points at login-customer-id for permission errors without a manager", () => {
        const err = parse("failure-user-permission-denied.json", 403);
        expect(describeGoogleAdsError(err)).toContain("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
        expect(describeGoogleAdsError(err, { loginCustomerId: "9876543210" })).toContain("through GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    });
    it("surfaces as a 502 GOOGLE_ADS_ERROR with the Google code", () => {
        const app = toAppError(parse("failure-quota.json", 429));
        expect(app).toBeInstanceOf(AppError);
        const e = app as AppError;
        expect(e.code).toBe("GOOGLE_ADS_ERROR");
        expect(e.status).toBe(502);
        expect(e.details).toMatchObject({ googleAdsCode: "RESOURCE_EXHAUSTED", requestId: "fixture-req-quota" });
        expect(e.retryAfterSec).toBe(2);
    });
});
