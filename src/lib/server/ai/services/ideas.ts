import "server-only";
import { randomUUID } from "node:crypto";
import { ideasOutputSchema, type IdeaSet, type IdeaSetPatch, type IdeasRequest } from "@/lib/domain/contracts/ai";
import { demoIdeas } from "@/lib/domain/ai/demo-engine";
import { ideasPrompt } from "@/lib/domain/ai/prompts";
import { repairIdeas } from "@/lib/domain/ai/validators";
import type { RequestContext } from "../../context";
import { notFound } from "../../http/errors";
import { getStore } from "../../store";
import { AcceptanceError, runStructured, systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";

// Campaign ideas: the prototype's prompt grounded in the account snapshot, repaired by the validators, persisted
// as an IdeaSet (history per account). Demo: GOAL_PICK order with rationales that cite live numbers.

const KEEP_SETS = 50;

export async function generateIdeas(ctx: RequestContext, req: IdeasRequest, signal?: AbortSignal): Promise<IdeaSet> {
  const snap = await buildSnapshot(ctx);
  const known = new Set(snap.campaigns.map((c) => c.id));
  const evidence = snap.campaigns.map((c) => ({ id: c.id, name: c.name, cost: c.cost, conversions: c.conversions, cpa: c.cpa, roas: c.roas }));
  const library = demoIdeas(req.goal, evidence);
  const business = `${ctx.account.name} — ${snap.settings.businessContext}`;

  const outcome = await runStructured({
    feature: "ideas",
    schema: ideasOutputSchema,
    schemaName: "campaign_ideas",
    system: systemBlocks(snap),
    prompt: ideasPrompt({ business, goal: req.goal, testBudget: req.testBudget, context: req.context }),
    cache: { input: req, snapshotHash: snap.hash },
    signal,
    accept: (out) => {
      const r = repairIdeas(out.ideas, { testBudget: req.testBudget, knownCampaignIds: known, topUps: library });
      if (!r.ideas.some((i) => !i.topUp)) throw new AcceptanceError("The AI returned no usable ideas.");
      return { value: r.ideas, warnings: r.warnings };
    },
    demo: () => {
      const r = repairIdeas(library, { testBudget: req.testBudget, knownCampaignIds: known, topUps: [] });
      return { value: r.ideas, warnings: r.warnings };
    },
  });

  const body = {
    goal: req.goal,
    testBudget: req.testBudget,
    context: req.context,
    ideas: outcome.value.map((idea) => ({ ...idea, id: randomUUID().slice(0, 8) })),
    source: outcome.source,
    model: outcome.model,
    ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
    warnings: outcome.warnings,
    accountId: ctx.accountId,
    mode: ctx.source.mode,
  };
  // The client is gone: don't store a set nobody asked for (it would carry a "cancelled" fallback reason).
  if (signal?.aborted) {
    const at = new Date().toISOString();
    return { ...body, id: randomUUID(), version: 0, createdAt: at, updatedAt: at };
  }
  const set = await getStore().ideaSets.create(body);
  await pruneSets(ctx.accountId);
  return set;
}

async function pruneSets(accountId: string): Promise<void> {
  const store = getStore();
  const mine = (await store.ideaSets.list((s) => s.accountId === accountId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const old of mine.slice(KEEP_SETS)) await store.ideaSets.delete(old.id);
}

/** Latest first, for the active account (sets saved before accounts were tracked are included). */
export async function listIdeaSets(ctx: RequestContext, limit = 20): Promise<IdeaSet[]> {
  const sets = await getStore().ideaSets.list((s) => !s.accountId || s.accountId === ctx.accountId);
  return sets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id))).slice(0, limit);
}

export async function getIdeaSet(id: string): Promise<IdeaSet> {
  const set = await getStore().ideaSets.get(id);
  if (!set) throw notFound("Idea set");
  return set;
}

export async function patchIdeaSet(id: string, patch: IdeaSetPatch): Promise<IdeaSet> {
  const store = getStore();
  const set = await getIdeaSet(id);
  if (!set.ideas.some((i) => i.id === patch.ideaId)) throw notFound("Idea");
  return store.ideaSets.update(id, (prev) => ({
    ...prev,
    ideas: prev.ideas.map((i) => (i.id === patch.ideaId ? { ...i, ...(patch.dismissed !== undefined ? { dismissed: patch.dismissed } : {}), ...(patch.inPlan !== undefined ? { inPlan: patch.inPlan } : {}) } : i)),
  }));
}
