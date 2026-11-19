import { describe, expect, it } from "vitest";
import { canBuildLive, cardStatus, filterCounts, filterPlugins, galleryStats, isAlertPlugin, needsConnectForm, readsMetrics } from "@/features/plugins/plugin-meta";
import type { PluginManifest, PluginView } from "@/lib/domain/contracts/plugins";

const view = (id: string, category: PluginManifest["category"], o: Partial<PluginView> & { live?: boolean; caps?: PluginManifest["capabilities"]; fields?: number } = {}): PluginView => ({
  manifest: {
    id,
    name: id.replace(/(^|-)(\w)/g, (_, s: string, c: string) => `${s ? " " : ""}${c.toUpperCase()}`),
    version: "1.0.0",
    kind: o.custom ? "rest" : "builtin",
    category,
    description: `${id} description`,
    icon: { abbr: id.slice(0, 2).toUpperCase() },
    capabilities: o.caps ?? (category === "alerts" ? ["alerts.send"] : category === "export" ? ["export.write"] : ["metrics.read"]),
    live: o.live ?? false,
    configFields: Array.from({ length: o.fields ?? 1 }, (_, i) => ({ key: `f${i}`, label: `F${i}`, type: "text" as const, required: false })),
    refresh: "hourly",
  },
  connected: o.connected ?? false,
  mode: o.mode ?? (o.connected ? "demo" : "off"),
  status: o.status ?? (o.connected ? "connected" : "available"),
  envDetected: o.envDetected ?? [],
  custom: o.custom ?? false,
  ...(o.reason ? { reason: o.reason } : {}),
});

const list = [
  view("meta", "ad_platform", { connected: true }),
  view("tiktok", "ad_platform", { envDetected: [{ key: "TIKTOK_ADS_ACCESS_TOKEN", set: true }] }),
  view("ga4", "analytics", { connected: true }),
  view("shopify", "commerce"),
  view("google-sheets", "export"),
  view("slack", "alerts", { live: true }),
  view("custom-klaviyo", "ad_platform", { custom: true, connected: true, mode: "live", live: true, fields: 0 }),
  view("custom-broken", "ad_platform", { custom: true, connected: true, mode: "live", status: "error", reason: "HTTP 401", live: true, fields: 0 }),
];

describe("gallery filters", () => {
  it("filters by category, custom and connected, keeping server order", () => {
    expect(filterPlugins(list, "all", "").length).toBe(8);
    expect(filterPlugins(list, "ad_platform", "").map((v) => v.manifest.id)).toEqual(["meta", "tiktok", "custom-klaviyo", "custom-broken"]);
    expect(filterPlugins(list, "custom", "").map((v) => v.manifest.id)).toEqual(["custom-klaviyo", "custom-broken"]);
    expect(filterPlugins(list, "connected", "").map((v) => v.manifest.id)).toEqual(["meta", "ga4", "custom-klaviyo", "custom-broken"]);
  });

  it("searches name, id, description and category label", () => {
    expect(filterPlugins(list, "all", "  SHOP ").map((v) => v.manifest.id)).toEqual(["shopify"]);
    expect(filterPlugins(list, "all", "commerce").map((v) => v.manifest.id)).toEqual(["shopify"]);
    expect(filterPlugins(list, "alerts", "meta")).toEqual([]);
  });

  it("counts chips under the current search", () => {
    expect(filterCounts(list, "")).toEqual({ all: 8, ad_platform: 4, analytics: 1, commerce: 1, export: 1, alerts: 1, custom: 2, connected: 4 });
    expect(filterCounts(list, "custom")).toMatchObject({ all: 2, custom: 2, analytics: 0 });
  });

  it("summarizes the gallery", () => {
    expect(galleryStats(list)).toEqual({ total: 8, connected: 4, live: 2, custom: 2 });
  });
});

describe("card status and actions", () => {
  it("prefers error, then connected, then .env detection", () => {
    expect(cardStatus(list[7] as PluginView)).toMatchObject({ label: "Error", tone: "crit", title: "HTTP 401" });
    expect(cardStatus(list[0] as PluginView)).toMatchObject({ label: "Connected", tone: "accent", title: "Connected · demo data" });
    expect(cardStatus(list[6] as PluginView).title).toBe("Connected · live data");
    expect(cardStatus(list[1] as PluginView)).toMatchObject({ label: "In .env", tone: "muted" });
    expect(cardStatus(list[3] as PluginView)).toMatchObject({ label: "Available", tone: "faint" });
  });

  it("offers a live REST connector only for demo-only metrics built-ins", () => {
    expect(list.filter(canBuildLive).map((v) => v.manifest.id)).toEqual(["meta", "tiktok", "ga4", "shopify"]);
    expect(list.filter(isAlertPlugin).map((v) => v.manifest.id)).toEqual(["slack"]);
    expect(list.filter(readsMetrics).length).toBe(6);
    expect(needsConnectForm(list[0] as PluginView)).toBe(true);
    expect(needsConnectForm(list[6] as PluginView)).toBe(false);
  });
});
