import { RSA_COUNTS, type AdTextCheck, type LintOptions } from "@/lib/domain/ai/ads-text";
import { adCopyLines, checkLines } from "@/lib/domain/ai/validators";
import type { AdCopyRequest, AdCopyResult } from "@/lib/domain/contracts/ai";
import { splitList } from "./blueprint-model";

// Pure model of the ad copy workbench: form → request, generated lines → editable lines (pin, lock), "regenerate
// unlocked" merging, live checks with the API's validator, preview order and the copy-all text.

export const TONES = ["confident", "friendly", "premium", "urgent"] as const;
export type Tone = (typeof TONES)[number];

export interface AdCopyForm {
  product: string;
  audience: string;
  keywords: string;
  usps: string;
  tone: Tone;
  finalUrl: string;
  campaignId: string;
}

export const EMPTY_FORM: AdCopyForm = { product: "", audience: "", keywords: "", usps: "", tone: "confident", finalUrl: "", campaignId: "" };

export function adCopyRequestFrom(f: AdCopyForm): Partial<AdCopyRequest> {
  const finalUrl = f.finalUrl.trim().slice(0, 300);
  return {
    product: f.product.trim().slice(0, 200),
    audience: f.audience.trim().slice(0, 200),
    keywords: splitList(f.keywords, 20, 80),
    usps: splitList(f.usps, 10, 80),
    tone: f.tone,
    ...(finalUrl ? { finalUrl } : {}),
    ...(f.campaignId ? { campaignId: f.campaignId } : {}),
  };
}

export function formIssues(f: AdCopyForm): string[] {
  return f.product.trim() || splitList(f.keywords).length || f.campaignId ? [] : ["Describe the product or offer, add keywords, or pick a campaign."];
}

export interface CopyLine {
  key: string;
  text: string;
  pin: number | null;
  locked: boolean;
  angle?: string;
}

export interface CopyState {
  headlines: CopyLine[];
  descriptions: CopyLine[];
  path1: string;
  path2: string;
  pathsLocked: boolean;
}

export const PIN_POSITIONS = { headlines: [1, 2, 3], descriptions: [1, 2] } as const;

/** Editable lines from an API result; `gen` keeps React keys unique across generations. */
export function copyFromResult(r: Pick<AdCopyResult, "headlines" | "descriptions" | "path1" | "path2">, gen: number): CopyState {
  return {
    headlines: r.headlines.map((h, i) => ({ key: `g${gen}h${i}`, text: h.text, pin: h.pin, locked: false, angle: h.angle })),
    descriptions: r.descriptions.map((d, i) => ({ key: `g${gen}d${i}`, text: d.text, pin: d.pin, locked: false })),
    path1: r.path1?.text ?? "",
    path2: r.path2?.text ?? "",
    pathsLocked: false,
  };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Locked lines keep their slot; every unlocked slot takes the next fresh line that doesn't repeat a kept text. When
 * the fresh set runs out the current line stays. The list keeps its length (and positions).
 */
export function mergeUnlocked(cur: readonly CopyLine[], fresh: readonly CopyLine[]): CopyLine[] {
  const taken = new Set(cur.filter((l) => l.locked).map((l) => norm(l.text)));
  const queue = fresh.filter((f) => f.text.trim());
  let q = 0;
  const next = (): CopyLine | null => {
    while (q < queue.length) {
      const f = queue[q++] as CopyLine;
      if (!taken.has(norm(f.text))) {
        taken.add(norm(f.text));
        return f;
      }
    }
    return null;
  };
  return cur.map((l) => {
    if (l.locked) return l;
    const f = next();
    return f ? { ...f, key: l.key, pin: l.pin, locked: false } : l;
  });
}

export function mergeCopy(cur: CopyState, fresh: CopyState): CopyState {
  return {
    headlines: mergeUnlocked(cur.headlines, fresh.headlines),
    descriptions: mergeUnlocked(cur.descriptions, fresh.descriptions),
    path1: cur.pathsLocked ? cur.path1 : fresh.path1,
    path2: cur.pathsLocked ? cur.path2 : fresh.path2,
    pathsLocked: cur.pathsLocked,
  };
}

/** Checks keyed like the API (`h0`, `d1`, `p1`, `p2`) using the same validator (wide chars count 2). */
export function copyChecks(c: CopyState, lint: LintOptions = {}): Record<string, AdTextCheck> {
  return checkLines(
    adCopyLines({
      headlines: c.headlines.map((h) => ({ text: h.text, pin: h.pin, angle: h.angle ?? "" })),
      descriptions: c.descriptions.map((d) => ({ text: d.text, pin: d.pin })),
      path1: c.path1 ? c.path1 : null,
      path2: c.path2 ? c.path2 : null,
    }),
    lint,
  );
}

/** Lines Google would show first: each position takes its pinned line, the rest fill in order. */
export function previewOrder(lines: readonly CopyLine[], positions: number): string[] {
  const withText = lines.filter((l) => l.text.trim());
  const used = new Set<CopyLine>();
  const out: string[] = [];
  for (let p = 1; p <= positions; p++) {
    const pinned = withText.find((l) => l.pin === p && !used.has(l));
    const pick = pinned ?? withText.find((l) => l.pin === null && !used.has(l));
    if (!pick) continue;
    used.add(pick);
    out.push(pick.text);
  }
  return out;
}

export function pinNotes(c: CopyState): string[] {
  const out: string[] = [];
  const hp = c.headlines.filter((h) => h.pin !== null).length;
  if (hp && hp >= c.headlines.length) out.push("Every headline is pinned — Google can't rotate them.");
  else if (hp) out.push(`${hp} headline${hp === 1 ? "" : "s"} pinned. Pinning lowers ad strength; pin only what must show.`);
  const dp = c.descriptions.filter((d) => d.pin !== null).length;
  if (dp && dp >= c.descriptions.length) out.push("Every description is pinned.");
  if (c.headlines.filter((h) => h.text.trim()).length < RSA_COUNTS.headlines.min) out.push(`A responsive search ad needs at least ${RSA_COUNTS.headlines.min} headlines.`);
  if (c.descriptions.filter((d) => d.text.trim()).length < RSA_COUNTS.descriptions.min) out.push(`A responsive search ad needs at least ${RSA_COUNTS.descriptions.min} descriptions.`);
  return out;
}

/** Plain-text export for "Copy all". */
export function formatCopyText(c: CopyState): string {
  const pin = (l: CopyLine) => (l.pin ? `  [pin ${l.pin}]` : "");
  const lines = [
    "Headlines",
    ...c.headlines.filter((h) => h.text.trim()).map((h, i) => `${i + 1}. ${h.text}${pin(h)}`),
    "",
    "Descriptions",
    ...c.descriptions.filter((d) => d.text.trim()).map((d, i) => `${i + 1}. ${d.text}${pin(d)}`),
  ];
  const path = [c.path1, c.path2].filter((p) => p.trim()).join("/");
  if (path) lines.push("", `Path: /${path}`);
  return lines.join("\n");
}

export function addLine(lines: readonly CopyLine[], max: number, key: string): CopyLine[] {
  return lines.length >= max ? [...lines] : [...lines, { key, text: "", pin: null, locked: false }];
}
