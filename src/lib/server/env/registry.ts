import "server-only";

// Single source of truth for environment variables: generates .env.example, drives /api/status (presence +
// masking) and documents every key. Values are never read here — see config.ts.

export type EnvGroup = "google_ads" | "demo" | "ai" | "alerts" | "plugins" | "warehouse" | "security" | "display";

export interface EnvVarDef {
  key: string;
  group: EnvGroup;
  description: string;
  /** secret values are masked to the last 4 characters; never logged */
  secret?: boolean;
  /** required for live Google Ads data */
  requiredForLive?: boolean;
  default?: string;
  /** declared by a demo-only built-in plugin (presence is reported, value never used in v1) */
  pluginId?: string;
  example?: string;
}

const G = (key: string, description: string, extra: Partial<EnvVarDef> = {}): EnvVarDef => ({ key, group: "google_ads", description, ...extra });

export const ENV_VARS: EnvVarDef[] = [
  // Google Ads (the four required keys → live data; otherwise demo data is shown)
  G("GOOGLE_ADS_CLIENT_ID", "OAuth 2.0 client id from the Google Cloud project with Google Ads API access (Explorer or higher for production accounts).", { requiredForLive: true }),
  G("GOOGLE_ADS_CLIENT_SECRET", "OAuth 2.0 client secret.", { secret: true, requiredForLive: true }),
  G("GOOGLE_ADS_REFRESH_TOKEN", "Refresh token with the https://www.googleapis.com/auth/adwords scope.", { secret: true, requiredForLive: true }),
  G("GOOGLE_ADS_CUSTOMER_ID", "Default client account id (dashes allowed), e.g. 482-119-3307.", { requiredForLive: true }),
  G(
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "Optional legacy developer token. Google sunset developer tokens on 2026-09-09: the header is still sent when set but ignored — access levels come from the Google Cloud project that owns the OAuth client.",
    { secret: true },
  ),
  G("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "Manager (MCC) id — sent as login-customer-id and enables the account switcher."),
  G("GOOGLE_ADS_API_VERSION", "REST API version.", { default: "v25" }),
  G("GOOGLE_ADS_CACHE_TTL_SECONDS", "Cache lifetime for hot (recent) report chunks.", { default: "900" }),
  G("GOOGLE_ADS_RESTATEMENT_DAYS", "Recent days treated as hot because conversions restate.", { default: "14" }),
  G("GOOGLE_ADS_MAX_CONCURRENCY", "Parallel Google Ads API requests.", { default: "5" }),
  G("GOOGLE_ADS_TIMEOUT_MS", "Per-request timeout.", { default: "60000" }),
  G("GOOGLE_ADS_UI_URL_TEMPLATE", "Deep link used for read-only 'Open in Google Ads' actions.", { default: "https://ads.google.com/aw/campaigns?campaignId={campaignId}&ocid={customerId}" }),
  G("DASHBOARD_FORCE_DEMO", "Always show demo data, even when credentials exist.", { default: "false" }),

  // Demo data
  { key: "DEMO_PROFILE", group: "demo", description: "realistic = stable data anchored to yesterday; prototype = the reference HTML's exact dataset (ends 2026-09-28).", default: "realistic" },
  { key: "DEMO_SEED", group: "demo", description: "Seed for the demo generator.", default: "savd-demo-v1" },
  { key: "DEMO_TIMEZONE", group: "demo", description: "Demo account time zone (the anchor is yesterday there).", default: "America/New_York" },
  { key: "DEMO_CURRENCY", group: "demo", description: "Demo account currency.", default: "USD" },
  { key: "DEMO_ANCHOR_DATE", group: "demo", description: "Pin the last day of demo data (YYYY-MM-DD) for screenshots and tests." },
  { key: "DEMO_SCENARIOS", group: "demo", description: "extended = prototype anomalies + tracking break + budget-limited scenario; basic = prototype only.", default: "extended" },

  // AI (optional — demo suggestions are shown without a key)
  { key: "AI_PROVIDER", group: "ai", description: "auto | anthropic | openai | gemini | demo. auto picks the first provider with a key.", default: "auto" },
  { key: "ANTHROPIC_API_KEY", group: "ai", description: "Enables Claude.", secret: true },
  { key: "ANTHROPIC_MODEL", group: "ai", description: "Claude model id.", default: "claude-opus-5-5" },
  { key: "OPENAI_API_KEY", group: "ai", description: "Enables OpenAI.", secret: true },
  { key: "OPENAI_MODEL", group: "ai", description: "OpenAI model id.", default: "gpt-6-sol" },
  { key: "GEMINI_API_KEY", group: "ai", description: "Enables Gemini.", secret: true },
  { key: "GEMINI_MODEL", group: "ai", description: "Gemini model id.", default: "gemini-3.8-flash" },
  { key: "GEMINI_FALLBACK_MODEL", group: "ai", description: "Gemini model used when the main one is out of quota or unavailable (none = off). Flash-Lite has a much larger free-tier quota.", default: "gemini-3.5-flash-lite" },
  { key: "AI_EFFORT", group: "ai", description: "Override reasoning effort for every AI feature (low | medium | high)." },
  { key: "AI_RATE_LIMIT_PER_MIN", group: "ai", description: "AI requests per minute per client.", default: "10" },
  { key: "AI_DAILY_REQUEST_LIMIT", group: "ai", description: "Daily cap on AI requests (cost guard).", default: "300" },
  { key: "AI_MAX_CONCURRENCY", group: "ai", description: "Parallel AI calls.", default: "3" },
  { key: "AI_TIMEOUT_MS", group: "ai", description: "Upstream AI timeout.", default: "120000" },
  { key: "AI_DISABLED", group: "ai", description: "Always use the demo engine.", default: "false" },

  // Alerts (live webhooks)
  { key: "SLACK_WEBHOOK_URL", group: "alerts", description: "Slack incoming webhook URL.", secret: true },
  { key: "TEAMS_WEBHOOK_URL", group: "alerts", description: "Microsoft Teams Workflows webhook URL (Office 365 connector URLs were retired in 2026).", secret: true },
  { key: "DISCORD_WEBHOOK_URL", group: "alerts", description: "Discord webhook URL.", secret: true },
  { key: "ALERT_WEBHOOK_URL", group: "alerts", description: "Generic JSON webhook URL.", secret: true },
  { key: "ALERT_WEBHOOK_SECRET", group: "alerts", description: "HMAC-SHA256 signing secret for the generic webhook (X-SAVD-Signature).", secret: true },
  { key: "ALERTS_SCHEDULER_ENABLED", group: "alerts", description: "Evaluate alerts on a timer inside a long-running Node server.", default: "false" },
  { key: "ALERTS_INTERVAL_MINUTES", group: "alerts", description: "Scheduler interval (minimum 5).", default: "60" },
  { key: "ALERTS_DEMO_DISPATCH", group: "alerts", description: "Allow real webhook sends while showing demo data.", default: "false" },
  { key: "ALERTS_ALL_ACCOUNTS", group: "alerts", description: "Evaluate every accessible account under the manager (MCC), not just the active one.", default: "false" },
  { key: "ALERTS_DIGEST_AI", group: "alerts", description: "Let the configured AI provider write the daily digest summary (numbers stay server-computed).", default: "false" },
  { key: "CRON_SECRET", group: "alerts", description: "Bearer token for /api/cron/alerts (external cron).", secret: true },
  { key: "APP_BASE_URL", group: "alerts", description: "Public base URL used in alert links and the CSRF origin check.", default: "http://localhost:3000" },

  // Plugins
  { key: "PLUGINS_ALLOW_PRIVATE_NETWORK", group: "plugins", description: "Allow custom plugins/webhooks to reach private network addresses (cloud metadata stays blocked).", default: "false" },
  { key: "PLUGINS_ALLOW_HTTP", group: "plugins", description: "Allow plain http:// endpoints.", default: "false" },
  { key: "PLUGINS_FETCH_TIMEOUT_MS", group: "plugins", description: "Timeout for plugin and webhook requests.", default: "15000" },
  { key: "PLUGINS_MAX_RESPONSE_BYTES", group: "plugins", description: "Response size cap for plugin requests.", default: "5242880" },
  { key: "DEV_MOCK_PLATFORM", group: "plugins", description: "Expose the mock ad platform used by tests and the plugin builder demo.", default: "true in development" },
  ...[
    ["meta", "META_ADS_ACCESS_TOKEN", "META_ADS_AD_ACCOUNT_ID"],
    ["microsoft", "MICROSOFT_ADS_DEVELOPER_TOKEN", "MICROSOFT_ADS_ACCOUNT_ID"],
    ["tiktok", "TIKTOK_ADS_ACCESS_TOKEN", "TIKTOK_ADS_ADVERTISER_ID"],
    ["linkedin", "LINKEDIN_ADS_ACCESS_TOKEN", "LINKEDIN_ADS_ACCOUNT_ID"],
    ["amazon", "AMAZON_ADS_REFRESH_TOKEN", "AMAZON_ADS_PROFILE_ID"],
    ["pinterest", "PINTEREST_ADS_ACCESS_TOKEN", "PINTEREST_ADS_AD_ACCOUNT_ID"],
    ["snapchat", "SNAPCHAT_ADS_ACCESS_TOKEN", "SNAPCHAT_ADS_AD_ACCOUNT_ID"],
    ["reddit", "REDDIT_ADS_ACCESS_TOKEN", "REDDIT_ADS_ACCOUNT_ID"],
    ["ga4", "GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON"],
    ["shopify", "SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_API_TOKEN"],
    ["woocommerce", "WOOCOMMERCE_STORE_URL", "WOOCOMMERCE_CONSUMER_SECRET"],
    ["google-sheets", "GOOGLE_SHEETS_SPREADSHEET_ID", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"],
    ["bigquery", "BIGQUERY_PROJECT_ID", "BIGQUERY_SERVICE_ACCOUNT_JSON"],
  ].flatMap(([pluginId, ...keys]) =>
    keys.map((key) => ({
      key: key as string,
      group: "plugins" as const,
      pluginId,
      secret: /TOKEN|SECRET|JSON/.test(key as string),
      description: `Reserved for a future live ${pluginId} connector (demo data in v1; presence is reported only).`,
    })),
  ),

  // Security & storage
  { key: "AUTH_MODE", group: "security", description: "required = everyone signs in (users, roles, client workspaces); off = no login, everyone is a local admin (local demos only).", default: "required" },
  { key: "AUTH_SETUP_TOKEN", group: "security", description: "One-time code for creating the first admin on /setup. If unset, a random code is printed to the server log while no user exists.", secret: true },
  { key: "AUTH_SESSION_DAYS", group: "security", description: "Maximum session length in days.", default: "7" },
  { key: "AUTH_IDLE_HOURS", group: "security", description: "Sign out after this many hours without activity.", default: "24" },
  { key: "AUTH_INVITE_HOURS", group: "security", description: "How long invite and password-reset links stay valid.", default: "72" },
  { key: "AUTH_REQUIRE_2FA", group: "security", description: "off | agency | all — require an authenticator app (TOTP) for agency users or for everyone. Needs APP_ENCRYPTION_KEY.", default: "off" },
  { key: "AUTH_GOOGLE_CLIENT_ID", group: "security", description: "OAuth client id (Web) for \"Sign in with Google\". Redirect URI: {APP_BASE_URL}/api/auth/google/callback." },
  { key: "AUTH_GOOGLE_CLIENT_SECRET", group: "security", description: "OAuth client secret for \"Sign in with Google\".", secret: true },
  { key: "AUTH_GOOGLE_ALLOWED_DOMAINS", group: "security", description: "Comma-separated Google Workspace domains (e.g. savd.ai) whose verified users may sign in without an invite; they join as agency members." },
  { key: "DASHBOARD_BASIC_AUTH", group: "security", description: "user:password — an extra HTTP Basic auth gate in front of every page and API route (optional; the app has its own login).", secret: true },
  { key: "APP_ENCRYPTION_KEY", group: "security", description: "32-byte key (base64 or hex) that encrypts secrets saved from the UI. Generate with `npm run gen:key`.", secret: true },
  { key: "TRUST_PROXY", group: "security", description: "Use the first X-Forwarded-For hop for rate-limit keys.", default: "false" },
  // Analytics warehouse (SQLite)
  { key: "WAREHOUSE_ENABLED", group: "warehouse", description: "Keep Google Ads data in a local SQLite warehouse for long-term analytics (needs Node.js 22.13+).", default: "true" },
  { key: "WAREHOUSE_DIR", group: "warehouse", description: "Folder of the SQLite files (live.sqlite, demo.sqlite).", default: "<DATA_DIR>/warehouse" },
  { key: "WAREHOUSE_READS", group: "warehouse", description: "Serve settled days from the warehouse instead of asking Google again (false = store only).", default: "true" },
  { key: "WAREHOUSE_SYNC_ENABLED", group: "warehouse", description: "Sync every accessible account on a timer inside a long-running Node server.", default: "false" },
  { key: "WAREHOUSE_SYNC_INTERVAL_MINUTES", group: "warehouse", description: "Sync interval (minimum 15).", default: "360" },
  { key: "WAREHOUSE_BACKFILL_DAYS", group: "warehouse", description: "How far back a sync fills each table (capped by what Google keeps: 37 months daily, 92 days hourly, 12 months search terms).", default: "400" },
  { key: "WAREHOUSE_SYNC_MAX_REQUESTS", group: "warehouse", description: "Google Ads API requests one sync may spend (Explorer access allows 2,880 operations a day).", default: "250" },
  { key: "WAREHOUSE_RETENTION_DAYS", group: "warehouse", description: "Delete stored facts older than this many days (0 = keep everything).", default: "0" },

  { key: "DATA_DIR", group: "security", description: "Where the JSON store (and by default the warehouse) lives.", default: "./data" },
  { key: "STORE_DRIVER", group: "security", description: "file | memory.", default: "file" },
  { key: "LOG_LEVEL", group: "security", description: "debug | info | warn | error.", default: "info" },

  // Display
  { key: "DASHBOARD_CURRENCY", group: "display", description: "Display currency override (defaults to the account currency)." },
  { key: "FX_RATES", group: "display", description: 'JSON map of display conversion rates from the account currency, e.g. {"VND":25400}.', default: '{"VND":25400}' },
];

export const GROUP_LABELS: Record<EnvGroup, string> = {
  google_ads: "Google Ads API (all 4 required keys → live data; otherwise demo data)",
  demo: "Demo data",
  ai: "AI providers (optional — demo suggestions without a key)",
  alerts: "Alert webhooks & scheduler",
  plugins: "Plugins",
  warehouse: "Analytics warehouse (SQLite)",
  security: "Security & storage",
  display: "Display",
};

export const REQUIRED_LIVE_KEYS = ENV_VARS.filter((v) => v.requiredForLive).map((v) => v.key);
export const SECRET_KEYS = new Set(ENV_VARS.filter((v) => v.secret).map((v) => v.key));

export function renderEnvExample(): string {
  const lines: string[] = [
    "# SAVD Ads Intelligence — environment",
    "# Copy to .env and fill in what you have. Anything incomplete falls back to demo data with a visible reason.",
    "# Generated by `npm run env:example` from src/lib/server/env/registry.ts — do not edit by hand.",
    "",
  ];
  const groups = Object.keys(GROUP_LABELS) as EnvGroup[];
  for (const g of groups) {
    lines.push(`# ── ${GROUP_LABELS[g]} ──`);
    for (const v of ENV_VARS.filter((e) => e.group === g)) {
      lines.push(`# ${v.description}${v.requiredForLive ? " (required for live)" : ""}${v.default ? ` Default: ${v.default}` : ""}`);
      lines.push(`${v.key}=`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
