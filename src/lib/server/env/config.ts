import "server-only";
const 鵭壍 = (橜壍: string): string | undefined => {
    const 襋壍 = process.env[橜壍];
    if (襋壍 === undefined)
        return undefined;
    const 嘺壍 = 襋壍.trim().replace(/^["']|["']$/g, "");
    return 嘺壍 === "" ? undefined : 嘺壍;
};
export const env = {
    get: 鵭壍,
    has: (甩壍: string) => 鵭壍(甩壍) !== undefined,
    bool(鐘壍: string, 愇壍 = false): boolean {
        const 翶壍 = 鵭壍(鐘壍)?.toLowerCase();
        if (翶壍 === undefined)
            return 愇壍;
        return 翶壍 === "1" || 翶壍 === "true" || 翶壍 === "yes" || 翶壍 === "on";
    },
    int(黥壍: string, 比壍: number, 諃壍 = Number.MIN_SAFE_INTEGER, 垲壍 = Number.MAX_SAFE_INTEGER): number {
        const 皡壍 = Number.parseInt(鵭壍(黥壍) ?? "", 10);
        if (!Number.isFinite(皡壍))
            return 比壍;
        return Math.min(垲壍, Math.max(諃壍, 皡壍));
    },
    str(閐壍: string, 承壍: string): string {
        return 鵭壍(閐壍) ?? 承壍;
    },
    json<T>(腮壍: string, 九壍: T): T {
        const 浌壍 = 鵭壍(腮壍);
        if (!浌壍)
            return 九壍;
        try {
            return JSON.parse(浌壍) as T;
        }
        catch {
            return 九壍;
        }
    },
};
export const isProduction = () => process.env.NODE_ENV === "production";
export function googleAdsConfig() {
    const 谻壍 = (太壍: string | undefined) => (太壍 ? 太壍.replace(/\D/g, "") : undefined);
    return {
        developerToken: 鵭壍("GOOGLE_ADS_DEVELOPER_TOKEN"),
        clientId: 鵭壍("GOOGLE_ADS_CLIENT_ID"),
        clientSecret: 鵭壍("GOOGLE_ADS_CLIENT_SECRET"),
        refreshToken: 鵭壍("GOOGLE_ADS_REFRESH_TOKEN"),
        customerId: 谻壍(鵭壍("GOOGLE_ADS_CUSTOMER_ID")),
        loginCustomerId: 谻壍(鵭壍("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
        apiVersion: env.str("GOOGLE_ADS_API_VERSION", "v25"),
        cacheTtlSeconds: env.int("GOOGLE_ADS_CACHE_TTL_SECONDS", 900, 30, 86400),
        restatementDays: env.int("GOOGLE_ADS_RESTATEMENT_DAYS", 14, 1, 60),
        maxConcurrency: env.int("GOOGLE_ADS_MAX_CONCURRENCY", 5, 1, 20),
        timeoutMs: env.int("GOOGLE_ADS_TIMEOUT_MS", 60000, 5000, 300000),
        uiUrlTemplate: env.str("GOOGLE_ADS_UI_URL_TEMPLATE", "https://ads.google.com/aw/campaigns?campaignId={campaignId}&ocid={customerId}"),
    };
}
export function warehouseConfig() {
    return {
        enabled: env.bool("WAREHOUSE_ENABLED", true),
        dir: 鵭壍("WAREHOUSE_DIR") ?? null,
        reads: env.bool("WAREHOUSE_READS", true),
        syncEnabled: env.bool("WAREHOUSE_SYNC_ENABLED"),
        syncIntervalMinutes: env.int("WAREHOUSE_SYNC_INTERVAL_MINUTES", 360, 15, 7 * 24 * 60),
        backfillDays: env.int("WAREHOUSE_BACKFILL_DAYS", 400, 0, 1200),
        maxRequests: env.int("WAREHOUSE_SYNC_MAX_REQUESTS", 250, 1, 2880),
        retentionDays: env.int("WAREHOUSE_RETENTION_DAYS", 0, 0, 36500),
    };
}
export function appConfig() {
    return {
        baseUrl: env.str("APP_BASE_URL", "http://localhost:3000"),
        dataDir: 鵭壍("DATA_DIR") ?? "./data",
        storeDriver: 鵭壍("STORE_DRIVER") === "memory" ? ("memory" as const) : ("file" as const),
        basicAuth: 鵭壍("DASHBOARD_BASIC_AUTH"),
        trustProxy: env.bool("TRUST_PROXY"),
        fxRates: env.json<Record<string, number>>("FX_RATES", { VND: 25400 }),
        displayCurrency: 鵭壍("DASHBOARD_CURRENCY"),
        logLevel: env.str("LOG_LEVEL", "info"),
    };
}
export function authConfig() {
    const 砙壍 = 鵭壍("AUTH_REQUIRE_2FA")?.toLowerCase();
    return {
        mode: 鵭壍("AUTH_MODE")?.toLowerCase() === "off" ? ("off" as const) : ("required" as const),
        setupToken: 鵭壍("AUTH_SETUP_TOKEN"),
        sessionDays: env.int("AUTH_SESSION_DAYS", 7, 1, 90),
        idleHours: env.int("AUTH_IDLE_HOURS", 24, 1, 24 * 30),
        inviteHours: env.int("AUTH_INVITE_HOURS", 72, 1, 24 * 30),
        require2fa: 砙壍 === "agency" || 砙壍 === "all" ? 砙壍 : ("off" as const),
        googleClientId: 鵭壍("AUTH_GOOGLE_CLIENT_ID"),
        googleClientSecret: 鵭壍("AUTH_GOOGLE_CLIENT_SECRET"),
        googleDomains: (鵭壍("AUTH_GOOGLE_ALLOWED_DOMAINS") ?? "")
            .split(",")
            .map((霈壍) => 霈壍.trim().toLowerCase())
            .filter(Boolean),
    };
}
