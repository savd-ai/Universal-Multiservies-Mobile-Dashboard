import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiStatus, fallbackModelFor } from "@/lib/server/ai/config";
import { describeAiFailure } from "@/lib/server/ai/provider";
import { createGeminiProvider, mapGeminiError, nextPacificMidnight } from "@/lib/server/ai/providers/gemini";
import type { AiProvider, StreamChunk } from "@/lib/server/ai/types";
import { setClockForTests } from "@/lib/server/clock";

// Gemini on the free tier: 402 (billed project out of credit) and the kinds of 429 (daily, per-minute, no free quota)
// get their own messages; a request the main model can't take moves to the fallback model, and a model whose daily
// quota is gone is skipped until midnight Pacific time. The SDK is mocked: nothing here reaches Google.

const create = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create };
  },
}));

const MAIN = "gemini-3.8-flash";
const LITE = "gemini-3.5-flash-lite";

/** An error shaped like the SDK's APIError: status, parsed google.rpc body in `error`, raw JSON in `body`. */
function apiError(status: number, rpc: Record<string, unknown>) {
  const body = { error: { code: status, ...rpc } };
  return Object.assign(new Error(`${status} ${String(rpc.message ?? "")}`), { name: status === 429 ? "RateLimitError" : "APIError", status, statusCode: status, error: body, body: JSON.stringify(body) });
}

const quota = (quotaId: string, quotaValue: string, retryDelay?: string) =>
  apiError(429, {
    status: "RESOURCE_EXHAUSTED",
    message: `You exceeded your current quota.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: ${quotaValue}, model: ${MAIN}`,
    details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId, quotaValue }] }, ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : [])],
  });
const DAILY = () => quota("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "20");
const PER_MINUTE = () => quota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "5", "37s");
const NO_FREE_TIER = () => quota("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "0");
const BILLING = () => apiError(402, { status: "RESOURCE_EXHAUSTED", message: "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing." });

const answer = (model: string) => ({ status: "completed", model, output_text: JSON.stringify({ n: 1 }) });
const request = { feature: "smoke", system: [{ text: "sys" }], prompt: "p", schema: z.object({ n: z.number() }), schemaName: "t", effort: "low" as const };
const modelsAsked = () => create.mock.calls.map((c) => (c[0] as { model: string }).model);

async function provider(fallbackModel: string | null = LITE): Promise<AiProvider> {
  return createGeminiProvider({ apiKey: "test-key", model: MAIN, timeoutMs: 10_000, fallbackModel });
}

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

async function* events(model: string, text: string) {
  yield { event_type: "step.delta", delta: { type: "text", text } };
  yield { event_type: "interaction.completed", interaction: { model, status: "completed" } };
}

// 2026-10-09 12:00 UTC = 05:00 PDT → the daily quota resets at 2026-10-10 07:00 UTC
const NOON = new Date("2026-10-09T12:00:00Z");
let clock = NOON;
const saved = { ...process.env };

beforeEach(() => {
  create.mockReset();
  clock = NOON;
  setClockForTests(() => clock);
});
afterEach(() => {
  setClockForTests(undefined);
  process.env = { ...saved };
});

describe("Gemini errors", () => {
  it("names a billed project whose prepaid credit is used up (HTTP 402)", () => {
    const e = mapGeminiError(BILLING());
    expect(e).toMatchObject({ code: "AI_BILLING", detail: "402" });
    expect(describeAiFailure(e, "gemini")).toBe("Gemini refused the request: the API project has no credit left (HTTP 402) — top it up in AI Studio, or use a key from a project without billing (free tier).");
  });

  it("tells the daily, per-minute and no-free-quota 429s apart", () => {
    expect(mapGeminiError(DAILY())).toMatchObject({ code: "AI_RATE_LIMITED", detail: "daily" });
    expect(mapGeminiError(PER_MINUTE())).toMatchObject({ code: "AI_RATE_LIMITED", detail: "per_minute" });
    expect(mapGeminiError(NO_FREE_TIER())).toMatchObject({ code: "AI_RATE_LIMITED", detail: "no_free_tier" });
    expect(mapGeminiError(apiError(429, { message: "Resource has been exhausted" }))).toMatchObject({ code: "AI_RATE_LIMITED", detail: "429" });
    expect(describeAiFailure(mapGeminiError(DAILY()), "gemini")).toBe("Gemini's daily quota for this model is used up — it resets at midnight Pacific time.");
    expect(describeAiFailure(mapGeminiError(NO_FREE_TIER()), "gemini")).toBe("Gemini has no free-tier quota for this model — choose a model with free quota, or add billing.");
    expect(describeAiFailure(mapGeminiError(PER_MINUTE()), "gemini")).toBe("Gemini rate limit reached — try again in a minute.");
  });

  it("reads the raw body when the parsed one is missing, and maps an unknown model to 404", () => {
    const raw = Object.assign(new Error("429"), { status: 429, body: JSON.stringify({ error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "20" }] }] } }) });
    expect(mapGeminiError(raw).detail).toBe("daily");
    expect(mapGeminiError(apiError(404, { message: "models/gemini-9 is not found" }))).toMatchObject({ code: "AI_UPSTREAM", detail: "404" });
  });

  it("finds the next midnight Pacific time in summer and winter", () => {
    expect(new Date(nextPacificMidnight(NOON)).toISOString()).toBe("2026-10-10T07:00:00.000Z");
    expect(new Date(nextPacificMidnight(new Date("2026-12-01T12:00:00Z"))).toISOString()).toBe("2026-12-02T08:00:00.000Z");
    // 23:30 PST is still the same Pacific day
    expect(new Date(nextPacificMidnight(new Date("2026-12-02T07:30:00Z"))).toISOString()).toBe("2026-12-02T08:00:00.000Z");
  });
});

describe("Gemini fallback model", () => {
  it("answers with the fallback when the main model's daily quota is gone, and skips the main model until midnight Pacific", async () => {
    const p = await provider();
    create.mockRejectedValueOnce(DAILY()).mockResolvedValueOnce(answer(LITE));
    expect(await p.generateObject(request)).toMatchObject({ object: { n: 1 }, model: LITE, fallbackUsed: true });
    expect(modelsAsked()).toEqual([MAIN, LITE]);
    // the main model is not asked again today
    create.mockResolvedValueOnce(answer(LITE));
    await p.generateObject(request);
    expect(modelsAsked()).toEqual([MAIN, LITE, LITE]);
    // after the reset it is
    clock = new Date("2026-10-10T07:00:01Z");
    create.mockResolvedValueOnce(answer(MAIN));
    expect(await p.generateObject(request)).toMatchObject({ model: MAIN, fallbackUsed: false });
    expect(modelsAsked()).toEqual([MAIN, LITE, LITE, MAIN]);
  });

  it("gives the main model one quick retry only when another model can take over", async () => {
    const p = await provider();
    create.mockRejectedValueOnce(apiError(503, { status: "UNAVAILABLE", message: "The model is overloaded." })).mockResolvedValueOnce(answer(LITE));
    expect(await p.generateObject(request)).toMatchObject({ model: LITE, fallbackUsed: true });
    expect(create.mock.calls.map((c) => (c[1] as { maxRetries?: number }).maxRetries)).toEqual([1, undefined]);
    // a 503 pauses nothing: the next request starts on the main model again
    create.mockResolvedValueOnce(answer(MAIN));
    await p.generateObject(request);
    expect(modelsAsked()).toEqual([MAIN, LITE, MAIN]);
  });

  it("does not try another model for billing, a bad key or bad output", async () => {
    const p = await provider();
    create.mockRejectedValueOnce(BILLING());
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_BILLING" });
    create.mockRejectedValueOnce(apiError(403, { status: "PERMISSION_DENIED", message: "API key not valid" }));
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_AUTH" });
    create.mockResolvedValueOnce({ status: "completed", model: MAIN, output_text: "not json" });
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_BAD_OUTPUT" });
    expect(modelsAsked()).toEqual([MAIN, MAIN, MAIN]);
  });

  it("without a fallback, waits out a per-minute limit without calling Google", async () => {
    const p = await provider(null);
    create.mockRejectedValueOnce(PER_MINUTE());
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_RATE_LIMITED", detail: "per_minute" });
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_RATE_LIMITED", detail: "per_minute" });
    expect(create).toHaveBeenCalledTimes(1);
    // RetryInfo said 37 s
    clock = new Date(NOON.getTime() + 38_000);
    create.mockResolvedValueOnce(answer(MAIN));
    await expect(p.generateObject(request)).resolves.toMatchObject({ model: MAIN });
  });

  it("streams from the fallback model, with a notice, when the main model refuses the request", async () => {
    const p = await provider();
    create.mockRejectedValueOnce(NO_FREE_TIER()).mockResolvedValueOnce(events(LITE, "Hello"));
    const chunks = await collect(p.streamText({ feature: "smoke", system: [{ text: "sys" }], messages: [{ role: "user", content: "hi" }], effort: "low" }));
    expect(chunks).toEqual([
      { type: "notice", message: `Answering with fallback model ${LITE}.` },
      { type: "text", delta: "Hello" },
      { type: "done", model: LITE },
    ]);
    expect(modelsAsked()).toEqual([MAIN, LITE]);
  });

  it("reports the last model's error when both are out of quota", async () => {
    const p = await provider();
    create.mockRejectedValueOnce(DAILY()).mockRejectedValueOnce(DAILY());
    await expect(p.generateObject(request)).rejects.toMatchObject({ code: "AI_RATE_LIMITED", detail: "daily" });
    // both paused until midnight Pacific: no further calls today
    const chunks = await collect(p.streamText({ feature: "smoke", system: [{ text: "sys" }], messages: [{ role: "user", content: "hi" }], effort: "low" }));
    expect(chunks).toEqual([{ type: "error", code: "AI_RATE_LIMITED", message: "Gemini daily quota used up", detail: "daily" }]);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("Gemini fallback setting", () => {
  it("defaults to Flash-Lite, can be turned off, and is shown in the AI status", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    expect(fallbackModelFor("gemini")).toBe(LITE);
    expect(aiStatus()).toMatchObject({ provider: "gemini", model: MAIN, fallbacksEnabled: true, fallbackModel: LITE });
    process.env.GEMINI_FALLBACK_MODEL = "none";
    expect(aiStatus()).toMatchObject({ fallbacksEnabled: false, fallbackModel: null });
    process.env.GEMINI_FALLBACK_MODEL = MAIN;
    expect(fallbackModelFor("gemini")).toBeNull();
    expect(fallbackModelFor("anthropic")).toBeNull();
  });
});
