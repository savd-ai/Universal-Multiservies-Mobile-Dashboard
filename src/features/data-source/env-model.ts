import type { EnvKeyStatusWire, StatusResponse } from "@/lib/domain/contracts/status";
import type { Tone } from "@/components/ui/status";

// Data source page model: env keys grouped for the credentials tables, the .env.example snippet and the go-live
// checklist — all derived from GET /api/status (which only ever carries masked hints, never values). Pure.

export const ENV_GROUPS = [
  { key: "google_ads", label: "Google Ads" },
  { key: "ai", label: "AI" },
  { key: "alerts", label: "Alerts" },
  { key: "plugins", label: "Plugins" },
  { key: "warehouse", label: "Warehouse" },
  { key: "security", label: "Security" },
  { key: "display", label: "Display" },
  { key: "demo", label: "Demo" },
] as const;

export interface EnvGroup {
  key: string;
  label: string;
  rows: EnvKeyStatusWire[];
  set: number;
  required: number;
  missingRequired: number;
}

const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Groups in a fixed order (unknown groups appended); within a group required keys first, then server order. */
export function groupEnv(env: readonly EnvKeyStatusWire[]): EnvGroup[] {
  const known = new Map<string, string>(ENV_GROUPS.map((g) => [g.key, g.label]));
  const order = [...ENV_GROUPS.map((g) => g.key as string), ...[...new Set(env.map((e) => e.group))].filter((g) => !known.has(g))];
  return order
    .map((key) => {
      const rows = env.filter((e) => e.group === key).sort((a, b) => Number(b.required) - Number(a.required));
      return {
        key,
        label: known.get(key) ?? titleCase(key),
        rows,
        set: rows.filter((r) => r.set).length,
        required: rows.filter((r) => r.required).length,
        missingRequired: rows.filter((r) => r.required && !r.set).length,
      };
    })
    .filter((g) => g.rows.length > 0);
}

export interface EnvRowStatus {
  label: string;
  tone: Tone;
}

/** Prototype semantics: set → masked hint (accent), required + missing → "Missing" (crit), else "Optional". */
export function envRowStatus(row: Pick<EnvKeyStatusWire, "set" | "required" | "masked">): EnvRowStatus {
  if (row.set) return { label: row.masked ?? "Set", tone: "accent" };
  if (row.required) return { label: "Missing", tone: "crit" };
  return { label: "Optional", tone: "faint" };
}

/** The core Google Ads keys the prototype's Credentials card lists: required first, then the MCC id. */
export function coreGoogleAdsRows(env: readonly EnvKeyStatusWire[]): EnvKeyStatusWire[] {
  const ga = env.filter((e) => e.group === "google_ads");
  return [...ga.filter((e) => e.required), ...ga.filter((e) => e.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID")];
}

/** `.env.example` for going live: required Google Ads keys, the optional MCC id, AI keys and the secrets key. */
export function envExample(env: readonly EnvKeyStatusWire[]): string {
  const ga = env.filter((e) => e.group === "google_ads");
  const required = ga.filter((e) => e.required).map((e) => `${e.key}=`);
  const lines = ["# Google Ads API — every key is required for live data", ...required];
  const login = ga.find((e) => e.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  if (login) lines.push("# optional", `${login.key}=`);
  const ai = env.filter((e) => e.group === "ai" && e.secret).map((e) => `# ${e.key}=`);
  if (ai.length) lines.push("", "# AI (optional) — any one key enables AI features", ...ai);
  if (env.some((e) => e.key === "APP_ENCRYPTION_KEY")) lines.push("", "# Encrypts secrets saved from the UI — npm run gen:key", "# APP_ENCRYPTION_KEY=");
  return lines.join("\n");
}

export type ChecklistState = "done" | "todo" | "manual";

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  state: ChecklistState;
}

const short = (k: string) => k.replace("GOOGLE_ADS_", "");

/** Go-live checklist: what the server can verify is checked automatically, the rest is a manual reminder. */
export function goLiveChecklist(status: Pick<StatusResponse, "googleAds" | "env" | "manager" | "mode">): ChecklistItem[] {
  const env = status.env;
  const required = env.filter((e) => e.group === "google_ads" && e.required);
  const missing = required.filter((e) => !e.set);
  const login = env.find((e) => e.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const health = status.googleAds.health;
  return [
    {
      id: "keys",
      label: `All ${required.length} required keys in .env`,
      detail: missing.length ? `Missing ${missing.map((e) => short(e.key)).join(", ")}.` : "OAuth client, refresh token and customer id are set.",
      state: missing.length ? "todo" : "done",
    },
    {
      id: "cloud-access",
      label: "Google Cloud project has Explorer access or higher",
      detail:
        "Access levels belong to the Google Cloud project that owns the OAuth client (developer tokens were sunset on 2026-09-09). Test access only reaches test accounts — check or upgrade it on the Google Ads API Overview page in Google Cloud Console.",
      state: "manual",
    },
    {
      id: "login-customer-id",
      label: "login-customer-id set for MCC access",
      detail: login?.set
        ? `Requests go through manager ${login.masked ?? "(set)"} — the account switcher lists its clients.`
        : "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID when the client account is reached through a manager (MCC) account.",
      state: login?.set ? "done" : "manual",
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
      detail: health?.ok
        ? `Reachable${health.latencyMs !== undefined ? ` · ${Math.round(health.latencyMs)} ms` : ""}.`
        : health?.errorCode
          ? `Last check failed (${health.errorCode}).`
          : missing.length
            ? "Runs once every required key is set."
            : "Run “Test connection” to check.",
      state: health?.ok && status.mode === "live" ? "done" : "todo",
    },
  ];
}

/** Plugin env vars that are set, by plugin id (presence only — values are never sent to the browser). */
export function pluginEnvDetections(env: readonly EnvKeyStatusWire[]): { pluginId: string; keys: string[] }[] {
  const byPlugin = new Map<string, string[]>();
  for (const e of env) {
    if (!e.pluginId || !e.set) continue;
    byPlugin.set(e.pluginId, [...(byPlugin.get(e.pluginId) ?? []), e.key]);
  }
  return [...byPlugin.entries()].map(([pluginId, keys]) => ({ pluginId, keys }));
}
