import "server-only";
import type { AiProviderId, AiStatus } from "@/lib/domain/contracts/ai";
import { env } from "../env/config";

// Which AI provider serves requests. `auto` = first provider with a key (anthropic → openai → gemini), else the
// deterministic demo engine. An explicit provider without its key also falls back to demo, with a reason.

export const AI_DEFAULT_MODELS: Record<Exclude<AiProviderId, "demo">, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-6-sol",
  gemini: "gemini-3.8-flash",
};

/** Gemini's second model: a Flash-Lite with a much larger free-tier daily quota than 3.8 Flash (~500 vs ~20 requests). */
export const GEMINI_DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const KEY_ENV: Record<Exclude<AiProviderId, "demo">, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };
const MODEL_ENV: Record<Exclude<AiProviderId, "demo">, string> = { anthropic: "ANTHROPIC_MODEL", openai: "OPENAI_MODEL", gemini: "GEMINI_MODEL" };

export interface ResolvedAiProvider {
  id: AiProviderId;
  model: string | null;
  reason?: string;
  configured: AiProviderId[];
}

export function configuredProviders(): Exclude<AiProviderId, "demo">[] {
  return (Object.keys(KEY_ENV) as Exclude<AiProviderId, "demo">[]).filter((p) => env.has(KEY_ENV[p]));
}

export function resolveAiProvider(): ResolvedAiProvider {
  const configured = configuredProviders();
  if (env.bool("AI_DISABLED")) return { id: "demo", model: null, reason: "AI_DISABLED=true", configured };
  const wanted = (env.get("AI_PROVIDER") ?? "auto").toLowerCase();
  const pick = (p: Exclude<AiProviderId, "demo">): ResolvedAiProvider => ({ id: p, model: env.str(MODEL_ENV[p], AI_DEFAULT_MODELS[p]), configured });
  if (wanted === "demo") return { id: "demo", model: null, reason: "AI_PROVIDER=demo", configured };
  if (wanted === "anthropic" || wanted === "openai" || wanted === "gemini") {
    if (configured.includes(wanted)) return pick(wanted);
    return { id: "demo", model: null, reason: `AI_PROVIDER=${wanted} but ${KEY_ENV[wanted]} is not set`, configured };
  }
  const first = configured[0];
  if (first) return pick(first);
  return { id: "demo", model: null, reason: "No AI key in .env (ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY)", configured };
}

export function aiStatus(): AiStatus {
  const r = resolveAiProvider();
  const fallbackModel = fallbackModelFor(r.id);
  return { provider: r.id, model: r.model, configured: r.configured, reason: r.reason, fallbacksEnabled: r.id === "anthropic" || fallbackModel !== null, fallbackModel };
}

/** The model a provider retries on when its main model is out of quota or unavailable (only Gemini has one; Anthropic
 *  falls back server-side). GEMINI_FALLBACK_MODEL=none turns it off. */
export function fallbackModelFor(p: AiProviderId): string | null {
  if (p !== "gemini") return null;
  const m = env.str("GEMINI_FALLBACK_MODEL", GEMINI_DEFAULT_FALLBACK_MODEL);
  return /^(none|off|false)$/i.test(m) || m === env.str(MODEL_ENV.gemini, AI_DEFAULT_MODELS.gemini) ? null : m;
}

export function apiKeyFor(p: Exclude<AiProviderId, "demo">): string | undefined {
  return env.get(KEY_ENV[p]);
}

// ── Limits & effort ────────────────────────────────────────────────────────────────────────────────────

export type AiEffort = "low" | "medium" | "high";

export const AI_FEATURES = ["ideas", "blueprint", "ad-copy", "narrative", "explain", "negatives", "chat-plan", "chat-answer", "repair", "smoke"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Default reasoning effort per feature (Opus 5.5 defaults to medium, so every call sets it explicitly). */
export const FEATURE_EFFORT: Record<AiFeature, AiEffort> = {
  ideas: "medium",
  blueprint: "medium",
  explain: "medium",
  "ad-copy": "low",
  narrative: "low",
  negatives: "low",
  "chat-plan": "low",
  "chat-answer": "low",
  repair: "low",
  smoke: "low",
};

/** AI_EFFORT overrides every feature when set to low | medium | high. */
export function effortFor(feature: AiFeature): AiEffort {
  const o = env.get("AI_EFFORT")?.toLowerCase();
  return o === "low" || o === "medium" || o === "high" ? o : FEATURE_EFFORT[feature];
}

export function aiLimits() {
  const perMinute = env.int("AI_RATE_LIMIT_PER_MIN", 10, 1, 10_000);
  return {
    perMinute,
    burst: Math.min(5, perMinute),
    daily: env.int("AI_DAILY_REQUEST_LIMIT", 300, 1, 1_000_000),
    maxConcurrency: env.int("AI_MAX_CONCURRENCY", 3, 1, 32),
    timeoutMs: env.int("AI_TIMEOUT_MS", 120_000, 5_000, 600_000),
  };
}

export const PROVIDER_LABELS: Record<AiProviderId, string> = { anthropic: "Anthropic", openai: "OpenAI", gemini: "Gemini", demo: "Demo engine" };
