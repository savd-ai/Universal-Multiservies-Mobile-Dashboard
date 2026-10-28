import "server-only";
import { AppError } from "../http/errors";
import { redact } from "../log";
import { GaqlError } from "./gaql";
import { at, isRecord } from "./json";
const MAX_MESSAGE = 240;
export const REFRESH_TOKEN_HINT = "OAuth apps in Testing status issue refresh tokens that expire after 7 days; publish the app or create a new token.";
export interface GoogleAdsErrorInit {
    code: string;
    message: string;
    httpStatus: number;
    requestId?: string;
    category?: string;
    retryable?: boolean;
    retryAfterMs?: number;
}
export class GoogleAdsApiError extends Error {
    readonly code: string;
    readonly httpStatus: number;
    readonly requestId?: string;
    readonly category?: string;
    readonly retryable: boolean;
    readonly retryAfterMs?: number;
    constructor(init: GoogleAdsErrorInit) {
        super(cleanMessage(init.message));
        this.name = "GoogleAdsApiError";
        this.code = init.code;
        this.httpStatus = init.httpStatus;
        this.requestId = init.requestId;
        this.category = init.category;
        this.retryable = init.retryable ?? false;
        this.retryAfterMs = init.retryAfterMs;
    }
}
export function cleanMessage(message: string): string {
    const flat = redact(message).replace(/\s+/g, " ").trim();
    return flat.length > MAX_MESSAGE ? `${flat.slice(0, MAX_MESSAGE - 1)}…` : flat;
}
const RETRYABLE_CODES = new Set(["RESOURCE_TEMPORARILY_EXHAUSTED", "RESOURCE_EXHAUSTED", "INTERNAL_ERROR", "TRANSIENT_ERROR", "DEADLINE_EXCEEDED"]);
const RETRYABLE_STATUS = new Set(["UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL", "UNKNOWN", "ABORTED", "RESOURCE_EXHAUSTED"]);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
function safeJson(body: string): unknown {
    try {
        return JSON.parse(body);
    }
    catch {
        return undefined;
    }
}
function statusOf(json: unknown): Record<string, unknown> | undefined {
    if (Array.isArray(json)) {
        for (const item of json)
            if (isRecord(item) && isRecord(item.error))
                return item.error;
        return undefined;
    }
    return isRecord(json) && isRecord(json.error) ? json.error : undefined;
}
function errorCodeOf(value: unknown): [
    string,
    string
] | [
] {
    if (!isRecord(value))
        return [];
    for (const [family, code] of Object.entries(value))
        if (typeof code === "string")
            return [family, code];
    return [];
}
function durationMs(value: unknown): number | undefined {
    if (typeof value === "string") {
        const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
        return m ? Math.round(Number(m[1]) * 1000) : undefined;
    }
    if (isRecord(value)) {
        const seconds = Number(value.seconds ?? 0);
        const nanos = Number(value.nanos ?? 0);
        if (Number.isFinite(seconds) && Number.isFinite(nanos))
            return Math.round(seconds * 1000 + nanos / 1e6);
    }
    return undefined;
}
function retryAfterHeader(headers?: Headers): number | undefined {
    const v = headers?.get("retry-after");
    if (!v)
        return undefined;
    const seconds = Number(v);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}
export function isRetryable(httpStatus: number, code: string, grpcStatus?: string): boolean {
    return httpStatus === 429 || httpStatus >= 500 || RETRYABLE_CODES.has(code) || (grpcStatus !== undefined && RETRYABLE_STATUS.has(grpcStatus));
}
export function failureFromJson(httpStatus: number, json: unknown, headers?: Headers): GoogleAdsApiError | null {
    const status = statusOf(json);
    if (!status)
        return null;
    const details = Array.isArray(status.details) ? status.details.filter(isRecord) : [];
    const failure = details.find((d) => typeof d["@type"] === "string" && d["@type"].endsWith(".GoogleAdsFailure"));
    const errors = failure && Array.isArray(failure.errors) ? failure.errors.filter(isRecord) : [];
    const first = errors[0];
    const [family, code] = errorCodeOf(first?.errorCode);
    const grpcStatus = str(status.status);
    const effectiveStatus = httpStatus === 200 && typeof status.code === "number" ? httpFromGrpc(status.code) : httpStatus;
    const quotaDelay = durationMs(at(first, "details.quotaErrorDetails.retryDelay"));
    const rpcDelay = durationMs(details.find((d) => typeof d["@type"] === "string" && d["@type"].endsWith("google.rpc.RetryInfo"))?.retryDelay);
    const finalCode = code ?? grpcStatus ?? `HTTP_${effectiveStatus}`;
    return new GoogleAdsApiError({
        code: finalCode,
        message: str(first?.message) ?? str(status.message) ?? `Google Ads API returned HTTP ${effectiveStatus}`,
        httpStatus: effectiveStatus,
        requestId: str(failure?.requestId) ?? headers?.get("request-id") ?? undefined,
        category: family ?? (grpcStatus ? "status" : "http"),
        retryable: isRetryable(effectiveStatus, finalCode, grpcStatus),
        retryAfterMs: quotaDelay ?? rpcDelay ?? retryAfterHeader(headers),
    });
}
export function parseGoogleAdsFailure(httpStatus: number, body: string, headers?: Headers): GoogleAdsApiError {
    return (failureFromJson(httpStatus, safeJson(body), headers) ??
        new GoogleAdsApiError({
            code: `HTTP_${httpStatus}`,
            message: `Google Ads API returned HTTP ${httpStatus}`,
            httpStatus,
            requestId: headers?.get("request-id") ?? undefined,
            category: "http",
            retryable: isRetryable(httpStatus, `HTTP_${httpStatus}`),
            retryAfterMs: retryAfterHeader(headers),
        }));
}
function httpFromGrpc(code: number): number {
    const map: Record<number, number> = { 1: 499, 2: 500, 3: 400, 4: 504, 5: 404, 6: 409, 7: 403, 8: 429, 9: 400, 10: 409, 11: 400, 12: 501, 13: 500, 14: 503, 15: 500, 16: 401 };
    return map[code] ?? 500;
}
const OAUTH_CODES: Record<string, string> = {
    invalid_grant: "AUTH_REFRESH_TOKEN_INVALID",
    invalid_client: "AUTH_CLIENT_INVALID",
    unauthorized_client: "AUTH_CLIENT_UNAUTHORIZED",
    invalid_scope: "AUTH_SCOPE_INVALID",
    invalid_request: "AUTH_REQUEST_INVALID",
};
export function parseOAuthError(httpStatus: number, body: string): GoogleAdsApiError {
    const json = safeJson(body);
    const error = isRecord(json) ? str(json.error) : undefined;
    const description = isRecord(json) ? str(json.error_description) : undefined;
    if (httpStatus === 429 || httpStatus >= 500) {
        return new GoogleAdsApiError({ code: "TOKEN_ENDPOINT_UNAVAILABLE", message: `Google OAuth token endpoint returned HTTP ${httpStatus}`, httpStatus, category: "oauth", retryable: true });
    }
    const code = (error && OAUTH_CODES[error]) || "AUTH_TOKEN_REFRESH_FAILED";
    const reason = `${error ?? `HTTP ${httpStatus}`}${description ? `: ${description}` : ""}`;
    const message = code === "AUTH_REFRESH_TOKEN_INVALID"
        ? `Google rejected the refresh token (${reason}). ${REFRESH_TOKEN_HINT}`
        : code === "AUTH_CLIENT_INVALID"
            ? `Google rejected the OAuth client (${reason}). Check GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.`
            : `Google OAuth token refresh failed (${reason}).`;
    return new GoogleAdsApiError({ code, message, httpStatus, category: "oauth", retryable: false });
}
export function transportError(err: unknown, timeoutMs: number, code = "NETWORK_ERROR"): GoogleAdsApiError {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
        return new GoogleAdsApiError({ code: code === "NETWORK_ERROR" ? "DEADLINE_EXCEEDED" : code, message: `No response within ${Math.round(timeoutMs / 1000)} s`, httpStatus: 0, category: "transport", retryable: true });
    }
    const cause = err instanceof Error && isRecord(err.cause) ? str(err.cause.code) : undefined;
    const base = err instanceof Error ? err.message : String(err);
    return new GoogleAdsApiError({ code, message: cause ? `${base} (${cause})` : base, httpStatus: 0, category: "transport", retryable: true });
}
const TEST_ACCESS = "The Google Cloud project that owns the OAuth client (GOOGLE_ADS_CLIENT_ID) only has Test access, which reaches test accounts only. Upgrade it to Explorer access or higher on the Google Ads API Overview page in Google Cloud Console (console.cloud.google.com/google/ads-apis/overview), or point GOOGLE_ADS_CUSTOMER_ID at a test account.";
const LEGACY_TOKEN = "Developer tokens are optional since 2026-09-09 — remove GOOGLE_ADS_DEVELOPER_TOKEN from .env.";
const DETAILS: Record<string, string> = {
    AUTH_REFRESH_TOKEN_INVALID: `The refresh token is expired or revoked. ${REFRESH_TOKEN_HINT}`,
    AUTH_CLIENT_INVALID: "Google rejected the OAuth client. Check GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.",
    AUTH_CLIENT_UNAUTHORIZED: "The refresh token was issued to a different OAuth client than GOOGLE_ADS_CLIENT_ID.",
    AUTH_SCOPE_INVALID: "The refresh token lacks the https://www.googleapis.com/auth/adwords scope.",
    DEVELOPER_TOKEN_NOT_APPROVED: TEST_ACCESS,
    CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION: TEST_ACCESS,
    DEVELOPER_TOKEN_INVALID: `Google rejected GOOGLE_ADS_DEVELOPER_TOKEN. ${LEGACY_TOKEN}`,
    DEVELOPER_TOKEN_PROHIBITED: `Google rejected GOOGLE_ADS_DEVELOPER_TOKEN for the OAuth client's Google Cloud project. ${LEGACY_TOKEN}`,
    DEVELOPER_TOKEN_NOT_ON_ALLOWLIST: "The OAuth client's Google Cloud project is not allow-listed for this feature.",
    CUSTOMER_NOT_ENABLED: "The Google Ads account is not enabled (cancelled, suspended or setup not finished).",
    NOT_ADS_USER: "The Google account that created the refresh token has no access to any Google Ads account.",
    INVALID_CUSTOMER_ID: "GOOGLE_ADS_CUSTOMER_ID is not a valid 10-digit customer id.",
    CUSTOMER_NOT_FOUND: "No Google Ads account matches GOOGLE_ADS_CUSTOMER_ID.",
    INVALID_LOGIN_CUSTOMER_ID_SERVING_CUSTOMER_ID_COMBINATION: "GOOGLE_ADS_LOGIN_CUSTOMER_ID does not manage GOOGLE_ADS_CUSTOMER_ID.",
    OAUTH_TOKEN_EXPIRED: "Google rejected the access token; create a new refresh token.",
    OAUTH_TOKEN_REVOKED: "Access was revoked for this app; create a new refresh token.",
    OAUTH_TOKEN_INVALID: "Google rejected the access token; create a new refresh token.",
    RESOURCE_EXHAUSTED: "The Google Ads API quota is used up for now; data refreshes resume automatically.",
    RESOURCE_TEMPORARILY_EXHAUSTED: "The Google Ads API is rate limiting requests; try again in a minute.",
    REQUESTED_METRICS_FOR_MANAGER: "GOOGLE_ADS_CUSTOMER_ID is a manager (MCC) account, which has no metrics. Set it to a client account and put the manager id in GOOGLE_ADS_LOGIN_CUSTOMER_ID.",
    TOKEN_ENDPOINT_UNAVAILABLE: "Google's OAuth token endpoint could not be reached.",
    DEADLINE_EXCEEDED: "The Google Ads API did not answer before GOOGLE_ADS_TIMEOUT_MS.",
    NETWORK_ERROR: "The Google Ads API could not be reached from this server.",
};
export function describeGoogleAdsError(err: GoogleAdsApiError, ctx: {
    loginCustomerId?: string;
} = {}): string {
    if (err.code === "USER_PERMISSION_DENIED") {
        return ctx.loginCustomerId
            ? "The OAuth user cannot reach GOOGLE_ADS_CUSTOMER_ID through GOOGLE_ADS_LOGIN_CUSTOMER_ID."
            : "The OAuth user cannot access this account directly. If it is managed through an MCC, set GOOGLE_ADS_LOGIN_CUSTOMER_ID to the manager id.";
    }
    return DETAILS[err.code] ?? err.message;
}
export function asGoogleAdsError(err: unknown): GoogleAdsApiError {
    if (err instanceof GoogleAdsApiError)
        return err;
    if (err instanceof GaqlError)
        return new GoogleAdsApiError({ code: "INVALID_QUERY", message: err.message, httpStatus: 0, category: "gaql" });
    return new GoogleAdsApiError({ code: "LIVE_SOURCE_ERROR", message: err instanceof Error ? err.message : String(err), httpStatus: 0, category: "internal" });
}
export function toAppError(err: unknown): unknown {
    if (err instanceof AppError)
        return err;
    if (err instanceof GaqlError)
        return new AppError("VALIDATION_ERROR", err.message);
    if (err instanceof GoogleAdsApiError) {
        const retryAfterSec = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : undefined;
        return new AppError("GOOGLE_ADS_ERROR", `Google Ads API error (${err.code}): ${err.message}`, { googleAdsCode: err.code, requestId: err.requestId, httpStatus: err.httpStatus }, retryAfterSec);
    }
    return err;
}
