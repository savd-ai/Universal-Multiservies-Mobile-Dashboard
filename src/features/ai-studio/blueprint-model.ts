import { checkAdText, RSA_COUNTS, type AdTextCheck, type LintOptions } from "@/lib/domain/ai/ads-text";
import { BLUEPRINT_LIMITS, blueprintLines, checkLines } from "@/lib/domain/ai/validators";
import type { Blueprint, BlueprintRequest, CampaignIdea } from "@/lib/domain/contracts/ai";
import { IDEA_TYPES } from "@/lib/domain/contracts/ai";

// Pure model of the blueprint wizard: step-1 idea drafts → request, the server's line checks (same validator the
// API runs: wide chars count 2, {KeyWord:…} counts its default), section regeneration merges, immutable edits and
// the review checklist of blocking issues.

export type MatchType = "Exact" | "Phrase" | "Broad";
export const MATCH_TYPES: readonly MatchType[] = ["Exact", "Phrase", "Broad"];
export type IdeaType = (typeof IDEA_TYPES)[number];
export const IDEA_TYPE_OPTIONS: readonly IdeaType[] = IDEA_TYPES;
export type AdGroup = Blueprint["adGroups"][number];
export type Keyword = AdGroup["keywords"][number];
export type Step = 1 | 2 | 3 | 4;

export const STEPS: { n: Step; title: string }[] = [
  { n: 1, title: "Idea" },
  { n: 2, title: "Structure" },
  { n: 3, title: "Ads" },
  { n: 4, title: "Review" },
];

export const BIDDING_LABELS: Record<Blueprint["bidding"]["strategy"], string> = {
  MAXIMIZE_CONVERSIONS: "Maximize conversions",
  TARGET_CPA: "Target CPA",
  MAXIMIZE_CONVERSION_VALUE: "Maximize conversion value",
  TARGET_ROAS: "Target ROAS",
  MAXIMIZE_CLICKS: "Maximize clicks",
  MANUAL_CPC: "Manual CPC",
};

export const DAYS_PER_MONTH = 30.4;

// ── Step 1: idea ─────────────────────────────────────────────────────────────────────────────────────

export interface IdeaDraft {
  title: string;
  type: IdeaType;
  audience: string;
  keywords: string[];
  rationale: string;
  dailyBudget: number;
  impact: string;
  confidence: number;
  citedCampaignIds: string[];
}

export function ideaDraftFrom(i: CampaignIdea): IdeaDraft {
  return { title: i.title, type: i.type, audience: i.audience, keywords: [...i.keywords], rationale: i.rationale, dailyBudget: i.dailyBudget, impact: i.impact, confidence: i.confidence, citedCampaignIds: [...i.citedCampaignIds] };
}

export function blankIdea(): IdeaDraft {
  return { title: "", type: "Search", audience: "", keywords: [], rationale: "", dailyBudget: 50, impact: "", confidence: 60, citedCampaignIds: [] };
}

export function sameIdea(a: IdeaDraft, b: IdeaDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "a, b ,, c" → ["a", "b", "c"] (trimmed, deduped case-insensitively, capped). */
export function splitList(text: string, max = 20, maxLen = 80): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n;]/)) {
    const v = raw.replace(/\s+/g, " ").trim().slice(0, maxLen);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function ideaIssues(d: IdeaDraft): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("Give the idea a title.");
  if (!(d.dailyBudget > 0)) out.push("Set a daily budget above zero.");
  if (d.type === "Search" && !d.keywords.length) out.push("Add at least one keyword theme for a Search campaign.");
  return out;
}

/** The stored idea is referenced by id when unchanged; an edited or blank idea is sent inline (API limits applied). */
export function blueprintRequestFor(opts: { setId?: string | null; ideaId?: string | null; original?: IdeaDraft | null; draft: IdeaDraft; finalUrl?: string }): BlueprintRequest {
  const finalUrl = opts.finalUrl?.trim() ? opts.finalUrl.trim().slice(0, 300) : undefined;
  if (opts.setId && opts.ideaId && opts.original && sameIdea(opts.original, opts.draft)) return { ideaSetId: opts.setId, ideaId: opts.ideaId, ...(finalUrl ? { finalUrl } : {}) };
  const d = opts.draft;
  return {
    idea: {
      title: d.title.trim().slice(0, 120) || "New campaign",
      type: d.type,
      audience: d.audience.trim().slice(0, 200),
      keywords: d.keywords.map((k) => k.slice(0, 80)).slice(0, 10),
      rationale: d.rationale.trim().slice(0, 500),
      dailyBudget: Math.min(1_000_000, Math.max(0, Number.isFinite(d.dailyBudget) ? d.dailyBudget : 0)),
      impact: d.impact.trim().slice(0, 80),
      confidence: Math.min(100, Math.max(0, Math.round(d.confidence))),
      citedCampaignIds: d.citedCampaignIds.slice(0, 20),
    },
    ...(finalUrl ? { finalUrl } : {}),
  };
}

// ── Checks ───────────────────────────────────────────────────────────────────────────────────────────

/** Per-line checks keyed like the API (`ag0.h3`, `ag1.d0`, `ag0.p1`, `sl2.t`, `sl2.l1`, `co4`). */
export function blueprintChecks(bp: Blueprint, lint: LintOptions = {}): Record<string, AdTextCheck> {
  return checkLines(blueprintLines(bp), lint);
}

export function keywordIssues(text: string): string[] {
  return checkAdText(text, "keyword").issues;
}

export function isEdited(bp: Blueprint | undefined, generated: Blueprint | undefined): boolean {
  return !!bp && !!generated && JSON.stringify(bp) !== JSON.stringify(generated);
}

// ── Section regeneration ─────────────────────────────────────────────────────────────────────────────

export type Section = "structure" | "ads" | "review";

/**
 * Replace one wizard section with a fresh generation, keeping every other edit. Structure = ad groups (name, theme,
 * keywords, negatives) + campaign negatives; ads = each group's RSA + sitelinks + callouts; review = bidding,
 * budget, targeting and the launch checklist.
 */
export function mergeSection(cur: Blueprint, fresh: Blueprint, section: Section): Blueprint {
  switch (section) {
    case "structure":
      return { ...cur, adGroups: fresh.adGroups.map((g, i) => ({ ...g, rsa: cur.adGroups[i]?.rsa ?? g.rsa })), campaignNegatives: fresh.campaignNegatives };
    case "ads":
      return { ...cur, adGroups: cur.adGroups.map((g, i) => ({ ...g, rsa: fresh.adGroups[i]?.rsa ?? g.rsa })), sitelinks: fresh.sitelinks, callouts: fresh.callouts };
    case "review":
      return { ...cur, bidding: fresh.bidding, dailyBudget: fresh.dailyBudget, targeting: fresh.targeting, launchChecklist: fresh.launchChecklist };
  }
}

// ── Immutable edits ──────────────────────────────────────────────────────────────────────────────────

export const replaceAt = <T>(list: readonly T[], i: number, v: T): T[] => list.map((x, j) => (j === i ? v : x));
export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, j) => j !== i);

export function updateGroup(bp: Blueprint, gi: number, fn: (g: AdGroup) => AdGroup): Blueprint {
  const g = bp.adGroups[gi];
  return g ? { ...bp, adGroups: replaceAt(bp.adGroups, gi, fn(g)) } : bp;
}

export function newAdGroup(n: number): AdGroup {
  return { name: `Ad group ${n}`, theme: "", keywords: [], negatives: [], rsa: { headlines: ["", "", ""], descriptions: ["", ""], path1: null, path2: null } };
}

export function addAdGroup(bp: Blueprint): Blueprint {
  if (bp.adGroups.length >= BLUEPRINT_LIMITS.adGroups) return bp;
  return { ...bp, adGroups: [...bp.adGroups, newAdGroup(bp.adGroups.length + 1)] };
}

export function removeAdGroup(bp: Blueprint, gi: number): Blueprint {
  return bp.adGroups.length <= 1 ? bp : { ...bp, adGroups: removeAt(bp.adGroups, gi) };
}

export const LIMITS = {
  headlines: RSA_COUNTS.headlines,
  descriptions: RSA_COUNTS.descriptions,
  sitelinks: BLUEPRINT_LIMITS.sitelinks,
  callouts: BLUEPRINT_LIMITS.callouts,
  keywords: BLUEPRINT_LIMITS.keywordsPerAdGroup,
  negatives: BLUEPRINT_LIMITS.negatives,
  adGroups: BLUEPRINT_LIMITS.adGroups,
} as const;

export type RsaList = "headlines" | "descriptions";

export function canAddLine(bp: Blueprint, gi: number, list: RsaList): boolean {
  return (bp.adGroups[gi]?.rsa[list].length ?? Infinity) < LIMITS[list].max;
}

export function canRemoveLine(bp: Blueprint, gi: number, list: RsaList): boolean {
  return (bp.adGroups[gi]?.rsa[list].length ?? 0) > LIMITS[list].min;
}

export function editRsaLine(bp: Blueprint, gi: number, list: RsaList, i: number, text: string): Blueprint {
  return updateGroup(bp, gi, (g) => ({ ...g, rsa: { ...g.rsa, [list]: replaceAt(g.rsa[list], i, text) } }));
}

export function addRsaLine(bp: Blueprint, gi: number, list: RsaList): Blueprint {
  return canAddLine(bp, gi, list) ? updateGroup(bp, gi, (g) => ({ ...g, rsa: { ...g.rsa, [list]: [...g.rsa[list], ""] } })) : bp;
}

export function removeRsaLine(bp: Blueprint, gi: number, list: RsaList, i: number): Blueprint {
  return canRemoveLine(bp, gi, list) ? updateGroup(bp, gi, (g) => ({ ...g, rsa: { ...g.rsa, [list]: removeAt(g.rsa[list], i) } })) : bp;
}

export function setPath(bp: Blueprint, gi: number, which: "path1" | "path2", text: string): Blueprint {
  return updateGroup(bp, gi, (g) => ({ ...g, rsa: { ...g.rsa, [which]: text === "" ? null : text } }));
}

// ── Review ───────────────────────────────────────────────────────────────────────────────────────────

export interface BlueprintIssue {
  step: 2 | 3 | 4;
  text: string;
}

/** Human label for a check id: `ag0.h2` → "Brand terms · Headline 3", `sl1.t` → "Sitelink 2 text", `co0` → "Callout 1". */
export function lineLabel(id: string, bp: Blueprint): string {
  const ag = /^ag(\d+)\.([hdp])(\d+)$/.exec(id);
  if (ag) {
    const group = bp.adGroups[Number(ag[1])]?.name || `Ad group ${Number(ag[1]) + 1}`;
    const kind = ag[2] === "h" ? "Headline" : ag[2] === "d" ? "Description" : "Path";
    return `${group} · ${kind} ${ag[2] === "p" ? ag[3] : Number(ag[3]) + 1}`;
  }
  const sl = /^sl(\d+)\.(t|l1|l2)$/.exec(id);
  if (sl) return `Sitelink ${Number(sl[1]) + 1} ${sl[2] === "t" ? "text" : sl[2] === "l1" ? "line 1" : "line 2"}`;
  const co = /^co(\d+)$/.exec(id);
  if (co) return `Callout ${Number(co[1]) + 1}`;
  return id;
}

export function blueprintIssues(bp: Blueprint, checks: Record<string, AdTextCheck>): BlueprintIssue[] {
  const out: BlueprintIssue[] = [];
  const search = bp.type === "Search";
  if (!bp.campaignName.trim()) out.push({ step: 2, text: "The campaign needs a name." });
  bp.adGroups.forEach((g, i) => {
    const name = g.name.trim() || `Ad group ${i + 1}`;
    if (!g.name.trim()) out.push({ step: 2, text: `Ad group ${i + 1} needs a name.` });
    if (search && !g.keywords.some((k) => k.text.trim())) out.push({ step: 2, text: `“${name}” has no keywords.` });
    const badKw = [...g.keywords, ...g.negatives].filter((k) => k.text.trim() && keywordIssues(k.text).length).length;
    if (badKw) out.push({ step: 2, text: `“${name}”: ${badKw} keyword${badKw === 1 ? "" : "s"} over 80 characters or 10 words.` });
    const h = g.rsa.headlines.filter((t) => t.trim()).length;
    const d = g.rsa.descriptions.filter((t) => t.trim()).length;
    if (h < LIMITS.headlines.min) out.push({ step: 3, text: `“${name}” needs at least ${LIMITS.headlines.min} headlines (has ${h}).` });
    if (d < LIMITS.descriptions.min) out.push({ step: 3, text: `“${name}” needs at least ${LIMITS.descriptions.min} descriptions (has ${d}).` });
  });
  for (const [id, c] of Object.entries(checks)) if (!c.ok) out.push({ step: 3, text: `${lineLabel(id, bp)}: ${c.issues[0] ?? "invalid"}` });
  if (!(bp.dailyBudget > 0)) out.push({ step: 4, text: "Set a daily budget above zero." });
  if (bp.bidding.strategy === "TARGET_CPA" && !(Number(bp.bidding.targetCpa) > 0)) out.push({ step: 4, text: "Target CPA needs a value." });
  if (bp.bidding.strategy === "TARGET_ROAS" && !(Number(bp.bidding.targetRoas) > 0)) out.push({ step: 4, text: "Target ROAS needs a value." });
  if (!bp.targeting.locations.length) out.push({ step: 4, text: "Add at least one location." });
  return out;
}

export function blueprintStats(bp: Blueprint): { groups: number; keywords: number; negatives: number; headlines: number; descriptions: number } {
  return {
    groups: bp.adGroups.length,
    keywords: bp.adGroups.reduce((s, g) => s + g.keywords.length, 0),
    negatives: bp.adGroups.reduce((s, g) => s + g.negatives.length, 0) + bp.campaignNegatives.length,
    headlines: bp.adGroups.reduce((s, g) => s + g.rsa.headlines.length, 0),
    descriptions: bp.adGroups.reduce((s, g) => s + g.rsa.descriptions.length, 0),
  };
}

export function csvFilename(campaignName: string): string {
  const slug = campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "blueprint"}-editor.csv`;
}

/** Google Ads Editor keyword notation: [exact], "phrase", broad. */
export function matchNotation(k: Keyword): string {
  return k.matchType === "Exact" ? `[${k.text}]` : k.matchType === "Phrase" ? `"${k.text}"` : k.text;
}
