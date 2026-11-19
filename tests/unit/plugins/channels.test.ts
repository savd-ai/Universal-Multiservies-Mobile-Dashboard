import { describe, expect, it } from "vitest";
import { summarizeChannels, type ChannelSource } from "@/lib/domain/plugins/channels";
import type { PlatformDailyRow } from "@/lib/domain/schema/facts";

const range = { start: "2026-09-27", end: "2026-09-28" };
const row = (platform: string, date: string, over: Partial<PlatformDailyRow> = {}): PlatformDailyRow => ({ date, account_id: "1", platform, currency: "USD", impressions: 0, clicks: 0, cost: 0, conversions: 0, conv_value: 0, ...over });

const rows: PlatformDailyRow[] = [
  row("google_ads", "2026-09-27", { cost: 600, clicks: 300, impressions: 10_000, conversions: 30, conv_value: 2400 }),
  row("google_ads", "2026-09-28", { cost: 400, clicks: 200, impressions: 8_000, conversions: 20, conv_value: 1600 }),
  row("meta", "2026-09-28", { cost: 1000, clicks: 500, impressions: 50_000, conversions: 25, conv_value: 2000 }),
  row("ga4", "2026-09-28", { sessions: 1200, conversions: 60, conv_value: 5000 }),
  row("shopify", "2026-09-27", { store_revenue: 3000, orders: 30 }),
  row("shopify", "2026-09-28", { store_revenue: 5000, orders: 50 }),
  row("meta", "2026-08-01", { cost: 999 }), // outside the range
];

const sources: ChannelSource[] = [
  { id: "google_ads", label: "Google Ads", kind: "ad_platform", mode: "live" },
  { id: "meta", label: "Meta Ads", kind: "ad_platform", mode: "demo", reason: "Demo connector in v1" },
  { id: "ga4", label: "Google Analytics 4", kind: "analytics", mode: "demo" },
  { id: "shopify", label: "Shopify", kind: "commerce", mode: "demo" },
];

describe("cross-channel ledger", () => {
  const out = summarizeChannels({ rows, sources, range, currency: "USD", warnings: ["upstream note"] });

  it("shares spend over ad platforms only, Google first", () => {
    expect(out.platforms.map((p) => p.id)).toEqual(["google_ads", "meta"]);
    expect(out.platforms.map((p) => p.share)).toEqual([0.5, 0.5]);
    expect(out.platforms[0]).toMatchObject({ cost: 1000, clicks: 500, conversions: 50, conv_value: 4000, roas: 4, cpa: 20, cpc: 2, trend: [600, 400] });
    expect(out.platforms[1]).toMatchObject({ mode: "demo", reason: "Demo connector in v1", trend: [0, 1000] });
  });

  it("reports analytics and commerce beside ad spend, with MER from store revenue", () => {
    expect(out.analytics).toEqual([expect.objectContaining({ id: "ga4", sessions: 1200, conversions: 60, trend: [0, 1200] })]);
    expect(out.commerce).toEqual([expect.objectContaining({ id: "shopify", store_revenue: 8000, orders: 80, trend: [3000, 5000] })]);
    expect(out.totals).toMatchObject({ cost: 2000, conversions: 75, conv_value: 6000, roas: 3, store_revenue: 8000, orders: 80, sessions: 1200, mer: 4, trend: [600, 1400] });
  });

  it("warns about blended attribution and mixed live/demo sources", () => {
    expect(out.warnings).toEqual([
      "upstream note",
      "Conversions use each platform's own attribution window — blended totals can double-count journeys that touch several platforms.",
      "Live and demo sources are mixed — demo platforms show generated data.",
    ]);
    expect(out.dates).toEqual(["2026-09-27", "2026-09-28"]);
    expect(out.range).toEqual({ ...range, days: 2 });
  });

  it("has no MER without a commerce plugin and no NaN on empty data", () => {
    const bare = summarizeChannels({ rows: [], sources: [sources[0] as ChannelSource], range, currency: "USD" });
    expect(bare.totals).toMatchObject({ cost: 0, roas: null, cpa: null, store_revenue: null, mer: null, sessions: null });
    expect(bare.platforms[0]?.share).toBe(0);
    expect(bare.warnings).toEqual([]);
  });
});
