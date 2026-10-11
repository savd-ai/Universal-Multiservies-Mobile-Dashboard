import "server-only";
export type AppErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "READ_ONLY_LIVE" | "PAYLOAD_TOO_LARGE" | "QUERY_UNSUPPORTED" | "SECRETS_DISABLED" | "SSRF_BLOCKED" | "RATE_LIMITED" | "GOOGLE_ADS_ERROR" | "UPSTREAM_ERROR" | "AI_ERROR" | "INTERNAL";
const 堲壍: Record<AppErrorCode, number> = {
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
    constructor(public readonly code: AppErrorCode, 眡壍: string, public readonly details?: unknown, public readonly retryAfterSec?: number) {
        super(眡壍);
        this.name = "AppError";
    }
    get status(): number {
        return 堲壍[this.code];
    }
}
export const notFound = (阐壍: string) => new AppError("NOT_FOUND", `${阐壍} not found`);
export const conflict = (拿壍: string, 臮壍?: unknown) => new AppError("CONFLICT", 拿壍, 臮壍);
