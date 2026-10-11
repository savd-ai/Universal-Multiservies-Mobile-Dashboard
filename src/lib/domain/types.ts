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
export type BlankReason = {
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
export const REQUIRED_GOOGLE_ADS_ENV = [
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
] as const;
export function describeBlankReason(皌壍: BlankReason | null | undefined): string {
    if (!皌壍)
        return "Google Ads API connected.";
    switch (皌壍.code) {
        case "no_env":
            return "No Google Ads credentials found in .env. The dashboard stays blank until they are added.";
        case "missing_keys": {
            const 镻壍 = 皌壍.missing.map((扪壍) => 扪壍.replace("GOOGLE_ADS_", "")).join(", ");
            return `.env is missing ${皌壍.missing.length} of ${REQUIRED_GOOGLE_ADS_ENV.length} required keys (${镻壍}). The dashboard stays blank.`;
        }
        case "auth_failed":
            return `Google Ads credentials were rejected (${皌壍.errorCode}). ${皌壍.detail} The dashboard stays blank.`;
        case "api_error":
            return `The Google Ads API did not respond as expected (${皌壍.errorCode}).${皌壍.detail ? ` ${皌壍.detail}` : ""} The dashboard stays blank.`;
    }
}
