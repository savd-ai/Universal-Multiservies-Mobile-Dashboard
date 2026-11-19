import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { parseSseText, postSse, SseParser, type SseMessage } from "@/lib/api/sse";

// Frame parser (WHATWG event-stream rules) and the fetch/TextDecoderStream POST client.

const ev = (event: string, data: string, id = ""): SseMessage => ({ event, data, id });

function feed(chunks: string[]): SseMessage[] {
  const p = new SseParser();
  const out: SseMessage[] = [];
  for (const c of chunks) out.push(...p.push(c));
  out.push(...p.flush());
  return out;
}

const STREAM = [
  "event: meta",
  'data: {"provider":"demo","model":null}',
  "",
  ": ping",
  "",
  "event: delta",
  'data: {"text":"**Top 5**\\n1. Brand"}',
  "",
  "event: delta",
  "data: line one",
  "data: line two",
  "",
  "event: done",
  'data: {"model":null}',
  "",
  "",
].join("\n");

const EXPECTED = [ev("meta", '{"provider":"demo","model":null}'), ev("delta", '{"text":"**Top 5**\\n1. Brand"}'), ev("delta", "line one\nline two"), ev("done", '{"model":null}')];

describe("SseParser", () => {
  it("parses named events with JSON data", () => {
    expect(parseSseText('event: meta\ndata: {"a":1}\n\n')).toEqual([ev("meta", '{"a":1}')]);
  });

  it("defaults the event type to message and resets it after each dispatch", () => {
    expect(parseSseText("event: a\ndata: 1\n\ndata: 2\n\n")).toEqual([ev("a", "1"), ev("message", "2")]);
  });

  it("joins multi-line data with newlines", () => {
    expect(parseSseText("data: line1\ndata: line2\ndata:\ndata: line4\n\n")).toEqual([ev("message", "line1\nline2\n\nline4")]);
  });

  it("ignores comment lines (heartbeats) anywhere", () => {
    expect(parseSseText(": ping\n\n")).toEqual([]);
    expect(parseSseText(": ping\n\nevent: x\n: inside a frame\ndata: y\n\n: ping\n\n")).toEqual([ev("x", "y")]);
  });

  it("does not dispatch frames without data, and their event type does not leak", () => {
    expect(parseSseText("event: a\n\n")).toEqual([]);
    expect(parseSseText("event: a\n\ndata: 2\n\n")).toEqual([ev("message", "2")]);
  });

  it("dispatches an empty data field as an empty string", () => {
    expect(parseSseText("data\n\n")).toEqual([ev("message", "")]);
    expect(parseSseText("data:\n\n")).toEqual([ev("message", "")]);
  });

  it("strips exactly one space after the colon", () => {
    expect(parseSseText("data:x\n\n")).toEqual([ev("message", "x")]);
    expect(parseSseText("data:  x\n\n")).toEqual([ev("message", " x")]);
    expect(parseSseText("data: a: b\n\n")).toEqual([ev("message", "a: b")]);
  });

  it("ignores unknown fields", () => {
    expect(parseSseText("foo: bar\ndata: 1\nbaz\n\n")).toEqual([ev("message", "1")]);
  });

  it("tracks id (persisting across events) and a numeric retry", () => {
    const p = new SseParser();
    const out = [...p.push("id: 7\nretry: 3000\ndata: x\n\ndata: y\n\nretry: soon\nid: a\0b\ndata: z\n\n"), ...p.flush()];
    expect(out).toEqual([ev("message", "x", "7"), ev("message", "y", "7"), ev("message", "z", "7")]);
    expect(p.retry).toBe(3000);
  });

  it("accepts CRLF, CR and LF line endings", () => {
    expect(parseSseText("event: a\r\ndata: 1\r\n\r\n")).toEqual([ev("a", "1")]);
    expect(parseSseText("event: a\rdata: 1\r\r")).toEqual([ev("a", "1")]);
    expect(parseSseText("event: a\ndata: 1\r\n\rdata: 2\n\n")).toEqual([ev("a", "1"), ev("message", "2")]);
  });

  it("strips a leading BOM", () => {
    expect(parseSseText("﻿data: 1\n\n")).toEqual([ev("message", "1")]);
    expect(feed(["", "﻿data: 1\n\n"])).toEqual([ev("message", "1")]);
  });

  it("yields the same events for every two-way split of the stream", () => {
    for (let i = 0; i <= STREAM.length; i++) expect(feed([STREAM.slice(0, i), STREAM.slice(i)])).toEqual(EXPECTED);
  });

  it("yields the same events when fed one character at a time (LF and CRLF)", () => {
    expect(feed([...STREAM])).toEqual(EXPECTED);
    expect(feed([...STREAM.replace(/\n/g, "\r\n")])).toEqual(EXPECTED);
  });

  it("treats a CRLF split across chunks as one line break", () => {
    // wrong handling would turn the LF into a blank line and dispatch "a" and "b" separately
    expect(feed(["data: a\r", "\ndata: b\r\n\r\n"])).toEqual([ev("message", "a\nb")]);
    expect(feed(["data: a\r", "", "\ndata: b\r\n\r\n"])).toEqual([ev("message", "a\nb")]);
    // a CR followed by a chunk starting with CR is a line break plus a blank line
    expect(feed(["data: a\r", "\rdata: b\n\n"])).toEqual([ev("message", "a"), ev("message", "b")]);
  });

  it("buffers a partial line until its terminator arrives", () => {
    const p = new SseParser();
    expect(p.push('event: delta\ndata: {"te')).toEqual([]);
    expect(p.push('xt":"hi"}')).toEqual([]);
    expect(p.push("\n")).toEqual([]);
    expect(p.push("\n")).toEqual([ev("delta", '{"text":"hi"}')]);
  });

  it("delivers a trailing frame without its blank line on flush", () => {
    const p = new SseParser();
    expect(p.push("event: done\ndata: {}")).toEqual([]);
    expect(p.flush()).toEqual([ev("done", "{}")]);
    expect(p.flush()).toEqual([]);
  });
});

// ── postSse ──────────────────────────────────────────────────────────────────────────────────────────

function byteStream(text: string, size: number, opts: { hold?: boolean; signal?: AbortSignal } = {}): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      if (!opts.hold) controller.close();
      opts.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    },
  });
}

async function collect(gen: AsyncGenerator<{ event: string; data: unknown }>) {
  const out: { event: string; data: unknown }[] = [];
  for await (const e of gen) out.push({ event: e.event, data: e.data });
  return out;
}

describe("postSse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs JSON, decodes UTF-8 split across byte chunks and JSON-parses data", async () => {
    const text = 'event: delta\ndata: {"text":"héllo — ✓ 東京"}\n\n: ping\n\nevent: note\ndata: plain text\n\nevent: done\ndata: {"model":null}\n\n';
    const fetchMock = vi.fn(async () => new Response(byteStream(text, 3), { headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const events = await collect(postSse("/api/ai/chat", { message: "hi" }, { headers: { "x-savd-account": "123" } }));
    expect(events).toEqual([
      { event: "delta", data: { text: "héllo — ✓ 東京" } },
      { event: "note", data: "plain text" },
      { event: "done", data: { model: null } },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ai/chat");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"message":"hi"}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", Accept: "text/event-stream", "x-savd-account": "123" });
  });

  it("throws ApiError with the server's error body for non-2xx answers", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Slow down", retryAfterSec: 12 } }), { status: 429, headers: { "Content-Type": "application/json" } }));
    const err = await collect(postSse("/x", {})).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "RATE_LIMITED", message: "Slow down", retryAfterSec: 12 });
  });

  it("maps network failures to ApiError(0)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const err = await collect(postSse("/x", {})).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: "network" });
  });

  it("throws AbortError when the signal aborts mid-stream, after yielding what arrived", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => new Response(byteStream('event: delta\ndata: {"text":"par"}\n\n', 64, { hold: true, signal: init.signal ?? undefined })));
    const seen: unknown[] = [];
    const err = await (async () => {
      for await (const e of postSse("/x", {}, { signal: controller.signal })) {
        seen.push(e.data);
        controller.abort();
      }
    })().catch((e: unknown) => e);
    expect(seen).toEqual([{ text: "par" }]);
    expect((err as Error).name).toBe("AbortError");
  });

  it("throws AbortError even if the server closed the stream right after the abort", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", async () => new Response(byteStream('data: {"a":1}\n\ndata: {"a":2}\n\n', 64)));
    const err = await (async () => {
      for await (const _ of postSse("/x", {}, { signal: controller.signal })) controller.abort();
    })().catch((e: unknown) => e);
    expect((err as Error).name).toBe("AbortError");
  });
});
