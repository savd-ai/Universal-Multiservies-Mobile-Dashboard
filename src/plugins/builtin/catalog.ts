import "server-only";
import { demoPlatformRowsFromTotals, type PlatformKind } from "@/lib/domain/demo/generator";
import type { PluginManifest } from "@/lib/domain/contracts/plugins";
import { definePlugin, type PluginRuntime } from "@/lib/server/plugins/define";

// Built-in connectors. Ad platforms, analytics, commerce and export plugins run on demo data in v1 (the
// "Build a live connector" path uses the custom REST engine). Alert webhooks are live — see ./alerts.ts.

interface BuiltinSpec {
  id: string;
  name: string;
  abbr: string;
  category: PluginManifest["category"];
  description: string;
  kind: PlatformKind | "export";
  env: [key: string, label: string][];
  fields: [key: string, label: string, type: "text" | "secret" | "url"][];
  docsUrl?: string;
}

const SPECS: BuiltinSpec[] = [
  { id: "meta", name: "Meta Ads", abbr: "MT", category: "ad_platform", kind: "ad_platform", description: "Facebook and Instagram spend, conversions and ROAS, normalized to the same attribution window.", env: [["META_ADS_ACCESS_TOKEN", "Access token"], ["META_ADS_AD_ACCOUNT_ID", "Ad account ID"]], fields: [["accessToken", "Access token", "secret"], ["adAccountId", "Ad account ID", "text"]] },
  { id: "microsoft", name: "Microsoft Advertising", abbr: "MS", category: "ad_platform", kind: "ad_platform", description: "Bing search campaigns — often the cheapest incremental search volume.", env: [["MICROSOFT_ADS_DEVELOPER_TOKEN", "Developer token"], ["MICROSOFT_ADS_ACCOUNT_ID", "Account ID"]], fields: [["developerToken", "Developer token", "secret"], ["accountId", "Account ID", "text"]] },
  { id: "tiktok", name: "TikTok Ads", abbr: "TT", category: "ad_platform", kind: "ad_platform", description: "Spark Ads and in-feed video performance, side by side with YouTube.", env: [["TIKTOK_ADS_ACCESS_TOKEN", "Access token"], ["TIKTOK_ADS_ADVERTISER_ID", "Advertiser ID"]], fields: [["accessToken", "Access token", "secret"], ["advertiserId", "Advertiser ID", "text"]] },
  { id: "linkedin", name: "LinkedIn Ads", abbr: "LI", category: "ad_platform", kind: "ad_platform", description: "B2B audiences and lead-gen form conversions.", env: [["LINKEDIN_ADS_ACCESS_TOKEN", "Access token"], ["LINKEDIN_ADS_ACCOUNT_ID", "Account ID"]], fields: [["accessToken", "Access token", "secret"], ["accountId", "Account ID", "text"]] },
  { id: "amazon", name: "Amazon Ads", abbr: "AZ", category: "ad_platform", kind: "ad_platform", description: "Sponsored Products and Brands spend with ACoS/ROAS next to Shopping.", env: [["AMAZON_ADS_REFRESH_TOKEN", "Refresh token"], ["AMAZON_ADS_PROFILE_ID", "Profile ID"]], fields: [["refreshToken", "Refresh token", "secret"], ["profileId", "Profile ID", "text"]] },
  { id: "pinterest", name: "Pinterest Ads", abbr: "PI", category: "ad_platform", kind: "ad_platform", description: "Idea and shopping pins — useful for gift-season inspiration traffic.", env: [["PINTEREST_ADS_ACCESS_TOKEN", "Access token"], ["PINTEREST_ADS_AD_ACCOUNT_ID", "Ad account ID"]], fields: [["accessToken", "Access token", "secret"], ["adAccountId", "Ad account ID", "text"]] },
  { id: "snapchat", name: "Snapchat Ads", abbr: "SC", category: "ad_platform", kind: "ad_platform", description: "Story and Spotlight placements for younger audiences.", env: [["SNAPCHAT_ADS_ACCESS_TOKEN", "Access token"], ["SNAPCHAT_ADS_AD_ACCOUNT_ID", "Ad account ID"]], fields: [["accessToken", "Access token", "secret"], ["adAccountId", "Ad account ID", "text"]] },
  { id: "reddit", name: "Reddit Ads", abbr: "RD", category: "ad_platform", kind: "ad_platform", description: "Community-targeted conversation ads for enthusiast audiences.", env: [["REDDIT_ADS_ACCESS_TOKEN", "Access token"], ["REDDIT_ADS_ACCOUNT_ID", "Account ID"]], fields: [["accessToken", "Access token", "secret"], ["accountId", "Account ID", "text"]] },
  { id: "ga4", name: "Google Analytics 4", abbr: "GA", category: "analytics", kind: "analytics", description: "Sessions, engaged conversions and revenue for attribution cross-checks.", env: [["GA4_PROPERTY_ID", "Property ID"], ["GA4_SERVICE_ACCOUNT_JSON", "Service account JSON"]], fields: [["propertyId", "Property ID", "text"], ["serviceAccountJson", "Service account JSON", "secret"]] },
  { id: "shopify", name: "Shopify", abbr: "SH", category: "commerce", kind: "commerce", description: "Orders and net revenue as the source of truth for ROAS and MER.", env: [["SHOPIFY_STORE_DOMAIN", "Store domain"], ["SHOPIFY_ADMIN_API_TOKEN", "Admin API token"]], fields: [["storeDomain", "Store domain", "text"], ["adminApiToken", "Admin API token", "secret"]] },
  { id: "woocommerce", name: "WooCommerce", abbr: "WC", category: "commerce", kind: "commerce", description: "Order revenue from a WooCommerce store for blended MER.", env: [["WOOCOMMERCE_STORE_URL", "Store URL"], ["WOOCOMMERCE_CONSUMER_SECRET", "Consumer secret"]], fields: [["storeUrl", "Store URL", "url"], ["consumerSecret", "Consumer secret", "secret"]] },
  { id: "google-sheets", name: "Google Sheets", abbr: "GS", category: "export", kind: "export", description: "Scheduled export of any widget to a sheet, daily or weekly.", env: [["GOOGLE_SHEETS_SPREADSHEET_ID", "Spreadsheet ID"], ["GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON", "Service account JSON"]], fields: [["spreadsheetUrl", "Spreadsheet URL", "url"]] },
  { id: "bigquery", name: "BigQuery", abbr: "BQ", category: "export", kind: "export", description: "Nightly export of fact tables to a dataset for your own modelling.", env: [["BIGQUERY_PROJECT_ID", "Project ID"], ["BIGQUERY_SERVICE_ACCOUNT_JSON", "Service account JSON"]], fields: [["projectId", "Project ID", "text"], ["dataset", "Dataset", "text"]] },
];

function toRuntime(s: BuiltinSpec): PluginRuntime {
  const manifest: PluginManifest = {
    id: s.id,
    name: s.name,
    version: "1.0.0",
    kind: "builtin",
    category: s.category,
    description: s.description,
    icon: { abbr: s.abbr },
    capabilities: s.kind === "export" ? ["export.write"] : ["metrics.read"],
    live: false,
    env: s.env.map(([key, label]) => ({ key, label, secret: /TOKEN|SECRET|JSON/.test(key), required: true })),
    configFields: s.fields.map(([key, label, type]) => ({ key, label, type, required: false })),
    refresh: "hourly",
    docsUrl: s.docsUrl,
  };
  const kind = s.kind === "export" ? undefined : s.kind;
  return definePlugin({
    manifest,
    demoKind: kind,
    demo: kind
      ? (range, ctx) =>
          demoPlatformRowsFromTotals(
            ctx.google.filter((g) => g.date >= range.start && g.date <= range.end),
            ctx.account,
            s.id,
            kind,
            ctx.seed,
          )
      : undefined,
  });
}

export const BUILTIN_DEMO_PLUGINS: PluginRuntime[] = SPECS.map(toRuntime);

/** Connected by default on first run — the prototype shipped with { meta: true, ga4: true }. */
export const DEFAULT_CONNECTED = ["meta", "ga4"];
