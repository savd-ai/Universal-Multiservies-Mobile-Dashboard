import { describe, expect, it } from "vitest";
import type { RestSourceSpec } from "@/lib/domain/contracts/plugins";
import { getPath, parsePath, PathError, toNumber } from "@/lib/domain/plugins/dot-path";
import { formatDateFor, mapRows, parseRowDate, readField, renderTemplate, validateTemplate } from "@/lib/domain/plugins/mapping";

const item = {
  day: "2026-09-28",
  campaign: { name: "Spring launch" },
  metrics: { spend: "1,234.50", spend_micros: 1_500_000, cost_cents: 1999, ctr: "12.5", share: "12.5%" },
  actions: [
    { action_type: "view", value: 40 },
    { action_type: "purchase", value: 3 },
    { action_type: "purchase", value: "2" },
    { action_type: "purchase_value", value: "250.00" },
  ],
  results: [{ cost: 1 }, { cost: 2.5 }, { cost: "3" }],
  "odd key": { v: 7 },
};

describe("dot paths", () => {
  it("reads keys, indexes, quoted keys and filters", () => {
    expect(getPath(item, "campaign.name")).toBe("Spring launch");
    expect(getPath(item, "actions[1].value")).toBe(3);
    expect(getPath(item, 'actions[action_type=purchase].value')).toBe(3);
    expect(getPath(item, "actions[action_type!=view].action_type")).toBe("purchase");
    expect(getPath(item, '["odd key"].v')).toBe(7);
    expect(getPath({ data: { rows: [1] } }, "$.data.rows")).toEqual([1]);
    expect(getPath([1, 2], "$")).toEqual([1, 2]);
    expect(getPath([1, 2], "")).toEqual([1, 2]);
  });

  it("fans out with [*] and with filters in `all` mode", () => {
    expect(getPath(item, "results[*].cost")).toEqual([1, 2.5, "3"]);
    expect(getPath(item, "actions[action_type=purchase].value", { all: true })).toEqual([3, "2"]);
  });

  it("reads own properties only and rejects prototype keys", () => {
    const proto = Object.create({ inherited: 1 }) as Record<string, unknown>;
    expect(getPath(proto, "inherited")).toBeUndefined();
    expect(() => parsePath("__proto__.polluted")).toThrow(PathError);
    expect(() => parsePath("a[constructor=x]")).toThrow(PathError);
    expect(() => parsePath("data[")).toThrow(/Unclosed/);
  });

  it("coerces API numbers", () => {
    expect(toNumber("1,234.50")).toBe(1234.5);
    expect(toNumber("$9.99")).toBe(9.99);
    expect(toNumber("12%")).toBe(0.12);
    expect(toNumber(true)).toBe(1);
    expect(toNumber("n/a")).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
    expect(toNumber(null)).toBeNull();
  });
});

describe("field transforms", () => {
  it("applies number / micros / cents / percent / sum", () => {
    expect(readField(item, "metrics.spend")).toBe(1234.5);
    expect(readField(item, { path: "metrics.spend_micros", transform: "micros" })).toBe(1.5);
    expect(readField(item, { path: "metrics.cost_cents", transform: "cents" })).toBe(19.99);
    expect(readField(item, { path: "metrics.ctr", transform: "percent" })).toBe(0.125);
    expect(readField(item, { path: "metrics.share", transform: "percent" })).toBe(0.125);
    expect(readField(item, { path: "actions[action_type=purchase].value", transform: "sum" })).toBe(5);
    expect(readField(item, { path: "results[*].cost", transform: "sum" })).toBe(6.5);
    expect(readField(item, { path: "actions[action_type=purchase]", transform: "sum" })).toBe(5); // objects sum their .value
  });

  it("evaluates expr formulas over top-level and a__b nested fields", () => {
    expect(readField({ spend: 10, fee: 2 }, { expr: "spend + fee" })).toBe(12);
    expect(readField(item, { expr: "metrics__spend_micros / 1000000" })).toBe(1.5);
    expect(readField(item, { expr: "safe_div(metrics__cost_cents, 0)" })).toBeNull();
  });
});

describe("dates and templates", () => {
  it("parses the date shapes APIs return", () => {
    expect(parseRowDate("2026-09-28", "YYYY-MM-DD")).toBe("2026-09-28");
    expect(parseRowDate("20260928", "YYYYMMDD")).toBe("2026-09-28");
    expect(parseRowDate(20260928, "YYYY-MM-DD")).toBe("2026-09-28");
    expect(parseRowDate(1790553600, "unix")).toBe("2026-09-28");
    expect(parseRowDate(1790553600000, "unix_ms")).toBe("2026-09-28");
    expect(parseRowDate("1790553600", "unix")).toBe("2026-09-28");
    expect(parseRowDate("2026-09-28T23:30:00-07:00", "iso")).toBe("2026-09-28"); // the local calendar day
    expect(parseRowDate("20261340", "YYYYMMDD")).toBeNull();
    expect(parseRowDate(undefined, "iso")).toBeNull();
  });

  it("formats request dates and renders templates with per-context encoding", () => {
    expect(formatDateFor("2026-09-28", "YYYYMMDD")).toBe("20260928");
    expect(formatDateFor("2026-09-28", "unix")).toBe("1790553600");
    expect(formatDateFor("2026-09-28", "iso", true)).toBe("2026-09-28T23:59:59Z");
    expect(renderTemplate("/r?q={x}&n={missing}", { x: "a b&c" }, "url")).toBe("/r?q=a%20b%26c&n=");
    expect(renderTemplate('{"q":"{x}"}', { x: 'say "hi"' }, "json")).toBe('{"q":"say \\"hi\\""}');
    expect(validateTemplate("/r?from={start}&acct={config.account_id}&x={nope}", ["account_id"])).toEqual(["Unknown template variable {nope}"]);
  });
});

describe("mapRows", () => {
  const spec = (mapping: Partial<RestSourceSpec["mapping"]> = {}): RestSourceSpec => ({
    baseUrl: "https://api.example.com",
    auth: { type: "none" },
    report: { method: "GET", path: "/r", dateFormat: "YYYY-MM-DD", rowsPath: "rows" },
    mapping: { date: "day", spend: "spend", clicks: "clicks", conversions: "conv", campaign: "campaign", ...mapping },
  });
  const ctx = { accountId: "1", platform: "custom-x", accountCurrency: "USD", range: { start: "2026-09-27", end: "2026-09-28" }, fx: () => null };

  it("sums rows per date × campaign and drops out-of-range / undated rows with warnings", () => {
    const out = mapRows(
      [
        { day: "2026-09-28", campaign: "A", spend: 10, clicks: 2, conv: 1 },
        { day: "2026-09-28", campaign: "A", spend: 5, clicks: 1, conv: 0, adset: "second" },
        { day: "2026-09-28", campaign: "B", spend: 1 },
        { day: "2026-09-01", campaign: "A", spend: 99 },
        { campaign: "A", spend: 99 },
      ],
      spec(),
      ctx,
    );
    expect(out.rows).toEqual([
      { date: "2026-09-28", account_id: "1", platform: "custom-x", platform_campaign: "A", currency: "USD", cost: 15, impressions: 0, clicks: 3, conversions: 1, conv_value: 0 },
      { date: "2026-09-28", account_id: "1", platform: "custom-x", platform_campaign: "B", currency: "USD", cost: 1, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 },
    ]);
    expect(out.warnings).toEqual(["1 row had no parseable date and was skipped.", "1 row fell outside the requested dates and was dropped."]);
  });

  it("converts currencies with FX and excludes (with a warning) values without a rate", () => {
    const eur = spec({ currency: "EUR", conversionValue: "value" });
    const noRate = mapRows([{ day: "2026-09-28", campaign: "A", spend: 10, value: 30 }], eur, ctx);
    expect(noRate.rows[0]?.cost).toBe(0);
    expect(noRate.warnings).toEqual(["2 values had no exchange rate from EUR into USD and were excluded."]);
    const withRate = mapRows([{ day: "2026-09-28", campaign: "A", spend: 10, value: 30 }], eur, { ...ctx, fx: (a, from) => (from === "EUR" ? a * 1.1 : null) });
    expect(withRate.rows[0]?.cost).toBeCloseTo(11);
    expect(withRate.rows[0]?.conv_value).toBeCloseTo(33);
    expect(withRate.warnings).toEqual([]);
  });

  it("dedupes repeated items (exact duplicates, or by dedupeKey)", () => {
    const row = { day: "2026-09-28", campaign: "A", spend: 10 };
    const exact = mapRows([row, { ...row }, { campaign: "A", spend: 10, day: "2026-09-28" }], spec(), ctx);
    expect(exact.rows[0]?.cost).toBe(10);
    expect(exact.duplicates).toBe(2);
    expect(exact.warnings).toContain("2 duplicate rows were ignored.");
    const byId = mapRows([{ ...row, id: "r1" }, { ...row, id: "r1", spend: 11 }, { ...row, id: "r2" }], spec({ dedupeKey: "id" }), ctx);
    expect(byId.rows[0]?.cost).toBe(20);
    expect(byId.duplicates).toBe(1);
  });

  it("maps commerce and analytics fields", () => {
    const out = mapRows([{ day: "2026-09-28", revenue: "1,200.00", orders: 12, sessions: 900 }], spec({ spend: "none", storeRevenue: "revenue", orders: "orders", sessions: "sessions", campaign: undefined }), ctx);
    expect(out.rows[0]).toMatchObject({ cost: 0, store_revenue: 1200, orders: 12, sessions: 900 });
  });
});
