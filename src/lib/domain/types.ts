export type CivilDate = string;
export type Mode = "live" | "blank";
export const CAMPAIGN_TYPES = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen", "App", "Other"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];
export const CAMPAIGN_STATUSES = ["Enabled", "Paused", "Removed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const DEVICES = ["Mobile", "Desktop", "Tablet", "Connected TV", "Other"] as const;
export type Device = (typeof DEVICES)[number];
export const MATCH_TYPES = ["Exact", "Phrase", "Broad"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export type Severity = "critical" | "warning" | "info";
export type MetricFormat = "money" | "number" | "decimal" | "percent" | "ratio";
export type MetricDirection = "up_good" | "down_good" | "neutral";
export interface AccountInfo {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    isManager: boolean;
    parentId?: string;
    mode: Mode;
}
/** Why the live Google Ads source isn't in use. */
export type LiveProblem = {
    code: "no_env";
} | {
    code: "missing_keys";
    missing: string[];
} | {
    code: "auth_failed";
    errorCode: string;
    detail: string;
} | {
    code: "api_error";
    errorCode: string;
    detail: string;
    requestId?: string;
};
/**
 * Mode "blank" with code "demo" means the dashboard shows the generated demo accounts instead of Google Ads
 * (asked for 2026-10-12); `cause` says why live data isn't available.
 */
export type BlankReason = LiveProblem | {
    code: "demo";
    cause: LiveProblem;
};
export const REQUIRED_GOOGLE_ADS_ENV = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
] as const;
export function isDemoReason(reason: BlankReason | null | undefined): reason is Extract<BlankReason, { code: "demo" }> {
    return reason?.code === "demo";
}
function shortLiveProblem(cause: LiveProblem): string {
    switch (cause.code) {
        case "no_env":
            return "no Google Ads credentials in .env";
        case "missing_keys":
            return `.env is missing ${cause.missing.length} of ${REQUIRED_GOOGLE_ADS_ENV.length} required keys`;
        case "auth_failed":
            return `Google Ads rejected the credentials (${cause.errorCode})`;
        case "api_error":
            return `the Google Ads API did not respond as expected (${cause.errorCode})`;
    }
}
export function describeBlankReason(reason: BlankReason | null | undefined): string {
    if (!reason)
        return "Google Ads API connected.";
    switch (reason.code) {
        case "demo":
            return `Demo data: generated sample accounts, not read from Google Ads. Live data replaces it once Google Ads is connected (now: ${shortLiveProblem(reason.cause)}).`;
        case "no_env":
            return "No Google Ads credentials found in .env. The dashboard stays blank until they are added.";
        case "missing_keys": {
            const short = reason.missing.map((k) => k.replace("GOOGLE_ADS_", "")).join(", ");
            return `.env is missing ${reason.missing.length} of ${REQUIRED_GOOGLE_ADS_ENV.length} required keys (${short}). The dashboard stays blank.`;
        }
        case "auth_failed":
            return `Google Ads credentials were rejected (${reason.errorCode}). ${reason.detail} The dashboard stays blank.`;
        case "api_error":
            return `The Google Ads API did not respond as expected (${reason.errorCode}).${reason.detail ? ` ${reason.detail}` : ""} The dashboard stays blank.`;
    }
}
