import type { NegativeCandidate, NegativeRuleId, NegativeVerdicts } from "../contracts/ai";

// Negative-keyword candidates from search terms. Rules find the waste; the AI (or the demo verdicts) only
// classifies the candidates it is given. Brand terms and converting terms are protected.

export const NEGATIVE_RULES = { cpaMultiple: 2, minCost: 20, minClicks: 20, lowCtrFactor: 0.2, minImpressions: 500, ngramMinTerms: 3, maxCandidates: 200 } as const;

/** Irrelevant-intent modifiers (word-boundary matches). Purchase phrases like "free shipping" are exempt. */
export const IRRELEVANT_MODIFIERS: { word: string; re: RegExp }[] = [
  { word: "free", re: /\bfree\b(?!\s+(?:shipping|delivery|returns?|exchanges?))/ },
  { word: "jobs", re: /\bjobs?\b/ },
  { word: "careers", re: /\bcareers?\b/ },
  { word: "salary", re: /\bsalar(?:y|ies)\b/ },
  { word: "how to", re: /\bhow to\b/ },
  { word: "diy", re: /\bdiy\b/ },
  { word: "repair", re: /\brepairs?\b/ },
  { word: "used", re: /\bused\b/ },
  { word: "manual", re: /\bmanuals?\b/ },
  { word: "pdf", re: /\bpdf\b/ },
  { word: "login", re: /\blog ?in\b/ },
  { word: "reddit", re: /\breddit\b/ },
  { word: "wiki", re: /\bwiki(?:pedia)?\b/ },
  { word: "meaning", re: /\bmeaning\b/ },
  { word: "customer service", re: /\bcustomer service\b/ },
  { word: "warranty", re: /\bwarrant(?:y|ies)\b/ },
];

const STOPWORDS = new Set(["the", "and", "for", "with", "near", "best", "top", "buy", "shop", "online", "sale", "cheap", "men", "mens", "women", "womens", "kids", "size", "your", "from", "what", "who", "are", "you", "can", "does", "how"]);

export interface SearchTermAgg {
  term: string;
  campaignId: string;
  adGroupId: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  status: string;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Sum search-term fact rows per (term, campaign, ad group). */
export function aggregateSearchTerms(rows: readonly Record<string, unknown>[]): SearchTermAgg[] {
  const map = new Map<string, SearchTermAgg>();
  for (const r of rows) {
    const term = String(r.search_term ?? "").trim();
    if (!term) continue;
    const campaignId = String(r.campaign_id ?? "");
    const adGroupId = String(r.ad_group_id ?? "");
    const key = `${term.toLowerCase()}\u0001${campaignId}\u0001${adGroupId}`;
    let a = map.get(key);
    if (!a) {
      a = { term, campaignId, adGroupId, cost: 0, clicks: 0, impressions: 0, conversions: 0, status: String(r.st_status ?? "none") };
      map.set(key, a);
    }
    a.cost += num(r.cost);
    a.clicks += num(r.clicks);
    a.impressions += num(r.impressions);
    a.conversions += num(r.conversions);
    if (r.st_status && r.st_status !== "none") a.status = String(r.st_status);
  }
  return [...map.values()];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function containsWord(text: string, word: string): boolean {
  const w = word.trim().toLowerCase();
  return !!w && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(w)}($|[^\\p{L}\\p{N}])`, "u").test(text.toLowerCase());
}

export function matchModifier(term: string): string | null {
  const t = term.toLowerCase();
  return IRRELEVANT_MODIFIERS.find((m) => m.re.test(t))?.word ?? null;
}

export interface NegativeRuleInput {
  terms: readonly SearchTermAgg[];
  campaigns: ReadonlyMap<string, { name: string; type: string }>;
  /** campaign-level CTR over the same range (clicks ÷ impressions) */
  campaignCtr: ReadonlyMap<string, number | null>;
  accountCpa: number | null;
  brandTerms: readonly string[];
  competitorTerms: readonly string[];
  rangeDays: number;
  campaignId?: string;
}

export interface NegativeThresholds {
  accountCpa: number | null;
  costThreshold: number;
  clicksThreshold: number;
  lowCtrFactor: number;
  minImpressions: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const money = (v: number) => `$${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)}`;

export function findNegativeCandidates(input: NegativeRuleInput): { candidates: NegativeCandidate[]; thresholds: NegativeThresholds } {
  const costThreshold = Math.max(NEGATIVE_RULES.cpaMultiple * (input.accountCpa ?? 0), NEGATIVE_RULES.minCost);
  const thresholds: NegativeThresholds = { accountCpa: input.accountCpa, costThreshold: r2(costThreshold), clicksThreshold: NEGATIVE_RULES.minClicks, lowCtrFactor: NEGATIVE_RULES.lowCtrFactor, minImpressions: NEGATIVE_RULES.minImpressions };
  const days = Math.max(1, input.rangeDays);
  const scope = input.terms.filter((t) => !input.campaignId || t.campaignId === input.campaignId);
  const isBrand = (term: string) => input.brandTerms.some((b) => containsWord(term, b));
  const competitorIn = (term: string) => input.competitorTerms.find((c) => containsWord(term, c)) ?? null;
  const isCompetitorCampaign = (id: string) => {
    const name = (input.campaigns.get(id)?.name ?? "").toLowerCase();
    return name.includes("competitor") || input.competitorTerms.some((c) => containsWord(name, c));
  };
  const excluded = (s: string) => s === "excluded" || s === "added_excluded";

  const out: (NegativeCandidate & { rules: NegativeRuleId[] })[] = [];
  for (const t of scope) {
    if (excluded(t.status)) continue;
    const modifier = matchModifier(t.term);
    if (isBrand(t.term) && !modifier) continue;
    if (t.conversions > 0 && !modifier) continue;
    const rules: NegativeRuleId[] = [];
    const reasons: string[] = [];
    const zeroConv = t.conversions <= 0;
    if (zeroConv && t.cost >= costThreshold) {
      rules.push("high_cost_no_conv");
      reasons.push(`${money(t.cost)} spent with no conversions (threshold ${money(costThreshold)})`);
    }
    if (zeroConv && t.clicks >= NEGATIVE_RULES.minClicks) {
      rules.push("clicks_no_conv");
      reasons.push(`${Math.round(t.clicks)} clicks and no conversions`);
    }
    if (modifier) {
      rules.push("modifier");
      reasons.push(`Irrelevant modifier “${modifier}”`);
    }
    const competitor = competitorIn(t.term);
    if (competitor && !isCompetitorCampaign(t.campaignId)) {
      rules.push("competitor");
      reasons.push(`Competitor term “${competitor}” outside a competitor campaign`);
    }
    const campCtr = input.campaignCtr.get(t.campaignId) ?? null;
    const ctr = t.impressions > 0 ? t.clicks / t.impressions : null;
    if (zeroConv && t.impressions >= NEGATIVE_RULES.minImpressions && campCtr && ctr !== null && ctr < NEGATIVE_RULES.lowCtrFactor * campCtr) {
      rules.push("low_ctr");
      reasons.push(`CTR ${(ctr * 100).toFixed(2)}% vs campaign ${(campCtr * 100).toFixed(2)}%`);
    }
    if (!rules.length) continue;
    const phrase = modifier ?? (rules.includes("competitor") ? competitor : null);
    out.push({
      id: `t:${t.campaignId}:${t.adGroupId}:${t.term.toLowerCase()}`,
      kind: "term",
      term: t.term,
      negativeText: phrase ?? t.term.toLowerCase(),
      campaignId: t.campaignId,
      campaignName: input.campaigns.get(t.campaignId)?.name ?? t.campaignId,
      adGroupId: t.adGroupId,
      cost: r2(t.cost),
      clicks: Math.round(t.clicks),
      impressions: Math.round(t.impressions),
      conversions: r2(t.conversions),
      reasons,
      rules,
      suggestedMatch: phrase ? "Phrase" : "Exact",
      suggestedLevel: modifier ? "account_list" : rules.includes("competitor") ? "campaign" : "ad_group",
      monthlySavings: r2((t.cost * 30) / days),
    });
  }

  // Wasteful n-grams: 1–2 word fragments shared by ≥ 3 terms with enough spend and no conversions anywhere.
  const grams = new Map<string, { terms: Set<string>; campaigns: Set<string>; cost: number; clicks: number; impressions: number; conversions: number }>();
  for (const t of scope) {
    if (excluded(t.status)) continue;
    const tokens = t.term.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const seen = new Set<string>();
    tokens.forEach((tok, i) => {
      if (tok.length >= 3 && !STOPWORDS.has(tok)) seen.add(tok);
      const next = tokens[i + 1];
      if (next && !(STOPWORDS.has(tok) && STOPWORDS.has(next))) seen.add(`${tok} ${next}`);
    });
    for (const g of seen) {
      if (isBrand(g) || input.brandTerms.some((b) => containsWord(b, g))) continue;
      let s = grams.get(g);
      if (!s) {
        s = { terms: new Set(), campaigns: new Set(), cost: 0, clicks: 0, impressions: 0, conversions: 0 };
        grams.set(g, s);
      }
      s.terms.add(t.term.toLowerCase());
      s.campaigns.add(t.campaignId);
      s.cost += t.cost;
      s.clicks += t.clicks;
      s.impressions += t.impressions;
      s.conversions += t.conversions;
    }
  }
  const taken = new Set(out.map((c) => `${c.negativeText}|${c.suggestedLevel}`));
  const ngramHits = [...grams.entries()]
    .filter(([, s]) => s.terms.size >= NEGATIVE_RULES.ngramMinTerms && s.cost >= costThreshold && s.conversions <= 0)
    // most spend first; on ties the shorter (broader) fragment wins, so "pdf" beats "marathon pdf"
    .sort((a, b) => b[1].cost - a[1].cost || a[0].split(" ").length - b[0].split(" ").length || a[0].localeCompare(b[0]));
  const kept: string[] = [];
  for (const [g, s] of ngramHits) {
    // "jobs" already covers "running shoes jobs"; skip a bigram when one of its words is already kept
    if (kept.some((k) => containsWord(g, k) || containsWord(k, g))) continue;
    const single = s.campaigns.size === 1 ? [...s.campaigns][0] ?? "" : "";
    const level = single ? "campaign" : "account_list";
    if (taken.has(`${g}|${level}`) || taken.has(`${g}|account_list`)) continue;
    kept.push(g);
    out.push({
      id: `n:${g}`,
      kind: "ngram",
      term: g,
      negativeText: g,
      campaignId: single,
      campaignName: single ? (input.campaigns.get(single)?.name ?? single) : "All campaigns",
      adGroupId: "",
      cost: r2(s.cost),
      clicks: Math.round(s.clicks),
      impressions: Math.round(s.impressions),
      conversions: 0,
      reasons: [`Appears in ${s.terms.size} search terms with ${money(s.cost)} spend and no conversions`],
      rules: ["ngram"],
      suggestedMatch: "Phrase",
      suggestedLevel: level,
      monthlySavings: r2((s.cost * 30) / days),
    });
  }

  out.sort((a, b) => b.monthlySavings - a.monthlySavings || a.term.localeCompare(b.term) || a.campaignId.localeCompare(b.campaignId));
  return { candidates: out.slice(0, NEGATIVE_RULES.maxCandidates), thresholds };
}

/** Rule-based verdicts (demo engine and fallback for anything the AI did not classify). */
export function demoNegativeVerdict(c: NegativeCandidate): { verdict: "negative" | "review"; reason: string } {
  const rules = c.rules ?? [];
  if (rules.includes("modifier") && c.conversions <= 0) return { verdict: "negative", reason: "Irrelevant intent and no conversions." };
  if (rules.includes("ngram")) return { verdict: "negative", reason: "Recurring fragment across non-converting searches." };
  if (rules.includes("high_cost_no_conv") || rules.includes("clicks_no_conv")) return { verdict: "negative", reason: "Meaningful spend with zero conversions." };
  if (rules.includes("modifier")) return { verdict: "review", reason: "Irrelevant-looking modifier, but the term has converted — check before excluding." };
  if (rules.includes("competitor")) return { verdict: "review", reason: "Competitor query in a non-competitor campaign — decide whether to conquest or exclude." };
  return { verdict: "review", reason: "Low engagement; review relevance before excluding." };
}

export function withDemoVerdicts(candidates: readonly NegativeCandidate[]): NegativeCandidate[] {
  return candidates.map((c) => {
    const v = demoNegativeVerdict(c);
    return { ...c, verdict: v.verdict, aiReason: v.reason };
  });
}

/** Merge model verdicts by term; unknown terms are ignored, unclassified candidates keep the rule verdict. */
export function applyVerdicts(candidates: readonly NegativeCandidate[], verdicts: NegativeVerdicts["verdicts"]): { candidates: NegativeCandidate[]; unknown: number; unclassified: number } {
  const byTerm = new Map<string, NegativeVerdicts["verdicts"][number]>();
  const known = new Set(candidates.map((c) => c.term.toLowerCase()));
  let unknown = 0;
  for (const v of verdicts) {
    const key = v.term.trim().toLowerCase();
    if (!known.has(key)) {
      unknown++;
      continue;
    }
    if (!byTerm.has(key)) byTerm.set(key, v);
  }
  let unclassified = 0;
  const out = candidates.map((c) => {
    const v = byTerm.get(c.term.toLowerCase());
    if (!v) {
      unclassified++;
      const d = demoNegativeVerdict(c);
      return { ...c, verdict: d.verdict, aiReason: `${d.reason} (rule-based)` };
    }
    const reason = v.reason.replace(/\s+/g, " ").trim().slice(0, 240);
    return { ...c, verdict: v.verdict, suggestedMatch: v.matchType, suggestedLevel: v.level, aiReason: reason };
  });
  return { candidates: out, unknown, unclassified };
}
