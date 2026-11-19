import type { Tone } from "@/components/ui/status";
import { containsWord } from "@/lib/domain/ai/negatives";
import type { SimulateRequest } from "@/lib/domain/contracts/actions";
import type { NegativeCandidate, NegativeRuleId } from "@/lib/domain/contracts/ai";

// Pure model of the negative keywords screen: reason/verdict labels and filters, brand protection and the
// `keywords.add_negatives` payload (deduped; cross-campaign n-grams expand to every campaign; ≤ 200 lines).

export type MatchType = "Exact" | "Phrase" | "Broad";
export const NEGATIVE_MATCH_TYPES: readonly MatchType[] = ["Exact", "Phrase", "Broad"];

export const REASON_LABELS: Record<NegativeRuleId, string> = {
  high_cost_no_conv: "Spend, no conversions",
  clicks_no_conv: "Clicks, no conversions",
  modifier: "Irrelevant modifier",
  competitor: "Competitor",
  low_ctr: "Low CTR",
  ngram: "Wasteful n-gram",
};
export const REASON_ORDER: readonly NegativeRuleId[] = ["high_cost_no_conv", "clicks_no_conv", "modifier", "competitor", "low_ctr", "ngram"];

export const VERDICTS = ["negative", "review", "keep"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_META: Record<Verdict, { label: string; tone: Tone }> = {
  negative: { label: "Negative", tone: "accent" },
  review: { label: "Review", tone: "warn" },
  keep: { label: "Keep", tone: "muted" },
};

export const LEVEL_LABELS: Record<NegativeCandidate["suggestedLevel"], string> = { ad_group: "Ad group", campaign: "Campaign", account_list: "Account list" };

export const MAX_NEGATIVES = 200;

export function candidateKey(c: NegativeCandidate): string {
  return c.id ?? `t:${c.campaignId}:${c.adGroupId}:${c.term.toLowerCase()}`;
}

export const rulesOf = (c: NegativeCandidate): NegativeRuleId[] => c.rules ?? [];
export const verdictOf = (c: NegativeCandidate): Verdict => c.verdict ?? "review";
export const negativeTextOf = (c: NegativeCandidate): string => (c.negativeText ?? c.term).replace(/\s+/g, " ").trim().toLowerCase();

export interface CandidateFilter {
  reason: NegativeRuleId | "all";
  verdict: Verdict | "all";
}

export function filterCandidates(list: readonly NegativeCandidate[], f: CandidateFilter): NegativeCandidate[] {
  return list.filter((c) => (f.reason === "all" || rulesOf(c).includes(f.reason)) && (f.verdict === "all" || verdictOf(c) === f.verdict));
}

export function countCandidates(list: readonly NegativeCandidate[]): { reasons: Record<NegativeRuleId, number>; verdicts: Record<Verdict, number> } {
  const reasons = Object.fromEntries(REASON_ORDER.map((r) => [r, 0])) as Record<NegativeRuleId, number>;
  const verdicts: Record<Verdict, number> = { negative: 0, review: 0, keep: 0 };
  for (const c of list) {
    for (const r of rulesOf(c)) reasons[r] = (reasons[r] ?? 0) + 1;
    verdicts[verdictOf(c)]++;
  }
  return { reasons, verdicts };
}

/** The brand term a negative would block (brand traffic must never be excluded), or null. */
export function brandHit(text: string, brandTerms: readonly string[]): string | null {
  return brandTerms.find((b) => b.trim() && containsWord(text, b)) ?? null;
}

/** Google Ads notation of a negative: [exact], "phrase", broad. */
export function notation(text: string, match: MatchType): string {
  return match === "Exact" ? `[${text}]` : match === "Phrase" ? `"${text}"` : text;
}

type NegativeLine = Extract<SimulateRequest, { type: "keywords.add_negatives" }>["negatives"][number];

export interface NegativesPayload {
  negatives: NegativeLine[];
  /** negatives dropped because they contain a brand term */
  skippedBrand: string[];
  /** candidates without a campaign (cross-campaign n-grams) that were applied to every campaign */
  expanded: number;
  /** lines beyond the 200-line limit of one action */
  truncated: number;
}

/**
 * Selected candidates → `keywords.add_negatives` lines. Ad-group suggestions keep their ad group; campaign and
 * account-list suggestions apply at campaign level (account lists aren't simulated); a candidate without a campaign
 * is added to each campaign in `campaignIds`. Brand-containing negatives are refused.
 */
export function buildNegativesPayload(selected: readonly NegativeCandidate[], opts: { match: Readonly<Record<string, MatchType>>; campaignIds: readonly string[]; brandTerms: readonly string[] }): NegativesPayload {
  const out: NegativeLine[] = [];
  const seen = new Set<string>();
  const skippedBrand: string[] = [];
  let expanded = 0;
  let truncated = 0;
  for (const c of selected) {
    const text = negativeTextOf(c).slice(0, 80);
    if (!text) continue;
    if (brandHit(text, opts.brandTerms)) {
      if (!skippedBrand.includes(text)) skippedBrand.push(text);
      continue;
    }
    const matchType = opts.match[candidateKey(c)] ?? c.suggestedMatch;
    const adGroupId = c.suggestedLevel === "ad_group" && c.adGroupId ? c.adGroupId : undefined;
    const targets = c.campaignId ? [c.campaignId] : [...opts.campaignIds];
    if (!c.campaignId && targets.length) expanded++;
    for (const campaignId of targets) {
      const k = `${text}|${matchType}|${campaignId}|${adGroupId ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (out.length >= MAX_NEGATIVES) {
        truncated++;
        continue;
      }
      out.push({ text, matchType, campaignId, ...(adGroupId ? { adGroupId } : {}) });
    }
  }
  return { negatives: out, skippedBrand, expanded, truncated };
}

/** Savings of the selection; n-grams overlap the terms they cover, so this is an upper bound. */
export function selectedSavings(list: readonly NegativeCandidate[], selected: ReadonlySet<string>): number {
  return list.reduce((s, c) => (selected.has(candidateKey(c)) ? s + c.monthlySavings : s), 0);
}
