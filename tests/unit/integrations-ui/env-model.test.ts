import { describe, expect, it } from "vitest";
import { coreGoogleAdsRows, envExample, envRowStatus, goLiveChecklist, groupEnv, pluginEnvDetections } from "@/features/data-source/env-model";
import type { EnvKeyStatusWire, StatusResponse } from "@/lib/domain/contracts/status";

const key = (k: string, group: string, o: Partial<EnvKeyStatusWire> = {}): EnvKeyStatusWire => ({ key: k, group, set: false, required: false, secret: false, masked: null, description: `${k} description`, ...o });

const REQUIRED = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"];

const env: EnvKeyStatusWire[] = [
  key("GOOGLE_ADS_API_VERSION", "google_ads"),
  ...REQUIRED.map((k, i) => key(k, "google_ads", { required: true, secret: i % 2 === 0, set: i < 2, masked: i < 2 ? "abc••••yz" : null })),
  key("GOOGLE_ADS_DEVELOPER_TOKEN", "google_ads", { secret: true }),
  key("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "google_ads"),
  key("DEMO_SEED", "demo"),
  key("ANTHROPIC_API_KEY", "ai", { secret: true, set: true, masked: "sk-••••42" }),
  key("OPENAI_API_KEY", "ai", { secret: true }),
  key("AI_PROVIDER", "ai"),
  key("SLACK_WEBHOOK_URL", "alerts", { secret: true }),
  key("META_ADS_ACCESS_TOKEN", "plugins", { secret: true, pluginId: "meta", set: true, masked: "EAA••••1" }),
  key("META_ADS_AD_ACCOUNT_ID", "plugins", { pluginId: "meta", set: true }),
  key("SHOPIFY_STORE_DOMAIN", "plugins", { pluginId: "shopify" }),
  key("APP_ENCRYPTION_KEY", "security", { secret: true }),
  key("DASHBOARD_CURRENCY", "display"),
  key("WEIRD_THING", "experimental"),
];

describe("env grouping", () => {
  it("orders groups Google Ads → AI → Alerts → Plugins → Security → Display → Demo, unknown groups last", () => {
    const groups = groupEnv(env);
    expect(groups.map((g) => g.label)).toEqual(["Google Ads", "AI", "Alerts", "Plugins", "Security", "Display", "Demo", "Experimental"]);
    const ga = groups[0];
    expect(ga?.rows.slice(0, 4).map((r) => r.key)).toEqual(REQUIRED);
    expect(ga).toMatchObject({ set: 2, required: 4, missingRequired: 2 });
    expect(groups.find((g) => g.key === "plugins")).toMatchObject({ set: 2, required: 0, missingRequired: 0 });
  });

  it("drops empty groups", () => {
    expect(groupEnv([key("X", "ai")]).map((g) => g.key)).toEqual(["ai"]);
    expect(groupEnv([])).toEqual([]);
  });

  it("labels rows like the prototype: masked hint when set, Missing when required, else Optional", () => {
    expect(envRowStatus({ set: true, required: true, masked: "abc••••yz" })).toEqual({ label: "abc••••yz", tone: "accent" });
    expect(envRowStatus({ set: true, required: false, masked: null })).toEqual({ label: "Set", tone: "accent" });
    expect(envRowStatus({ set: false, required: true, masked: null })).toEqual({ label: "Missing", tone: "crit" });
    expect(envRowStatus({ set: false, required: false, masked: null })).toEqual({ label: "Optional", tone: "faint" });
  });

  it("lists the core credentials: four required keys, then the MCC id (no developer token)", () => {
    expect(coreGoogleAdsRows(env).map((r) => r.key)).toEqual([...REQUIRED, "GOOGLE_ADS_LOGIN_CUSTOMER_ID"]);
  });

  it("builds .env.example from the key registry (names only)", () => {
    const text = envExample(env);
    const lines = text.split("\n");
    for (const k of REQUIRED) expect(lines).toContain(`${k}=`);
    expect(lines).toContain("# optional");
    expect(lines).toContain("GOOGLE_ADS_LOGIN_CUSTOMER_ID=");
    expect(lines).toContain("# ANTHROPIC_API_KEY=");
    expect(lines).toContain("# APP_ENCRYPTION_KEY=");
    expect(text).not.toContain("••");
    expect(lines.indexOf("GOOGLE_ADS_CLIENT_ID=")).toBeLessThan(lines.indexOf("# optional"));
    expect(text).not.toContain("GOOGLE_ADS_DEVELOPER_TOKEN");
  });

  it("reports plugin env detections by plugin (presence only)", () => {
    expect(pluginEnvDetections(env)).toEqual([{ pluginId: "meta", keys: ["META_ADS_ACCESS_TOKEN", "META_ADS_AD_ACCOUNT_ID"] }]);
  });
});

describe("go-live checklist", () => {
  const status = (o: { env?: EnvKeyStatusWire[]; health?: StatusResponse["googleAds"]["health"]; mode?: "live" | "demo" } = {}) =>
    ({ env: o.env ?? env, mode: o.mode ?? "demo", manager: null, googleAds: { apiVersion: "v25", envFile: true, missingKeys: [], health: o.health ?? null } }) as Pick<StatusResponse, "googleAds" | "env" | "manager" | "mode">;

  it("checks required keys and the MCC id automatically, the rest are manual reminders", () => {
    const items = goLiveChecklist(status());
    expect(items.map((i) => i.id)).toEqual(["keys", "cloud-access", "login-customer-id", "oauth-published", "health"]);
    expect(items[0]).toMatchObject({ state: "todo", label: "All 4 required keys in .env" });
    expect(items[0]?.detail).toBe("Missing REFRESH_TOKEN, CUSTOMER_ID.");
    expect(items[1]?.detail).toMatch(/Google Ads API Overview page in Google Cloud Console/);
    expect(items.map((i) => i.state)).toEqual(["todo", "manual", "manual", "manual", "todo"]);
  });

  it("turns green once everything is in place and the API answers", () => {
    const full = env.map((e) => (e.group === "google_ads" && (e.required || e.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID") ? { ...e, set: true, masked: "111••••33" } : e));
    const items = goLiveChecklist(status({ env: full, mode: "live", health: { ok: true, checkedAt: "2026-09-29T00:00:00Z", latencyMs: 212.4 } }));
    expect(items.find((i) => i.id === "keys")?.state).toBe("done");
    expect(items.find((i) => i.id === "login-customer-id")?.state).toBe("done");
    expect(items.find((i) => i.id === "health")).toMatchObject({ state: "done", detail: "Reachable · 212 ms." });
  });

  it("explains a failed health check", () => {
    const items = goLiveChecklist(status({ health: { ok: false, checkedAt: null, errorCode: "UNAUTHENTICATED" } }));
    expect(items.find((i) => i.id === "health")?.detail).toBe("Last check failed (UNAUTHENTICATED).");
  });
});
