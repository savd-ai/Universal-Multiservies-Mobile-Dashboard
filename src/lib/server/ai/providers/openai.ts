import "server-only";
import { createHash } from "node:crypto";
import { AiError, type AiProvider, type GenerateObjectRequest, type GenerateObjectResult, type ProviderOptions, type StreamChunk, type StreamTextRequest, type SystemBlock } from "../types";

// OpenAI adapter (Responses API). Structured output via zodTextFormat (strict: every field required, nullable
// instead of optional — our wire schemas already comply). Refusals arrive as `refusal` content parts / deltas.
// `store: false` keeps prompts out of OpenAI's response storage; the cacheable snapshot drives prompt_cache_key.

const DEFAULT_MAX_TOKENS = 16_000;

export async function createOpenAiProvider(opts: ProviderOptions): Promise<AiProvider> {
  const { default: OpenAI } = await import("openai");
  const { zodTextFormat } = await import("openai/helpers/zod");
  const client = new OpenAI({ apiKey: opts.apiKey, timeout: opts.timeoutMs, maxRetries: 2 });

  const instructions = (blocks: SystemBlock[]) => blocks.map((b) => b.text).join("\n\n");
  const cacheKey = (blocks: SystemBlock[]): string | undefined => {
    const cacheable = blocks.filter((b) => b.cacheable).map((b) => b.text);
    return cacheable.length ? `savd-${createHash("sha256").update(cacheable.join("\n")).digest("hex").slice(0, 32)}` : undefined;
  };

  const mapError = (err: unknown): AiError => {
    if (err instanceof AiError) return err;
    if (err instanceof OpenAI.RateLimitError) return new AiError("AI_RATE_LIMITED", "OpenAI rate limit reached", "429");
    if (err instanceof OpenAI.AuthenticationError) return new AiError("AI_AUTH", "OpenAI rejected the API key (check OPENAI_API_KEY)", "401");
    if (err instanceof OpenAI.APIConnectionTimeoutError) return new AiError("AI_TIMEOUT", "OpenAI did not respond in time");
    if (err instanceof OpenAI.APIUserAbortError) return new AiError("AI_ABORTED", "Request cancelled");
    if (err instanceof OpenAI.APIError) return new AiError("AI_UPSTREAM", `OpenAI API error${err.status ? ` (HTTP ${err.status})` : ""}`, err.status ? String(err.status) : undefined);
    if (err instanceof OpenAI.OpenAIError) return new AiError("AI_BAD_OUTPUT", "OpenAI returned an unreadable response");
    return new AiError("AI_UPSTREAM", err instanceof Error ? err.message : String(err));
  };

  return {
    id: "openai",
    model: opts.model,

    async generateObject<T>(r: GenerateObjectRequest<T>): Promise<GenerateObjectResult<T>> {
      try {
        const res = await client.responses.parse(
          {
            model: opts.model,
            instructions: instructions(r.system),
            input: r.prompt,
            text: { format: zodTextFormat(r.schema, r.schemaName) },
            reasoning: { effort: r.effort },
            max_output_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS,
            prompt_cache_key: cacheKey(r.system),
            store: false,
          },
          { signal: r.signal },
        );
        for (const item of res.output) {
          if (item.type !== "message") continue;
          for (const part of item.content) if (part.type === "refusal") throw new AiError("AI_REFUSED", "OpenAI declined the request", part.refusal.slice(0, 120));
        }
        if (res.status === "incomplete") {
          const reason = res.incomplete_details?.reason;
          throw reason === "content_filter" ? new AiError("AI_REFUSED", "OpenAI filtered the response", reason) : new AiError("AI_TRUNCATED", "OpenAI's answer was incomplete", reason ?? undefined);
        }
        if (res.output_parsed === null) throw new AiError("AI_BAD_OUTPUT", "OpenAI returned no structured output");
        return { object: res.output_parsed, model: res.model, stopReason: res.status ?? "completed", fallbackUsed: false };
      } catch (err) {
        throw mapError(err);
      }
    },

    async *streamText(r: StreamTextRequest): AsyncGenerator<StreamChunk> {
      let model = opts.model;
      let refusal = "";
      try {
        const stream = await client.responses.create(
          {
            model: opts.model,
            instructions: instructions(r.system),
            input: r.messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
            reasoning: { effort: r.effort },
            max_output_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS,
            prompt_cache_key: cacheKey(r.system),
            store: false,
          },
          { signal: r.signal },
        );
        for await (const ev of stream) {
          switch (ev.type) {
            case "response.output_text.delta":
              yield { type: "text", delta: ev.delta };
              break;
            case "response.refusal.delta":
              refusal += ev.delta;
              break;
            case "response.completed":
              model = ev.response.model;
              break;
            case "response.incomplete":
              model = ev.response.model;
              yield { type: "notice", message: ev.response.incomplete_details?.reason === "content_filter" ? "Part of the answer was filtered." : "The answer was cut short by the token limit." };
              break;
            case "response.failed":
              yield { type: "error", code: "AI_UPSTREAM", message: `OpenAI failed: ${ev.response.error?.message ?? "unknown error"}` };
              return;
            case "error":
              yield { type: "error", code: "AI_UPSTREAM", message: `OpenAI stream error${ev.code ? ` (${ev.code})` : ""}` };
              return;
            default:
              break;
          }
        }
        if (refusal) {
          yield { type: "error", code: "AI_REFUSED", message: "OpenAI declined to answer." };
          return;
        }
        yield { type: "done", model };
      } catch (err) {
        const e = mapError(err);
        yield { type: "error", code: e.code, message: e.message };
      }
    },
  };
}
