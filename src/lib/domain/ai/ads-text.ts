// Google Ads text rules: display length (East-Asian wide characters count double; only the default text of a
// {KeyWord:default} insertion counts), per-asset limits and an editorial policy lint. Pure.

export const AD_TEXT_LIMITS = {
  headline: 30,
  description: 90,
  path: 15,
  sitelinkText: 25,
  sitelinkLine: 35,
  callout: 25,
  keyword: 80,
} as const;
export type AdTextKind = keyof typeof AD_TEXT_LIMITS;

export const KEYWORD_MAX_WORDS = 10;

/** Responsive search ad asset counts. */
export const RSA_COUNTS = { headlines: { min: 3, max: 15 }, descriptions: { min: 2, max: 4 } } as const;

export interface AdTextCheck {
  text: string;
  length: number;
  limit: number;
  ok: boolean;
  issues: string[];
}

// {KeyWord:Running shoes}, {LOCATION(City):Your area}, {CUSTOMIZER.price:$99} → only the default text is shown
// when the insertion cannot be filled, so that is what Google measures.
const INSERTION_RE = /\{\s*(?:keyword|location\([a-z]+\)|customizer\.[\w-]+)\s*:([^{}]*)\}/gi;

/** Text as Google measures it: dynamic insertions replaced by their default text. */
export function insertionDefaults(text: string): string {
  return text.replace(INSERTION_RE, (_m, def: string) => def);
}

/** East Asian Wide / Fullwidth code points (CJK, Hangul, fullwidth forms, emoji) take two display cells. */
export function isWideCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xa960 && cp <= 0xa97f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x2fffd) ||
    (cp >= 0x30000 && cp <= 0x3fffd)
  );
}

/** Google Ads display length: wide characters count as 2, insertions count their default text only. */
export function adsTextLength(text: string): number {
  let n = 0;
  for (const ch of insertionDefaults(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    n += isWideCodePoint(cp) ? 2 : 1;
  }
  return n;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const REPEATED_PUNCT_RE = /([!?.,;:*~#@&$%^_=+|\\/-])\1+/;
const WORD_RE = /\p{L}+/gu;

export interface LintOptions {
  /** words allowed in capitals, e.g. brand acronyms ("ASICS") */
  allowCaps?: readonly string[];
}

/** Editorial basics that get ads disapproved: exclamation marks in headlines, emoji, gimmicky caps, "!!". */
export function lintAdText(text: string, kind: AdTextKind, opts: LintOptions = {}): string[] {
  const issues: string[] = [];
  const shown = insertionDefaults(text);
  if (kind === "headline" && shown.includes("!")) issues.push("Headlines can't contain exclamation marks");
  if (EMOJI_RE.test(shown)) issues.push("Emoji aren't allowed");
  const allow = new Set((opts.allowCaps ?? []).map((w) => w.toUpperCase()));
  const shouting = (shown.match(WORD_RE) ?? []).filter((w) => w.length > 3 && w === w.toUpperCase() && w !== w.toLowerCase() && !allow.has(w));
  if (shouting.length) issues.push(`Avoid ALL CAPS words (${[...new Set(shouting)].slice(0, 3).join(", ")})`);
  if (REPEATED_PUNCT_RE.test(shown)) issues.push("Repeated punctuation or symbols");
  if (/^\s|\s$/.test(text)) issues.push("Leading or trailing spaces");
  return issues;
}

/** Length + lint for one asset line. */
export function checkAdText(text: string, kind: AdTextKind, opts: LintOptions = {}): AdTextCheck {
  const limit = AD_TEXT_LIMITS[kind];
  const length = adsTextLength(text);
  const issues: string[] = [];
  if (!text.trim()) issues.push("Empty");
  if (length > limit) issues.push(`Too long (${length}/${limit})`);
  if (kind === "keyword") {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words > KEYWORD_MAX_WORDS) issues.push(`Too many words (${words}/${KEYWORD_MAX_WORDS})`);
  } else {
    issues.push(...lintAdText(text, kind, opts));
  }
  return { text, length, limit, ok: issues.length === 0, issues };
}

/** Trim to a display length on a word boundary (used by the deterministic templates, never on AI output). */
export function fitAdText(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (adsTextLength(clean) <= limit) return clean;
  const words = clean.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (adsTextLength(next) > limit) break;
    out = next;
  }
  if (out) return out.replace(/[\s,;:–—-]+$/, "");
  // a single over-long word: cut by code points
  let cut = "";
  for (const ch of clean) {
    if (adsTextLength(cut + ch) > limit) break;
    cut += ch;
  }
  return cut;
}
