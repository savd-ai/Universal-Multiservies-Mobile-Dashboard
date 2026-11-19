import "server-only";
import { adCopySchema, type AdCopy, type AdCopyRequest, type AdCopyResult, type AdTextLine } from "@/lib/domain/contracts/ai";
import type { LintOptions } from "@/lib/domain/ai/ads-text";
import { demoAdCopy, shortCampaignName } from "@/lib/domain/ai/demo-engine";
import { sanitizeText } from "@/lib/domain/ai/prompt-safety";
import { adCopyPrompt } from "@/lib/domain/ai/prompts";
import { adCopyLines, checkLines, failingLines, meetsRsaMinimum, rebuildAdCopy } from "@/lib/domain/ai/validators";
import type { RequestContext } from "../../context";
import { AcceptanceError, runStructured, shortenLines, systemBlocks } from "../run";
import { buildSnapshot, type AccountSnapshot } from "../snapshot";
import type { AiProvider } from "../types";

// RSA ad copy with Google Ads validation per line: lengths (wide characters count double, {KeyWord:…} counts its
// default), policy lint, one "shorten" repair round, then failing lines are dropped. Below 3 headlines or 2
// descriptions the demo template answers instead.

function campaignContext(snap: AccountSnapshot, campaignId: string | undefined): string | null {
  if (!campaignId) return null;
  const c = snap.campaigns.find((x) => x.id === campaignId);
  if (!c) return null;
  const terms = snap.searchTerms.filter((t) => t.campaignId === c.id).slice(0, 8);
  return [
    `campaign: ${sanitizeText(c.name)} (${c.type}, ${c.status})`,
    `last_30d: spend ${c.cost.toFixed(2)} | conv ${c.conversions.toFixed(1)} | cpa ${c.cpa === null ? "—" : c.cpa.toFixed(2)} | roas ${c.roas === null ? "—" : c.roas.toFixed(2)}`,
    `top_search_terms: ${terms.map((t) => sanitizeText(t.term, 80)).join(" | ") || "none"}`,
  ].join("\n");
}

interface CheckedCopy {
  copy: AdCopy;
  checks: Record<string, AdTextLine>;
  warnings: string[];
}

async function validateCopy(raw: AdCopy, lint: LintOptions, provider: AiProvider | null, signal?: AbortSignal): Promise<CheckedCopy> {
  const warnings: string[] = [];
  let copy = rebuildAdCopy(raw, new Map());
  let failing = failingLines(adCopyLines(copy), checkLines(adCopyLines(copy), lint));
  if (failing.length && provider) {
    const fixes = await shortenLines(provider, failing, signal);
    if (fixes.size) {
      copy = rebuildAdCopy(copy, fixes);
      failing = failingLines(adCopyLines(copy), checkLines(adCopyLines(copy), lint));
    }
  }
  if (failing.length) {
    copy = rebuildAdCopy(copy, new Map(), new Set(failing.map((f) => f.id)));
    warnings.push(`Removed ${failing.length} line${failing.length === 1 ? "" : "s"} that broke Google Ads limits or policy.`);
  }
  return { copy, checks: checkLines(adCopyLines(copy), lint), warnings };
}

function toResult(v: CheckedCopy): Omit<AdCopyResult, "source" | "model" | "fallbackReason" | "warnings" | "cached"> {
  const line = (id: string): AdTextLine => v.checks[id] ?? { text: "", length: 0, limit: 0, ok: false, issues: ["Missing"] };
  return {
    headlines: v.copy.headlines.map((h, i) => ({ ...line(`h${i}`), pin: h.pin, angle: h.angle })),
    descriptions: v.copy.descriptions.map((d, i) => ({ ...line(`d${i}`), pin: d.pin })),
    path1: v.copy.path1 === null ? null : line("p1"),
    path2: v.copy.path2 === null ? null : line("p2"),
  };
}

export async function generateAdCopy(ctx: RequestContext, req: AdCopyRequest, signal?: AbortSignal): Promise<AdCopyResult> {
  const snap = await buildSnapshot(ctx);
  const brand = snap.settings.brandTerms[0] ?? null;
  const lint: LintOptions = { allowCaps: snap.settings.brandTerms };
  const campaign = campaignContext(snap, req.campaignId);
  const templateReq: AdCopyRequest = !req.product && !req.keywords.length && req.campaignId ? { ...req, product: shortCampaignName(snap.campaigns.find((c) => c.id === req.campaignId)?.name ?? "") } : req;

  const outcome = await runStructured({
    feature: "ad-copy",
    schema: adCopySchema,
    schemaName: "rsa_ad_copy",
    system: systemBlocks(snap),
    prompt: adCopyPrompt(req, campaign),
    cache: { input: req, snapshotHash: snap.hash },
    signal,
    accept: async (copy, { provider }) => {
      const v = await validateCopy(copy, lint, provider, signal);
      if (!meetsRsaMinimum(v.copy)) throw new AcceptanceError("Too few AI lines passed Google Ads validation; showing the template copy.");
      return { value: v, warnings: v.warnings };
    },
    demo: async () => {
      const v = await validateCopy(demoAdCopy(templateReq, { brand }), lint, null);
      return { value: v, warnings: v.warnings };
    },
  });
  return {
    ...toResult(outcome.value),
    source: outcome.source,
    model: outcome.model,
    ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
    warnings: outcome.warnings,
    ...(outcome.cached ? { cached: true } : {}),
  };
}
