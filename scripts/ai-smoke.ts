// npm run ai:smoke — exercise the AI layer from the command line. For every provider with a key in .env it runs one
// tiny structured call (generateObject) and one streamed call (streamText) through the same adapters and guard the
// app uses, printing model and latency. With no keys it says demo mode is active and exercises the demo engine.
// Prompts are tiny and contain no account data. Exits non-zero when a configured provider fails.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const REACT_SERVER = "--conditions=react-server";

// Server modules start with `import "server-only"`, a no-op only under the "react-server" export condition —
// so the script re-runs itself once with that condition.
function relaunchWithServerCondition(): number | null {
  if (process.execArgv.includes(REACT_SERVER)) return null;
  const child = spawnSync(process.execPath, [...process.execArgv, REACT_SERVER, ...process.argv.slice(1)], { stdio: "inherit", env: process.env });
  return child.status ?? 1;
}

const ms = (t0: number) => `${Math.round(performance.now() - t0)} ms`;

async function main(): Promise<number> {
  const relaunched = relaunchWithServerCondition();
  if (relaunched !== null) return relaunched;
  for (const f of [".env", ".env.local"]) {
    const file = path.resolve(process.cwd(), f);
    if (existsSync(file)) process.loadEnvFile?.(file);
  }

  const { z } = await import("zod");
  const { AI_DEFAULT_MODELS, aiLimits, configuredProviders, fallbackModelFor, resolveAiProvider } = await import("@/lib/server/ai/config");
  const { describeAiFailure, guardProvider } = await import("@/lib/server/ai/provider");
  const { createAnthropicProvider } = await import("@/lib/server/ai/providers/anthropic");
  const { createOpenAiProvider } = await import("@/lib/server/ai/providers/openai");
  const { createGeminiProvider } = await import("@/lib/server/ai/providers/gemini");
  const { env } = await import("@/lib/server/env/config");
  const { BASE_INSTRUCTIONS } = await import("@/lib/domain/ai/prompts");

  const resolved = resolveAiProvider();
  console.log("SAVD · AI smoke test");
  console.log(`Active provider: ${resolved.id}${resolved.model ? ` (${resolved.model})` : ""}${resolved.reason ? ` — ${resolved.reason}` : ""}`);

  const configured = configuredProviders();
  if (!configured.length) {
    console.log("No AI keys configured — demo mode is active. Exercising the demo engine:");
    await demoEngine();
    return 0;
  }

  const factories = { anthropic: createAnthropicProvider, openai: createOpenAiProvider, gemini: createGeminiProvider } as const;
  const modelEnv = { anthropic: "ANTHROPIC_MODEL", openai: "OPENAI_MODEL", gemini: "GEMINI_MODEL" } as const;
  const keyEnv = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" } as const;
  const schema = z.object({ ok: z.boolean(), greeting: z.string().describe("At most 6 words") });
  let failures = 0;

  for (const id of configured) {
    const model = env.str(modelEnv[id], AI_DEFAULT_MODELS[id]);
    const fallbackModel = fallbackModelFor(id);
    console.log(`\n▸ ${id} · ${model}${fallbackModel ? ` (fallback ${fallbackModel})` : ""}`);
    let provider;
    let fallbackOnly;
    try {
      const options = { apiKey: env.str(keyEnv[id], ""), timeoutMs: aiLimits().timeoutMs };
      provider = guardProvider(await factories[id]({ ...options, model, fallbackModel }));
      // the fallback model on its own, so a wrong id shows up before the day it is needed
      fallbackOnly = fallbackModel ? guardProvider(await factories[id]({ ...options, model: fallbackModel })) : null;
    } catch (err) {
      failures++;
      console.log(`  ✗ SDK failed to load: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const check = { feature: "smoke", system: [{ text: BASE_INSTRUCTIONS }], prompt: "Connectivity check: return ok=true and a short friendly greeting.", schema, schemaName: "smoke_check", effort: "low" as const, maxTokens: 4000 };
    let t0 = performance.now();
    try {
      const r = await provider.generateObject(check);
      console.log(`  ✓ generateObject  ${ms(t0)}  model=${r.model}  stop=${r.stopReason}${r.fallbackUsed ? "  (served by fallback)" : ""}  → ${JSON.stringify(r.object)}`);
    } catch (err) {
      failures++;
      console.log(`  ✗ generateObject  ${ms(t0)}  ${describeAiFailure(err, id)}`);
    }
    if (fallbackOnly) {
      t0 = performance.now();
      try {
        const r = await fallbackOnly.generateObject(check);
        console.log(`  ✓ fallback model  ${ms(t0)}  model=${r.model}  → ${JSON.stringify(r.object)}`);
      } catch (err) {
        failures++;
        console.log(`  ✗ fallback model  ${ms(t0)}  ${describeAiFailure(err, id)}`);
      }
    }
    t0 = performance.now();
    let text = "";
    let ok = false;
    for await (const chunk of provider.streamText({ feature: "smoke", system: [{ text: BASE_INSTRUCTIONS }], messages: [{ role: "user", content: "Connectivity check: say hello in at most six words." }], effort: "low", maxTokens: 4000 })) {
      if (chunk.type === "text") text += chunk.delta;
      else if (chunk.type === "notice") console.log(`  · notice: ${chunk.message}`);
      else if (chunk.type === "done") {
        ok = true;
        console.log(`  ✓ streamText      ${ms(t0)}  model=${chunk.model}  → ${JSON.stringify(text.trim().slice(0, 120))}`);
      } else {
        failures++;
        console.log(`  ✗ streamText      ${ms(t0)}  ${chunk.code}: ${chunk.message}`);
      }
    }
    if (!ok && !text) console.log("  (stream ended without a done event)");
  }
  console.log(failures ? `\n${failures} check(s) failed — the app falls back to the demo engine for those calls.` : "\nAll configured providers answered.");
  return failures ? 1 : 0;
}

/** No keys: run each deterministic demo feature once (pure domain code, no data source needed). */
async function demoEngine(): Promise<void> {
  const { demoAdCopy, demoBlueprint, demoIdeas, insightSentence } = await import("@/lib/domain/ai/demo-engine");
  const { blueprintToEditorCsv } = await import("@/lib/domain/ai/editor-csv");
  const { parseNlQuery } = await import("@/lib/domain/ai/nl-lite");
  const { adCopyLines, blueprintLines, checkLines, failingLines, repairIdeas } = await import("@/lib/domain/ai/validators");

  let t0 = performance.now();
  const ideas = repairIdeas(demoIdeas("Lower CPA"), { testBudget: 3000, knownCampaignIds: new Set(), topUps: [] });
  console.log(`  ✓ ideas        ${ms(t0)}  ${ideas.ideas.length} ideas: ${ideas.ideas.map((i) => `${i.title} ($${i.dailyBudget}/day)`).join(" · ")}`);
  t0 = performance.now();
  const copy = demoAdCopy({ product: "trail running shoes", audience: "", usps: [], keywords: ["trail running shoes"], tone: "confident" }, { brand: "acme" });
  const copyLines = adCopyLines(copy);
  console.log(`  ✓ ad copy      ${ms(t0)}  ${copy.headlines.length} headlines, ${copy.descriptions.length} descriptions, ${failingLines(copyLines, checkLines(copyLines)).length} failing lines`);
  t0 = performance.now();
  const first = ideas.ideas[0];
  if (first) {
    const bp = demoBlueprint(first, { brand: "acme" });
    const csv = blueprintToEditorCsv(bp);
    console.log(`  ✓ blueprint    ${ms(t0)}  ${bp.adGroups.length} ad groups, ${failingLines(blueprintLines(bp), checkLines(blueprintLines(bp))).length} failing lines, Editor CSV ${csv.rows} rows`);
  }
  t0 = performance.now();
  const nl = parseNlQuery("top 5 campaigns by ROAS last 7 days", { today: new Date().toISOString().slice(0, 10) });
  console.log(`  ✓ NL-lite      ${ms(t0)}  ${JSON.stringify(nl.queries[0]?.spec)}`);
  console.log(`  ✓ narrative    ${insightSentence({ signals: [{ id: "s", kind: "metric_deviation", campaign: "Search — Competitor Terms", shortName: "Competitor Terms", title: "CPA up 92%", severity: "critical", metric: "cpa", changePct: 0.92, recommendation: "" }], bestRoas: { campaignId: "c4", name: "Shopping — Best Sellers", shortName: "Best Sellers", roas: 4.26, cost: 17230 } })}`);
  console.log("Add ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to .env to test a live provider.");
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
