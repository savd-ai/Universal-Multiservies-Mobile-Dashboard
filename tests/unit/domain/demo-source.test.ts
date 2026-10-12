import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { describeBlankReason } from "@/lib/domain/types";
import { setClockForTests } from "@/lib/server/clock";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";

(globalThis as { __savdRealResolver?: boolean }).__savdRealResolver = true;

const KEYS = ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"];

beforeEach(() => {
  for (const key of KEYS) vi.stubEnv(key, "");
  setClockForTests(() => new Date("2026-10-12T15:00:00Z"));
});
afterEach(() => {
  setClockForTests(undefined);
  vi.unstubAllEnvs();
});

describe("demo data source", () => {
  it("replaces the blank dashboard with the generated demo accounts and says so", async () => {
    const { source } = await resolveGoogleAds({ fresh: true });
    expect(source.mode).toBe("blank");
    expect(source.apiVersion).toBe("demo");
    expect(source.reason).toEqual({ code: "demo", cause: { code: "no_env" } });
    expect(describeBlankReason(source.reason)).toMatch(/^Demo data: generated sample accounts, not read from Google Ads/);
    const accounts = await source.listAccounts();
    expect(accounts.map((account) => account.name)).toEqual(["Acme Running Co.", "Trail Gear Outlet"]);
    expect(accounts.every((account) => account.mode === "blank")).toBe(true);
    expect(source.defaultAccountId()).toBe(accounts[0]!.id);
  });

  it("anchors on yesterday so recent ranges have rows in every fact table", async () => {
    const { source } = await resolveGoogleAds({ fresh: true });
    const id = source.defaultAccountId();
    const through = await source.dataThrough(id);
    expect(through).toBe("2026-10-11");
    expect(await source.today(id)).toBe("2026-10-12");
    const range = { start: addDays(through, -6), end: through };
    for (const table of ["campaign_daily", "campaign_device_daily", "campaign_geo_daily", "campaign_hourly", "ad_group_daily", "keyword_daily", "search_term_daily"] as const) {
      const slice = await source.getTable(id, table, range);
      expect(slice.rows.length, table).toBeGreaterThan(0);
      expect(slice.rows.every((row) => (row.date as string) >= range.start && (row.date as string) <= range.end)).toBe(true);
    }
    const dims = await source.getDims(id);
    expect(dims.campaigns.size).toBeGreaterThan(0);
    const estimates = await source.getGoogleEstimates(id);
    expect(estimates.simulations.length).toBeGreaterThan(0);
  });

  it("is deterministic for a given day", async () => {
    const { source } = await resolveGoogleAds({ fresh: true });
    const id = source.defaultAccountId();
    const range = { start: "2026-10-05", end: "2026-10-11" };
    const a = await source.getTable(id, "campaign_daily", range);
    await source.invalidate();
    const b = await source.getTable(id, "campaign_daily", range);
    expect(b.rows).toEqual(a.rows);
  });
});
