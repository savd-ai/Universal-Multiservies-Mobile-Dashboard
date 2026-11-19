import { describe, expect, it } from "vitest";
import { channelKpis, foldPlatforms, merSeries, platformAbbr, platformColorIndex, splitWarnings } from "@/features/channels/channels-model";
import type { ChannelPlatformSummary, ChannelsSummary } from "@/lib/domain/contracts/plugins";

const platform = (id: string, cost: number, trend: number[] = [cost / 2, cost / 2], mode: "live" | "demo" = "demo"): ChannelPlatformSummary => ({
  id,
  label: id,
  kind: "ad_platform",
  mode,
  cost,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conv_value: 0,
  roas: null,
  cpa: null,
  cpc: null,
  ctr: null,
  share: 0,
  trend,
});

const summary = (o: Partial<ChannelsSummary> = {}): ChannelsSummary => ({
  range: { start: "2026-09-27", end: "2026-09-28", days: 2 },
  currency: "USD",
  dates: ["2026-09-27", "2026-09-28"],
  platforms: [platform("google_ads", 300, [100, 200]), platform("meta", 100, [60, 40], "live")],
  analytics: [],
  commerce: [],
  totals: { cost: 400, impressions: 0, clicks: 0, conversions: 20, conv_value: 1200, roas: 3, cpa: 20, store_revenue: null, orders: null, sessions: null, mer: null, trend: [160, 240] },
  sources: [],
  warnings: [],
  ...o,
});

describe("platform identity colors", () => {
  it("keeps the fixed slots for known platforms regardless of order", () => {
    const a = platformColorIndex(["google_ads", "meta", "tiktok"]);
    const b = platformColorIndex(["tiktok", "meta", "google_ads"]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
    expect(a.get("google_ads")).toBe(0);
    expect(a.get("meta")).toBe(1);
    expect(a.get("tiktok")).toBe(3);
  });

  it("gives other platforms free slots by id (never by rank) and Other past the palette", () => {
    const m = platformColorIndex(["google_ads", "meta", "custom-zeta", "custom-alpha", "amazon"]);
    expect(m.get("amazon")).toBe(5);
    expect(m.get("custom-alpha")).toBe(4);
    expect(m.get("custom-zeta")).toBe(3);
    const crowded = platformColorIndex(["google_ads", "meta", "microsoft", "tiktok", "linkedin", "a", "b"]);
    expect(crowded.get("a")).toBe(5);
    expect(crowded.get("b")).toBeGreaterThanOrEqual(6);
  });
});

describe("series folding", () => {
  it("returns every platform when within the limit", () => {
    expect(foldPlatforms(summary().platforms).map((s) => s.id)).toEqual(["google_ads", "meta"]);
  });

  it("keeps Google Ads + the biggest others and folds the rest into Other", () => {
    const ps = [platform("google_ads", 10), ...["a", "b", "c", "d", "e", "f", "g"].map((id, i) => platform(id, 100 - i * 10, [1, 2]))];
    const folded = foldPlatforms(ps, 6);
    expect(folded.map((s) => s.id)).toEqual(["google_ads", "a", "b", "c", "d", "other"]);
    const other = folded[5];
    expect(other).toMatchObject({ other: true, label: "Other (3)", cost: 60 + 50 + 40, trend: [3, 6] });
  });
});

describe("KPIs and MER", () => {
  it("derives the KPI strip from blended totals", () => {
    expect(channelKpis(summary())).toEqual({ spend: 400, roas: 3, conversions: 20, cpa: 20, mer: null, storeRevenue: null, sessions: null, platforms: 2, live: 1, demo: 1 });
  });

  it("has no MER series without commerce data", () => {
    expect(merSeries(summary())).toBeNull();
  });

  it("computes daily MER = store revenue ÷ blended ad cost", () => {
    const s = summary({
      commerce: [
        { id: "shopify", label: "Shopify", kind: "commerce", mode: "demo", store_revenue: 900, orders: 9, trend: [400, 300] },
        { id: "woo", label: "Woo", kind: "commerce", mode: "demo", store_revenue: 200, orders: 2, trend: [0, 200] },
      ],
      totals: { ...summary().totals, store_revenue: 1100, mer: 2.75, trend: [160, 0] },
    });
    expect(merSeries(s)).toEqual({ dates: s.dates, revenue: [400, 500], spend: [160, 0], mer: [2.5, null] });
  });
});

describe("helpers", () => {
  it("pulls the attribution caveat out of the warnings", () => {
    const w = ["Klaviyo: HTTP 401", "Conversions use each platform's own attribution window — blended totals can double-count.", "Live and demo sources are mixed"];
    expect(splitWarnings(w)).toEqual({ attribution: w[1], other: [w[0], w[2]] });
    expect(splitWarnings([])).toEqual({ attribution: null, other: [] });
  });

  it("abbreviates platforms (plugin icon first)", () => {
    expect(platformAbbr("google_ads", "Google Ads")).toBe("GA");
    expect(platformAbbr("custom-klaviyo", "Klaviyo", new Map([["custom-klaviyo", "KL"]]))).toBe("KL");
    expect(platformAbbr("custom-x", "Acme Retail Media")).toBe("AR");
    expect(platformAbbr("custom-y", "!!!")).toBe("··");
  });
});
