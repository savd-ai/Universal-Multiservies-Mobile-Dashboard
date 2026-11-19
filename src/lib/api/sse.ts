"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ChatChart, ChatEvent, ChatPlanQuery } from "@/lib/domain/contracts/ai";
import type { QueryResult } from "@/lib/domain/query/spec";
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/domain/types";
import { ApiError } from "./client";
import { useAccountId, useDashboards } from "./hooks";

// Server-Sent Events over POST (EventSource can only GET): an incremental frame parser (event/data/id/retry
// fields, multi-line data, comments/heartbeats, CRLF/CR/LF, frames split across chunks), a fetch + TextDecoderStream
// client with AbortController support, and the Ask-your-data chat state (reducer + useChatStream hook).

// ── Frame parser ─────────────────────────────────────────────────────────────────────────────────────

export interface SseMessage {
  /** event type ("message" when the frame had no `event:` field) */
  event: string;
  /** data lines joined with "\n" */
  data: string;
  /** last event id seen on the stream ("" if none) */
  id: string;
}

/** Incremental parser per the WHATWG event-stream rules. Feed decoded text with push(); call flush() at EOF. */
export class SseParser {
  private partial = "";
  private skipLf = false;
  private bomChecked = false;
  private dataLines: string[] = [];
  private eventType = "";
  private lastId = "";
  /** reconnection time from the last valid `retry:` field */
  retry: number | null = null;

  push(chunk: string): SseMessage[] {
    const out: SseMessage[] = [];
    if (!chunk) return out;
    let text = chunk;
    if (!this.bomChecked) {
      this.bomChecked = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    let i = 0;
    // a CR ended the previous chunk: an LF right after it is the same line break
    if (this.skipLf) {
      this.skipLf = false;
      if (text.charCodeAt(0) === 10) i = 1;
    }
    let start = i;
    for (; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c !== 10 && c !== 13) continue;
      this.line(this.partial + text.slice(start, i), out);
      this.partial = "";
      if (c === 13) {
        if (i + 1 < text.length) {
          if (text.charCodeAt(i + 1) === 10) i++;
        } else this.skipLf = true;
      }
      start = i + 1;
    }
    if (start < text.length) this.partial += text.slice(start);
    return out;
  }

  /** End of stream: a trailing line is processed and a final event without its blank line is still delivered. */
  flush(): SseMessage[] {
    const out: SseMessage[] = [];
    if (this.partial) {
      this.line(this.partial, out);
      this.partial = "";
    }
    this.dispatch(out);
    this.skipLf = false;
    return out;
  }

  private line(line: string, out: SseMessage[]): void {
    if (line === "") return this.dispatch(out);
    if (line.charCodeAt(0) === 58) return; // ":" comment — heartbeats
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.charCodeAt(0) === 32) value = value.slice(1);
    if (field === "event") this.eventType = value;
    else if (field === "data") this.dataLines.push(value);
    else if (field === "id") {
      if (!value.includes("\0")) this.lastId = value;
    } else if (field === "retry") {
      if (/^\d+$/.test(value)) this.retry = Number(value);
    }
  }

  private dispatch(out: SseMessage[]): void {
    if (this.dataLines.length === 0) {
      this.eventType = "";
      return;
    }
    out.push({ event: this.eventType || "message", data: this.dataLines.join("\n"), id: this.lastId });
    this.dataLines = [];
    this.eventType = "";
  }
}

/** Parse a complete event-stream text (tests, fixtures). */
export function parseSseText(text: string): SseMessage[] {
  const p = new SseParser();
  return [...p.push(text), ...p.flush()];
}

// ── POST client ──────────────────────────────────────────────────────────────────────────────────────

export interface SseEvent {
  event: string;
  /** JSON-decoded data (the raw string when it isn't JSON) */
  data: unknown;
  id: string;
}

function abortError(): Error {
  return typeof DOMException !== "undefined" ? new DOMException("The stream was aborted", "AbortError") : Object.assign(new Error("The stream was aborted"), { name: "AbortError" });
}

export function isAbortError(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === "AbortError";
}

function decode(m: SseMessage): SseEvent {
  let data: unknown = m.data;
  try {
    data = JSON.parse(m.data);
  } catch {
    /* keep the raw text */
  }
  return { event: m.event, data, id: m.id };
}

/**
 * POST a JSON body and iterate the SSE response. Non-2xx answers throw ApiError with the server's {error} body;
 * aborting the signal throws an AbortError (also after the server closed the stream, so callers can tell stop from
 * a normal end).
 */
export async function* postSse(path: string, body: unknown, opts: { signal?: AbortSignal; headers?: Record<string, string> } = {}): AsyncGenerator<SseEvent> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...opts.headers },
      body: JSON.stringify(body),
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (isAbortError(err) || opts.signal?.aborted) throw abortError();
    throw new ApiError(0, "network", "Network error — is the dashboard server running?");
  }
  if (!res.ok) {
    let e: { code?: string; message?: string; details?: unknown; retryAfterSec?: number } | undefined;
    try {
      e = ((await res.json()) as { error?: typeof e })?.error;
    } catch {
      /* not JSON */
    }
    const retryHeader = Number(res.headers.get("retry-after"));
    throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? (res.statusText || "Request failed"), e?.details, e?.retryAfterSec ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined));
  }
  if (!res.body) throw new ApiError(0, "network", "The server returned an empty stream");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const parser = new SseParser();
  let finished = false;
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<string>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (isAbortError(err) || opts.signal?.aborted) throw abortError();
        throw new ApiError(0, "network", "The connection dropped while the answer was streaming.");
      }
      if (chunk.done) break;
      for (const m of parser.push(chunk.value)) yield decode(m);
      if (opts.signal?.aborted) throw abortError();
    }
    finished = true;
    for (const m of parser.flush()) yield decode(m);
    if (opts.signal?.aborted) throw abortError();
  } finally {
    // consumer stopped early (break / abort): close the connection
    if (!finished) void reader.cancel().catch(() => undefined);
  }
}

// ── Ask-your-data chat state ─────────────────────────────────────────────────────────────────────────

type EventData<K extends ChatEvent["event"]> = Extract<ChatEvent, { event: K }>["data"];

export type ChatMeta = EventData<"meta">;
export type ChatPlan = EventData<"plan">;

export interface ChatResultItem {
  index: number;
  chart: ChatChart;
  result: QueryResult;
}

export interface ChatError {
  code: string;
  message: string;
  status?: number;
  retryAfterSec?: number;
}

export type ChatStatus = "pending" | "streaming" | "done" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** user text, or the assistant's markdown answer (partial while streaming) */
  content: string;
  status: ChatStatus;
  results: ChatResultItem[];
  notices: string[];
  plan?: ChatPlan;
  meta?: ChatMeta;
  suggestions?: string[];
  model?: string | null;
  error?: ChatError;
}

export interface ChatState {
  messages: ChatMessage[];
  /** latest provider/model info (the drawer chip) */
  meta: ChatMeta | null;
}

export const INITIAL_CHAT: ChatState = { messages: [], meta: null };

export type ChatAction =
  | { type: "send"; user: ChatMessage; assistant: ChatMessage; keep?: number }
  | { type: "event"; id: string; event: ChatEvent }
  | { type: "end"; id: string }
  | { type: "stop"; id: string }
  | { type: "fail"; id: string; error: ChatError }
  | { type: "reset" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";

/** Validate a decoded SSE event against the chat contract; unknown or malformed events are dropped. */
export function toChatEvent(e: { event: string; data: unknown }): ChatEvent | null {
  const d = e.data;
  if (!isObj(d)) return null;
  switch (e.event) {
    case "meta":
      return str(d.provider) ? ({ event: "meta", data: d } as ChatEvent) : null;
    case "plan":
      return Array.isArray(d.queries) ? ({ event: "plan", data: d } as ChatEvent) : null;
    case "result":
      return typeof d.index === "number" && isObj(d.chart) && isObj(d.result) && Array.isArray((d.result as { rows?: unknown }).rows) ? ({ event: "result", data: d } as ChatEvent) : null;
    case "delta":
      return str(d.text) ? { event: "delta", data: { text: d.text } } : null;
    case "notice":
      return str(d.message) ? { event: "notice", data: { message: d.message } } : null;
    case "suggestions":
      return Array.isArray(d.prompts) ? { event: "suggestions", data: { prompts: d.prompts.filter(str).slice(0, 6) } } : null;
    case "done":
      return { event: "done", data: { model: str(d.model) ? d.model : null } };
    case "error":
      return { event: "error", data: { code: str(d.code) ? d.code : "ERROR", message: str(d.message) ? d.message : "The answer failed." } };
    default:
      return null;
  }
}

const active = (m: ChatMessage) => m.status === "pending" || m.status === "streaming";

function patchMessage(state: ChatState, id: string, fn: (m: ChatMessage) => ChatMessage): ChatState {
  let changed = false;
  const messages = state.messages.map((m) => {
    if (m.id !== id) return m;
    const next = fn(m);
    if (next !== m) changed = true;
    return next;
  });
  return changed ? { ...state, messages } : state;
}

function applyEvent(m: ChatMessage, ev: ChatEvent): ChatMessage {
  if (!active(m)) return m; // late events after stop/error are ignored
  switch (ev.event) {
    case "meta":
      return { ...m, meta: ev.data };
    case "plan":
      return { ...m, plan: ev.data, notices: ev.data.notes?.length ? [...m.notices, ...ev.data.notes] : m.notices };
    case "result": {
      const item: ChatResultItem = { index: ev.data.index, chart: ev.data.chart, result: ev.data.result as QueryResult };
      const results = [...m.results.filter((r) => r.index !== item.index), item].sort((a, b) => a.index - b.index);
      return { ...m, results };
    }
    case "delta":
      return { ...m, status: "streaming", content: m.content + ev.data.text };
    case "notice":
      return { ...m, notices: [...m.notices, ev.data.message] };
    case "suggestions":
      return { ...m, suggestions: ev.data.prompts };
    case "done":
      return { ...m, status: "done", model: ev.data.model };
    case "error":
      return { ...m, status: "error", error: { code: ev.data.code, message: ev.data.message } };
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send": {
      const base = action.keep === undefined ? state.messages : state.messages.slice(0, action.keep);
      return { ...state, messages: [...base, action.user, action.assistant] };
    }
    case "event": {
      const next = patchMessage(state, action.id, (m) => applyEvent(m, action.event));
      return action.event.event === "meta" ? { ...next, meta: action.event.data } : next;
    }
    case "end":
      return patchMessage(state, action.id, (m) => {
        if (!active(m)) return m;
        if (m.content.trim() || m.results.length) return { ...m, status: "done" };
        return { ...m, status: "error", error: { code: "STREAM_ENDED", message: "The answer ended before any text arrived." } };
      });
    case "stop":
      return patchMessage(state, action.id, (m) => (active(m) ? { ...m, status: "stopped" } : m));
    case "fail":
      return patchMessage(state, action.id, (m) => (m.status === "done" ? m : { ...m, status: "error", error: action.error }));
    case "reset":
      return INITIAL_CHAT;
  }
}

export const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 12;
const MAX_HISTORY_CHARS = 8000;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Prior turns for the request: user turns plus finished (or stopped) answers that have text; last 12. */
export function buildHistory(messages: readonly ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: clip(m.content, MAX_HISTORY_CHARS) });
    else if ((m.status === "done" || m.status === "stopped") && m.content.trim()) out.push({ role: "assistant", content: clip(m.content, MAX_HISTORY_CHARS) });
  }
  return out.slice(-MAX_HISTORY);
}

// ── Page context ─────────────────────────────────────────────────────────────────────────────────────

/** Where the question was asked: page, dashboard, open campaign and the URL slicers (enums only, as the API requires). */
export interface ChatContextPayload {
  page?: string;
  dashboardId?: string;
  campaignId?: string;
  range?: string;
  compare?: "prev" | "yoy";
  types?: CampaignType[];
}

const fit = (v: string | null | undefined, max: number): string | undefined => (v && v.length <= max ? v : undefined);

function segment(pathname: string, prefix: string): string | null {
  const m = new RegExp(`^/${prefix}/([^/?#]+)`).exec(pathname);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export function chatContextFrom(input: { pathname: string; search: { get(name: string): string | null } | null; defaultDashboardId?: string | null }): ChatContextPayload {
  const { pathname, search } = input;
  const get = (k: string) => search?.get(k) ?? null;
  const onDefaultDashboard = pathname === "/" || pathname === "/overview";
  const dashboardId = segment(pathname, "overview") ?? (onDefaultDashboard ? (input.defaultDashboardId ?? null) : null);
  const campaignId = get("campaign") || segment(pathname, "campaigns");
  const rangeKey = get("range") || "30d";
  const from = get("from");
  const to = get("to");
  const range = rangeKey === "custom" && from && to ? `${from}..${to}` : rangeKey;
  // URL default is "prev"; "off" (and anything unknown) is omitted
  const cmp = get("cmp") || "prev";
  const types = [...new Set((get("types") ?? "").split(",").filter((t): t is CampaignType => (CAMPAIGN_TYPES as readonly string[]).includes(t)))].slice(0, 8);
  const ctx: ChatContextPayload = {
    page: pathname.slice(0, 64) || "/",
    dashboardId: fit(dashboardId, 64),
    campaignId: fit(campaignId, 64),
    range: fit(range, 32),
    compare: cmp === "prev" || cmp === "yoy" ? cmp : undefined,
    types: types.length ? types : undefined,
  };
  return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== undefined)) as ChatContextPayload;
}

// ── Hook ─────────────────────────────────────────────────────────────────────────────────────────────

let seq = 0;
const newMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({ id: `m${++seq}-${Date.now().toString(36)}`, role, content, status: role === "user" ? "done" : "pending", results: [], notices: [] });

function toChatError(err: unknown): ChatError {
  if (err instanceof ApiError) {
    const message = err.status === 429 ? `AI rate limit reached${err.retryAfterSec ? ` — try again in ${err.retryAfterSec}s` : ""}.` : err.message;
    return { code: err.code, message, status: err.status, retryAfterSec: err.retryAfterSec };
  }
  return { code: "NETWORK", message: (err as Error)?.message || "The connection dropped." };
}

/**
 * Ask-your-data conversation: send (with prior turns and the page context), stop (keeps the partial answer),
 * retry the last question, reset. One stream at a time; a new question aborts the running one.
 */
export function useChatStream() {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT);
  const pathname = usePathname();
  const search = useSearchParams();
  const dashboards = useDashboards();
  const account = useAccountId();
  const defaultDashboardId = dashboards.data?.find((d) => d.isDefault)?.id ?? dashboards.data?.[0]?.id ?? null;
  const context = useMemo(() => chatContextFrom({ pathname, search, defaultDashboardId }), [pathname, search, defaultDashboardId]);

  const latest = useRef({ state, context, account });
  useEffect(() => {
    latest.current = { state, context, account };
  });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (raw: string, keep?: number) => {
    const message = raw.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!message) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { state: s, context: ctx, account: acct } = latest.current;
    const history = buildHistory(keep === undefined ? s.messages : s.messages.slice(0, keep));
    const user = newMessage("user", message);
    const assistant = newMessage("assistant", "");
    dispatch({ type: "send", user, assistant, keep });
    try {
      const headers = acct ? { "x-savd-account": acct } : undefined;
      for await (const e of postSse("/api/ai/chat", { message, history, context: ctx }, { signal: controller.signal, headers })) {
        const ev = toChatEvent(e);
        if (ev) dispatch({ type: "event", id: assistant.id, event: ev });
      }
      dispatch({ type: "end", id: assistant.id });
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) dispatch({ type: "stop", id: assistant.id });
      else dispatch({ type: "fail", id: assistant.id, error: toChatError(err) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const send = useCallback((text: string) => void run(text), [run]);
  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);
  /** Re-ask the question behind an answer (default: the last one); that answer and anything after it is replaced. */
  const retry = useCallback(
    (assistantId?: string) => {
      const msgs = latest.current.state.messages;
      let ai = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m && m.role === "assistant" && (!assistantId || m.id === assistantId)) {
          ai = i;
          break;
        }
      }
      let ui = ai - 1;
      while (ui >= 0 && msgs[ui]?.role !== "user") ui--;
      const question = ui >= 0 ? msgs[ui] : undefined;
      if (question) void run(question.content, ui);
    },
    [run],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const last = state.messages[state.messages.length - 1];
  const streaming = !!last && last.role === "assistant" && active(last);
  return { messages: state.messages, meta: state.meta, streaming, context, send, stop, retry, reset };
}

export type { ChatPlanQuery };
