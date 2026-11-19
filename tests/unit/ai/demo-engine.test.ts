import { describe, expect, it } from "vitest";
import { adCopySchema, blueprintSchema, explanationSchema, ideasOutputSchema, narrativeSchema, type ExplainFacts, type NarrativeFacts } from "@/lib/domain/contracts/ai";
import { AI_GOALS, DEMO_IDEAS, GOAL_PICK } from "@/lib/domain/demo/scenario";
import { adCopyLines, blueprintLines, checkLines, failingLines, groundingCheck } from "@/lib/domain/ai/validators";
import { demoAdCopy, demoBlueprint, demoIdeas, demoNarrative, followUps, insightSentence, narrateResults, narrativeFactNumbers, shortCampaignName } from "@/lib/domain/ai/demo-engine";
import { blueprintToEditorCsv, EDITOR_HEADER } from "@/lib/domain/ai/editor-csv";
import { explainWithRules, logDecomposition, segmentContributions, type WindowAgg } from "@/lib/domain/ai/explain";
import { aggregateSearchTerms, applyVerdicts, findNegativeCandidates, withDemoVerdicts, type SearchTermAgg } from "@/lib/domain/ai/negatives";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import type { QueryResult } from "@/lib/domain/query/spec";

describe("demo ideas", () => {
  it("follow the prototype's GOAL_PICK ordering for every goal", () => {
    for (const goal of AI_GOALS) {
      expect(demoIdeas(goal).map((i) => i.title)).toEqual(GOAL_PICK[goal].map((i) => DEMO_IDEAS[i]?.title));
    }
    expect(GOAL_PICK["Lower CPA"]).toEqual([1, 0, 2, 3, 4, 5]);
  });

  it("are verbatim without data and cite live numbers when the campaign exists", () => {
    const plain = demoIdeas("Scale conversions");
    expect(plain[0]?.rationale).toBe(DEMO_IDEAS[3]?.rationale);
    expect(ideasOutputSchema.parse({ ideas: plain }).ideas).toHaveLength(6);
    const cited = demoIdeas("Scale conversions", [{ id: "c6", name: "Display — Cart Remarketing", cost: 7490.2, conversions: 370, cpa: 20.24, roas: 4.55 }]);
    expect(cited[0]?.rationale).toBe(`${DEMO_IDEAS[3]?.rationale} Last 30 days, Cart Remarketing: $7,490 spend, CPA $20, ROAS 4.55x.`);
    expect(demoIdeas("Scale conversions")).toEqual(plain);
  });

  it("shortCampaignName keeps the text after the em dash", () => {
    expect(shortCampaignName("Search — Competitor Terms")).toBe("Competitor Terms");
    expect(shortCampaignName("Plain name")).toBe("Plain name");
  });
});

describe("demo ad copy", () => {
  const req = { product: "trail running shoes", audience: "trail runners", usps: ["Free returns", "Grip that lasts"], keywords: ["trail running shoes", "waterproof trail shoes"], tone: "confident" as const };

  it("is deterministic, schema-valid and within every limit", () => {
    const a = demoAdCopy(req, { brand: "acme" });
    expect(demoAdCopy(req, { brand: "acme" })).toEqual(a);
    expect(adCopySchema.parse(a)).toEqual(a);
    expect(a.headlines.length).toBeGreaterThanOrEqual(3);
    expect(a.descriptions.length).toBeGreaterThanOrEqual(2);
    const lines = adCopyLines(a);
    expect(failingLines(lines, checkLines(lines))).toEqual([]);
    expect(a.headlines.some((h) => h.text.startsWith("{KeyWord:"))).toBe(true);
  });

  it("changes with the input", () => {
    const b = demoAdCopy({ ...req, tone: "premium" }, { brand: "acme" });
    expect(b.headlines.map((h) => h.text)).not.toEqual(demoAdCopy(req, { brand: "acme" }).headlines.map((h) => h.text));
  });
});

describe("demo blueprint + Editor CSV", () => {
  const idea = demoIdeas("Lower CPA")[0];
  if (!idea) throw new Error("no idea");

  it("is schema-valid, deterministic and passes line validation", () => {
    const bp = demoBlueprint(idea, { brand: "acme" });
    expect(blueprintSchema.parse(bp)).toEqual(bp);
    expect(demoBlueprint(idea, { brand: "acme" })).toEqual(bp);
    const lines = blueprintLines(bp);
    expect(failingLines(lines, checkLines(lines, { allowCaps: ["acme"] }))).toEqual([]);
    expect(bp.adGroups).toHaveLength(3);
    expect(bp.adGroups.every((g) => g.keywords.length === 5 && g.rsa.headlines.length >= 3 && g.rsa.descriptions.length >= 2)).toBe(true);
    const pmax = demoBlueprint({ ...idea, type: "PMax" });
    expect(pmax.adGroups.every((g) => g.keywords.length === 0)).toBe(true);
    expect(pmax.bidding.strategy).toBe("MAXIMIZE_CONVERSION_VALUE");
  });

  it("exports Editor rows with everything paused", () => {
    const bp = demoBlueprint(idea, { brand: "acme" });
    const { csv, rows, warnings } = blueprintToEditorCsv(bp, { finalUrl: "https://acme.example/shoes" });
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(EDITOR_HEADER.join(","));
    expect(lines).toHaveLength(rows + 1);
    expect(csv).toContain(",Paused,");
    expect(csv).not.toMatch(/,Enabled,/);
    expect(csv).toContain("Responsive search ad");
    expect(csv).toContain("Campaign Negative Phrase");
    expect(warnings).toEqual([]);
    expect(blueprintToEditorCsv(bp).warnings.join(" ")).toMatch(/final URL/);
  });
});

const facts = (over: Partial<NarrativeFacts> = {}): NarrativeFacts => ({
  range: { start: "2026-08-30", end: "2026-09-28", days: 30, label: "Last 30 days" },
  compareRange: { start: "2026-07-31", end: "2026-08-29" },
  currency: "USD",
  kpis: [
    { metric: "cost", label: "Spend", value: 126131.03, previous: 126888.04, changePct: -0.006, display: "$126.1K", deltaDisplay: "−0.6%", sentiment: "neutral" },
    { metric: "roas", label: "ROAS", value: 4.8405, previous: 4.7288, changePct: 0.0236, display: "4.84x", deltaDisplay: "+2.4%", sentiment: "positive" },
  ],
  signals: [
    { id: "c3:cpa", kind: "metric_deviation", campaign: "PMax — Full Catalog", shortName: "Full Catalog", title: "CPA up 71%", severity: "critical", metric: "cpa", changePct: 0.7064, recommendation: "Review auction insights." },
    { id: "c6:pacing", kind: "pacing", campaign: "Display — Cart Remarketing", shortName: "Cart Remarketing", title: "Overpacing", severity: "warning", metric: null, changePct: 0.18, recommendation: "Lower the daily budget." },
  ],
  bestRoas: { campaignId: "c1", name: "Brand — Core Terms", shortName: "Core Terms", roas: 19.9688, cost: 12177.27 },
  biggestMover: { campaignId: "c4", name: "Shopping — Best Sellers", shortName: "Best Sellers", metric: "cost", value: 17229.66, previous: 17740.36, delta: -510.7, changePct: -0.0288 },
  pacing: { month: "2026-09", projected: 126679.24, target: 136500, paceRatio: 0.9281, overpacingCount: 0 },
  dashboardId: null,
  ...over,
});

describe("demo narrative", () => {
  it("generalises the prototype's insight sentence", () => {
    expect(insightSentence(facts())).toBe("Full Catalog CPA +71% and Cart Remarketing overpacing need attention first. Core Terms returns 20.0x — the clearest place to scale.");
    expect(insightSentence(facts({ signals: [], bestRoas: null }))).toBe("No critical signals.");
  });

  it("is schema-valid and fully grounded in its own facts", () => {
    const f = facts();
    const n = demoNarrative(f);
    expect(narrativeSchema.parse(n)).toEqual(n);
    const report = groundingCheck([n.headline, ...n.bullets.map((b) => b.text), ...n.nextSteps], narrativeFactNumbers(f));
    expect(report.unmatched).toEqual([]);
    expect(demoNarrative(f)).toEqual(n);
  });
});

const agg = (o: Partial<WindowAgg>): WindowAgg => ({ impressions: 10_000, clicks: 500, cost: 500, conversions: 20, conv_value: 2000, lostIsRank: null, ...o });
const explainFacts = (over: Partial<ExplainFacts["signal"]>, changes: ExplainFacts["changes"], series: ExplainFacts["series"] = []): ExplainFacts => ({
  signal: { id: "s", title: "CPA up 50%", summary: "CPA rose", kind: "metric_deviation", metric: "cpa", severity: "critical", polarity: "bad", observed: 30, expected: 20, changePct: 0.5, campaignId: "c1", campaignName: "Campaign", window: { recentStart: "2026-09-26", recentEnd: "2026-09-28", baselineStart: "2026-09-12", baselineEnd: "2026-09-25" }, ...over },
  series,
  decomposition: null,
  contributions: [],
  changes,
});

describe("explanation rules", () => {
  it("log decomposition: ΔlnCPA = ΔlnCPC − ΔlnCVR", () => {
    const d = logDecomposition(agg({ cost: 900, clicks: 600, conversions: 15 }), agg({}));
    expect((d.dlnCpc ?? 0) - (d.dlnCvr ?? 0)).toBeCloseTo(d.dlnCpa ?? 0, 3);
    expect((d.cpcShare ?? 0) + (d.cvrShare ?? 0)).toBeCloseTo(1, 3);
  });

  const run = (f: ExplainFacts, recent: WindowAgg, baseline: WindowAgg) => {
    const withDecomp = { ...f, decomposition: logDecomposition(recent, baseline) };
    const out = explainWithRules({ facts: withDecomp, recent, baseline, recentDays: 3, baselineDays: 14 });
    expect(explanationSchema.parse(out)).toEqual(out);
    return out.possibleCauses.map((c) => `${c.likelihood}:${c.cause}`);
  };
  const base = agg({ impressions: 14 * 10_000, clicks: 14 * 500, cost: 14 * 500, conversions: 14 * 20 });

  it("CPC up + lost-to-rank up → auction pressure", () => {
    expect(run(explainFacts({}, []), agg({ impressions: 30_000, clicks: 1500, cost: 3 * 900, conversions: 60, lostIsRank: 0.3 }), { ...base, lostIsRank: 0.1 })[0]).toBe("high:Auction pressure from competitors");
  });
  it("CTR down + recent ad change → creative change", () => {
    const f = explainFacts({ metric: "ctr" }, [{ id: "e1", ts: "2026-09-25 09:00:00", date: "2026-09-25", resource: "AD_GROUP_AD", fields: ["ad.video_ad"], summary: "New ad" }]);
    expect(run(f, agg({ impressions: 30_000, clicks: 700, cost: 700, conversions: 28 }), base)).toContain("high:Creative change");
  });
  it("conversions ≈ 0 with normal clicks → tracking break", () => {
    const series = ["2026-09-26", "2026-09-27", "2026-09-28"].map((date, i) => ({ date, impressions: 10_000, clicks: 500, cost: 500, conversions: i === 0 ? 5 : 0, ctr: 0.05, cpc: 1, cvr: null, cpa: null }));
    const f = explainFacts({ metric: "conversions" }, [], series);
    expect(run(f, agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 5 }), base)[0]).toBe("high:Conversion tracking break");
  });
  it("spend up + bid strategy change → bid strategy switch", () => {
    const f = explainFacts({ metric: "spend" }, [{ id: "e2", ts: "2026-09-24 10:00:00", date: "2026-09-24", resource: "CAMPAIGN", fields: ["bidding_strategy_type"], summary: "Bid strategy changed" }]);
    expect(run(f, agg({ impressions: 45_000, clicks: 2250, cost: 2250, conversions: 90 }), base)).toContain("high:Bid strategy switch");
  });
  it("CVR down + final URL change → landing page change", () => {
    const f = explainFacts({}, [{ id: "e3", ts: "2026-09-26 16:40:00", date: "2026-09-26", resource: "ASSET", fields: ["final_urls"], summary: "Final URL changed" }]);
    expect(run(f, agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 30 }), base)[0]).toBe("high:Landing page change");
  });
  it("falls back to a low-likelihood generic cause", () => {
    expect(run(explainFacts({}, []), agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 60 }), base)).toEqual(["low:Normal volatility, seasonality or low volume"]);
  });

  // Change-history rules: budget, status, target, keyword, negative and targeting changes, the timing check and the
  // server's verdict (window: recent Sep 26–28, onset Sep 26 unless given).
  const change = (over: Partial<ExplainFacts["changes"][number]>): ExplainFacts["changes"][number] => ({ id: "c1", ts: "2026-09-25 09:00:00", date: "2026-09-25", resource: "CAMPAIGN", fields: [], summary: "Changed", ...over });
  const budgetUp = change({ resource: "CAMPAIGN_BUDGET", fields: ["amount_micros"], category: "budget", action: "raised", effect: "Budget +50% ($500 → $750)", summary: "Budget changed from $500.00 to $750.00" });
  const spendUp = agg({ impressions: 45_000, clicks: 2250, cost: 2250, conversions: 90 });
  const spendDown = agg({ impressions: 18_000, clicks: 900, cost: 900, conversions: 36 });

  it("budget raised / cut before the shift", () => {
    expect(run(explainFacts({ metric: "spend" }, [budgetUp]), spendUp, base)).toContain("high:Budget increase");
    const cut = change({ resource: "CAMPAIGN_BUDGET", fields: ["amount_micros"], category: "budget", action: "lowered", summary: "Budget changed from $500.00 to $300.00" });
    expect(run(explainFacts({ metric: "conversions" }, [cut]), spendDown, base)).toContain("high:Budget cut");
  });

  it("paused / enabled campaigns and ad groups", () => {
    const paused = change({ resource: "AD_GROUP", fields: ["status"], category: "status", action: "paused", summary: "Ad group paused" });
    expect(run(explainFacts({ metric: "conversions" }, [paused]), spendDown, base)).toContain("high:Paused campaign or ad group");
    const enabled = change({ resource: "AD_GROUP", fields: ["status"], category: "status", action: "enabled", summary: "Ad group enabled" });
    expect(run(explainFacts({ metric: "spend" }, [enabled]), spendUp, base)).toContain("medium:Newly enabled campaign or ad group");
  });

  it("target change behind a CPA move, new keywords, negatives and targeting changes", () => {
    const target = change({ fields: ["target_cpa.target_cpa_micros"], category: "bid_target", action: "raised", summary: "Target CPA changed from $25.00 to $35.00" });
    expect(run(explainFacts({ metric: "cpa" }, [target]), agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 45 }), base)).toContain("high:Bid or target change");
    const keywords = change({ resource: "AD_GROUP_CRITERION", fields: ["keyword.text", "status"], category: "keywords", action: "added", summary: "Keyword “trail shoes” added (Broad match)" });
    expect(run(explainFacts({ metric: "cpc" }, [keywords]), agg({ impressions: 30_000, clicks: 1500, cost: 2100, conversions: 60 }), base)).toContain("medium:New keywords changed the traffic mix");
    const negatives = change({ resource: "CAMPAIGN_CRITERION", fields: ["keyword.text", "negative"], category: "negatives", action: "added", summary: "Negative keyword “free” added" });
    expect(run(explainFacts({ metric: "conversions" }, [negatives]), agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 36 }), base)).toContain("medium:Negative keywords blocking converting searches");
    const targeting = change({ resource: "CAMPAIGN_CRITERION", fields: ["audience"], summary: "Audience segment added" }); // category from the fields
    expect(run(explainFacts({ metric: "ctr" }, [targeting]), agg({ impressions: 30_000, clicks: 1000, cost: 1000, conversions: 40 }), base)).toContain("medium:Targeting change");
  });

  it("changes after the onset are not causes", () => {
    const late = change({ id: "late", ts: "2026-09-27 10:00:00", date: "2026-09-27", resource: "ASSET", fields: ["final_urls"], summary: "Final URL changed" });
    const f = { ...explainFacts({ onsetDate: "2026-09-26" }, [late]), decomposition: null };
    const recent = agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 30 });
    const out = explainWithRules({ facts: { ...f, decomposition: logDecomposition(recent, base) }, recent, baseline: base, recentDays: 3, baselineDays: 14 });
    expect(out.possibleCauses[0]).toMatchObject({ cause: "Landing page or offer issue", likelihood: "medium" });
    expect(out.confidenceNote).toContain("One change was made after the shift began and is not treated as a cause.");
  });

  it("follows the server's verdict: expected, learning, no recent changes", () => {
    const expected = { ...explainFacts({ metric: "spend" }, [{ ...budgetUp, primary: true }]), changeContext: { verdict: "expected" as const, eventId: "c1", lagDays: 1, note: "Budget +50% ($500 → $750) on Sep 25 — the rise in spend is expected." } };
    const e = run(expected, spendUp, base);
    expect(e[0]).toBe("high:Expected effect of a recent change");
    expect(e).not.toContain("high:Budget increase");
    const strategy = change({ fields: ["bidding_strategy_type"], category: "bidding", action: "switched", summary: "Bid strategy changed from Target CPA to Maximize conversions", primary: true });
    const learning = { ...explainFacts({ metric: "cpa" }, [strategy]), changeContext: { verdict: "learning" as const, eventId: "c1", lagDays: 1, learning: { day: 4, days: 7 }, note: "…" } };
    const withDecomp = { ...learning, decomposition: logDecomposition(agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 45 }), base) };
    const l = explainWithRules({ facts: withDecomp, recent: agg({ impressions: 30_000, clicks: 1500, cost: 1500, conversions: 45 }), baseline: base, recentDays: 3, baselineDays: 14 });
    expect(l.possibleCauses[0]).toMatchObject({ cause: "Bid-strategy learning period", likelihood: "high", evidence: expect.arrayContaining(["Day 4 of about 7"]) });
    expect(l.actions[0]?.action).toBe("Wait for the learning period to end before changing bids or targets");
    const quiet = { ...explainFacts({}, []), changeContext: { verdict: "no_recent_changes" as const, note: "Nothing changed in this campaign in the 14 days before the shift, so the cause is likely external (competitors, seasonality or market)." } };
    expect(run(quiet, agg({ impressions: 30_000, clicks: 1500, cost: 3 * 900, conversions: 60, lostIsRank: 0.3 }), { ...base, lostIsRank: 0.1 })).toEqual(["high:Auction pressure from competitors", "medium:External factors (competitors, seasonality, market)"]);
  });
  it("segment contributions sum to 1 for additive metrics", () => {
    const c = segmentContributions("cost", "device", [
      { segment: "Mobile", recent: agg({ cost: 900 }), baseline: agg({ cost: 14 * 200 }) },
      { segment: "Desktop", recent: agg({ cost: 600 }), baseline: agg({ cost: 14 * 190 }) },
    ], 3, 14);
    expect(c.reduce((s, x) => s + (x.share ?? 0), 0)).toBeCloseTo(1, 3);
    expect(c[0]?.segment).toBe("Mobile");
  });
});

describe("negative-keyword rules", () => {
  const t = (term: string, o: Partial<SearchTermAgg> = {}): SearchTermAgg => ({ term, campaignId: "c2", adGroupId: "ag1", cost: 50, clicks: 30, impressions: 1000, conversions: 0, status: "none", ...o });
  const campaigns = new Map([
    ["c2", { name: "Generic — Running Shoes", type: "Search" }],
    ["c8", { name: "Search — Competitor Terms", type: "Search" }],
    ["c3", { name: "PMax — Full Catalog", type: "PMax" }],
  ]);
  const input = (terms: SearchTermAgg[]) => ({ terms, campaigns, campaignCtr: new Map([["c2", 0.05]]), accountCpa: 20, brandTerms: ["acme"], competitorTerms: ["stridemax"], rangeDays: 15 });

  it("applies each rule and protects brand, converting and excluded terms", () => {
    const { candidates, thresholds } = findNegativeCandidates(
      input([
        t("running shoes jobs"),
        t("acme running", { cost: 500 }),
        t("acme careers"),
        t("best running shoes", { conversions: 3, cost: 900 }),
        t("used running shoes", { conversions: 1 }),
        t("free shipping running shoes", { cost: 10, clicks: 5, impressions: 100 }),
        t("stridemax sale", { campaignId: "c3", cost: 10, clicks: 2, conversions: 0 }),
        t("stridemax shoes", { campaignId: "c8", cost: 10, clicks: 2 }),
        t("cheap trail sneakers", { cost: 60, clicks: 5, impressions: 100 }),
        t("old excluded term", { status: "excluded", cost: 999 }),
        t("low ctr term", { impressions: 5000, clicks: 10, cost: 5 }),
      ]),
    );
    expect(thresholds.costThreshold).toBe(40);
    const byTerm = new Map(candidates.map((c) => [c.term, c]));
    expect(byTerm.get("running shoes jobs")?.rules).toEqual(["high_cost_no_conv", "clicks_no_conv", "modifier"]);
    expect(byTerm.get("running shoes jobs")).toMatchObject({ negativeText: "jobs", suggestedMatch: "Phrase", suggestedLevel: "account_list", monthlySavings: 100 });
    expect(byTerm.has("acme running")).toBe(false);
    expect(byTerm.get("acme careers")?.rules).toContain("modifier");
    expect(byTerm.has("best running shoes")).toBe(false);
    expect(byTerm.get("used running shoes")?.rules).toEqual(["modifier"]);
    expect(byTerm.has("free shipping running shoes")).toBe(false);
    expect(byTerm.get("stridemax sale")?.rules).toEqual(["competitor"]);
    expect(byTerm.has("stridemax shoes")).toBe(false);
    expect(byTerm.get("cheap trail sneakers")?.rules).toEqual(["high_cost_no_conv"]);
    expect(byTerm.has("old excluded term")).toBe(false);
    expect(byTerm.get("low ctr term")?.rules).toEqual(["low_ctr"]);
  });

  it("finds wasteful n-grams shared by 3+ non-converting terms", () => {
    const quiet = { cost: 20, clicks: 5, impressions: 100 };
    const { candidates } = findNegativeCandidates(input([t("marathon checklist plan", quiet), t("marathon checklist guide", quiet), t("marathon checklist printable", quiet), t("marathon shoes", { conversions: 2 })]));
    expect(candidates.filter((c) => c.kind === "term")).toEqual([]);
    const ngram = candidates.find((c) => c.kind === "ngram");
    expect(ngram).toMatchObject({ term: "checklist", suggestedMatch: "Phrase", suggestedLevel: "campaign", campaignId: "c2", monthlySavings: 120 });
    expect(candidates.some((c) => c.kind === "ngram" && c.term.includes("marathon"))).toBe(false);
  });

  it("demo verdicts: negative for lexicon/zero-conversion waste, review otherwise; AI verdicts only for known terms", () => {
    const { candidates } = findNegativeCandidates(input([t("running shoes jobs"), t("used running shoes", { conversions: 1 }), t("stridemax sale", { campaignId: "c3", cost: 10, clicks: 2 })]));
    const demo = new Map(withDemoVerdicts(candidates).map((c) => [c.term, c.verdict]));
    expect(Object.fromEntries(demo)).toEqual({ "running shoes jobs": "negative", "used running shoes": "review", "stridemax sale": "review" });
    const merged = applyVerdicts(candidates, [
      { term: "Running Shoes Jobs", verdict: "keep", matchType: "Exact", level: "ad_group", reason: "Relevant" },
      { term: "invented term", verdict: "negative", matchType: "Exact", level: "campaign", reason: "?" },
    ]);
    expect(merged.unknown).toBe(1);
    expect(merged.unclassified).toBe(2);
    expect(merged.candidates.find((c) => c.term === "running shoes jobs")).toMatchObject({ verdict: "keep", suggestedMatch: "Exact" });
  });

  it("aggregates daily search-term rows", () => {
    const rows = [
      { search_term: "a b", campaign_id: "c2", ad_group_id: "g", cost: 1, clicks: 2, impressions: 3, conversions: 0, st_status: "none" },
      { search_term: "a b", campaign_id: "c2", ad_group_id: "g", cost: 2, clicks: 1, impressions: 3, conversions: 1, st_status: "added" },
    ];
    expect(aggregateSearchTerms(rows)).toEqual([{ term: "a b", campaignId: "c2", adGroupId: "g", cost: 3, clicks: 3, impressions: 6, conversions: 1, status: "added" }]);
  });
});

describe("chat narration", () => {
  const registry = new MetricRegistry();
  const result: QueryResult = {
    columns: [
      { key: "campaign", label: "Campaign", kind: "dimension" },
      { key: "roas", label: "ROAS", kind: "metric", format: "ratio" },
      { key: "cost", label: "Spend", kind: "metric", format: "money" },
    ],
    rows: [
      { campaign: "Brand — Core Terms", campaign_id: "c1", roas: 22.9, cost: 2912 },
      { campaign: "Display — Cart Remarketing", campaign_id: "c6", roas: 4.56, cost: 2158 },
    ],
    totals: { roas: 5.04, cost: 26500 },
    meta: { range: { start: "2026-09-22", end: "2026-09-28", days: 7 }, table: "campaign_daily", grain: "daily", currency: "USD", timezone: "America/New_York", sources: [], truncated: true, rowCount: 2, warnings: [], tookMs: 1 },
  };

  it("only uses numbers from the result", () => {
    const text = narrateResults([{ title: "Top campaigns by ROAS", result }], registry);
    expect(text).toContain("1. Brand — Core Terms — ROAS 22.90x (Spend $2,912)");
    expect(text).toContain("All campaigns combined: ROAS 5.04x.");
    expect(narrateResults([{ title: "Empty", result: { ...result, rows: [] } }], registry)).toMatch(/no rows matched/);
  });

  it("suggests follow-ups deterministically", () => {
    expect(followUps(["campaign"], "none")).toEqual(["Show the daily trend", "Break it down by device", "Compare with the previous period"]);
  });
});
