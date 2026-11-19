import "server-only";
import { isCivilDate } from "@/lib/domain/dates";

// Typed getters over process.env, read at call time (never at module top level) so one build can be configured at
// runtime (Docker) and tests can change values per case.

const raw = (key: string): string | undefined => {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const t = v.trim().replace(/^["']|["']$/g, "");
  return t === "" ? undefined : t;
};

export const env = {
  get: raw,
  has: (key: string) => raw(key) !== undefined,
  bool(key: string, fallback = false): boolean {
    const v = raw(key)?.toLowerCase();
    if (v === undefined) return fallback;
    return v === "1" || v === "true" || v === "yes" || v === "on";
  },
  int(key: string, fallback: number, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
    const n = Number.parseInt(raw(key) ?? "", 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  },
  str(key: string, fallback: string): string {
    return raw(key) ?? fallback;
  },
  json<T>(key: string, fallback: T): T {
    const v = raw(key);
    if (!v) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  },
};

export const isProduction = () => process.env.NODE_ENV === "production";

export function demoConfig() {
  const anchor = raw("DEMO_ANCHOR_DATE");
  return {
    profile: raw("DEMO_PROFILE") === "prototype" ? ("prototype" as const) : ("realistic" as const),
    seed: env.str("DEMO_SEED", "savd-demo-v1"),
    timezone: env.str("DEMO_TIMEZONE", "America/New_York"),
    currency: env.str("DEMO_CURRENCY", "USD"),
    anchor: anchor && isCivilDate(anchor) ? anchor : undefined,
    scenarios: raw("DEMO_SCENARIOS") === "basic" ? ("basic" as const) : ("extended" as const),
  };
}

export function googleAdsConfig() {
  const digits = (v: string | undefined) => (v ? v.replace(/\D/g, "") : undefined);
  return {
    developerToken: raw("GOOGLE_ADS_DEVELOPER_TOKEN"),
    clientId: raw("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: raw("GOOGLE_ADS_CLIENT_SECRET"),
    refreshToken: raw("GOOGLE_ADS_REFRESH_TOKEN"),
    customerId: digits(raw("GOOGLE_ADS_CUSTOMER_ID")),
    loginCustomerId: digits(raw("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
    apiVersion: env.str("GOOGLE_ADS_API_VERSION", "v25"),
    cacheTtlSeconds: env.int("GOOGLE_ADS_CACHE_TTL_SECONDS", 900, 30, 86_400),
    restatementDays: env.int("GOOGLE_ADS_RESTATEMENT_DAYS", 14, 1, 60),
    maxConcurrency: env.int("GOOGLE_ADS_MAX_CONCURRENCY", 5, 1, 20),
    timeoutMs: env.int("GOOGLE_ADS_TIMEOUT_MS", 60_000, 5_000, 300_000),
    uiUrlTemplate: env.str("GOOGLE_ADS_UI_URL_TEMPLATE", "https://ads.google.com/aw/campaigns?campaignId={campaignId}&ocid={customerId}"),
    forceDemo: env.bool("DASHBOARD_FORCE_DEMO"),
  };
}

export function warehouseConfig() {
  return {
    enabled: env.bool("WAREHOUSE_ENABLED", true),
    /** null → <DATA_DIR>/warehouse */
    dir: raw("WAREHOUSE_DIR") ?? null,
    reads: env.bool("WAREHOUSE_READS", true),
    syncEnabled: env.bool("WAREHOUSE_SYNC_ENABLED"),
    syncIntervalMinutes: env.int("WAREHOUSE_SYNC_INTERVAL_MINUTES", 360, 15, 7 * 24 * 60),
    backfillDays: env.int("WAREHOUSE_BACKFILL_DAYS", 400, 0, 1200),
    maxRequests: env.int("WAREHOUSE_SYNC_MAX_REQUESTS", 250, 1, 2880),
    retentionDays: env.int("WAREHOUSE_RETENTION_DAYS", 0, 0, 36_500),
  };
}

export function appConfig() {
  return {
    baseUrl: env.str("APP_BASE_URL", "http://localhost:3000"),
    dataDir: raw("DATA_DIR") ?? "./data",
    storeDriver: raw("STORE_DRIVER") === "memory" ? ("memory" as const) : ("file" as const),
    basicAuth: raw("DASHBOARD_BASIC_AUTH"),
    trustProxy: env.bool("TRUST_PROXY"),
    fxRates: env.json<Record<string, number>>("FX_RATES", { VND: 25_400 }),
    displayCurrency: raw("DASHBOARD_CURRENCY"),
    logLevel: env.str("LOG_LEVEL", "info"),
  };
}

export function authConfig() {
  const require2fa = raw("AUTH_REQUIRE_2FA")?.toLowerCase();
  return {
    mode: raw("AUTH_MODE")?.toLowerCase() === "off" ? ("off" as const) : ("required" as const),
    setupToken: raw("AUTH_SETUP_TOKEN"),
    sessionDays: env.int("AUTH_SESSION_DAYS", 7, 1, 90),
    idleHours: env.int("AUTH_IDLE_HOURS", 24, 1, 24 * 30),
    inviteHours: env.int("AUTH_INVITE_HOURS", 72, 1, 24 * 30),
    require2fa: require2fa === "agency" || require2fa === "all" ? require2fa : ("off" as const),
    googleClientId: raw("AUTH_GOOGLE_CLIENT_ID"),
    googleClientSecret: raw("AUTH_GOOGLE_CLIENT_SECRET"),
    googleDomains: (raw("AUTH_GOOGLE_ALLOWED_DOMAINS") ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  };
}
