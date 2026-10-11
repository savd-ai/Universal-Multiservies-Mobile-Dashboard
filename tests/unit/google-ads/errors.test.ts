import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/http/errors";
import { describeGoogleAdsError, failureFromJson, GoogleAdsApiError, parseGoogleAdsFailure, parseOAuthError, toAppError, transportError } from "@/lib/server/google-ads/errors";
import { fixture } from "./helpers";
const 堌壍 = (盻壍: string, 闪壍: number, 拙壍?: Headers) => parseGoogleAdsFailure(闪壍, JSON.stringify(fixture(盻壍)), 拙壍);
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
    ])("%s → %s", (臈壍, 亷壍, 润壍, 貕壍, 妄壍, 硳壍) => {
        const 面壍 = 堌壍(臈壍, 亷壍);
        expect(面壍).toBeInstanceOf(GoogleAdsApiError);
        expect(面壍).toMatchObject({ code: 润壍, category: 貕壍, requestId: 妄壍, retryable: 硳壍, httpStatus: 亷壍 });
        expect(面壍.message.length).toBeGreaterThan(10);
        expect(面壍.message.length).toBeLessThanOrEqual(240);
    });
    it("reads the quota retry delay", () => {
        expect(堌壍("failure-quota.json", 429).retryAfterMs).toBe(2000);
        expect(堌壍("failure-quota-daily.json", 429).retryAfterMs).toBe(43200000);
    });
    it("falls back to the gRPC status, then the HTTP status", () => {
        expect(堌壍("failure-unauthenticated.json", 401)).toMatchObject({ code: "UNAUTHENTICATED", category: "status", retryable: false });
        expect(堌壍("failure-unavailable.json", 503)).toMatchObject({ code: "UNAVAILABLE", retryable: true });
        const 摑壍 = parseGoogleAdsFailure(502, "<html><body>Bad Gateway</body></html>", new Headers({ "request-id": "hdr-1", "retry-after": "3" }));
        expect(摑壍).toMatchObject({ code: "HTTP_502", requestId: "hdr-1", retryable: true, retryAfterMs: 3000 });
        expect(parseGoogleAdsFailure(404, "")).toMatchObject({ code: "HTTP_404", retryable: false });
    });
    it("finds an error element inside a searchStream array", () => {
        const 荀壍 = failureFromJson(200, fixture("failure-stream-error.json"));
        expect(荀壍).toMatchObject({ code: "RESOURCE_TEMPORARILY_EXHAUSTED", httpStatus: 429, retryable: true, retryAfterMs: 1000, requestId: "fixture-req-stream" });
        expect(failureFromJson(200, fixture("campaign-daily.json"))).toBeNull();
    });
    it("redacts secrets and caps the message at 240 characters", () => {
        vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "super-secret-dev-token-42");
        const 倯壍 = { error: { code: 400, status: "INVALID_ARGUMENT", message: `bad token super-secret-dev-token-42 with Bearer ya29.abcdefghijklmnop ${"x".repeat(400)}` } };
        const 漞壍 = parseGoogleAdsFailure(400, JSON.stringify(倯壍));
        expect(漞壍.message).not.toContain("super-secret-dev-token-42");
        expect(漞壍.message).not.toContain("ya29.abcdefghijklmnop");
        expect(漞壍.message).toContain("[GOOGLE_ADS_DEVELOPER_TOKEN]");
        expect(漞壍.message.length).toBeLessThanOrEqual(240);
    });
});
describe("OAuth and transport errors", () => {
    it("maps invalid_grant with the Testing-status hint", () => {
        const 踍壍 = parseOAuthError(400, JSON.stringify(fixture("oauth-invalid-grant.json")));
        expect(踍壍).toMatchObject({ code: "AUTH_REFRESH_TOKEN_INVALID", retryable: false, category: "oauth" });
        expect(踍壍.message).toContain("OAuth apps in Testing status issue refresh tokens that expire after 7 days");
    });
    it("maps invalid_client and server failures", () => {
        expect(parseOAuthError(401, JSON.stringify(fixture("oauth-invalid-client.json"))).code).toBe("AUTH_CLIENT_INVALID");
        expect(parseOAuthError(400, JSON.stringify({ error: "unauthorized_client" })).code).toBe("AUTH_CLIENT_UNAUTHORIZED");
        expect(parseOAuthError(503, "")).toMatchObject({ code: "TOKEN_ENDPOINT_UNAVAILABLE", retryable: true });
    });
    it("maps timeouts and network failures", () => {
        const 嫼壍 = new DOMException("The operation was aborted due to timeout", "TimeoutError");
        expect(transportError(嫼壍, 60000)).toMatchObject({ code: "DEADLINE_EXCEEDED", retryable: true, httpStatus: 0 });
        const 秫壍 = new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
        expect(transportError(秫壍, 60000)).toMatchObject({ code: "NETWORK_ERROR", message: "fetch failed (ENOTFOUND)" });
    });
});
describe("explanations and HTTP mapping", () => {
    it("explains test-only access as a Cloud project access level", () => {
        const 飚壍 = describeGoogleAdsError(堌壍("failure-cloud-project-test-access.json", 403));
        expect(飚壍).toMatch(/Google Cloud project that owns the OAuth client .* only has Test access/);
        expect(飚壍).toContain("console.cloud.google.com/google/ads-apis/overview");
        expect(飚壍).not.toMatch(/developer token/i);
        expect(describeGoogleAdsError(堌壍("failure-developer-token-not-approved.json", 403))).toBe(飚壍);
    });
    it("points at login-customer-id for permission errors without a manager", () => {
        const 旉壍 = 堌壍("failure-user-permission-denied.json", 403);
        expect(describeGoogleAdsError(旉壍)).toContain("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
        expect(describeGoogleAdsError(旉壍, { loginCustomerId: "9876543210" })).toContain("through GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    });
    it("surfaces as a 502 GOOGLE_ADS_ERROR with the Google code", () => {
        const 蒸壍 = toAppError(堌壍("failure-quota.json", 429));
        expect(蒸壍).toBeInstanceOf(AppError);
        const 冧壍 = 蒸壍 as AppError;
        expect(冧壍.code).toBe("GOOGLE_ADS_ERROR");
        expect(冧壍.status).toBe(502);
        expect(冧壍.details).toMatchObject({ googleAdsCode: "RESOURCE_EXHAUSTED", requestId: "fixture-req-quota" });
        expect(冧壍.retryAfterSec).toBe(2);
    });
});
