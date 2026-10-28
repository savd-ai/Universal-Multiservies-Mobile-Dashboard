import "server-only";
export type AppErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "READ_ONLY_LIVE" | "PAYLOAD_TOO_LARGE" | "QUERY_UNSUPPORTED" | "SECRETS_DISABLED" | "SSRF_BLOCKED" | "RATE_LIMITED" | "GOOGLE_ADS_ERROR" | "UPSTREAM_ERROR" | "AI_ERROR" | "INTERNAL";
const STATUS: Record<AppErrorCode, number> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    READ_ONLY_LIVE: 409,
    PAYLOAD_TOO_LARGE: 413,
    QUERY_UNSUPPORTED: 422,
    SECRETS_DISABLED: 422,
    SSRF_BLOCKED: 422,
    RATE_LIMITED: 429,
    GOOGLE_ADS_ERROR: 502,
    UPSTREAM_ERROR: 502,
    AI_ERROR: 502,
    INTERNAL: 500,
};
export class AppError extends Error {
    constructor(public readonly code: AppErrorCode, message: string, public readonly details?: unknown, public readonly retryAfterSec?: number) {
        super(message);
        this.name = "AppError";
    }
    get status(): number {
        return STATUS[this.code];
    }
}
export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", message, details);
