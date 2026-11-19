import { describe, expect, it } from "vitest";
import { validateSpec } from "@/lib/domain/ai/chat-plan";
import { NL_EXAMPLES, parseNlQuery } from "@/lib/domain/ai/nl-lite";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import type { QuerySpecInput } from "@/lib/domain/query/spec";

const today = "2026-09-29";
const ctx = { today, campaignNames: ["Brand — Core Terms", "Search — Competitor Terms", "PMax — Full Catalog"] };
const registry = new MetricRegistry();

function spec(q: string): QuerySpecInput {
  const r = parseNlQuery(q, ctx);
  expect(r.intent, q).toBe("query");
  const first = r.queries[0];
  if (!first) throw new Error(`no query for ${q}`);
  return first.spec;
}

const TABLE: [string, Partial<QuerySpecInput>][] = [
  ["spend and conversions yesterday", { metrics: ["cost", "conversions"], dimensions: [], dateRange: { preset: "yesterday" } }],
  ["CPA by device this month vs previous period", { metrics: ["cpa", "cost", "conversions"], dimensions: ["device"], dateRange: { preset: "mtd" }, compare: "previous_period" }],
  ["search terms with no conversions last 30 days", { dimensions: ["search_term"], having: [{ metric: "conversions", op: "eq", value: 0 }], dateRange: { preset: "last_30d" } }],
  ["daily spend for PMax campaigns in the last 14 days", { metrics: ["cost"], dimensions: ["date"], filters: [{ dim: "campaign_type", op: "eq", value: "PMax" }], dateRange: { preset: "last_14d" } }],
  ["cross-channel spend and ROAS by platform last month", { source: "blended", metrics: ["cost", "roas"], dimensions: ["platform"], dateRange: { preset: "last_month" } }],
  ["which campaign has the highest CPA", { dimensions: ["campaign"], sort: [{ key: "cpa", dir: "desc" }], limit: 1 }],
  ["top 3 campaigns by CPA", { metrics: ["cpa", "cost", "conversions"], sort: [{ key: "cpa", dir: "asc" }], limit: 3 }],
  ["worst 3 keywords by CTR", { dimensions: ["keyword"], sort: [{ key: "ctr", dir: "asc" }], limit: 3 }],
  ["conversion rate by day of week", { metrics: ["cvr", "conversions", "clicks"], dimensions: ["dow"] }],
  ["campaigns with ROAS above 3 last 90 days", { dimensions: ["campaign"], having: [{ metric: "roas", op: "gt", value: 3 }], dateRange: { preset: "last_90d" } }],
  ["CPA under $50 by campaign", { dimensions: ["campaign"], having: [{ metric: "cpa", op: "lt", value: 50 }] }],
  ["more than 100 clicks by search term", { dimensions: ["search_term"], having: [{ metric: "clicks", op: "gt", value: 100 }] }],
  ["CTR below 1% by campaign type", { dimensions: ["campaign_type"], having: [{ metric: "ctr", op: "lt", value: 0.01 }] }],
  ["spend in august 2026", { metrics: ["cost"], dateRange: { start: "2026-08-01", end: "2026-08-31" } }],
  ["revenue since 2026-09-01", { metrics: ["conv_value"], dateRange: { start: "2026-09-01", end: "2026-09-28" } }],
  ["clicks between 2026-08-01 and 2026-08-15", { metrics: ["clicks"], dateRange: { start: "2026-08-01", end: "2026-08-15" } }],
  ["impressions on mobile last week", { metrics: ["impressions"], filters: [{ dim: "device", op: "eq", value: "Mobile" }], dateRange: { start: "2026-09-21", end: "2026-09-27" } }],
  ["clicks in the us by campaign", { dimensions: ["campaign"], filters: [{ dim: "country", op: "eq", value: "US" }] }],
  ["impressions on mobile in the us", { filters: [{ dim: "device", op: "eq", value: "Mobile" }] }],
  ["campaigns containing 'brand' spend YoY", { dimensions: ["campaign"], filters: [{ dim: "campaign", op: "contains", value: "brand" }], compare: "previous_year" }],
  ["hourly clicks", { metrics: ["clicks"], dimensions: ["hour"] }],
  ["monthly conversions ytd", { metrics: ["conversions"], dimensions: ["month"], dateRange: { preset: "ytd" } }],
  ["cost per conversion for shopping campaigns mtd", { metrics: ["cpa", "cost", "conversions"], filters: [{ dim: "campaign_type", op: "eq", value: "Shopping" }], dateRange: { preset: "mtd" } }],
  ["spend WoW", { metrics: ["cost"], dateRange: { preset: "last_7d" }, compare: "previous_period" }],
  ["cost per click by country last 3 months", { metrics: ["cpc", "cost", "clicks"], dimensions: ["country"], dateRange: { start: "2026-06-29", end: "2026-09-28" } }],
  ["non-brand spend by campaign last 7 days", { dimensions: ["campaign"], filters: [{ dim: "campaign", op: "ncontains", value: "brand" }], dateRange: { preset: "last_7d" } }],
  ["spend for competitor terms last 7 days", { filters: [{ dim: "campaign", op: "contains", value: "competitor terms" }] }],
  ["how are we doing", { metrics: ["cost", "conversions", "cpa", "roas"], dimensions: [], dateRange: { preset: "last_30d" } }],
  ["why did cpa go up last 14 days", { dimensions: ["campaign"], compare: "previous_period", sort: [{ key: "cpa__delta", dir: "desc" }], dateRange: { preset: "last_14d" } }],
];

describe("NL-lite parser", () => {
  it("parses the reference example exactly", () => {
    expect(spec("top 5 campaigns by ROAS last 7 days")).toMatchObject({
      source: "google_ads",
      metrics: ["roas", "cost", "conv_value"],
      dimensions: ["campaign"],
      dateRange: { preset: "last_7d" },
      sort: [{ key: "roas", dir: "desc" }],
      limit: 5,
    });
  });

  it.each(TABLE)("%s", (q, expected) => {
    expect(spec(q)).toMatchObject(expected);
  });

  it("produces specs the query engine accepts", () => {
    for (const [q] of TABLE) {
      const r = validateSpec(spec(q), { today, registry });
      expect("spec" in r ? "ok" : r.error, q).toBe("ok");
    }
  });

  it("ignores apostrophes and treats quoted text as data", () => {
    const s = spec("which search terms didn't convert last 7 days");
    expect(s.having).toEqual([{ metric: "conversions", op: "eq", value: 0 }]);
    const q = spec("keywords containing 'last 7 days cpa'");
    expect(q.filters).toEqual([{ dim: "keyword", op: "contains", value: "last 7 days cpa" }]);
    expect(q.dateRange).toEqual({ preset: "last_30d" });
  });

  it("asks to clarify when nothing maps to ad data", () => {
    for (const q of ["hello", "what's the weather in Hanoi?", "thanks!"]) {
      const r = parseNlQuery(q, ctx);
      expect(r.intent, q).toBe("clarify");
      expect(r.examples.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic and its example prompts all parse", () => {
    expect(parseNlQuery("top 5 campaigns by ROAS last 7 days", ctx)).toEqual(parseNlQuery("top 5 campaigns by ROAS last 7 days", ctx));
    for (const ex of NL_EXAMPLES) expect(parseNlQuery(ex, ctx).intent, ex).toBe("query");
  });

  it("titles and charts follow the query shape", () => {
    const r = parseNlQuery("top 5 campaigns by ROAS last 7 days", ctx).queries[0];
    expect(r?.title).toBe("Top 5 campaigns by ROAS · Last 7 days");
    expect(r?.chart).toBe("bar");
    expect(parseNlQuery("daily spend last 14 days", ctx).queries[0]?.chart).toBe("line");
    expect(parseNlQuery("spend yesterday", ctx).queries[0]?.chart).toBe("kpi");
  });
});
