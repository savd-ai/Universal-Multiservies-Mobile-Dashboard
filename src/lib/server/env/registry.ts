import "server-only";
export type EnvGroup = "google_ads" | "alerts" | "warehouse" | "security" | "display";
export interface EnvVarDef {
    key: string;
    group: EnvGroup;
    description: string;
    secret?: boolean;
    requiredForLive?: boolean;
    default?: string;
    example?: string;
}
const 揷壍 = (苦壍: string, 俕壍: string, 滄壍: Partial<EnvVarDef> = {}): EnvVarDef => ({ key: 苦壍, group: "google_ads", description: 俕壍, ...滄壍 });
export const ENV_VARS: EnvVarDef[] = [
    揷壍("GOOGLE_ADS_CLIENT_ID", "OAuth 2.0 client id from the Google Cloud project with Google Ads API access (Explorer or higher for production accounts).", { requiredForLive: true }),
    揷壍("GOOGLE_ADS_CLIENT_SECRET", "OAuth 2.0 client secret.", { secret: true, requiredForLive: true }),
    揷壍("GOOGLE_ADS_REFRESH_TOKEN", "Refresh token with the https://www.googleapis.com/auth/adwords scope.", { secret: true, requiredForLive: true }),
    揷壍("GOOGLE_ADS_CUSTOMER_ID", "Default client account id (dashes allowed), e.g. 482-119-3307.", { requiredForLive: true }),
    揷壍("GOOGLE_ADS_DEVELOPER_TOKEN", "Optional legacy developer token. Google sunset developer tokens on 2026-09-09: the header is still sent when set but ignored — access levels come from the Google Cloud project that owns the OAuth client.", { secret: true }),
    揷壍("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "Manager (MCC) id — sent as login-customer-id and enables the account switcher."),
    揷壍("GOOGLE_ADS_API_VERSION", "REST API version.", { default: "v25" }),
    揷壍("GOOGLE_ADS_CACHE_TTL_SECONDS", "Cache lifetime for hot (recent) report chunks.", { default: "900" }),
    揷壍("GOOGLE_ADS_RESTATEMENT_DAYS", "Recent days treated as hot because conversions restate.", { default: "14" }),
    揷壍("GOOGLE_ADS_MAX_CONCURRENCY", "Parallel Google Ads API requests.", { default: "5" }),
    揷壍("GOOGLE_ADS_TIMEOUT_MS", "Per-request timeout.", { default: "60000" }),
    揷壍("GOOGLE_ADS_UI_URL_TEMPLATE", "Deep link used for read-only 'Open in Google Ads' actions.", { default: "https://ads.google.com/aw/campaigns?campaignId={campaignId}&ocid={customerId}" }),
    { key: "SLACK_WEBHOOK_URL", group: "alerts", description: "Slack incoming webhook URL.", secret: true },
    { key: "TEAMS_WEBHOOK_URL", group: "alerts", description: "Microsoft Teams Workflows webhook URL (Office 365 connector URLs were retired in 2026).", secret: true },
    { key: "DISCORD_WEBHOOK_URL", group: "alerts", description: "Discord webhook URL.", secret: true },
    { key: "ALERT_WEBHOOK_URL", group: "alerts", description: "Generic JSON webhook URL.", secret: true },
    { key: "ALERT_WEBHOOK_SECRET", group: "alerts", description: "HMAC-SHA256 signing secret for the generic webhook (X-SAVD-Signature).", secret: true },
    { key: "ALERTS_SCHEDULER_ENABLED", group: "alerts", description: "Evaluate alerts on a timer inside a long-running Node server.", default: "false" },
    { key: "ALERTS_INTERVAL_MINUTES", group: "alerts", description: "Scheduler interval (minimum 5).", default: "60" },
    { key: "ALERTS_ALL_ACCOUNTS", group: "alerts", description: "Evaluate every accessible account under the manager (MCC), not just the active one.", default: "false" },
    { key: "CRON_SECRET", group: "alerts", description: "Bearer token for /api/cron/alerts (external cron).", secret: true },
    { key: "APP_BASE_URL", group: "alerts", description: "Public base URL used in alert links and the CSRF origin check.", default: "http://localhost:3000" },
    { key: "AUTH_MODE", group: "security", description: "required = everyone signs in (users, roles, client workspaces); off = no login, everyone is a local admin (local use only).", default: "required" },
    { key: "AUTH_SETUP_TOKEN", group: "security", description: "Code the first account must enter on /register to become the agency admin. Set it on any server others can reach (otherwise whoever registers first is admin).", secret: true },
    { key: "AUTH_SESSION_DAYS", group: "security", description: "Maximum session length in days.", default: "7" },
    { key: "AUTH_IDLE_HOURS", group: "security", description: "Sign out after this many hours without activity.", default: "24" },
    { key: "AUTH_MOBILE_SESSION_DAYS", group: "security", description: "Maximum length of a mobile app session in days (the app signs in with a bearer token).", default: "30" },
    { key: "AUTH_MOBILE_IDLE_DAYS", group: "security", description: "Sign a mobile app out after this many days without a request (background refreshes count).", default: "14" },
    { key: "AUTH_INVITE_HOURS", group: "security", description: "How long invite and password-reset links stay valid.", default: "72" },
    { key: "AUTH_REQUIRE_2FA", group: "security", description: "off | agency | all — require an authenticator app (TOTP) for agency users or for everyone. Needs APP_ENCRYPTION_KEY.", default: "off" },
    { key: "AUTH_GOOGLE_CLIENT_ID", group: "security", description: "OAuth client id (Web) for \"Sign in with Google\". Redirect URI: {APP_BASE_URL}/api/auth/google/callback." },
    { key: "AUTH_GOOGLE_CLIENT_SECRET", group: "security", description: "OAuth client secret for \"Sign in with Google\".", secret: true },
    { key: "AUTH_GOOGLE_ALLOWED_DOMAINS", group: "security", description: "Comma-separated Google Workspace domains (e.g. savd.ai) whose verified users may sign in without an invite; they join as agency members." },
    { key: "DASHBOARD_BASIC_AUTH", group: "security", description: "user:password — an extra HTTP Basic auth gate in front of every page and API route (optional; the app has its own login).", secret: true },
    { key: "APP_ENCRYPTION_KEY", group: "security", description: "32-byte key (base64 or hex) that encrypts secrets saved from the UI. Generate with `npm run gen:key`.", secret: true },
    { key: "TRUST_PROXY", group: "security", description: "Use the first X-Forwarded-For hop for rate-limit keys.", default: "false" },
    { key: "WAREHOUSE_ENABLED", group: "warehouse", description: "Keep Google Ads data in a local SQLite warehouse for long-term analytics (needs Node.js 22.13+).", default: "true" },
    { key: "WAREHOUSE_DIR", group: "warehouse", description: "Folder of the SQLite file (live.sqlite).", default: "<DATA_DIR>/warehouse" },
    { key: "WAREHOUSE_READS", group: "warehouse", description: "Serve settled days from the warehouse instead of asking Google again (false = store only).", default: "true" },
    { key: "WAREHOUSE_SYNC_ENABLED", group: "warehouse", description: "Sync every accessible account on a timer inside a long-running Node server.", default: "false" },
    { key: "WAREHOUSE_SYNC_INTERVAL_MINUTES", group: "warehouse", description: "Sync interval (minimum 15).", default: "360" },
    { key: "WAREHOUSE_BACKFILL_DAYS", group: "warehouse", description: "How far back a sync fills each table (capped by what Google keeps: 37 months daily, 92 days hourly, 12 months search terms).", default: "400" },
    { key: "WAREHOUSE_SYNC_MAX_REQUESTS", group: "warehouse", description: "Google Ads API requests one sync may spend (Explorer access allows 2,880 operations a day).", default: "250" },
    { key: "HISTORY_ENABLED", group: "warehouse", description: "Keep every anomaly evaluation, signal, notification and mobile device in a SQLite history database for long-term analysis (needs Node.js 22.13+).", default: "true" },
    { key: "HISTORY_DB", group: "warehouse", description: "Path of the history database file.", default: "<DATA_DIR>/history/history.sqlite" },
    { key: "HISTORY_RETENTION_DAYS", group: "warehouse", description: "Delete evaluation runs, observations and notifications older than this many days (0 = keep everything). Signals are kept.", default: "0" },
    { key: "WAREHOUSE_RETENTION_DAYS", group: "warehouse", description: "Delete stored facts older than this many days (0 = keep everything).", default: "0" },
    { key: "DATA_DIR", group: "security", description: "Where the JSON store (and by default the warehouse) lives.", default: "./data" },
    { key: "STORE_DRIVER", group: "security", description: "file | memory.", default: "file" },
    { key: "LOG_LEVEL", group: "security", description: "debug | info | warn | error.", default: "info" },
    { key: "DASHBOARD_CURRENCY", group: "display", description: "Display currency override (defaults to the account currency)." },
    { key: "FX_RATES", group: "display", description: 'JSON map of display conversion rates from the account currency, e.g. {"VND":25400}.', default: '{"VND":25400}' },
];
export const GROUP_LABELS: Record<EnvGroup, string> = {
    google_ads: "Google Ads API (all 4 required keys → live data; otherwise the dashboard stays blank)",
    alerts: "Alert webhooks & scheduler",
    warehouse: "Analytics warehouse (SQLite)",
    security: "Security & storage",
    display: "Display",
};
export const REQUIRED_LIVE_KEYS = ENV_VARS.filter((足壍) => 足壍.requiredForLive).map((媢壍) => 媢壍.key);
export const SECRET_KEYS = new Set(ENV_VARS.filter((禑壍) => 禑壍.secret).map((颀壍) => 颀壍.key));
export function renderEnvExample(): string {
    const 敯壍: string[] = [
        "# Environment",
        "# Copy to .env and fill in the four Google Ads keys. Until they are complete the dashboard stays blank and says why.",
        "# Generated by `npm run env:example` from src/lib/server/env/registry.ts — do not edit by hand.",
        "",
    ];
    const 葞壍 = Object.keys(GROUP_LABELS) as EnvGroup[];
    for (const 免壍 of 葞壍) {
        敯壍.push(`# ── ${GROUP_LABELS[免壍]} ──`);
        for (const 瀼壍 of ENV_VARS.filter((輫壍) => 輫壍.group === 免壍)) {
            敯壍.push(`# ${瀼壍.description}${瀼壍.requiredForLive ? " (required for live)" : ""}${瀼壍.default ? ` Default: ${瀼壍.default}` : ""}`);
            敯壍.push(`${瀼壍.key}=`);
        }
        敯壍.push("");
    }
    return 敯壍.join("\n");
}
