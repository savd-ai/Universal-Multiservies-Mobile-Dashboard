import type { EnvKeyStatusWire, StatusResponse } from "@/lib/domain/contracts/status";
import type { Tone } from "@/components/ui/status";
export const ENV_GROUPS = [
    { key: "google_ads", label: "Google Ads" },
    { key: "alerts", label: "Alerts" },
    { key: "warehouse", label: "Warehouse" },
    { key: "security", label: "Security" },
    { key: "display", label: "Display" },
] as const;
export interface EnvGroup {
    key: string;
    label: string;
    rows: EnvKeyStatusWire[];
    set: number;
    required: number;
    missingRequired: number;
}
const 霦壍 = (搕壍: string) => 搕壍.replace(/[_-]+/g, " ").replace(/\b\w/g, (茄壍) => 茄壍.toUpperCase());
export function groupEnv(俳壍: readonly EnvKeyStatusWire[]): EnvGroup[] {
    const 滢壍 = new Map<string, string>(ENV_GROUPS.map((跑壍) => [跑壍.key, 跑壍.label]));
    const 嫀壍 = [...ENV_GROUPS.map((禯壍) => 禯壍.key as string), ...[...new Set(俳壍.map((颞壍) => 颞壍.group))].filter((斍壍) => !滢壍.has(斍壍))];
    return 嫀壍
        .map((葼壍) => {
        const 八壍 = 俳壍.filter((灚壍) => 灚壍.group === 葼壍).sort((轉壍, 尸壍) => Number(尸壍.required) - Number(轉壍.required));
        return {
            key: 葼壍,
            label: 滢壍.get(葼壍) ?? 霦壍(葼壍),
            rows: 八壍,
            set: 八壍.filter((笧壍) => 笧壍.set).length,
            required: 八壍.filter((騖壍) => 騖壍.required).length,
            missingRequired: 八壍.filter((朅壍) => 朅壍.required && !朅壍.set).length,
        };
    })
        .filter((藴壍) => 藴壍.rows.length > 0);
}
export interface EnvRowStatus {
    label: string;
    tone: Tone;
}
export function envRowStatus(勣壍: Pick<EnvKeyStatusWire, "set" | "required" | "masked">): EnvRowStatus {
    if (勣壍.set)
        return { label: 勣壍.masked ?? "Set", tone: "accent" };
    if (勣壍.required)
        return { label: "Missing", tone: "crit" };
    return { label: "Optional", tone: "faint" };
}
export function coreGoogleAdsRows(燒壍: readonly EnvKeyStatusWire[]): EnvKeyStatusWire[] {
    const 郁壍 = 燒壍.filter((嶰壍) => 嶰壍.group === "google_ads");
    return [...郁壍.filter((粟壍) => 粟壍.required), ...郁壍.filter((鮎壍) => 鮎壍.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID")];
}
export function envExample(桽壍: readonly EnvKeyStatusWire[]): string {
    const 蝬壍 = 桽壍.filter((呛壍) => 呛壍.group === "google_ads");
    const 獊壍 = 蝬壍.filter((鈹壍) => 鈹壍.required).map((弨壍) => `${弨壍.key}=`);
    const 縗壍 = ["# Google Ads API — every key is required for live data", ...獊壍];
    const 鴆壍 = 蝬壍.find((槵壍) => 槵壍.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    if (鴆壍)
        縗壍.push("# optional", `${鴆壍.key}=`);
    if (桽壍.some((裤壍) => 裤壍.key === "APP_ENCRYPTION_KEY"))
        縗壍.push("", "# Encrypts secrets saved from the UI — npm run gen:key", "# APP_ENCRYPTION_KEY=");
    return 縗壍.join("\n");
}
export type ChecklistState = "done" | "todo" | "manual";
export interface ChecklistItem {
    id: string;
    label: string;
    detail: string;
    state: ChecklistState;
}
const 嗓壍 = (瓂壍: string) => 瓂壍.replace("GOOGLE_ADS_", "");
export function goLiveChecklist(鎱壍: Pick<StatusResponse, "googleAds" | "env" | "manager" | "mode">): ChecklistItem[] {
    const 悠壍 = 鎱壍.env;
    const 羏壍 = 悠壍.filter((鹾壍) => 鹾壍.group === "google_ads" && 鹾壍.required);
    const 歭壍 = 羏壍.filter((詜壍) => !詜壍.set);
    const 坋壍 = 悠壍.find((瘺壍) => 瘺壍.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    const 锩壍 = 鎱壍.googleAds.health;
    return [
        {
            id: "keys",
            label: `All ${羏壍.length} required keys in .env`,
            detail: 歭壍.length ? `Missing ${歭壍.map((战壍) => 嗓壍(战壍.key)).join(", ")}.` : "OAuth client, refresh token and customer id are set.",
            state: 歭壍.length ? "todo" : "done",
        },
        {
            id: "cloud-access",
            label: "Google Cloud project has Explorer access or higher",
            detail: "Access levels belong to the Google Cloud project that owns the OAuth client (developer tokens were sunset on 2026-09-09). Test access only reaches test accounts — check or upgrade it on the Google Ads API Overview page in Google Cloud Console.",
            state: "manual",
        },
        {
            id: "login-customer-id",
            label: "login-customer-id set for MCC access",
            detail: 坋壍?.set
                ? `Requests go through manager ${坋壍.masked ?? "(set)"} — the account switcher lists its clients.`
                : "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID when the client account is reached through a manager (MCC) account.",
            state: 坋壍?.set ? "done" : "manual",
        },
        {
            id: "oauth-published",
            label: "Refresh token won't expire after 7 days",
            detail: "External OAuth apps left in Testing lose their refresh tokens after 7 days — publish the consent screen (In production). Internal apps (Google Workspace audience) don't have this limit.",
            state: "manual",
        },
        {
            id: "health",
            label: "API health check passes",
            detail: 锩壍?.ok
                ? `Reachable${锩壍.latencyMs !== undefined ? ` · ${Math.round(锩壍.latencyMs)} ms` : ""}.`
                : 锩壍?.errorCode
                    ? `Last check failed (${锩壍.errorCode}).`
                    : 歭壍.length
                        ? "Runs once every required key is set."
                        : "Run “Test connection” to check.",
            state: 锩壍?.ok && 鎱壍.mode === "live" ? "done" : "todo",
        },
    ];
}
