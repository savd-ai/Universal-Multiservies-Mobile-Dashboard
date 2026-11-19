import "server-only";
import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AiError, type AiProvider, type GenerateObjectRequest, type GenerateObjectResult, type ProviderOptions, type StreamChunk, type StreamTextRequest, type SystemBlock } from "../types";

// Anthropic adapter (beta namespace so server-side fallbacks work). Structured output: messages.parse with a
// betaZodOutputFormat whose parser never throws, so stop_reason (refusal / max_tokens) is checked BEFORE the
// content is read. Opus 5.5 thinks adaptively: `thinking` is omitted, effort is always explicit and max_tokens
// leaves room for thinking. The SDK is loaded lazily (serverExternalPackages).

const BETAS = ["server-side-fallback-2026-07-01"];
const DEFAULT_MAX_TOKENS = 16_000;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export async function createAnthropicProvider(opts: ProviderOptions): Promise<AiProvider> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs, maxRetries: 2 });

  const system = (blocks: SystemBlock[]): BetaTextBlockParam[] => blocks.map((b) => ({ type: "text", text: b.text, ...(b.cacheable ? { cache_control: { type: "ephemeral" as const } } : {}) }));

  // Most specific first: RateLimit / Authentication / ConnectionTimeout / UserAbort extend APIError.
  const mapError = (err: unknown): AiError => {
    if (err instanceof AiError) return err;
    if (err instanceof Anthropic.RateLimitError) return new AiError("AI_RATE_LIMITED", "Anthropic rate limit reached", "429");
    if (err instanceof Anthropic.AuthenticationError) return new AiError("AI_AUTH", "Anthropic rejected the API key (check ANTHROPIC_API_KEY)", "401");
    if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiError("AI_TIMEOUT", "Anthropic did not respond in time");
    if (err instanceof Anthropic.APIUserAbortError) return new AiError("AI_ABORTED", "Request cancelled");
    if (err instanceof Anthropic.APIError) return new AiError(err.status === 429 ? "AI_RATE_LIMITED" : "AI_UPSTREAM", `Anthropic API error${err.status ? ` (HTTP ${err.status})` : ""}`, err.status ? String(err.status) : undefined);
    if (err instanceof Anthropic.AnthropicError) return new AiError("AI_BAD_OUTPUT", "Anthropic returned an unreadable response");
    return new AiError("AI_UPSTREAM", err instanceof Error ? err.message : String(err));
  };

  return {
    id: "anthropic",
    model: opts.model,

    async generateObject<T>(r: GenerateObjectRequest<T>): Promise<GenerateObjectResult<T>> {
      const zodFormat = betaZodOutputFormat(r.schema);
      const format = {
        type: zodFormat.type,
        schema: zodFormat.schema,
        parse: (content: string): Parsed<T> => {
          try {
            return { ok: true, value: zodFormat.parse(content) };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "invalid output" };
          }
        },
      };
      try {
        const message = await client.beta.messages.parse(
          {
            model: opts.model,
            max_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS,
            betas: BETAS,
            fallbacks: "default",
            output_config: { effort: r.effort, format },
            system: system(r.system),
            messages: [{ role: "user", content: r.prompt }],
          },
          { signal: r.signal },
        );
        if (message.stop_reason === "refusal") throw new AiError("AI_REFUSED", "Anthropic declined the request", message.stop_details?.category ?? undefined);
        if (message.stop_reason === "max_tokens") throw new AiError("AI_TRUNCATED", "Anthropic's answer hit the token limit");
        const parsed = message.parsed_output;
        if (!parsed) throw new AiError("AI_BAD_OUTPUT", "Anthropic returned no structured output");
        if (!parsed.ok) throw new AiError("AI_BAD_OUTPUT", "Anthropic output did not match the schema", parsed.error);
        const fallback = message.content.find((b) => b.type === "fallback");
        return {
          object: parsed.value,
          model: fallback && fallback.type === "fallback" ? fallback.to.model : message.model,
          stopReason: message.stop_reason ?? "end_turn",
          fallbackUsed: !!fallback,
        };
      } catch (err) {
        throw mapError(err);
      }
    },

    async *streamText(r: StreamTextRequest): AsyncGenerator<StreamChunk> {
      try {
        const stream = client.beta.messages.stream(
          {
            model: opts.model,
            max_tokens: r.maxTokens ?? DEFAULT_MAX_TOKENS,
            betas: BETAS,
            fallbacks: "default",
            output_config: { effort: r.effort },
            system: system(r.system),
            messages: r.messages.map((m) => ({ role: m.role, content: m.content })),
          },
          { signal: r.signal },
        );
        for await (const ev of stream) {
          if (ev.type === "content_block_start" && ev.content_block.type === "fallback") {
            yield { type: "notice", message: `Continuing on fallback model ${ev.content_block.to.model}.` };
          } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            yield { type: "text", delta: ev.delta.text };
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          yield { type: "error", code: "AI_REFUSED", message: `Anthropic declined to answer${final.stop_details?.category ? ` (${final.stop_details.category})` : ""}.` };
          return;
        }
        if (final.stop_reason === "max_tokens") yield { type: "notice", message: "The answer was cut short by the token limit." };
        const fallback = final.content.find((b) => b.type === "fallback");
        yield { type: "done", model: fallback && fallback.type === "fallback" ? fallback.to.model : final.model };
      } catch (err) {
        const e = mapError(err);
        yield { type: "error", code: e.code, message: e.message };
      }
    },
  };
}
