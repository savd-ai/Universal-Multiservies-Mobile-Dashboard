import "server-only";
import { blueprintSchema, type Blueprint, type BlueprintRequest, type BlueprintResult, type CampaignIdea } from "@/lib/domain/contracts/ai";
import type { LintOptions } from "@/lib/domain/ai/ads-text";
import { demoBlueprint } from "@/lib/domain/ai/demo-engine";
import { blueprintToEditorCsv, type EditorCsv } from "@/lib/domain/ai/editor-csv";
import { blueprintPrompt } from "@/lib/domain/ai/prompts";
import { blueprintLines, checkLines, failingLines, normalizeBlueprint, rebuildBlueprint, rsaBelowMinimum } from "@/lib/domain/ai/validators";
import type { RequestContext } from "../../context";
import { AppError, notFound } from "../../http/errors";
import { getStore } from "../../store";
import { AcceptanceError, runStructured, shortenLines, systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";
import type { AiProvider } from "../types";

// Campaign blueprint from an idea: AI structure + copy, validated line by line (one "shorten" repair round, then
// failing lines are dropped; an ad group whose RSA falls below 3 headlines / 2 descriptions gets the template
// RSA). `format=editor` turns the result into a Google Ads Editor CSV with every row Paused.

async function resolveIdea(req: BlueprintRequest): Promise<CampaignIdea> {
  if (req.ideaSetId && req.ideaId) {
    const set = await getStore().ideaSets.get(req.ideaSetId);
    if (!set) throw notFound("Idea set");
    const idea = set.ideas.find((i) => i.id === req.ideaId);
    if (!idea) throw notFound("Idea");
    return { title: idea.title, type: idea.type, audience: idea.audience, keywords: idea.keywords, rationale: idea.rationale, dailyBudget: idea.dailyBudget, impact: idea.impact, confidence: idea.confidence, citedCampaignIds: idea.citedCampaignIds };
  }
  if (req.idea) return { ...req.idea };
  throw new AppError("VALIDATION_ERROR", "Send ideaSetId + ideaId, or an idea object");
}

interface Validated {
  blueprint: Blueprint;
  checks: BlueprintResult["checks"];
  warnings: string[];
}

async function validateBlueprint(bp: Blueprint, idea: CampaignIdea, template: Blueprint, lint: LintOptions, provider: AiProvider | null, signal?: AbortSignal): Promise<Validated> {
  const { blueprint: normalized, warnings } = normalizeBlueprint(bp, idea.dailyBudget);
  if (!normalized.adGroups.length) throw new AcceptanceError("The AI blueprint had no ad groups.");
  let current = normalized;
  let failing = failingLines(blueprintLines(current), checkLines(blueprintLines(current), lint));
  if (failing.length && provider) {
    const fixes = await shortenLines(provider, failing, signal);
    if (fixes.size) {
      current = rebuildBlueprint(current, fixes);
      failing = failingLines(blueprintLines(current), checkLines(blueprintLines(current), lint));
    }
  }
  if (failing.length) {
    current = rebuildBlueprint(current, new Map(), new Set(failing.map((f) => f.id)));
    warnings.push(`Removed ${failing.length} ad line${failing.length === 1 ? "" : "s"} that broke Google Ads limits or policy.`);
  }
  const below = rsaBelowMinimum(current);
  if (below.length && template.adGroups.length) {
    current = { ...current, adGroups: current.adGroups.map((g, i) => (below.includes(i) ? { ...g, rsa: template.adGroups[i % template.adGroups.length]?.rsa ?? g.rsa } : g)) };
    warnings.push(`${below.length} ad group${below.length === 1 ? "" : "s"} used the template ad because too few lines passed validation.`);
  }
  return { blueprint: current, checks: checkLines(blueprintLines(current), lint), warnings };
}

export interface BlueprintResponse extends BlueprintResult {
  editor?: EditorCsv;
}

export async function buildBlueprint(ctx: RequestContext, req: BlueprintRequest, signal?: AbortSignal): Promise<BlueprintResponse> {
  const idea = await resolveIdea(req);
  const snap = await buildSnapshot(ctx);
  const brand = snap.settings.brandTerms[0] ?? ctx.account.name.split(/\s+/)[0] ?? null;
  const lint: LintOptions = { allowCaps: snap.settings.brandTerms };
  const template = demoBlueprint(idea, { brand });

  const outcome = await runStructured({
    feature: "blueprint",
    schema: blueprintSchema,
    schemaName: "campaign_blueprint",
    system: systemBlocks(snap),
    prompt: blueprintPrompt(idea),
    cache: { input: { idea }, snapshotHash: snap.hash },
    signal,
    accept: async (bp, { provider }) => {
      const v = await validateBlueprint(bp, idea, template, lint, provider, signal);
      return { value: v, warnings: v.warnings };
    },
    demo: async () => {
      const v = await validateBlueprint(template, idea, template, lint, null);
      return { value: v, warnings: v.warnings };
    },
  });

  const result: BlueprintResponse = {
    blueprint: outcome.value.blueprint,
    checks: outcome.value.checks,
    idea: { title: idea.title, type: idea.type, dailyBudget: idea.dailyBudget },
    source: outcome.source,
    model: outcome.model,
    ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
    warnings: outcome.warnings,
    ...(outcome.cached ? { cached: true } : {}),
  };
  if (req.format === "editor") result.editor = blueprintToEditorCsv(result.blueprint, { finalUrl: req.finalUrl ?? null });
  return result;
}
