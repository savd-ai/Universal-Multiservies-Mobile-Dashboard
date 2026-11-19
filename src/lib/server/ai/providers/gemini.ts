import "server-only";
import { z } from "zod";
import { now } from "../../clock";
import { AiError, codeForStatus, type AiProvider, type GenerateObjectRequest, type GenerateObjectResult, type ProviderOptions, type StreamChunk, type StreamTextRequest, type SystemBlock } from "../types";

// Gemini adapter on the Interactions API (`client.interactions.create`, present in @google/genai 2.x types):
// structured output via response_format {type:"text", mime_type:"application/json", schema: z.toJSONSchema(...)},
// then JSON.parse + zod safeParse; streaming via `step.delta` text deltas. `store: false` keeps no server copy.
// The next-gen SDK's error classes are not exported, so errors are classified structurally (statusCode / name /
// the google.rpc body it carries).
//
// Free tier (an AI Studio project without billing): each model has its own small quota (about 20 requests a day
// for 3.8 Flash, several hundred for Flash-Lite), and the daily ones reset at midnight Pacific time. A request the
// main model can't take (quota, no free quota, overloaded, unknown model) is retried once on `fallbackModel` before
// any text is produced, and a model whose quota is gone is skipped until it comes back. HTTP 402 is a billed project
// whose prepaid credit is used up: no model answers until it is topped up or a key from a free-tier project is used.

const DEFAULT_MAX_TOKENS = 16_000;
/** how long a model without free-tier quota is skipped before it is tried again (billing may have been added) */
const NO_FREE_TIER_PAUSE_MS = 60 * 60_000;

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

/** The google.rpc error an SDK error carries (`error` = parsed body, `body` = raw JSON). */
interface RpcError {
  code?: number;
  message?: string;
  status?: string;
  details?: { "@type"?: string; violations?: { quotaId?: string; quotaValue?: string }[]; retryDelay?: string }[];
}

function rpcError(err: unknown): RpcError | null {
  const e = err as { error?: unknown; body?: unknown };
  let body: unknown = e.error;
  if (!body || typeof body !== "object") {
    try {
      body = typeof e.body === "string" && e.body ? JSON.parse(e.body) : null;
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") return null;
  const inner = (body as { error?: unknown }).error;
  return (inner && typeof inner === "object" ? inner : body) as RpcError;
}

export type GeminiQuota = "daily" | "per_minute" | "no_free_tier";

/** Which quota a 429 hit, from its QuotaFailure (quota ids like GenerateRequestsPerDayPerProjectPerModel-FreeTier). */
export function quotaKind(rpc: RpcError | null): GeminiQuota | null {
  const violations = (rpc?.details ?? []).flatMap((d) => d.violations ?? []);
  if (violations.some((v) => v.quotaValue === "0") || /\blimit: 0\b/.test(rpc?.message ?? "")) return "no_free_tier";
  if (violations.some((v) => /PerDay/i.test(v.quotaId ?? ""))) return "daily";
  if (violations.some((v) => /PerMinute/i.test(v.quotaId ?? ""))) return "per_minute";
  return null;
}

/** RetryInfo.retryDelay ("37s", "1.5s") in ms. */
function retryDelayMs(rpc: RpcError | null): number | null {
  const d = rpc?.details?.find((x) => typeof x.retryDelay === "string")?.retryDelay;
  const s = d ? Number.parseFloat(d) : Number.NaN;
  return Number.isFinite(s) && s >= 0 ? Math.ceil(s * 1000) : null;
}

/** The next midnight Pacific time (when Gemini's daily quotas reset) as epoch ms; up to an hour off on DST days. */
export function nextPacificMidnight(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const sinceMidnight = ((part("hour") * 60 + part("minute")) * 60 + part("second")) * 1000 + at.getUTCMilliseconds();
  return at.getTime() - sinceMidnight + 86_400_000;
}

export function mapGeminiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Error) {
    const e = err as Error & { statusCode?: unknown; status?: unknown };
    const status = typeof e.statusCode === "number" ? e.statusCode : typeof e.status === "number" ? e.status : undefined;
    if (/Timeout/i.test(e.name)) return new AiError("AI_TIMEOUT", "Gemini did not respond in time");
    if (/Abort/i.test(e.name)) return new AiError("AI_ABORTED", "Request cancelled");
    const code = codeForStatus(status);
    if (code === "AI_RATE_LIMITED") {
      const kind = quotaKind(rpcError(err));
      return new AiError(code, kind === "daily" ? "Gemini daily quota used up" : kind === "no_free_tier" ? "This Gemini model has no free-tier quota" : "Gemini rate limit reached", kind ?? "429");
    }
    if (code === "AI_BILLING") return new AiError(code, "Gemini: the project's prepaid credit is used up or its billing is inactive (HTTP 402)", "402");
    if (code === "AI_AUTH") return new AiError(code, "Gemini rejected the API key (check GEMINI_API_KEY)", String(status));
    if (status === 404) return new AiError(code, "Gemini does not know this model (check GEMINI_MODEL)", "404");
    return new AiError(code, `Gemini API error${status ? ` (HTTP ${status})` : ""}`, status ? String(status) : undefined);
  }
  return new AiError("AI_UPSTREAM", String(err));
}

export async function createGeminiProvider(opts: ProviderOptions): Promise<AiProvider> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: opts.apiKey, httpOptions: { timeout: opts.timeoutMs } });
  const systemText = (blocks: SystemBlock[]) => blocks.map((b) => b.text).join("\n\n");
  const models = [opts.model, ...(opts.fallbackModel && opts.fallbackModel !== opts.model ? [opts.fallbackModel] : [])];
  /** models whose quota is gone: until when, and the error that said so */
  const paused = new Map<string, { until: number; error: AiError }>();

  /** The models to try, in order; when every one is paused, the main model's last error is thrown without a call. */
  function plan(): string[] {
    const at = now().getTime();
    const open = models.filter((m) => (paused.get(m)?.until ?? 0) <= at);
    if (!open.length) throw paused.get(opts.model)?.error ?? new AiError("AI_RATE_LIMITED", "Gemini rate limit reached", "429");
    return open;
  }

  /** Classify a failed call, pause a model whose quota is gone, and say whether the next model is worth a try. */
  function failed(model: string, err: unknown): { error: AiError; tryNext: boolean } {
    const error = mapGeminiError(err);
    if (error.code === "AI_RATE_LIMITED") {
      const at = now();
      const until = error.detail === "daily" ? nextPacificMidnight(at) : at.getTime() + (error.detail === "no_free_tier" ? NO_FREE_TIER_PAUSE_MS : (retryDelayMs(rpcError(err)) ?? 60_000));
      paused.set(model, { until, error });
    }
    return { error, tryNext: error.code === "AI_RATE_LIMITED" || (error.code === "AI_UPSTREAM" && /^(404|5\d\d)$/.test(error.detail ?? "")) };
  }

  /** Request options: one quick retry when another model can still take the request, the SDK's own policy otherwise. */
  const requestOptions = (signal: AbortSignal | undefined, last: boolean) => ({ signal, timeout: opts.timeoutMs, ...(last ? {} : { maxRetries: 1 }) });

  async function objectFrom<T>(model: string, r: GenerateObjectRequest<T>, last: boolean): Promise<GenerateObjectResult<T>> {
    const interaction = await client.interactions.create(
      {
        model,
        input: r.prompt,
        system_instruction: systemText(r.system),
        response_format: { type: "text", mime_type: "application/json", schema: jsonSchemaFor(r.schema) },
        generation_config: { thinking_level: r.effort, max_output_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS },
        store: false,
      },
      requestOptions(r.signal, last),
    );
    if (interaction.status === "incomplete" || interaction.status === "budget_exceeded") throw new AiError("AI_TRUNCATED", "Gemini's answer was incomplete", interaction.status);
    if (interaction.status !== "completed") throw new AiError("AI_UPSTREAM", `Gemini interaction ${interaction.status}`, interaction.status);
    const text =
      interaction.output_text ??
      (interaction.steps ?? [])
        .flatMap((s) => (s.type === "model_output" ? (s.content ?? []) : []))
        .flatMap((c) => (c.type === "text" ? [c.text] : []))
        .join("");
    if (!text.trim()) throw new AiError("AI_REFUSED", "Gemini returned no content (possibly blocked by safety filters)");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError("AI_BAD_OUTPUT", "Gemini returned invalid JSON");
    }
    const parsed = r.schema.safeParse(json);
    if (!parsed.success) throw new AiError("AI_BAD_OUTPUT", "Gemini output did not match the schema", parsed.error.message.slice(0, 300));
    return { object: parsed.data, model: interaction.model ?? model, stopReason: interaction.status, fallbackUsed: model !== opts.model };
  }

  return {
    id: "gemini",
    model: opts.model,

    async generateObject<T>(r: GenerateObjectRequest<T>): Promise<GenerateObjectResult<T>> {
      const order = plan();
      for (let i = 0; ; i++) {
        const model = order[i]!;
        const last = i === order.length - 1;
        try {
          return await objectFrom(model, r, last);
        } catch (err) {
          const { error, tryNext } = failed(model, err);
          if (last || !tryNext) throw error;
        }
      }
    },

    async *streamText(r: StreamTextRequest): AsyncGenerator<StreamChunk> {
      let order: string[];
      try {
        order = plan();
      } catch (err) {
        const e = mapGeminiError(err);
        yield { type: "error", code: e.code, message: e.message, detail: e.detail };
        return;
      }
      for (let i = 0; i < order.length; i++) {
        const model = order[i]!;
        const last = i === order.length - 1;
        let started = false;
        try {
          const stream = await client.interactions.create(
            {
              model,
              input: r.messages.map((m) => ({ type: m.role === "user" ? ("user_input" as const) : ("model_output" as const), content: [{ type: "text" as const, text: m.content }] })),
              system_instruction: systemText(r.system),
              generation_config: { thinking_level: r.effort, max_output_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS },
              stream: true,
              store: false,
            },
            requestOptions(r.signal, last),
          );
          // the request was accepted: from here on a failure ends the answer instead of moving to the next model
          started = true;
          if (model !== opts.model) yield { type: "notice", message: `Answering with fallback model ${model}.` };
          let served = model;
          for await (const ev of stream) {
            if (ev.event_type === "step.delta") {
              if (ev.delta.type === "text") yield { type: "text", delta: ev.delta.text };
            } else if (ev.event_type === "error") {
              yield { type: "error", code: "AI_UPSTREAM", message: `Gemini stream error${ev.error?.message ? `: ${ev.error.message.slice(0, 160)}` : ""}` };
              return;
            } else if (ev.event_type === "interaction.completed") {
              served = ev.interaction.model ?? served;
              if (ev.interaction.status === "incomplete" || ev.interaction.status === "budget_exceeded") yield { type: "notice", message: "The answer was cut short by the token limit." };
            }
          }
          yield { type: "done", model: served };
          return;
        } catch (err) {
          const { error, tryNext } = started ? { error: mapGeminiError(err), tryNext: false } : failed(model, err);
          if (!last && tryNext) continue;
          yield { type: "error", code: error.code, message: error.message, detail: error.detail };
          return;
        }
      }
    },
  };
}
