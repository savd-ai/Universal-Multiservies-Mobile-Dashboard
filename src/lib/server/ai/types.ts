import "server-only";
import type { z } from "zod";
import type { AiProviderId } from "@/lib/domain/contracts/ai";
import type { AiEffort, AiFeature } from "./config";

// The provider contract every adapter (Anthropic, OpenAI, Gemini) implements, plus the typed AI error.

export interface SystemBlock {
  text: string;
  /** mark for prompt caching (Anthropic cache_control; OpenAI prompt_cache_key) */
  cacheable?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const AI_ERROR_CODES = ["AI_NOT_CONFIGURED", "AI_REFUSED", "AI_TRUNCATED", "AI_BAD_OUTPUT", "AI_TIMEOUT", "AI_RATE_LIMITED", "AI_BILLING", "AI_AUTH", "AI_UPSTREAM", "AI_ABORTED"] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    /** short machine detail, e.g. the refusal category or HTTP status */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface GenerateObjectRequest<T> {
  feature: AiFeature | string;
  system: SystemBlock[];
  prompt: string;
  schema: z.ZodType<T>;
  /** [a-zA-Z0-9_-], ≤ 64 chars (OpenAI format name) */
  schemaName: string;
  effort: AiEffort;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateObjectResult<T> {
  object: T;
  model: string;
  stopReason: string;
  /** a server-side fallback model produced (part of) the answer */
  fallbackUsed: boolean;
}

export interface StreamTextRequest {
  feature: AiFeature | string;
  system: SystemBlock[];
  messages: ChatTurn[];
  effort: AiEffort;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type StreamChunk = { type: "text"; delta: string } | { type: "notice"; message: string } | { type: "done"; model: string } | { type: "error"; code: AiErrorCode; message: string; detail?: string };

export interface AiProvider {
  id: AiProviderId;
  model: string | null;
  generateObject<T>(r: GenerateObjectRequest<T>): Promise<GenerateObjectResult<T>>;
  streamText(r: StreamTextRequest): AsyncIterable<StreamChunk>;
}

export interface ProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** a second model tried when the main one is out of quota or unavailable (Gemini) */
  fallbackModel?: string | null;
}

/** Map an HTTP status from any SDK error shape to an AI error code. */
export function codeForStatus(status: number | undefined): AiErrorCode {
  if (status === 429) return "AI_RATE_LIMITED";
  if (status === 402) return "AI_BILLING";
  if (status === 401 || status === 403) return "AI_AUTH";
  if (status === 408 || status === 504) return "AI_TIMEOUT";
  return "AI_UPSTREAM";
}

export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "APIUserAbortError")) return new AiError("AI_ABORTED", "Request cancelled");
  if (err instanceof Error && err.name === "TimeoutError") return new AiError("AI_TIMEOUT", "The AI provider timed out");
  return new AiError("AI_UPSTREAM", err instanceof Error ? err.message : String(err));
}
