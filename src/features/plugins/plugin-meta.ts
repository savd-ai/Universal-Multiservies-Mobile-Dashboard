import type { PluginCategory, PluginView } from "@/lib/domain/contracts/plugins";
import type { Tone } from "@/components/ui/status";

// Gallery vocabulary: category labels, filter chips, card status and which actions a plugin supports. Pure.

export const CATEGORY_LABEL: Record<PluginCategory, string> = {
  ad_platform: "Ad platform",
  analytics: "Analytics",
  commerce: "Commerce",
  export: "Export",
  alerts: "Alerts",
  other: "Other",
};

export const GALLERY_FILTERS = ["all", "ad_platform", "analytics", "commerce", "export", "alerts", "custom", "connected"] as const;
export type GalleryFilter = (typeof GALLERY_FILTERS)[number];

export const FILTER_LABEL: Record<GalleryFilter, string> = {
  all: "All",
  ad_platform: "Ad platforms",
  analytics: "Analytics",
  commerce: "Commerce",
  export: "Export",
  alerts: "Alerts",
  custom: "Custom",
  connected: "Connected",
};

function matchesFilter(v: PluginView, f: GalleryFilter): boolean {
  if (f === "all") return true;
  if (f === "custom") return v.custom;
  if (f === "connected") return v.connected;
  return v.manifest.category === f;
}

function matchesQuery(v: PluginView, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const m = v.manifest;
  return [m.name, m.id, m.description, CATEGORY_LABEL[m.category]].some((s) => s.toLowerCase().includes(needle));
}

/** Server order is kept (cards never jump when something connects). */
export function filterPlugins(list: readonly PluginView[], filter: GalleryFilter, query: string): PluginView[] {
  return list.filter((v) => matchesFilter(v, filter) && matchesQuery(v, query));
}

/** Chip counts under the current search. Empty categories (other than All) are hidden by the caller. */
export function filterCounts(list: readonly PluginView[], query: string): Record<GalleryFilter, number> {
  const out = Object.fromEntries(GALLERY_FILTERS.map((f) => [f, 0])) as Record<GalleryFilter, number>;
  for (const v of list) {
    if (!matchesQuery(v, query)) continue;
    for (const f of GALLERY_FILTERS) if (matchesFilter(v, f)) out[f]++;
  }
  return out;
}

export interface CardStatus {
  label: string;
  title: string;
  tone: Tone;
}

export function cardStatus(v: PluginView): CardStatus {
  if (v.status === "error") return { label: "Error", title: v.reason ?? v.lastTest?.message ?? "The last request failed", tone: "crit" };
  if (v.connected) return { label: "Connected", title: v.mode === "live" ? "Connected · live data" : "Connected · demo data", tone: "accent" };
  if (v.envDetected.some((e) => e.set)) return { label: "In .env", title: "Detected in .env — connect to use it", tone: "muted" };
  return { label: "Available", title: "Not connected", tone: "faint" };
}

export const isAlertPlugin = (v: PluginView): boolean => v.manifest.capabilities.includes("alerts.send");
export const readsMetrics = (v: PluginView): boolean => v.manifest.capabilities.includes("metrics.read");

/** Demo-only built-in that a REST plugin could replace (the builder reads metrics — not alerts or exports). */
export function canBuildLive(v: PluginView): boolean {
  const c = v.manifest.category;
  return !v.manifest.live && !v.custom && (c === "ad_platform" || c === "analytics" || c === "commerce");
}

/** Built-ins with fields open the connect modal; custom REST plugins connect directly. */
export const needsConnectForm = (v: PluginView): boolean => !v.custom && (v.manifest.configFields?.length ?? 0) > 0;

export function galleryStats(list: readonly PluginView[]): { total: number; connected: number; live: number; custom: number } {
  return {
    total: list.length,
    connected: list.filter((v) => v.connected).length,
    live: list.filter((v) => v.connected && v.mode === "live").length,
    custom: list.filter((v) => v.custom).length,
  };
}
