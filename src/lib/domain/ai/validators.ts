import { MONTHLY_CAP_FACTOR } from "../contracts/budget";
import type { AdCopy, Blueprint, CampaignIdea } from "../contracts/ai";
import { AD_TEXT_LIMITS, checkAdText, RSA_COUNTS, type AdTextCheck, type AdTextKind, type LintOptions } from "./ads-text";

// Server-side enforcement of every limit the portable wire schemas cannot express. Validators REPAIR what they can
// (trim, dedupe, clamp, scale, top up) and report the rest so the service can run one repair round or fall back.

// ── Campaign ideas ─────────────────────────────────────────────────────────────────────────────────────

export const IDEA_COUNT = 6;
export const IDEA_TITLE_MAX_WORDS = 6;
export const CONFIDENCE_MIN = 40;
export const CONFIDENCE_MAX = 95;
export const IDEA_KEYWORDS = 3;

export type RepairedIdea = CampaignIdea & { topUp?: boolean };

export interface IdeaRepairContext {
  testBudget: number;
  knownCampaignIds: ReadonlySet<string>;
  /** demo ideas (goal order) used to top the list up to six */
  topUps: readonly CampaignIdea[];
}

const oneLine = (s: unknown, max: number): string => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return [...t].length > max ? `${[...t].slice(0, max - 1).join("")}…` : t;
};

export function clampConfidence(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 60;
  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, n));
}

export function truncateWords(title: string, maxWords: number): string {
  const words = title.replace(/^["'“”]+|["'“”.!,;:]+$/g, "").split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ").replace(/[,;:–—-]+$/, "");
}

export function dedupeStrings(values: readonly string[], max = Infinity, maxLen = 80): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = oneLine(v, maxLen);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Round to $5 with a $10 floor. */
const roundBudget = (v: number): number => Math.max(10, Math.round(v / 5) * 5);

/**
 * Keep Σ daily × 30.4 within 110% of the monthly test budget: scale proportionally to the budget, round to $5
 * (min $10), then trim the largest lines if rounding pushed the total back over the cap.
 */
export function fitDailyBudgets(dailies: readonly number[], testBudget: number): { dailies: number[]; scaled: boolean; overCap: boolean } {
  const clean = dailies.map((d) => (Number.isFinite(d) && d > 0 ? d : 0));
  const total = clean.reduce((s, v) => s + v, 0);
  const cap = 1.1 * testBudget;
  if (testBudget <= 0 || total * MONTHLY_CAP_FACTOR <= cap) return { dailies: clean.map((d) => Math.round(d * 100) / 100), scaled: false, overCap: false };
  const factor = testBudget / MONTHLY_CAP_FACTOR / total;
  const out = clean.map((d) => roundBudget(d * factor));
  const monthly = () => out.reduce((s, v) => s + v, 0) * MONTHLY_CAP_FACTOR;
  while (monthly() > cap) {
    let idx = -1;
    for (let i = 0; i < out.length; i++) if ((out[i] ?? 0) > 10 && (idx < 0 || (out[i] ?? 0) > (out[idx] ?? 0))) idx = i;
    if (idx < 0) break;
    out[idx] = (out[idx] ?? 10) - 5;
  }
  return { dailies: out, scaled: true, overCap: monthly() > cap };
}

/** Enforce the idea contract: exactly six, titles ≤ 6 words, 3 keywords, confidence 40–95, real campaign ids, budget fit. */
export function repairIdeas(raw: readonly CampaignIdea[], ctx: IdeaRepairContext): { ideas: RepairedIdea[]; warnings: string[] } {
  const warnings: string[] = [];
  let droppedIds = 0;
  let badBudgets = 0;
  const seenTitles = new Set<string>();
  const ideas: RepairedIdea[] = [];
  for (const r of raw) {
    const title = truncateWords(oneLine(r.title, 120), IDEA_TITLE_MAX_WORDS);
    const key = title.toLowerCase();
    if (!title || seenTitles.has(key)) continue;
    seenTitles.add(key);
    const cited = dedupeStrings(r.citedCampaignIds ?? [], 10, 64);
    const known = cited.filter((id) => ctx.knownCampaignIds.has(id));
    droppedIds += cited.length - known.length;
    const daily = Number.isFinite(r.dailyBudget) && r.dailyBudget > 0 ? r.dailyBudget : 50;
    if (daily !== r.dailyBudget) badBudgets++;
    ideas.push({
      title,
      type: r.type,
      audience: oneLine(r.audience, 120),
      keywords: dedupeStrings(r.keywords ?? [], IDEA_KEYWORDS),
      rationale: oneLine(r.rationale, 400),
      dailyBudget: daily,
      impact: oneLine(r.impact, 60),
      confidence: clampConfidence(r.confidence),
      citedCampaignIds: known,
    });
    if (ideas.length === IDEA_COUNT) break;
  }
  if (raw.length > IDEA_COUNT) warnings.push(`Kept the first ${IDEA_COUNT} of ${raw.length} ideas.`);
  if (droppedIds) warnings.push(`Dropped ${droppedIds} cited campaign id${droppedIds === 1 ? "" : "s"} that do not exist in this account.`);
  if (badBudgets) warnings.push(`${badBudgets} idea${badBudgets === 1 ? " had" : "s had"} no valid daily budget; defaulted to $50.`);

  let added = 0;
  for (const d of ctx.topUps) {
    if (ideas.length >= IDEA_COUNT) break;
    const key = d.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    ideas.push({ ...d, citedCampaignIds: d.citedCampaignIds.filter((id) => ctx.knownCampaignIds.has(id)), confidence: clampConfidence(d.confidence), topUp: true });
    added++;
  }
  if (added) warnings.push(`Added ${added} demo idea${added === 1 ? "" : "s"} to reach ${IDEA_COUNT}.`);

  const fit = fitDailyBudgets(
    ideas.map((i) => i.dailyBudget),
    ctx.testBudget,
  );
  if (fit.scaled) {
    ideas.forEach((idea, i) => (idea.dailyBudget = fit.dailies[i] ?? idea.dailyBudget));
    warnings.push(`Daily budgets were scaled down to fit the $${Math.round(ctx.testBudget).toLocaleString("en-US")} monthly test budget.`);
  }
  if (fit.overCap) warnings.push("Even at the $10/day minimum these ideas exceed the monthly test budget — test fewer ideas at once.");
  return { ideas, warnings };
}

// ── Ad text lines (RSA, sitelinks, callouts) ───────────────────────────────────────────────────────────

export interface TextLine {
  /** stable id used by repair rounds, e.g. `h3`, `ag1.d0`, `sl2.l1` */
  id: string;
  kind: AdTextKind;
  text: string;
}

export interface FailingLine extends TextLine {
  limit: number;
  issues: string[];
}

export function normalizeLine(text: string, kind: AdTextKind): string {
  const t = text.replace(/\s+/g, " ").trim();
  return kind === "path" ? t.replace(/\s/g, "-").replace(/^\/+|\/+$/g, "") : t;
}

const UNIQUE_KINDS: ReadonlySet<AdTextKind> = new Set(["headline", "description", "sitelinkText", "callout"]);

/** Duplicate scope: RSA assets are unique per ad group (`ag1.h3` → `ag1`), campaign assets per campaign. */
const dupScope = (id: string): string => (/^ag\d+\./.test(id) ? (id.split(".")[0] ?? id) : "campaign");

export function checkLines(lines: readonly TextLine[], opts: LintOptions = {}): Record<string, AdTextCheck> {
  const out: Record<string, AdTextCheck> = {};
  const seen = new Set<string>();
  for (const l of lines) {
    const check = checkAdText(l.text, l.kind, opts);
    // Google rejects duplicate assets inside one group (headlines of an RSA, callouts of a campaign …).
    const dupKey = `${dupScope(l.id)}|${l.kind}|${l.text.toLowerCase()}`;
    if (UNIQUE_KINDS.has(l.kind) && l.text && seen.has(dupKey)) {
      check.issues.push("Duplicate");
      check.ok = false;
    } else seen.add(dupKey);
    out[l.id] = check;
  }
  return out;
}

export function failingLines(lines: readonly TextLine[], checks: Record<string, AdTextCheck>): FailingLine[] {
  return lines.filter((l) => checks[l.id] && !checks[l.id]?.ok).map((l) => ({ ...l, limit: AD_TEXT_LIMITS[l.kind], issues: checks[l.id]?.issues ?? [] }));
}

const validPin = (pin: number | null | undefined, max: number): number | null => (typeof pin === "number" && Number.isInteger(pin) && pin >= 1 && pin <= max ? pin : null);

export function adCopyLines(copy: AdCopy): TextLine[] {
  return [
    ...copy.headlines.map((h, i) => ({ id: `h${i}`, kind: "headline" as const, text: normalizeLine(h.text, "headline") })),
    ...copy.descriptions.map((d, i) => ({ id: `d${i}`, kind: "description" as const, text: normalizeLine(d.text, "description") })),
    ...(copy.path1 !== null ? [{ id: "p1", kind: "path" as const, text: normalizeLine(copy.path1, "path") }] : []),
    ...(copy.path2 !== null ? [{ id: "p2", kind: "path" as const, text: normalizeLine(copy.path2, "path") }] : []),
  ];
}

/** Replace line texts (repair round) and drop the ids in `drop`. Pins are validated on the way. */
export function rebuildAdCopy(copy: AdCopy, texts: ReadonlyMap<string, string>, drop: ReadonlySet<string> = new Set()): AdCopy {
  const text = (id: string, fallback: string, kind: AdTextKind) => normalizeLine(texts.get(id) ?? fallback, kind);
  return {
    headlines: copy.headlines
      .map((h, i) => ({ id: `h${i}`, h }))
      .filter(({ id }) => !drop.has(id))
      .map(({ id, h }) => ({ text: text(id, h.text, "headline"), pin: validPin(h.pin, 3), angle: oneLine(h.angle, 40) }))
      .slice(0, RSA_COUNTS.headlines.max),
    descriptions: copy.descriptions
      .map((d, i) => ({ id: `d${i}`, d }))
      .filter(({ id }) => !drop.has(id))
      .map(({ id, d }) => ({ text: text(id, d.text, "description"), pin: validPin(d.pin, 2) }))
      .slice(0, RSA_COUNTS.descriptions.max),
    path1: copy.path1 === null || drop.has("p1") ? null : text("p1", copy.path1, "path") || null,
    path2: copy.path2 === null || drop.has("p2") ? null : text("p2", copy.path2, "path") || null,
  };
}

export function meetsRsaMinimum(copy: { headlines: readonly unknown[]; descriptions: readonly unknown[] }): boolean {
  return copy.headlines.length >= RSA_COUNTS.headlines.min && copy.descriptions.length >= RSA_COUNTS.descriptions.min;
}

// ── Blueprint ──────────────────────────────────────────────────────────────────────────────────────────

export const BLUEPRINT_LIMITS = { adGroups: 20, keywordsPerAdGroup: 50, negatives: 100, sitelinks: 8, callouts: 10, checklist: 12 } as const;

type Kw = { text: string; matchType: "Exact" | "Phrase" | "Broad" };

function dedupeKeywords(list: readonly Kw[], max: number, dropped: { n: number }): Kw[] {
  const seen = new Set<string>();
  const out: Kw[] = [];
  for (const k of list) {
    const text = k.text.replace(/[[\]"+]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const check = checkAdText(text, "keyword");
    const key = `${text}|${k.matchType}`;
    if (!text || seen.has(key)) continue;
    if (!check.ok) {
      dropped.n++;
      continue;
    }
    seen.add(key);
    out.push({ text, matchType: k.matchType });
    if (out.length >= max) break;
  }
  return out;
}

/** Structural repair: caps, dedupes, keyword limits, bidding consistency. Text lines are checked separately. */
export function normalizeBlueprint(bp: Blueprint, fallbackDaily: number): { blueprint: Blueprint; warnings: string[] } {
  const warnings: string[] = [];
  const dropped = { n: 0 };
  const seenGroups = new Set<string>();
  const adGroups: Blueprint["adGroups"] = [];
  for (const g of bp.adGroups) {
    const name = oneLine(g.name, 120);
    if (!name || seenGroups.has(name.toLowerCase())) continue;
    seenGroups.add(name.toLowerCase());
    const kwTotal = g.keywords.length;
    const keywords = dedupeKeywords(g.keywords, BLUEPRINT_LIMITS.keywordsPerAdGroup, dropped);
    if (kwTotal > BLUEPRINT_LIMITS.keywordsPerAdGroup) warnings.push(`Ad group “${name}” was capped at ${BLUEPRINT_LIMITS.keywordsPerAdGroup} keywords.`);
    adGroups.push({
      name,
      theme: oneLine(g.theme, 160),
      keywords,
      negatives: dedupeKeywords(g.negatives, BLUEPRINT_LIMITS.negatives, dropped),
      rsa: {
        headlines: g.rsa.headlines.map((h) => normalizeLine(h, "headline")),
        descriptions: g.rsa.descriptions.map((d) => normalizeLine(d, "description")),
        path1: g.rsa.path1 === null ? null : normalizeLine(g.rsa.path1, "path") || null,
        path2: g.rsa.path2 === null ? null : normalizeLine(g.rsa.path2, "path") || null,
      },
    });
    if (adGroups.length >= BLUEPRINT_LIMITS.adGroups) break;
  }
  if (bp.adGroups.length > BLUEPRINT_LIMITS.adGroups) warnings.push(`Capped at ${BLUEPRINT_LIMITS.adGroups} ad groups.`);
  if (dropped.n) warnings.push(`Dropped ${dropped.n} keyword${dropped.n === 1 ? "" : "s"} over 80 characters or 10 words.`);

  const bidding = { ...bp.bidding };
  if (bidding.strategy === "TARGET_CPA" && !(typeof bidding.targetCpa === "number" && bidding.targetCpa > 0)) {
    bidding.strategy = "MAXIMIZE_CONVERSIONS";
    warnings.push("Target CPA had no value; switched to Maximize conversions.");
  }
  if (bidding.strategy === "TARGET_ROAS" && !(typeof bidding.targetRoas === "number" && bidding.targetRoas > 0)) {
    bidding.strategy = "MAXIMIZE_CONVERSION_VALUE";
    warnings.push("Target ROAS had no value; switched to Maximize conversion value.");
  }
  if (bidding.strategy !== "TARGET_CPA") bidding.targetCpa = null;
  if (bidding.strategy !== "TARGET_ROAS") bidding.targetRoas = null;

  const daily = Number.isFinite(bp.dailyBudget) && bp.dailyBudget > 0 ? Math.round(bp.dailyBudget * 100) / 100 : fallbackDaily;
  return {
    blueprint: {
      campaignName: oneLine(bp.campaignName, 120) || "New campaign",
      type: bp.type,
      objective: oneLine(bp.objective, 200),
      bidding,
      dailyBudget: daily,
      targeting: {
        locations: dedupeStrings(bp.targeting.locations, 20),
        languages: dedupeStrings(bp.targeting.languages, 10),
        audiences: dedupeStrings(bp.targeting.audiences, 20),
        devices: bp.targeting.devices === null ? null : dedupeStrings(bp.targeting.devices, 5),
        adSchedule: bp.targeting.adSchedule === null ? null : oneLine(bp.targeting.adSchedule, 120),
      },
      adGroups,
      campaignNegatives: dedupeKeywords(bp.campaignNegatives, BLUEPRINT_LIMITS.negatives, dropped),
      sitelinks: bp.sitelinks.slice(0, BLUEPRINT_LIMITS.sitelinks).map((s) => ({
        text: normalizeLine(s.text, "sitelinkText"),
        line1: s.line1 === null ? null : normalizeLine(s.line1, "sitelinkLine") || null,
        line2: s.line2 === null ? null : normalizeLine(s.line2, "sitelinkLine") || null,
      })),
      callouts: bp.callouts.slice(0, BLUEPRINT_LIMITS.callouts).map((c) => normalizeLine(c, "callout")),
      launchChecklist: dedupeStrings(bp.launchChecklist, BLUEPRINT_LIMITS.checklist, 200),
    },
    warnings,
  };
}

export function blueprintLines(bp: Blueprint): TextLine[] {
  const lines: TextLine[] = [];
  bp.adGroups.forEach((g, i) => {
    g.rsa.headlines.forEach((t, j) => lines.push({ id: `ag${i}.h${j}`, kind: "headline", text: t }));
    g.rsa.descriptions.forEach((t, j) => lines.push({ id: `ag${i}.d${j}`, kind: "description", text: t }));
    if (g.rsa.path1 !== null) lines.push({ id: `ag${i}.p1`, kind: "path", text: g.rsa.path1 });
    if (g.rsa.path2 !== null) lines.push({ id: `ag${i}.p2`, kind: "path", text: g.rsa.path2 });
  });
  bp.sitelinks.forEach((s, i) => {
    lines.push({ id: `sl${i}.t`, kind: "sitelinkText", text: s.text });
    if (s.line1 !== null) lines.push({ id: `sl${i}.l1`, kind: "sitelinkLine", text: s.line1 });
    if (s.line2 !== null) lines.push({ id: `sl${i}.l2`, kind: "sitelinkLine", text: s.line2 });
  });
  bp.callouts.forEach((c, i) => lines.push({ id: `co${i}`, kind: "callout", text: c }));
  return lines;
}

/** Apply repaired texts and remove lines that still fail (a failing sitelink title removes the sitelink). */
export function rebuildBlueprint(bp: Blueprint, texts: ReadonlyMap<string, string>, drop: ReadonlySet<string> = new Set()): Blueprint {
  const t = (id: string, fallback: string, kind: AdTextKind) => normalizeLine(texts.get(id) ?? fallback, kind);
  return {
    ...bp,
    adGroups: bp.adGroups.map((g, i) => ({
      ...g,
      rsa: {
        headlines: g.rsa.headlines.flatMap((h, j) => (drop.has(`ag${i}.h${j}`) ? [] : [t(`ag${i}.h${j}`, h, "headline")])).slice(0, RSA_COUNTS.headlines.max),
        descriptions: g.rsa.descriptions.flatMap((d, j) => (drop.has(`ag${i}.d${j}`) ? [] : [t(`ag${i}.d${j}`, d, "description")])).slice(0, RSA_COUNTS.descriptions.max),
        path1: g.rsa.path1 === null || drop.has(`ag${i}.p1`) ? null : t(`ag${i}.p1`, g.rsa.path1, "path") || null,
        path2: g.rsa.path2 === null || drop.has(`ag${i}.p2`) ? null : t(`ag${i}.p2`, g.rsa.path2, "path") || null,
      },
    })),
    sitelinks: bp.sitelinks.flatMap((s, i) =>
      drop.has(`sl${i}.t`)
        ? []
        : [
            {
              text: t(`sl${i}.t`, s.text, "sitelinkText"),
              line1: s.line1 === null || drop.has(`sl${i}.l1`) ? null : t(`sl${i}.l1`, s.line1, "sitelinkLine"),
              line2: s.line2 === null || drop.has(`sl${i}.l2`) ? null : t(`sl${i}.l2`, s.line2, "sitelinkLine"),
            },
          ],
    ),
    callouts: bp.callouts.flatMap((c, i) => (drop.has(`co${i}`) ? [] : [t(`co${i}`, c, "callout")])),
  };
}

/** Ad groups whose RSA has fewer than 3 headlines or 2 descriptions after validation. */
export function rsaBelowMinimum(bp: Blueprint): number[] {
  return bp.adGroups.flatMap((g, i) => (meetsRsaMinimum(g.rsa) ? [] : [i]));
}

// ── Numeric grounding (narrative) ──────────────────────────────────────────────────────────────────────

export interface ExtractedNumber {
  raw: string;
  value: number;
  decimals: number;
  unit: "" | "%" | "$" | "x";
  scaled: boolean;
}

const NUMBER_RE = /([$€£¥₫]?)\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?([kKmM](?![a-zA-Z])|%|x(?![a-zA-Z]))?/g;
/** Quoted names (“Fall drop 15s”, 'Summer hero 30s') are references, not data. A straight single quote only counts at
 *  a word boundary, so possessives and contractions (Google's, competitors') are left alone. */
const QUOTED = /“[^”\n]{1,80}”|‘[^’\n]{1,80}’|"[^"\n]{1,80}"|(?<![\p{L}\p{N}])'[^'\n]{1,80}'(?![\p{L}\p{N}])/gu;

/** Numbers a reader would take as data (dates, years, small unitless counts and quoted names are ignored; `quoted`
 *  keeps the numbers inside quotes, for the source texts the generated text may quote from). */
export function extractNumbers(text: string, opts: { quoted?: boolean } = {}): ExtractedNumber[] {
  const unquoted = opts.quoted ? text : text.replace(QUOTED, " ");
  const cleaned = unquoted.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b(?:19|20)\d{2}\b(?![%x.,\d])/g, " ");
  const out: ExtractedNumber[] = [];
  for (const m of cleaned.matchAll(NUMBER_RE)) {
    const [raw, currency = "", int = "", frac = "", suffix = ""] = m;
    let value = Number(`${int.replace(/,/g, "")}${frac}`);
    if (!Number.isFinite(value)) continue;
    const decimals = frac ? frac.length - 1 : 0;
    let scaled = false;
    if (suffix === "k" || suffix === "K") {
      value *= 1_000;
      scaled = true;
    } else if (suffix === "m" || suffix === "M") {
      value *= 1_000_000;
      scaled = true;
    }
    const unit: ExtractedNumber["unit"] = suffix === "%" ? "%" : suffix === "x" ? "x" : currency ? "$" : "";
    if (unit === "" && !scaled && value <= 12 && decimals === 0) continue;
    out.push({ raw: raw.trim(), value, decimals, unit, scaled });
  }
  return out;
}

function matchesFact(n: ExtractedNumber, facts: readonly number[]): boolean {
  const tol = 0.5 * 10 ** -n.decimals + 1e-9;
  return facts.some((f) => {
    const a = Math.abs(f);
    if (!Number.isFinite(a)) return false;
    if (Math.abs(n.value - a) <= tol) return true;
    const rel = a === 0 ? Infinity : Math.abs(n.value - a) / a;
    return rel <= (n.scaled ? 0.05 : 0.02);
  });
}

export interface GroundingReport {
  numbers: number;
  unmatched: string[];
  /** share of numbers that match no fact */
  ratio: number;
}

/** Every number in generated text must correspond to a server-computed fact (within rounding). Numbers in `sources` —
 *  the facts' own sentences and names the model was given (a recommendation's "14 days", an ad called "Fall drop
 *  15s") — count as facts too. */
export function groundingCheck(texts: readonly string[], facts: readonly number[], sources: readonly string[] = []): GroundingReport {
  const known = [...facts, ...sources.flatMap((t) => extractNumbers(t, { quoted: true }).map((n) => n.value))];
  const nums = texts.flatMap((t) => extractNumbers(t));
  const unmatched = nums.filter((n) => !matchesFact(n, known)).map((n) => n.raw);
  return { numbers: nums.length, unmatched, ratio: nums.length ? unmatched.length / nums.length : 0 };
}

/** Prose that names an internal id ("campaign c8", a 10-digit campaign id) gets the name instead; ids belong only in
 *  the fields that ask for them. Ids inside other tokens (c80, campaign:c8, an ad group's c8-ag1, URLs) are left alone. */
export function nameIds(text: string, names: ReadonlyMap<string, string>): string {
  let out = text;
  for (const [id, name] of names) {
    if (!id || !name || id === name) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // a replacer function: "$" in a campaign name must not act as a replacement pattern
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_:/.-])${escaped}(?![\\p{L}\\p{N}_]|[-:/.][\\p{L}\\p{N}])`, "gu"), () => name);
  }
  return out;
}
