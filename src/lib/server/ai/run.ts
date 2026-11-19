import "server-only";
import type { z } from "zod";
import type { AiMeta } from "@/lib/domain/contracts/ai";
import { BASE_INSTRUCTIONS, shortenPrompt } from "@/lib/domain/ai/prompts";
import { shortenLinesSchema } from "@/lib/domain/ai/schemas";
import type { FailingLine } from "@/lib/domain/ai/validators";
import { log } from "../log";
import { aiCacheKey, getCachedAi, setCachedAi } from "./cache";
import { effortFor, type AiFeature } from "./config";
import { describeAiFailure, getProvider } from "./provider";
import type { AccountSnapshot } from "./snapshot";
import { AiError, toAiError, type AiProvider, type SystemBlock } from "./types";

// The one path every structured AI feature takes: provider → cache → generateObject → accept (validate/repair) →
// cache; ANY failure (missing key, refusal, bad output, timeout, upstream rate limit, validation) returns the
// deterministic demo result with `source: "demo"` and a human `fallbackReason`.

/** Thrown by an `accept` step when output is unusable; its message is shown to the user as a warning. */
export class AcceptanceError extends AiError {
  constructor(message: string) {
    super("AI_BAD_OUTPUT", message, "acceptance");
    this.name = "AcceptanceError";
  }
}

export interface Accepted<R> {
  value: R;
  warnings?: string[];
}

export interface StructuredTask<T, R> {
  feature: AiFeature;
  schema: z.ZodType<T>;
  schemaName: string;
  system: SystemBlock[];
  prompt: string;
  /** what identifies the request for the 1 h result cache */
  cache: { input: unknown; snapshotHash: string | null };
  maxTokens?: number;
  signal?: AbortSignal;
  accept(object: T, ctx: { provider: AiProvider; model: string }): Promise<Accepted<R>> | Accepted<R>;
  demo(): Promise<Accepted<R>> | Accepted<R>;
}

export type AiOutcome<R> = AiMeta & { value: R };

/** The shared system prompt: identical instructions + the cacheable account snapshot. */
export function systemBlocks(snapshot: AccountSnapshot | null): SystemBlock[] {
  return snapshot ? [{ text: BASE_INSTRUCTIONS }, { text: snapshot.text, cacheable: true }] : [{ text: BASE_INSTRUCTIONS }];
}

export async function runStructured<T, R>(task: StructuredTask<T, R>): Promise<AiOutcome<R>> {
  const provider = await getProvider();
  const key = aiCacheKey({ feature: task.feature, input: task.cache.input, snapshotHash: task.cache.snapshotHash, provider: provider.id, model: provider.model });
  if (provider.id !== "demo") {
    const hit = getCachedAi<AiOutcome<R>>(key);
    if (hit) return { ...hit, cached: true };
  }
  try {
    const res = await provider.generateObject({ feature: task.feature, system: task.system, prompt: task.prompt, schema: task.schema, schemaName: task.schemaName, effort: effortFor(task.feature), maxTokens: task.maxTokens, signal: task.signal });
    const accepted = await task.accept(res.object, { provider, model: res.model });
    const out: AiOutcome<R> = { value: accepted.value, source: provider.id, model: res.model, warnings: [...(accepted.warnings ?? []), ...(res.fallbackUsed ? [`Answered by fallback model ${res.model}.`] : [])] };
    setCachedAi(key, out);
    return out;
  } catch (err) {
    const e = toAiError(err);
    if (e.code !== "AI_NOT_CONFIGURED") log.warn("AI feature fell back to the demo engine", { feature: task.feature, provider: provider.id, code: e.code, detail: e.detail?.slice(0, 200) });
    const d = await task.demo();
    return {
      value: d.value,
      source: "demo",
      model: null,
      fallbackReason: describeAiFailure(e, provider.id),
      warnings: [...(err instanceof AcceptanceError ? [err.message] : []), ...(d.warnings ?? [])],
    };
  }
}

/** One low-effort "shorten these lines" round; returns rewritten texts by id (empty on any failure). */
export async function shortenLines(provider: AiProvider, failing: readonly FailingLine[], signal?: AbortSignal): Promise<Map<string, string>> {
  if (!failing.length || provider.id === "demo") return new Map();
  try {
    const res = await provider.generateObject({
      feature: "repair",
      system: systemBlocks(null),
      prompt: shortenPrompt(failing.slice(0, 40)),
      schema: shortenLinesSchema,
      schemaName: "shortened_lines",
      effort: effortFor("repair"),
      signal,
    });
    const ids = new Set(failing.map((f) => f.id));
    return new Map(res.object.lines.filter((l) => ids.has(l.id)).map((l) => [l.id, l.text]));
  } catch (err) {
    log.warn("AI line repair failed; dropping the lines", { error: toAiError(err).code });
    return new Map();
  }
}
