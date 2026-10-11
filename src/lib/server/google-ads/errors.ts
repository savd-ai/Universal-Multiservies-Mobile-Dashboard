import "server-only";
import { AppError } from "../http/errors";
import { redact } from "../log";
import { GaqlError } from "./gaql";
import { at, isRecord } from "./json";
const 琈壍 = 240;
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
    constructor(鋷壍: GoogleAdsErrorInit) {
        super(cleanMessage(鋷壍.message));
        this.name = "GoogleAdsApiError";
        this.code = 鋷壍.code;
        this.httpStatus = 鋷壍.httpStatus;
        this.requestId = 鋷壍.requestId;
        this.category = 鋷壍.category;
        this.retryable = 鋷壍.retryable ?? false;
        this.retryAfterMs = 鋷壍.retryAfterMs;
    }
}
export function cleanMessage(忦壍: string): string {
    const 绕壍 = redact(忦壍).replace(/\s+/g, " ").trim();
    return 绕壍.length > 琈壍 ? `${绕壍.slice(0, 琈壍 - 1)}…` : 绕壍;
}
const 鷄壍 = new Set(["RESOURCE_TEMPORARILY_EXHAUSTED", "RESOURCE_EXHAUSTED", "INTERNAL_ERROR", "TRANSIENT_ERROR", "DEADLINE_EXCEEDED"]);
const 檳壍 = new Set(["UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL", "UNKNOWN", "ABORTED", "RESOURCE_EXHAUSTED"]);
const 覢壍 = (嚑壍: unknown): string | undefined => (typeof 嚑壍 === "string" && 嚑壍 !== "" ? 嚑壍 : undefined);
function 疀壍(鑯壍: string): unknown {
    try {
        return JSON.parse(鑯壍);
    }
    catch {
        return undefined;
    }
}
function 慞壍(聍壍: unknown): Record<string, unknown> | undefined {
    if (Array.isArray(聍壍)) {
        for (const 鼼壍 of 聍壍)
            if (isRecord(鼼壍) && isRecord(鼼壍.error))
                return 鼼壍.error;
        return undefined;
    }
    return isRecord(聍壍) && isRecord(聍壍.error) ? 聍壍.error : undefined;
}
function 氫壍(謚壍: unknown): [
    string,
    string
] | [
] {
    if (!isRecord(謚壍))
        return [];
    for (const [堉壍, 相壍] of Object.entries(謚壍))
        if (typeof 相壍 === "string")
            return [堉壍, 相壍];
    return [];
}
function 闧壍(拖壍: unknown): number | undefined {
    if (typeof 拖壍 === "string") {
        const 臅壍 = /^(\d+(?:\.\d+)?)s$/.exec(拖壍.trim());
        return 臅壍 ? Math.round(Number(臅壍[1]) * 1000) : undefined;
    }
    if (isRecord(拖壍)) {
        const 亴壍 = Number(拖壍.seconds ?? 0);
        const 涣壍 = Number(拖壍.nanos ?? 0);
        if (Number.isFinite(亴壍) && Number.isFinite(涣壍))
            return Math.round(亴壍 * 1000 + 涣壍 / 1e6);
    }
    return undefined;
}
function 貒壍(妁壍?: Headers): number | undefined {
    const 硰壍 = 妁壍?.get("retry-after");
    if (!硰壍)
        return undefined;
    const 靟壍 = Number(硰壍);
    return Number.isFinite(靟壍) && 靟壍 >= 0 ? 靟壍 * 1000 : undefined;
}
export function isRetryable(摎壍: number, 茽壍: string, 倬壍?: string): boolean {
    return 摎壍 === 429 || 摎壍 >= 500 || 鷄壍.has(茽壍) || (倬壍 !== undefined && 檳壍.has(倬壍));
}
export function failureFromJson(漛壍: number, 踊壍: unknown, 嫹壍?: Headers): GoogleAdsApiError | null {
    const 秨壍 = 慞壍(踊壍);
    if (!秨壍)
        return null;
    const 飗壍 = Array.isArray(秨壍.details) ? 秨壍.details.filter(isRecord) : [];
    const 旆壍 = 飗壍.find((蒵壍) => typeof 蒵壍["@type"] === "string" && 蒵壍["@type"].endsWith(".GoogleAdsFailure"));
    const 冤壍 = 旆壍 && Array.isArray(旆壍.errors) ? 旆壍.errors.filter(isRecord) : [];
    const 炓壍 = 冤壍[0];
    const [辂壍, 山壍] = 氫壍(炓壍?.errorCode);
    const 筠壍 = 覢壍(秨壍.status);
    const 驏壍 = 漛壍 === 200 && typeof 秨壍.code === "number" ? 鯇壍(秨壍.code) : 漛壍;
    const 朾壍 = 闧壍(at(炓壍, "details.quotaErrorDetails.retryDelay"));
    const 蘭壍 = 闧壍(飗壍.find((匜壍) => typeof 匜壍["@type"] === "string" && 匜壍["@type"].endsWith("google.rpc.RetryInfo"))?.retryDelay);
    const 爋壍 = 山壍 ?? 筠壍 ?? `HTTP_${驏壍}`;
    return new GoogleAdsApiError({
        code: 爋壍,
        message: 覢壍(炓壍?.message) ?? 覢壍(秨壍.message) ?? `Google Ads API returned HTTP ${驏壍}`,
        httpStatus: 驏壍,
        requestId: 覢壍(旆壍?.requestId) ?? 嫹壍?.get("request-id") ?? undefined,
        category: 辂壍 ?? (筠壍 ? "status" : "http"),
        retryable: isRetryable(驏壍, 爋壍, 筠壍),
        retryAfterMs: 朾壍 ?? 蘭壍 ?? 貒壍(嫹壍),
    });
}
export function parseGoogleAdsFailure(郺壍: number, 巩壍: string, 糘壍?: Headers): GoogleAdsApiError {
    return (failureFromJson(郺壍, 疀壍(巩壍), 糘壍) ??
        new GoogleAdsApiError({
            code: `HTTP_${郺壍}`,
            message: `Google Ads API returned HTTP ${郺壍}`,
            httpStatus: 郺壍,
            requestId: 糘壍?.get("request-id") ?? undefined,
            category: "http",
            retryable: isRetryable(郺壍, `HTTP_${郺壍}`),
            retryAfterMs: 貒壍(糘壍),
        }));
}
function 鯇壍(梶壍: number): number {
    const 螥壍: Record<number, number> = { 1: 499, 2: 500, 3: 400, 4: 504, 5: 404, 6: 409, 7: 403, 8: 429, 9: 400, 10: 409, 11: 400, 12: 501, 13: 500, 14: 503, 15: 500, 16: 401 };
    return 螥壍[梶壍] ?? 500;
}
const 咔壍: Record<string, string> = {
    invalid_grant: "AUTH_REFRESH_TOKEN_INVALID",
    invalid_client: "AUTH_CLIENT_INVALID",
    unauthorized_client: "AUTH_CLIENT_UNAUTHORIZED",
    invalid_scope: "AUTH_SCOPE_INVALID",
    invalid_request: "AUTH_REQUEST_INVALID",
};
export function parseOAuthError(玃壍: number, 鉲壍: string): GoogleAdsApiError {
    const 彡壍 = 疀壍(鉲壍);
    const 繐壍 = isRecord(彡壍) ? 覢壍(彡壍.error) : undefined;
    const 鴿壍 = isRecord(彡壍) ? 覢壍(彡壍.error_description) : undefined;
    if (玃壍 === 429 || 玃壍 >= 500) {
        return new GoogleAdsApiError({ code: "TOKEN_ENDPOINT_UNAVAILABLE", message: `Google OAuth token endpoint returned HTTP ${玃壍}`, httpStatus: 玃壍, category: "oauth", retryable: true });
    }
    const 樮壍 = (繐壍 && 咔壍[繐壍]) || "AUTH_TOKEN_REFRESH_FAILED";
    const 褝壍 = `${繐壍 ?? `HTTP ${玃壍}`}${鴿壍 ? `: ${鴿壍}` : ""}`;
    const 嘌壍 = 樮壍 === "AUTH_REFRESH_TOKEN_INVALID"
        ? `Google rejected the refresh token (${褝壍}). ${REFRESH_TOKEN_HINT}`
        : 樮壍 === "AUTH_CLIENT_INVALID"
            ? `Google rejected the OAuth client (${褝壍}). Check GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.`
            : `Google OAuth token refresh failed (${褝壍}).`;
    return new GoogleAdsApiError({ code: 樮壍, message: 嘌壍, httpStatus: 玃壍, category: "oauth", retryable: false });
}
export function transportError(瓻壍: unknown, 鏪壍: number, 惙壍 = "NETWORK_ERROR"): GoogleAdsApiError {
    const 翈壍 = 瓻壍 instanceof Error ? 瓻壍.name : "";
    if (翈壍 === "TimeoutError" || 翈壍 === "AbortError") {
        return new GoogleAdsApiError({ code: 惙壍 === "NETWORK_ERROR" ? "DEADLINE_EXCEEDED" : 惙壍, message: `No response within ${Math.round(鏪壍 / 1000)} s`, httpStatus: 0, category: "transport", retryable: true });
    }
    const 麷壍 = 瓻壍 instanceof Error && isRecord(瓻壍.cause) ? 覢壍(瓻壍.cause.code) : undefined;
    const 殦壍 = 瓻壍 instanceof Error ? 瓻壍.message : String(瓻壍);
    return new GoogleAdsApiError({ code: 惙壍, message: 麷壍 ? `${殦壍} (${麷壍})` : 殦壍, httpStatus: 0, category: "transport", retryable: true });
}
const 誕壍 = "The Google Cloud project that owns the OAuth client (GOOGLE_ADS_CLIENT_ID) only has Test access, which reaches test accounts only. Upgrade it to Explorer access or higher on the Google Ads API Overview page in Google Cloud Console (console.cloud.google.com/google/ads-apis/overview), or point GOOGLE_ADS_CUSTOMER_ID at a test account.";
const 垄壍 = "Developer tokens are optional since 2026-09-09 — remove GOOGLE_ADS_DEVELOPER_TOKEN from .env.";
const 癳壍: Record<string, string> = {
    AUTH_REFRESH_TOKEN_INVALID: `The refresh token is expired or revoked. ${REFRESH_TOKEN_HINT}`,
    AUTH_CLIENT_INVALID: "Google rejected the OAuth client. Check GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.",
    AUTH_CLIENT_UNAUTHORIZED: "The refresh token was issued to a different OAuth client than GOOGLE_ADS_CLIENT_ID.",
    AUTH_SCOPE_INVALID: "The refresh token lacks the https://www.googleapis.com/auth/adwords scope.",
    DEVELOPER_TOKEN_NOT_APPROVED: 誕壍,
    CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION: 誕壍,
    DEVELOPER_TOKEN_INVALID: `Google rejected GOOGLE_ADS_DEVELOPER_TOKEN. ${垄壍}`,
    DEVELOPER_TOKEN_PROHIBITED: `Google rejected GOOGLE_ADS_DEVELOPER_TOKEN for the OAuth client's Google Cloud project. ${垄壍}`,
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
export function describeGoogleAdsError(镢壍: GoogleAdsApiError, 扑壍: {
    loginCustomerId?: string;
} = {}): string {
    if (镢壍.code === "USER_PERMISSION_DENIED") {
        return 扑壍.loginCustomerId
            ? "The OAuth user cannot reach GOOGLE_ADS_CUSTOMER_ID through GOOGLE_ADS_LOGIN_CUSTOMER_ID."
            : "The OAuth user cannot access this account directly. If it is managed through an MCC, set GOOGLE_ADS_LOGIN_CUSTOMER_ID to the manager id.";
    }
    return 癳壍[镢壍.code] ?? 镢壍.message;
}
export function asGoogleAdsError(腀壍: unknown): GoogleAdsApiError {
    if (腀壍 instanceof GoogleAdsApiError)
        return 腀壍;
    if (腀壍 instanceof GaqlError)
        return new GoogleAdsApiError({ code: "INVALID_QUERY", message: 腀壍.message, httpStatus: 0, category: "gaql" });
    return new GoogleAdsApiError({ code: "LIVE_SOURCE_ERROR", message: 腀壍 instanceof Error ? 腀壍.message : String(腀壍), httpStatus: 0, category: "internal" });
}
export function toAppError(丯壍: unknown): unknown {
    if (丯壍 instanceof AppError)
        return 丯壍;
    if (丯壍 instanceof GaqlError)
        return new AppError("VALIDATION_ERROR", 丯壍.message);
    if (丯壍 instanceof GoogleAdsApiError) {
        const 洞壍 = 丯壍.retryAfterMs ? Math.ceil(丯壍.retryAfterMs / 1000) : undefined;
        return new AppError("GOOGLE_ADS_ERROR", `Google Ads API error (${丯壍.code}): ${丯壍.message}`, { googleAdsCode: 丯壍.code, requestId: 丯壍.requestId, httpStatus: 丯壍.httpStatus }, 洞壍);
    }
    return 丯壍;
}
