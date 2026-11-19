import { describe, expect, it } from "vitest";
import type { AdCopy, Blueprint, CampaignIdea } from "@/lib/domain/contracts/ai";
import { MONTHLY_CAP_FACTOR } from "@/lib/domain/contracts/budget";
import { adsTextLength, checkAdText, fitAdText, insertionDefaults, lintAdText } from "@/lib/domain/ai/ads-text";
import { demoBlueprint, demoIdeas } from "@/lib/domain/ai/demo-engine";
import {
  adCopyLines,
  blueprintLines,
  checkLines,
  clampConfidence,
  extractNumbers,
  failingLines,
  fitDailyBudgets,
  groundingCheck,
  meetsRsaMinimum,
  nameIds,
  normalizeBlueprint,
  rebuildAdCopy,
  rebuildBlueprint,
  repairIdeas,
  rsaBelowMinimum,
  truncateWords,
} from "@/lib/domain/ai/validators";

const idea = (over: Partial<CampaignIdea> = {}): CampaignIdea => ({
  title: "Long-tail generic Search",
  type: "Search",
  audience: "Runners",
  keywords: ["wide fit running shoes", "trail shoes women", "carbon plate trainers"],
  rationale: "CPA sits above average.",
  dailyBudget: 100,
  impact: "CPA −18%",
  confidence: 70,
  citedCampaignIds: ["c2"],
  ...over,
});

describe("Google Ads text length", () => {
  it("counts East-Asian wide characters as 2", () => {
    expect(adsTextLength("Trail Running Shoes")).toBe(19);
    expect(adsTextLength("ランニングシューズ")).toBe(18);
    expect(adsTextLength("Acme 跑鞋")).toBe(9);
    expect(adsTextLength("ＡＢＣ")).toBe(6);
    expect(adsTextLength("러닝화 세일")).toBe(11);
  });

  it("counts only the default text of {KeyWord:…} insertions", () => {
    expect(insertionDefaults("{KeyWord:Running Shoes} Sale")).toBe("Running Shoes Sale");
    expect(adsTextLength("{KeyWord:Running Shoes} Sale")).toBe(18);
    expect(adsTextLength("{keyword:跑鞋}")).toBe(4);
    expect(adsTextLength("{LOCATION(City):Your City} Stores")).toBe(16);
    expect(checkAdText("{KeyWord:A Very Long Default Keyword Text Here}", "headline").issues[0]).toMatch(/Too long \(37\/30\)/);
    expect(checkAdText("{KeyWord:Trail Running Shoes}", "headline").ok).toBe(true);
  });

  it("fitAdText trims on word boundaries", () => {
    expect(fitAdText("Shop the brand new trail running shoe collection", 30)).toBe("Shop the brand new trail");
    expect(adsTextLength(fitAdText("ランニングシューズ ランニングシューズ", 30))).toBeLessThanOrEqual(30);
  });
});

describe("policy lint", () => {
  it("flags exclamation marks in headlines only", () => {
    expect(lintAdText("Buy Now!", "headline")).toContain("Headlines can't contain exclamation marks");
    expect(lintAdText("Great shoes. Buy now!", "description")).toEqual([]);
  });
  it("flags emoji, ALL CAPS (except allowed acronyms) and repeated punctuation", () => {
    expect(lintAdText("Run faster 🏃", "headline").join()).toMatch(/Emoji/);
    expect(lintAdText("FREE Shipping Today", "headline").join()).toMatch(/ALL CAPS words \(FREE\)/);
    expect(lintAdText("ASICS Trail Shoes", "headline", { allowCaps: ["asics"] })).toEqual([]);
    expect(lintAdText("NYC Store", "headline")).toEqual([]);
    expect(lintAdText("Big sale..", "description").join()).toMatch(/Repeated punctuation/);
    expect(lintAdText("Really?? Yes", "description").join()).toMatch(/Repeated punctuation/);
  });
  it("checks keyword length and word count", () => {
    expect(checkAdText("one two three four five six seven eight nine ten eleven", "keyword").issues.join()).toMatch(/Too many words/);
    expect(checkAdText("trail running shoes", "keyword").ok).toBe(true);
  });
});

describe("campaign idea repair", () => {
  const known = new Set(["c1", "c2", "c3", "c4", "c5", "c6", "c8"]);
  const topUps = demoIdeas("Scale conversions");

  it("enforces titles, keywords, confidence and cited ids", () => {
    const r = repairIdeas(
      [idea({ title: "An extremely long title that keeps going on and on", keywords: ["a", "A ", " b ", "c", "d"], confidence: 120, citedCampaignIds: ["c2", "c99", "c2"] })],
      { testBudget: 100_000, knownCampaignIds: known, topUps },
    );
    const first = r.ideas[0];
    expect(first?.title).toBe("An extremely long title that keeps");
    expect(first?.keywords).toEqual(["a", "b", "c"]);
    expect(first?.confidence).toBe(95);
    expect(first?.citedCampaignIds).toEqual(["c2"]);
    expect(r.warnings.join(" ")).toMatch(/Dropped 1 cited campaign id/);
    expect(clampConfidence(12.4)).toBe(40);
    expect(clampConfidence(66.6)).toBe(67);
    expect(clampConfidence(Number.NaN)).toBe(60);
    expect(truncateWords("“Brand defense on competitor surge.”", 6)).toBe("Brand defense on competitor surge");
  });

  it("returns exactly six ideas: trims extras and tops up from the demo library (marked)", () => {
    const many = Array.from({ length: 8 }, (_, i) => idea({ title: `Idea number ${i}` }));
    const trimmed = repairIdeas(many, { testBudget: 100_000, knownCampaignIds: known, topUps });
    expect(trimmed.ideas).toHaveLength(6);
    expect(trimmed.ideas.some((i) => i.topUp)).toBe(false);

    const few = repairIdeas([idea(), idea()], { testBudget: 100_000, knownCampaignIds: known, topUps });
    expect(few.ideas).toHaveLength(6);
    expect(few.ideas.filter((i) => i.topUp)).toHaveLength(5);
    expect(few.warnings.join(" ")).toMatch(/Added 5 demo ideas/);
  });

  it("scales daily budgets to the monthly test budget (round to $5, min $10)", () => {
    const r = repairIdeas(demoIdeas("Lower CPA"), { testBudget: 3000, knownCampaignIds: known, topUps: [] });
    const dailies = r.ideas.map((i) => i.dailyBudget);
    expect(dailies.every((d) => d % 5 === 0 && d >= 10)).toBe(true);
    expect(dailies.reduce((s, d) => s + d, 0) * MONTHLY_CAP_FACTOR).toBeLessThanOrEqual(1.1 * 3000);
    expect(r.warnings.join(" ")).toMatch(/scaled down/);

    const within = fitDailyBudgets([30, 20], 3000);
    expect(within).toEqual({ dailies: [30, 20], scaled: false, overCap: false });
    const floor = fitDailyBudgets([100, 100, 100, 100, 100, 100], 1000);
    expect(floor.dailies).toEqual([10, 10, 10, 10, 10, 10]);
    expect(floor.overCap).toBe(true);
  });
});

describe("RSA / blueprint line validation", () => {
  const copy: AdCopy = {
    headlines: [
      { text: "Trail Running Shoes", pin: 1, angle: "keyword" },
      { text: "Shop Now!", pin: 7, angle: "cta" },
      { text: "This headline is far too long for Google Ads", pin: null, angle: "benefit" },
      { text: "trail running shoes", pin: null, angle: "keyword" },
      { text: "Free Returns", pin: null, angle: "benefit" },
    ],
    descriptions: [
      { text: "Find your fit and order online today.", pin: null },
      { text: "Grippy, light and waterproof trail shoes for every season.", pin: 3 },
    ],
    path1: "trail shoes",
    path2: null,
  };

  it("finds failing lines, repairs by id and drops the rest", () => {
    const normalized = rebuildAdCopy(copy, new Map());
    expect(normalized.headlines[1]?.pin).toBeNull();
    expect(normalized.descriptions[1]?.pin).toBeNull();
    expect(normalized.path1).toBe("trail-shoes");
    const lines = adCopyLines(normalized);
    const failing = failingLines(lines, checkLines(lines));
    expect(failing.map((f) => f.id)).toEqual(["h1", "h2", "h3"]);
    expect(failing.find((f) => f.id === "h3")?.issues).toContain("Duplicate");

    const repaired = rebuildAdCopy(normalized, new Map([["h1", "Shop Now"], ["h2", "Built for Long Trail Runs"]]), new Set(["h3"]));
    const again = adCopyLines(repaired);
    expect(failingLines(again, checkLines(again))).toEqual([]);
    expect(repaired.headlines.map((h) => h.text)).toEqual(["Trail Running Shoes", "Shop Now", "Built for Long Trail Runs", "Free Returns"]);
    expect(meetsRsaMinimum(repaired)).toBe(true);
    expect(meetsRsaMinimum({ headlines: repaired.headlines.slice(0, 2), descriptions: repaired.descriptions })).toBe(false);
  });

  it("normalizes blueprints: caps, dedupes, keyword limits and bidding consistency", () => {
    const base = demoBlueprint(idea());
    const group = base.adGroups[0];
    if (!group) throw new Error("template has no ad group");
    const bp: Blueprint = {
      ...base,
      bidding: { strategy: "TARGET_CPA", targetCpa: null, targetRoas: 3 },
      adGroups: Array.from({ length: 25 }, (_, i) => ({
        ...group,
        name: `Group ${i}`,
        keywords: [...Array.from({ length: 60 }, (_, k) => ({ text: `keyword ${k}`, matchType: "Phrase" as const })), { text: "Keyword 0", matchType: "Phrase" as const }, { text: "x ".repeat(12).trim(), matchType: "Broad" as const }],
      })),
    };
    const { blueprint, warnings } = normalizeBlueprint(bp, 50);
    expect(blueprint.adGroups).toHaveLength(20);
    expect(blueprint.adGroups[0]?.keywords).toHaveLength(50);
    expect(blueprint.bidding).toEqual({ strategy: "MAXIMIZE_CONVERSIONS", targetCpa: null, targetRoas: null });
    expect(warnings.join(" ")).toMatch(/Capped at 20 ad groups/);
  });

  it("drops failing blueprint lines and reports ad groups below the RSA minimum", () => {
    const base = demoBlueprint(idea());
    const bp: Blueprint = { ...base, adGroups: base.adGroups.map((g, i) => (i === 0 ? { ...g, rsa: { ...g.rsa, headlines: ["Only One Headline", "WAY TOO LOUD HEADLINE!", "Second Headline"] } } : g)), callouts: [...base.callouts, "This callout is much too long to fit"] };
    const lines = blueprintLines(bp);
    const failing = failingLines(lines, checkLines(lines));
    expect(failing.map((f) => f.id)).toEqual(["ag0.h1", "co4"]);
    const dropped = rebuildBlueprint(bp, new Map(), new Set(failing.map((f) => f.id)));
    expect(dropped.callouts).toHaveLength(base.callouts.length);
    expect(rsaBelowMinimum(dropped)).toEqual([0]);
  });
});

describe("numeric grounding", () => {
  it("extracts data-like numbers and ignores dates, years and small counts", () => {
    const nums = extractNumbers("Spend $12,345.67 on 2026-09-28 (top 2 campaigns, 2026) with ROAS 3.2x, CTR 4.5% and $12.3K revenue");
    expect(nums.map((n) => [n.value, n.unit])).toEqual([
      [12345.67, "$"],
      [3.2, "x"],
      [4.5, "%"],
      [12300, "$"],
    ]);
  });
  it("matches facts within rounding and reports the rest", () => {
    const facts = [12345.67, 3.21, 4.49, 12.3];
    expect(groundingCheck(["Spend $12,346, ROAS 3.2x, CTR 4.5%, CPA down 12%"], facts).unmatched).toEqual([]);
    const bad = groundingCheck(["Spend $99,999 and ROAS 7.1x"], facts);
    expect(bad.unmatched).toEqual(["$99,999", "7.1x"]);
    expect(bad.ratio).toBe(1);
  });
  it("ignores numbers inside quoted names, but not after possessives", () => {
    expect(extractNumbers(`the creative swap to 'Fall drop 15s' and “Summer hero 30s”, plus "Promo 25"`)).toEqual([]);
    expect(extractNumbers("Google's CPA rose 25% while competitors' bids fell 18%").map((n) => n.raw)).toEqual(["25%", "18%"]);
    // the source side keeps them: the model may repeat a name without its quotes
    expect(extractNumbers("New video ad “Fall drop 15s” created", { quoted: true }).map((n) => n.value)).toEqual([15]);
  });
  it("grounds the numbers that the facts' own sentences contain (Gemini, 2026-10-09: 14, 15, 15 were flagged)", () => {
    const sources = ["No account changes in the 14 days before the shift: rising CPCs usually mean competitors.", "New video ad “Fall drop 15s” created"];
    const text = ["CPA spiked with no account changes in the prior 14 days.", "CTR fell after the Fall drop 15s creative went live."];
    expect(groundingCheck(text, [], sources).unmatched).toEqual([]);
    expect(groundingCheck(text, []).unmatched).toEqual(["14", "15"]);
  });
});

describe("ids in AI prose", () => {
  it("become names, while ids inside other tokens stay (Gemini wrote 'campaign c8')", () => {
    const names = new Map([
      ["c8", "Search — Competitor Terms"],
      ["1234567890", "Brand — Core Terms"],
    ]);
    expect(nameIds("Review Auction Insights for campaign c8 (c8, from Oct 6).", names)).toBe("Review Auction Insights for campaign Search — Competitor Terms (Search — Competitor Terms, from Oct 6).");
    expect(nameIds("Campaign 1234567890 leads.", names)).toBe("Campaign Brand — Core Terms leads.");
    expect(nameIds("c80, campaign:c8, /c8/x, abc8, c8:cpa and the ad group c8-ag1 stay", names)).toBe("c80, campaign:c8, /c8/x, abc8, c8:cpa and the ad group c8-ag1 stay");
    expect(nameIds("Pause c8.", names)).toBe("Pause Search — Competitor Terms.");
    // "$" in a name is text, not a replacement pattern
    expect(nameIds("Raise c8", new Map([["c8", "Save $& now"]]))).toBe("Raise Save $& now");
  });
});
