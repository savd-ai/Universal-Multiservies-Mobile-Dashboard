import type { ChannelPlatformSummary, ChannelsSummary } from "@/lib/domain/contracts/plugins";

// Channels page model: stable identity-color slots per platform, ≤ 6 series + Other folding, KPI derivations and
// the daily MER series. Pure.

/** Fixed identity slots (mirrors colorFor("platform") in charts/palette.ts). */
const KNOWN_SLOT: Record<string, number> = { google_ads: 0, meta: 1, microsoft: 2, tiktok: 3, linkedin: 4 };

/**
 * Index to pass to colorFor("platform", id, index): known platforms keep their fixed slot; other platforms (custom
 * REST plugins, Amazon, Pinterest …) take the free slots in a fixed order, sorted by id — never by rank, so a
 * range change never repaints a platform. Past the palette they get the "Other" color.
 */
export function platformColorIndex(ids: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  const used = new Set<number>();
  for (const id of ids) {
    const k = KNOWN_SLOT[id];
    if (k !== undefined) {
      out.set(id, k);
      used.add(k);
    }
  }
  const free = [5, 4, 3, 2, 1, 0].filter((s) => !used.has(s));
  const unknown = [...new Set(ids.filter((id) => KNOWN_SLOT[id] === undefined))].sort();
  unknown.forEach((id, i) => out.set(id, free[i] ?? 6 + i));
  return out;
}

export interface StackSeries {
  id: string;
  label: string;
  cost: number;
  trend: number[];
  other?: boolean;
}

/** At most `max` stacked series: Google Ads + the biggest others, the rest folded into "Other". */
export function foldPlatforms(platforms: readonly ChannelPlatformSummary[], max = 6): StackSeries[] {
  const all = platforms.map((p) => ({ id: p.id, label: p.label, cost: p.cost, trend: p.trend }));
  if (all.length <= max) return all;
  const google = all.filter((p) => p.id === "google_ads");
  const rest = all.filter((p) => p.id !== "google_ads").sort((a, b) => b.cost - a.cost);
  const keep = rest.slice(0, max - 1 - google.length);
  const folded = rest.slice(keep.length);
  const len = Math.max(0, ...all.map((p) => p.trend.length));
  const other: StackSeries = {
    id: "other",
    label: `Other (${folded.length})`,
    cost: folded.reduce((s, p) => s + p.cost, 0),
    trend: Array.from({ length: len }, (_, i) => folded.reduce((s, p) => s + (p.trend[i] ?? 0), 0)),
    other: true,
  };
  return [...google, ...keep, other];
}

export interface ChannelKpis {
  spend: number;
  roas: number | null;
  conversions: number;
  cpa: number | null;
  mer: number | null;
  storeRevenue: number | null;
  sessions: number | null;
  platforms: number;
  live: number;
  demo: number;
}

export function channelKpis(s: ChannelsSummary): ChannelKpis {
  return {
    spend: s.totals.cost,
    roas: s.totals.roas,
    conversions: s.totals.conversions,
    cpa: s.totals.cpa,
    mer: s.totals.mer,
    storeRevenue: s.totals.store_revenue,
    sessions: s.totals.sessions,
    platforms: s.platforms.length,
    live: s.platforms.filter((p) => p.mode === "live").length,
    demo: s.platforms.filter((p) => p.mode === "demo").length,
  };
}

/** Daily store revenue (all commerce sources) and MER = revenue ÷ blended ad cost; null without commerce data. */
export function merSeries(s: ChannelsSummary): { dates: string[]; revenue: number[]; spend: number[]; mer: (number | null)[] } | null {
  if (!s.commerce.length || s.totals.store_revenue === null) return null;
  const revenue = s.dates.map((_, i) => s.commerce.reduce((sum, c) => sum + (c.trend[i] ?? 0), 0));
  const spend = s.dates.map((_, i) => s.totals.trend[i] ?? 0);
  const mer = revenue.map((r, i) => {
    const sp = spend[i] ?? 0;
    return sp > 0 ? r / sp : null;
  });
  return { dates: s.dates, revenue, spend, mer };
}

/** Indices of ~`count` evenly spaced x-axis labels (first and last included). */
export function evenTicks(n: number, count = 5): Set<number> {
  if (n <= count) return new Set(Array.from({ length: n }, (_, i) => i));
  return new Set(Array.from({ length: count }, (_, j) => Math.round(((n - 1) * j) / (count - 1))));
}

/** Split the API warnings: the attribution-window caveat gets its own note, the rest are listed. */
export function splitWarnings(warnings: readonly string[]): { attribution: string | null; other: string[] } {
  const attribution = warnings.find((w) => /attribution/i.test(w)) ?? null;
  return { attribution, other: warnings.filter((w) => w !== attribution) };
}

const ABBR: Record<string, string> = { google_ads: "GA", meta: "MT", microsoft: "MS", tiktok: "TT", linkedin: "LI", amazon: "AZ", pinterest: "PI", snapchat: "SC", reddit: "RD", ga4: "GA", shopify: "SH", woocommerce: "WC" };

/** Two-letter mark for a platform (the plugin's own icon when known, else initials). */
export function platformAbbr(id: string, label: string, icons: ReadonlyMap<string, string> = new Map()): string {
  return (
    icons.get(id) ??
    ABBR[id] ??
    (label
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
      "··")
  );
}
