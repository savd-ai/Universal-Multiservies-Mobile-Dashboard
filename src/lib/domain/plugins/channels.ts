import type { ChannelAnalyticsSummary, ChannelCommerceSummary, ChannelKind, ChannelPlatformSummary, ChannelsSummary } from "../contracts/plugins";
import { enumerate, rangeDays, type DateRange } from "../dates";
import type { PlatformDailyRow } from "../schema/facts";

// Cross-channel ledger (GET /api/channels): Google Ads + connected ad platforms share one spend base; analytics
// (sessions) and commerce (store revenue → MER) are reported beside it, never summed into ad totals.

export interface ChannelSource {
  id: string;
  label: string;
  kind: ChannelKind;
  mode: "live" | "demo";
  reason?: string;
  stale?: boolean;
}

const div = (a: number, b: number): number | null => (b > 0 && Number.isFinite(a / b) ? a / b : null);
const round2 = (v: number) => Math.round(v * 100) / 100;

export function summarizeChannels(input: { rows: readonly PlatformDailyRow[]; sources: readonly ChannelSource[]; range: DateRange; currency: string; warnings?: readonly string[] }): ChannelsSummary {
  const dates = enumerate(input.range.start, input.range.end);
  const dateIdx = new Map(dates.map((d, i) => [d, i]));
  const byPlatform = new Map<string, PlatformDailyRow[]>();
  for (const r of input.rows) {
    if (!dateIdx.has(r.date)) continue;
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }
  const sources = [...input.sources];
  for (const id of byPlatform.keys()) if (!sources.some((s) => s.id === id)) sources.push({ id, label: id, kind: "ad_platform", mode: "demo" });

  const series = (rows: readonly PlatformDailyRow[], pick: (r: PlatformDailyRow) => number) => {
    const out = dates.map(() => 0);
    for (const r of rows) {
      const i = dateIdx.get(r.date);
      if (i !== undefined) out[i] = (out[i] ?? 0) + pick(r);
    }
    return out.map(round2);
  };
  const sum = (rows: readonly PlatformDailyRow[], pick: (r: PlatformDailyRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  const platforms: ChannelPlatformSummary[] = [];
  const analytics: ChannelAnalyticsSummary[] = [];
  const commerce: ChannelCommerceSummary[] = [];
  for (const src of sources) {
    const rows = byPlatform.get(src.id) ?? [];
    const meta = { id: src.id, label: src.label, mode: src.mode, ...(src.reason ? { reason: src.reason } : {}), ...(src.stale ? { stale: true } : {}) };
    if (src.kind === "analytics") {
      analytics.push({ ...meta, kind: "analytics", sessions: sum(rows, (r) => r.sessions ?? 0), conversions: round2(sum(rows, (r) => r.conversions)), conv_value: round2(sum(rows, (r) => r.conv_value)), trend: series(rows, (r) => r.sessions ?? 0) });
    } else if (src.kind === "commerce") {
      commerce.push({ ...meta, kind: "commerce", store_revenue: round2(sum(rows, (r) => r.store_revenue ?? 0)), orders: sum(rows, (r) => r.orders ?? 0), trend: series(rows, (r) => r.store_revenue ?? 0) });
    } else {
      const cost = sum(rows, (r) => r.cost);
      const clicks = sum(rows, (r) => r.clicks);
      const impressions = sum(rows, (r) => r.impressions);
      const conversions = sum(rows, (r) => r.conversions);
      const convValue = sum(rows, (r) => r.conv_value);
      platforms.push({
        ...meta,
        kind: "ad_platform",
        cost: round2(cost),
        impressions,
        clicks,
        conversions: round2(conversions),
        conv_value: round2(convValue),
        roas: div(convValue, cost),
        cpa: div(cost, conversions),
        cpc: div(cost, clicks),
        ctr: div(clicks, impressions),
        share: 0,
        trend: series(rows, (r) => r.cost),
      });
    }
  }

  const totalCost = platforms.reduce((s, p) => s + p.cost, 0);
  for (const p of platforms) p.share = totalCost > 0 ? p.cost / totalCost : 0;
  platforms.sort((a, b) => (a.id === "google_ads" ? -1 : b.id === "google_ads" ? 1 : b.cost - a.cost));

  const adRows = platforms.flatMap((p) => byPlatform.get(p.id) ?? []);
  const conversions = platforms.reduce((s, p) => s + p.conversions, 0);
  const convValue = platforms.reduce((s, p) => s + p.conv_value, 0);
  const storeRevenue = commerce.length ? round2(commerce.reduce((s, c) => s + c.store_revenue, 0)) : null;
  const warnings = [...(input.warnings ?? [])];
  if (platforms.filter((p) => p.conversions > 0).length > 1) {
    warnings.push("Conversions use each platform's own attribution window — blended totals can double-count journeys that touch several platforms.");
  }
  const modes = new Set([...platforms, ...analytics, ...commerce].map((s) => s.mode));
  if (modes.size > 1) warnings.push("Live and demo sources are mixed — demo platforms show generated data.");

  return {
    range: { start: input.range.start, end: input.range.end, days: rangeDays(input.range) },
    currency: input.currency,
    dates,
    platforms,
    analytics,
    commerce,
    totals: {
      cost: round2(totalCost),
      impressions: platforms.reduce((s, p) => s + p.impressions, 0),
      clicks: platforms.reduce((s, p) => s + p.clicks, 0),
      conversions: round2(conversions),
      conv_value: round2(convValue),
      roas: div(convValue, totalCost),
      cpa: div(totalCost, conversions),
      store_revenue: storeRevenue,
      orders: commerce.length ? commerce.reduce((s, c) => s + c.orders, 0) : null,
      sessions: analytics.length ? analytics.reduce((s, a) => s + a.sessions, 0) : null,
      mer: storeRevenue !== null ? div(storeRevenue, totalCost) : null,
      trend: series(adRows, (r) => r.cost),
    },
    sources: sources.map((s) => ({ id: s.id, label: s.label, mode: s.mode, ...(s.reason ? { reason: s.reason } : {}), ...(s.stale ? { stale: true } : {}) })),
    warnings,
  };
}
