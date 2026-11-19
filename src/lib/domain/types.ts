// Shared primitive types. Everything under src/lib/domain is pure and isomorphic:
// no fs, no process.env, no Date.now() — clocks and anchors are passed in.

/** Calendar date in the account time zone, formatted `YYYY-MM-DD`. */
export type CivilDate = string;

export type Mode = "live" | "demo";

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

export type DemoReason =
  | { code: "forced" }
  | { code: "no_env" }
  | { code: "missing_keys"; missing: string[] }
  | { code: "auth_failed"; errorCode: string; detail: string }
  | { code: "api_error"; errorCode: string; detail: string; requestId?: string };

/** Keys needed for live data (mirrors `requiredForLive` in server/env/registry.ts). The developer token is not one of
 * them: Google sunset developer tokens on 2026-09-09 — access levels belong to the OAuth client's Cloud project. */
export const REQUIRED_GOOGLE_ADS_ENV = [
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
] as const;

/** Human copy for a demo reason (ported from the prototype's banner text). */
export function describeDemoReason(reason: DemoReason | null | undefined): string {
  if (!reason) return "Google Ads API connected.";
  switch (reason.code) {
    case "forced":
      return "Demo mode is forced on (DASHBOARD_FORCE_DEMO=true). Every number below is generated demo data.";
    case "no_env":
      return "No Google Ads credentials found in .env. Every number below is generated demo data for a sample account.";
    case "missing_keys": {
      const short = reason.missing.map((k) => k.replace("GOOGLE_ADS_", "")).join(", ");
      return `.env is missing ${reason.missing.length} of ${REQUIRED_GOOGLE_ADS_ENV.length} required keys (${short}). Showing demo data.`;
    }
    case "auth_failed":
      return `Google Ads credentials were rejected (${reason.errorCode}). ${reason.detail} Showing demo data.`;
    case "api_error":
      return `The Google Ads API did not respond as expected (${reason.errorCode}).${reason.detail ? ` ${reason.detail}` : ""} Showing demo data.`;
  }
}
