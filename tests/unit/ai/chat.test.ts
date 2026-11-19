import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatPlanWire } from "@/lib/domain/ai/schemas";
import { clearAiCache } from "@/lib/server/ai/cache";
import { setProviderForTests } from "@/lib/server/ai/provider";
import { resetAiQuotaForTests } from "@/lib/server/ai/quota";
import { normalizeHistory, runChat } from "@/lib/server/ai/services/chat";
import type { AiProvider, GenerateObjectRequest, StreamChunk } from "@/lib/server/ai/types";
import { requestContext } from "@/lib/server/context";

// `connection()` needs a Next request scope; route handlers are otherwise plain (Request) => Response functions.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
const { POST } = await import("@/app/api/ai/chat/route");

interface Ev {
  event: string;
  data: Record<string, unknown>;
}

async function readSse(res: Response): Promise<Ev[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("event:"))
    .map((block) => {
      const [head, ...rest] = block.split("\n");
      return { event: (head ?? "").slice("event: ".length), data: JSON.parse(rest.join("\n").slice("data: ".length)) as Record<string, unknown> };
    });
}

const post = (body: unknown) => POST(new Request("http://localhost:3000/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

/** meta → plan → result… → delta… → suggestions → done, as a compact shape string. */
const shape = (evs: Ev[]) => evs.map((e) => e.event).join(",").replace(/(delta,)+delta/g, "delta+").replace(/delta(?=,)/g, "delta+").replace(/(result,)+result/g, "result+");

beforeEach(() => {
  clearAiCache();
  resetAiQuotaForTests();
});
afterEach(() => setProviderForTests(null));

describe("POST /api/ai/chat (demo engine)", () => {
  it("streams meta → plan → result → delta… → suggestions → done", async () => {
    const res = await post({ message: "top 5 campaigns by ROAS last 7 days" });
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const evs = await readSse(res);
    expect(shape(evs)).toBe("meta,plan,result,delta+,suggestions,done");
    const [meta, plan, result] = evs;
    expect(meta?.data).toMatchObject({ provider: "demo", mode: "demo", dataMode: "demo" });
    expect(plan?.data).toMatchObject({ intent: "query", planner: "nl-lite", queries: [{ id: "q1", chart: "bar", query: { metrics: ["roas", "cost", "conv_value"], limit: 5 } }] });
    const rows = (result?.data.result as { rows: Record<string, unknown>[] }).rows;
    expect(rows).toHaveLength(5);
    const roas = rows.map((r) => r.roas as number);
    expect([...roas].sort((a, b) => b - a)).toEqual(roas);
    const text = evs.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
    expect(text).toContain(String(rows[0]?.campaign));
    expect(evs.at(-1)?.data).toEqual({ model: null });
  });

  it("asks to clarify when the question is not about ad data", async () => {
    const evs = await readSse(await post({ message: "hello" }));
    expect(shape(evs)).toBe("meta,plan,delta+,suggestions,done");
    expect(evs[1]?.data).toMatchObject({ intent: "clarify", queries: [], planner: "nl-lite" });
    expect((evs.find((e) => e.event === "suggestions")?.data.prompts as string[]).length).toBeGreaterThan(0);
  });

  it("rejects invalid bodies with the JSON error envelope", async () => {
    const res = await post({ message: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});

function chatProvider(plan: (r: GenerateObjectRequest<unknown>) => ChatPlanWire, chunks: StreamChunk[]) {
  const calls: string[] = [];
  const provider: AiProvider = {
    id: "openai",
    model: "mock-gpt",
    async generateObject<T>(r: GenerateObjectRequest<T>) {
      calls.push(r.feature);
      return { object: r.schema.parse(plan(r as GenerateObjectRequest<unknown>)), model: "mock-gpt", stopReason: "completed", fallbackUsed: false };
    },
    async *streamText(r) {
      calls.push(`${r.feature}:${r.messages.at(-1)?.content.includes("<query_result") ? "results" : "none"}`);
      for (const c of chunks) yield c;
    },
  };
  return { provider, calls };
}

const q = (over: Partial<ChatPlanWire["queries"][number]> = {}): ChatPlanWire["queries"][number] => ({
  title: "Spend by device",
  chart: "bar",
  source: "google_ads",
  metrics: ["cost", "conversions"],
  dimensions: ["device"],
  dateRange: { preset: "last_7d", start: null, end: null },
  compare: "none",
  filters: [],
  having: [],
  sort: [{ key: "cost", dir: "desc" }],
  limit: null,
  ...over,
});

function writer() {
  const events: Ev[] = [];
  return { events, w: { closed: false, send: (event: string, data: unknown) => void events.push({ event, data: data as Record<string, unknown> }) } };
}

describe("runChat with an AI provider (mocked)", () => {
  it("plans with the AI, runs the queries and streams the AI answer", async () => {
    const m = chatProvider(() => ({ intent: "query", clarification: null, queries: [q()], suggestions: ["Same by country?"] }), [
      { type: "text", delta: "Mobile drives most spend" },
      { type: "text", delta: " this week." },
      { type: "done", model: "mock-gpt-2" },
    ]);
    setProviderForTests(m.provider);
    const { events, w } = writer();
    await runChat(w, await requestContext(), { message: "spend by device last week", history: [], context: {} }, new AbortController().signal);
    expect(shape(events)).toBe("meta,plan,result,delta+,suggestions,done");
    expect(events[0]?.data).toMatchObject({ provider: "openai", mode: "ai" });
    expect(events[1]?.data).toMatchObject({ planner: "ai", queries: [{ title: "Spend by device", query: { dimensions: ["device"], dateRange: { preset: "last_7d" } } }] });
    expect(events.filter((e) => e.event === "delta").map((e) => e.data.text).join("")).toBe("Mobile drives most spend this week.");
    expect(events.find((e) => e.event === "suggestions")?.data).toEqual({ prompts: ["Same by country?"] });
    expect(events.at(-1)?.data).toEqual({ model: "mock-gpt-2" });
    expect(m.calls).toEqual(["chat-plan", "chat-answer:results"]);
  });

  it("repairs an invalid plan once, then falls back to NL-lite; a failed answer is narrated from the numbers", async () => {
    const m = chatProvider(() => ({ intent: "query", clarification: null, queries: [q({ dimensions: ["hour", "device"] })], suggestions: [] }), [{ type: "error", code: "AI_UPSTREAM", message: "boom" }]);
    setProviderForTests(m.provider);
    const { events, w } = writer();
    await runChat(w, await requestContext(), { message: "clicks by device last 7 days", history: [], context: {} }, new AbortController().signal);
    expect(m.calls).toEqual(["chat-plan", "chat-plan", "chat-answer:results"]);
    expect(shape(events)).toBe("meta,notice,plan,result,notice,delta+,suggestions,done");
    expect(events[1]?.data.message).toMatch(/failed validation\. Using the rule-based parser instead\./);
    expect(events[2]?.data).toMatchObject({ planner: "nl-lite" });
    expect(events.find((e) => e.event === "delta")?.data.text).toMatch(/Clicks by device/);
    expect(events.at(-1)?.data).toEqual({ model: null });
  });

  it("keeps history to the last turns, starting with a user turn", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `${i} ${"x".repeat(900)}` }));
    const h = normalizeHistory([{ role: "assistant", content: "orphan" }, ...history]);
    expect(h[0]?.role).toBe("user");
    expect(h.reduce((s, m) => s + m.content.length, 0)).toBeLessThanOrEqual(8000);
    expect(h.at(-1)?.content.startsWith("11 ")).toBe(true);
  });
});
