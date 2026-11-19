import "server-only";
import { createHash } from "node:crypto";
import type { AiProviderId } from "@/lib/domain/contracts/ai";
import { Semaphore, singleton } from "../cache";
import { log, redact } from "../log";
import { aiLimits, apiKeyFor, fallbackModelFor, PROVIDER_LABELS, resolveAiProvider } from "./config";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAiProvider } from "./providers/openai";
import { AiError, toAiError, type AiProvider, type GenerateObjectRequest, type GenerateObjectResult, type ProviderOptions, type StreamChunk, type StreamTextRequest } from "./types";

export { AiError } from "./types";
export type { AiErrorCode, AiProvider, ChatTurn, GenerateObjectRequest, GenerateObjectResult, StreamChunk, StreamTextRequest, SystemBlock } from "./types";

// getProvider(): the configured provider wrapped with the guard every call goes through — a process-wide
// concurrency cap (AI_MAX_CONCURRENCY), a hard timeout (AI_TIMEOUT_MS) and a final redact() pass over everything
// sent upstream. No key / AI_DISABLED → the demo provider, whose calls fail with AI_NOT_CONFIGURED so services
// take the same fallback path as for any other provider failure.

const FACTORIES: Record<Exclude<AiProviderId, "demo">, (o: ProviderOptions) => Promise<AiProvider>> = {
  anthropic: createAnthropicProvider,
  openai: createOpenAiProvider,
  gemini: createGeminiProvider,
};

const g = globalThis as unknown as { __savdAiOverride?: AiProvider | null; __savdAiProviders?: Map<string, Promise<AiProvider>> };
const instances = (g.__savdAiProviders ??= new Map());

/** Tests inject a fake provider; it is still wrapped by the guard. */
export function setProviderForTests(p: AiProvider | null): void {
  g.__savdAiOverride = p;
}

export function demoProvider(reason: string): AiProvider {
  return {
    id: "demo",
    model: null,
    async generateObject<T>(): Promise<GenerateObjectResult<T>> {
      throw new AiError("AI_NOT_CONFIGURED", reason);
    },
    async *streamText(): AsyncGenerator<StreamChunk> {
      yield { type: "error", code: "AI_NOT_CONFIGURED", message: reason };
    },
  };
}

export async function getProvider(): Promise<AiProvider> {
  if (g.__savdAiOverride) return guardProvider(g.__savdAiOverride);
  const r = resolveAiProvider();
  if (r.id === "demo" || !r.model) return demoProvider(r.reason ?? "AI is not configured");
  const apiKey = apiKeyFor(r.id);
  if (!apiKey) return demoProvider(`${PROVIDER_LABELS[r.id]} key is not set`);
  const { timeoutMs } = aiLimits();
  const fallbackModel = fallbackModelFor(r.id);
  const key = `${r.id}|${r.model}|${fallbackModel ?? ""}|${timeoutMs}|${createHash("sha256").update(apiKey).digest("hex").slice(0, 16)}`;
  let p = instances.get(key);
  if (!p) {
    p = FACTORIES[r.id]({ apiKey, model: r.model, timeoutMs, fallbackModel });
    instances.set(key, p);
  }
  try {
    return guardProvider(await p);
  } catch (err) {
    instances.delete(key);
    log.error("AI provider failed to initialise", { provider: r.id, error: err instanceof Error ? err.message : String(err) });
    return demoProvider(`${PROVIDER_LABELS[r.id]} SDK could not be loaded`);
  }
}

const semaphore = () => singleton(`ai:semaphore:${aiLimits().maxConcurrency}`, () => new Semaphore(aiLimits().maxConcurrency));

/** Hold one concurrency permit until `release` is called (works across async-iterator lifetimes). */
async function acquire(sem: Semaphore): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await new Promise<void>((ready) => {
    void sem.use(async () => {
      ready();
      await held;
    });
  });
  return release;
}

interface Deadline {
  signal: AbortSignal;
  /** rejects with the AiError that aborted the call */
  aborted: Promise<never>;
  dispose(): void;
}

function deadline(ms: number, outer?: AbortSignal): Deadline {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new AiError("AI_TIMEOUT", `No response within ${Math.round(ms / 1000)} s`)), ms);
  const onAbort = () => ctl.abort(new AiError("AI_ABORTED", "Request cancelled"));
  if (outer?.aborted) onAbort();
  else outer?.addEventListener("abort", onAbort, { once: true });
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(ctl.signal.reason instanceof AiError ? ctl.signal.reason : new AiError("AI_ABORTED", "Request cancelled"));
    if (ctl.signal.aborted) fail();
    else ctl.signal.addEventListener("abort", fail, { once: true });
  });
  aborted.catch(() => undefined);
  return {
    signal: ctl.signal,
    aborted,
    dispose() {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

export function guardProvider(inner: AiProvider): AiProvider {
  if (inner.id === "demo") return inner;
  return {
    id: inner.id,
    model: inner.model,

    async generateObject<T>(req: GenerateObjectRequest<T>): Promise<GenerateObjectResult<T>> {
      const { timeoutMs } = aiLimits();
      return semaphore().use(async () => {
        const d = deadline(timeoutMs, req.signal);
        try {
          return await Promise.race([inner.generateObject({ ...req, system: req.system.map((b) => ({ ...b, text: redact(b.text) })), prompt: redact(req.prompt), signal: d.signal }), d.aborted]);
        } catch (err) {
          throw d.signal.aborted && d.signal.reason instanceof AiError ? d.signal.reason : toAiError(err);
        } finally {
          d.dispose();
        }
      });
    },

    async *streamText(req: StreamTextRequest): AsyncGenerator<StreamChunk> {
      const { timeoutMs } = aiLimits();
      const release = await acquire(semaphore());
      const d = deadline(timeoutMs, req.signal);
      const it = inner
        .streamText({ ...req, system: req.system.map((b) => ({ ...b, text: redact(b.text) })), messages: req.messages.map((m) => ({ ...m, content: redact(m.content) })), signal: d.signal })
        [Symbol.asyncIterator]();
      try {
        for (;;) {
          const next = await Promise.race([it.next(), d.aborted]);
          if (next.done) break;
          yield next.value;
        }
      } catch (err) {
        const e = d.signal.aborted && d.signal.reason instanceof AiError ? d.signal.reason : toAiError(err);
        yield { type: "error", code: e.code, message: e.message, detail: e.detail };
      } finally {
        d.dispose();
        release();
        void it.return?.(undefined);
      }
    },
  };
}

/** User-facing reason for a fallback to the demo engine (never includes secrets or raw upstream bodies). */
export function describeAiFailure(err: unknown, providerId: AiProviderId): string {
  const e = toAiError(err);
  const who = PROVIDER_LABELS[providerId] ?? "The AI provider";
  switch (e.code) {
    case "AI_NOT_CONFIGURED":
      return e.message;
    case "AI_REFUSED":
      return `${who} declined this request${e.detail && /^[a-z_]+$/.test(e.detail) ? ` (policy: ${e.detail})` : ""}.`;
    case "AI_TRUNCATED":
      return `${who}'s answer was cut off before it finished.`;
    case "AI_BAD_OUTPUT":
      return `${who} returned output that failed validation.`;
    case "AI_TIMEOUT":
      return `${who} did not respond in time.`;
    case "AI_RATE_LIMITED":
      if (e.detail === "daily") return `${who}'s daily quota for this model is used up${providerId === "gemini" ? " — it resets at midnight Pacific time" : ""}.`;
      if (e.detail === "no_free_tier") return `${who} has no free-tier quota for this model — choose a model with free quota, or add billing.`;
      return `${who} rate limit reached — try again in a minute.`;
    case "AI_BILLING":
      return `${who} refused the request: the API project has no credit left (HTTP 402)${providerId === "gemini" ? " — top it up in AI Studio, or use a key from a project without billing (free tier)" : ""}.`;
    case "AI_AUTH":
      return `${who} rejected the API key.`;
    case "AI_ABORTED":
      return "The request was cancelled.";
    case "AI_UPSTREAM":
      return `${who} is unavailable${e.detail && /^\d{3}$/.test(e.detail) ? ` (HTTP ${e.detail})` : ""}.`;
  }
}
