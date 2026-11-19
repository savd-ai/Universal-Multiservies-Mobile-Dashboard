"use client";

import { useEffect, useId, useRef, useState } from "react";
import { navFor } from "@/components/shell/nav-config";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { Drawer, Tooltip } from "@/components/ui/overlays";
import { CharCounter, Dot, Kbd } from "@/components/ui/status";
import { Markdown } from "@/features/widgets/bespoke/markdown";
import { useAiStatus } from "@/lib/api/analytics";
import { useCatalog, type Catalog } from "@/lib/api/hooks";
import { MAX_MESSAGE_CHARS, useChatStream, type ChatContextPayload, type ChatMessage, type ChatMeta } from "@/lib/api/sse";
import { RANGE_LABELS, type RangeKey } from "@/lib/filters";
import { useUi } from "@/stores/ui";
import { ChatResultCard } from "./chat-result";
import { DEFAULT_PROMPTS, providerLabel, streamPhase } from "./chat-model";

// Global "Ask your data" drawer (⌘J / header "Ask AI"): non-modal, so the page stays usable while answers stream.
// Answers are markdown; every `result` event renders inline with Explore / dashboard actions. The conversation lives
// here (not in the drawer body) so closing the drawer keeps it.

export function ChatDrawer() {
  const open = useUi((s) => s.chatOpen);
  const seed = useUi((s) => s.chatSeed);
  const closeChat = useUi((s) => s.closeChat);
  const chat = useChatStream();
  const { send } = chat;
  const [draft, setDraft] = useState("");
  const consumed = useRef<string | null>(null);

  // A seeded open ("Ask AI: …" in the palette, "Ask AI why" buttons) asks right away; the seed is consumed (the ref
  // guards the Strict Mode double effect on mount).
  useEffect(() => {
    if (!seed) {
      consumed.current = null;
      return;
    }
    if (!open || consumed.current === seed) return;
    consumed.current = seed;
    useUi.setState({ chatSeed: null });
    send(seed);
  }, [open, seed, send]);

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? undefined : closeChat())} modal={false} width={520} eyebrow="Ask AI · ⌘J" title="Ask your data">
      <ChatPanel chat={chat} draft={draft} setDraft={setDraft} />
    </Drawer>
  );
}

type Chat = ReturnType<typeof useChatStream>;

function ProviderChip({ meta }: { meta: ChatMeta | null }) {
  const status = useAiStatus();
  const info = meta ?? (status.data ? { provider: status.data.provider, model: status.data.model, mode: status.data.provider === "demo" ? ("demo" as const) : ("ai" as const), fallbackReason: status.data.reason } : null);
  const reason = info?.fallbackReason;
  const chip = (
    <span className="inline-flex items-center gap-2 rounded-pill border border-teal/30 px-3 py-1 text-[11px] text-accent" tabIndex={reason ? 0 : undefined}>
      <Dot size={6} />
      {info ? providerLabel(info) : "Connecting…"}
    </span>
  );
  return reason ? <Tooltip content={reason}>{chip}</Tooltip> : chip;
}

function contextLine(ctx: ChatContextPayload): string {
  const page = navFor(ctx.page ?? "/")?.label ?? "Overview";
  const range = ctx.range && ctx.range in RANGE_LABELS ? RANGE_LABELS[ctx.range as RangeKey] : ctx.range?.replace("..", " → ");
  return [page, range].filter(Boolean).join(" · ");
}

function ChatPanel({ chat, draft, setDraft }: { chat: Chat; draft: string; setDraft: (v: string) => void }) {
  const { messages, meta, streaming, context, send, stop, retry, reset } = chat;
  const catalog = useCatalog();
  const inputId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // follow the stream while the reader is at the bottom
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const ask = (text: string) => {
    if (!text.trim() || streaming) return;
    pinned.current = true;
    send(text);
    setDraft("");
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="-mt-1.5 flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderChip meta={meta} />
        <span className="flex-1" />
        {messages.length ? (
          <Button variant="ghost" size="xs" onClick={reset}>
            New chat
          </Button>
        ) : null}
      </div>

      <div ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-busy={streaming} aria-label="Conversation" className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5 sm:-mx-7 sm:px-7">
        {messages.length === 0 ? (
          <Intro onPick={ask} />
        ) : (
          <div className="flex flex-col gap-5 pb-2">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-[14px] rounded-br-[4px] border border-teal/30 bg-teal/6 px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-fg">
                  {m.content}
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} catalog={catalog.data} onRetry={() => retry(m.id)} onPick={ask} showSuggestions={m.id === lastAssistant?.id && !streaming} />
              ),
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex flex-col gap-2 rounded-mini border border-line bg-fill p-2.5 transition-colors focus-within:border-accent/60"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask a question about your account data
        </label>
        <textarea
          id={inputId}
          autoFocus
          value={draft}
          maxLength={MAX_MESSAGE_CHARS}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              ask(draft);
            }
          }}
          placeholder="Ask about spend, CPA, ROAS, devices, search terms…"
          className="max-h-40 min-h-11 resize-none bg-transparent px-1.5 text-[13.5px] leading-relaxed text-fg outline-none [field-sizing:content] placeholder:text-faint"
        />
        <div className="flex items-center gap-2 px-1">
          <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-micro tracking-label text-faint uppercase" title="Sent with your question">
            {contextLine(context)}
          </span>
          <span className="flex-1" />
          {draft.length > MAX_MESSAGE_CHARS * 0.9 ? <CharCounter length={draft.length} max={MAX_MESSAGE_CHARS} /> : null}
          <span className="hidden items-center gap-1 text-[11px] text-faint sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </span>
          {streaming ? (
            <Button variant="outline" size="xs" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="accent" size="xs" disabled={!draft.trim()}>
              Send →
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Intro({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-5 pt-1 pb-2">
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">
        Ask about spend, conversions, CPA, ROAS, devices or search terms. Every number comes from a query on your account — open any chart in Explore or pin it to a dashboard.
      </p>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Try asking</span>
        {DEFAULT_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="flex items-center justify-between gap-3 rounded-mini border border-line bg-fill px-3.5 py-2.5 text-left text-[13px] text-fg transition-colors hover:border-teal/40 hover:text-accent"
          >
            {p}
            <span aria-hidden className="text-accent">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantMessage({ m, catalog, onRetry, onPick, showSuggestions }: { m: ChatMessage; catalog: Catalog | undefined; onRetry: () => void; onPick: (text: string) => void; showSuggestions: boolean }) {
  const phase = streamPhase(m);
  const streamingText = m.status === "streaming" && !!m.content;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 font-mono text-micro tracking-label text-faint uppercase">
        <Dot size={6} tone={m.status === "error" ? "crit" : "accent"} />
        <span>{m.meta ? providerLabel(m.meta) : "Ask AI"}</span>
        {m.plan ? <span>· {m.plan.planner === "ai" ? "AI planner" : "rule-based parser"}</span> : null}
        {m.results.length ? <span>· {m.results.length === 1 ? "1 query" : `${m.results.length} queries`}</span> : null}
      </div>
      {m.notices.map((n, i) => (
        <div key={i} className="flex items-start gap-2 rounded-mini border border-warn/30 bg-warn-t/40 px-3 py-2 text-xs leading-normal text-muted" role="note">
          <Dot tone="warn" size={6} className="mt-1" />
          <span>{n}</span>
        </div>
      ))}
      {m.results.map((r) => (
        <ChatResultCard key={r.index} item={r} catalog={catalog} />
      ))}
      {m.content ? (
        <div className="text-[13.5px] leading-relaxed text-muted">
          <Markdown text={m.content} />
          {streamingText ? <span aria-hidden className="mt-1 inline-block size-1.5 animate-pulse rounded-full bg-accent" /> : null}
        </div>
      ) : null}
      {phase ? (
        <div className="flex items-center gap-2 text-xs text-muted-3">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-accent" />
          {phase}
        </div>
      ) : null}
      {m.status === "stopped" ? (
        <div className="flex items-center gap-3 text-xs text-muted-3">
          <span>Stopped — the partial answer is kept.</span>
          <Button variant="link" className="text-xs" onClick={onRetry}>
            Retry ↻
          </Button>
        </div>
      ) : null}
      {m.status === "error" && m.error ? <ErrorState error={{ status: m.error.status, message: m.error.message, retryAfterSec: m.error.retryAfterSec }} onRetry={onRetry} /> : null}
      {showSuggestions && m.suggestions?.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Follow-up questions">
          {m.suggestions.map((p) => (
            <Chip key={p} tone="add" onClick={() => onPick(p)} className="text-left whitespace-normal">
              {p}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
