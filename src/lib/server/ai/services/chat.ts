import "server-only";
import type { ChatChart, ChatEvent, ChatPlanQuery, ChatRequest } from "@/lib/domain/contracts/ai";
import { MAX_ROWS_TO_MODEL, MAX_ROWS_TO_UI, validatePlan, validateSpec, type PlannedQuery } from "@/lib/domain/ai/chat-plan";
import { followUps, narrateResults } from "@/lib/domain/ai/demo-engine";
import { parseNlQuery } from "@/lib/domain/ai/nl-lite";
import { sanitizeBlock, sanitizeText, wrapData } from "@/lib/domain/ai/prompt-safety";
import { CHAT_ANSWER_RULES, chatPlanPrompt } from "@/lib/domain/ai/prompts";
import { buildChatPlanSchema, type ChatPlanWire } from "@/lib/domain/ai/schemas";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import { QueryError } from "@/lib/domain/query/engine";
import type { QueryResult } from "@/lib/domain/query/spec";
import type { RequestContext } from "../../context";
import { log } from "../../log";
import { runQuery } from "../../query/service";
import { effortFor, resolveAiProvider } from "../config";
import { describeAiFailure, getProvider } from "../provider";
import { systemBlocks } from "../run";
import { buildSnapshot } from "../snapshot";
import { AiError, toAiError, type AiProvider, type ChatTurn } from "../types";

// Ask-your-data over SSE: meta → plan → result… → delta… → suggestions → done (notice/error in between).
// Step 1 plans ≤ 3 queries (AI with per-request enums, validated + one repair round; NL-lite otherwise). Step 2
// streams an answer that may only use numbers from the <query_result> tables; if it fails, the numbers are
// narrated from a template. The model never sees more than 50 rows per query, the UI at most 200.

export interface ChatWriter {
  send(event: ChatEvent["event"], data: unknown): void;
  readonly closed: boolean;
}

const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 8000;

/** Last 6 turns within 8,000 characters, starting with a user turn, consecutive roles merged. */
export function normalizeHistory(history: ChatRequest["history"]): ChatTurn[] {
  const recent = history.slice(-HISTORY_MESSAGES).map((m) => ({ role: m.role, content: sanitizeBlock(m.content, 4000) })).filter((m) => m.content);
  let total = recent.reduce((s, m) => s + m.content.length, 0);
  while (recent.length && total > HISTORY_CHARS) total -= recent.shift()?.content.length ?? 0;
  while (recent[0]?.role === "assistant") recent.shift();
  const merged: ChatTurn[] = [];
  for (const m of recent) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else merged.push({ ...m });
  }
  return merged;
}

function resultBlock(id: string, title: string, result: QueryResult, ctx: RequestContext): string {
  const cur = result.meta.currency;
  const dims = result.columns.filter((c) => c.kind === "dimension");
  const mets = result.columns.filter((c) => c.kind === "metric");
  const fmt = (key: string, v: unknown) => formatMetricValue(ctx.registry.get(key)?.format ?? "number", typeof v === "number" ? v : null, { currency: cur, compact: false });
  const header = [...dims.map((d) => d.label), ...mets.map((m) => m.label)].join(" | ");
  const rows = result.rows.slice(0, MAX_ROWS_TO_MODEL).map((r) =>
    [
      ...dims.map((d) => sanitizeText(r[d.key] ?? "—", 120).replace(/\|/g, "/")),
      ...mets.map((m) => {
        const pct = r[`${m.key}__pct`];
        return `${fmt(m.key, r[m.key])}${typeof pct === "number" ? ` (${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(1)}% vs ${fmt(m.key, r[`${m.key}__prev`])})` : ""}`;
      }),
    ].join(" | "),
  );
  const totals = result.totals ? mets.map((m) => `${m.label} ${fmt(m.key, result.totals?.[m.key])}`).join(" | ") : null;
  const prevTotals = result.compareTotals ? mets.map((m) => `${m.label} ${fmt(m.key, result.compareTotals?.[m.key])}`).join(" | ") : null;
  const body = [
    `columns: ${header}`,
    ...rows,
    ...(totals && dims.length ? [`totals: ${totals}`] : []),
    ...(prevTotals ? [`previous_period_totals: ${prevTotals}`] : []),
    `rows_shown: ${rows.length} of ${result.meta.rowCount}${result.meta.truncated ? "+" : ""}`,
    ...(result.meta.warnings.length ? [`warnings: ${result.meta.warnings.map((w) => sanitizeText(w, 160)).join("; ")}`] : []),
  ].join("\n");
  return wrapData("query_result", body, { id, title, range: `${result.meta.range.start}..${result.meta.range.end}`, ...(result.meta.compareRange ? { compare: `${result.meta.compareRange.start}..${result.meta.compareRange.end}` } : {}) });
}

function metricCatalog(ctx: RequestContext): string {
  return ctx.registry
    .list()
    .map((m) => `${m.key}: ${sanitizeText(m.label, 60)} (${m.format}${m.direction === "down_good" ? ", lower is better" : ""})`)
    .join("\n");
}

interface Plan {
  intent: "query" | "clarify";
  queries: PlannedQuery[];
  planner: "ai" | "nl-lite";
  suggestions: string[];
  clarification: string | null;
  notes: string[];
}

async function aiPlan(provider: AiProvider, ctx: RequestContext, question: string, history: ChatTurn[], req: ChatRequest, signal: AbortSignal): Promise<Plan> {
  const snap = await buildSnapshot(ctx);
  const schema = buildChatPlanSchema(ctx.registry.list().map((m) => m.key));
  const historyText = history.map((h) => `${h.role}: ${h.content}`).join("\n").slice(-3000);
  const cmp = req.context.compare;
  const context = [
    req.context.page && `page ${req.context.page}`,
    req.context.campaignId && `campaign ${req.context.campaignId}`,
    req.context.range && `range ${req.context.range}`,
    cmp && cmp !== "off" && cmp !== "none" && `compared with the ${cmp === "yoy" || cmp === "previous_year" ? "previous year" : "previous period"}`,
    req.context.types?.length && `campaign types ${req.context.types.join("/")}`,
  ]
    .filter(Boolean)
    .join(", ");
  const basePrompt = chatPlanPrompt({ question, history: historyText, today: ctx.today, dataThrough: ctx.dataThrough, metricCatalog: metricCatalog(ctx), context });
  const call = (prompt: string) => provider.generateObject<ChatPlanWire>({ feature: "chat-plan", system: systemBlocks(snap), prompt, schema, schemaName: "chat_plan", effort: effortFor("chat-plan"), signal });

  let plan = (await call(basePrompt)).object;
  const suggestions = plan.suggestions.map((s) => sanitizeText(s, 120)).filter(Boolean).slice(0, 3);
  if (plan.intent === "clarify") return { intent: "clarify", queries: [], planner: "ai", suggestions, clarification: sanitizeText(plan.clarification ?? "", 400) || null, notes: [] };
  let { valid, errors } = validatePlan(plan.queries, { today: ctx.today, registry: ctx.registry });
  if (errors.length) {
    // One low-effort repair round with the validation errors.
    const list = errors.map((e) => `query ${e.index + 1} (“${sanitizeText(e.title, 80)}”): ${sanitizeText(e.error, 240)}`).join("\n");
    try {
      plan = (await call(`${basePrompt}\nYour previous plan had invalid queries:\n${wrapData("plan_errors", list)}\nReturn a corrected plan.`)).object;
      const again = validatePlan(plan.queries, { today: ctx.today, registry: ctx.registry });
      if (again.valid.length >= valid.length) ({ valid, errors } = again);
    } catch (err) {
      log.warn("Chat plan repair failed", { code: toAiError(err).code });
    }
  }
  if (!valid.length) throw new AiError("AI_BAD_OUTPUT", "The AI plan had no valid queries");
  return { intent: "query", queries: valid, planner: "ai", suggestions, clarification: null, notes: errors.length ? [`Skipped ${errors.length} invalid quer${errors.length === 1 ? "y" : "ies"}.`] : [] };
}

async function nlPlan(ctx: RequestContext, question: string): Promise<Plan> {
  const dims = await ctx.source.getDims(ctx.accountId);
  const parsed = parseNlQuery(question, {
    today: ctx.today,
    metrics: ctx.registry.list().map((m) => ({ key: m.key, label: m.label, direction: m.direction, format: m.format })),
    campaignNames: [...dims.campaigns.values()].map((c) => c.name),
  });
  if (parsed.intent === "clarify") return { intent: "clarify", queries: [], planner: "nl-lite", suggestions: parsed.examples, clarification: null, notes: parsed.notes };
  const queries: PlannedQuery[] = [];
  const notes = [...parsed.notes];
  for (const q of parsed.queries) {
    const r = validateSpec(q.spec, { today: ctx.today, registry: ctx.registry });
    if ("spec" in r) queries.push({ title: q.title, chart: q.chart, spec: r.spec });
    else notes.push(`Couldn't run “${q.title}”: ${r.error}`);
  }
  return queries.length ? { intent: "query", queries, planner: "nl-lite", suggestions: [], clarification: null, notes } : { intent: "clarify", queries: [], planner: "nl-lite", suggestions: parsed.examples.length ? parsed.examples : [], clarification: notes.at(-1) ?? null, notes };
}

/** Stream text in paragraph-sized chunks so templated answers render like streamed ones. */
function sendText(w: ChatWriter, text: string): void {
  for (const part of text.split(/(?<=\n\n)/)) if (part && !w.closed) w.send("delta", { text: part });
}

/** Never lets an exception escape as a raw message: failures become one sanitised `error` event. */
export async function runChat(w: ChatWriter, ctx: RequestContext, req: ChatRequest, signal: AbortSignal): Promise<void> {
  try {
    await answer(w, ctx, req, signal);
  } catch (err) {
    if (signal.aborted || w.closed) return;
    log.error("Ask-your-data failed", { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
    w.send("error", { code: err instanceof QueryError ? err.code : "AI_ERROR", message: err instanceof QueryError ? err.message : "Something went wrong while answering. Please try again." });
  }
}

async function answer(w: ChatWriter, ctx: RequestContext, req: ChatRequest, signal: AbortSignal): Promise<void> {
  const provider = await getProvider();
  const demo = provider.id === "demo";
  const question = sanitizeBlock(req.message, 2000);
  const history = normalizeHistory(req.history);
  w.send("meta", { provider: provider.id, model: provider.model, mode: demo ? "demo" : "ai", dataMode: ctx.source.mode, ...(demo ? { fallbackReason: resolveAiProvider().reason ?? "AI is not configured" } : {}) });

  // Step 1 — plan.
  let plan: Plan | null = null;
  let providerDown = demo;
  if (!demo) {
    try {
      plan = await aiPlan(provider, ctx, question, history, req, signal);
    } catch (err) {
      const e = toAiError(err);
      if (signal.aborted) return;
      providerDown = e.code !== "AI_BAD_OUTPUT";
      w.send("notice", { message: `${describeAiFailure(e, provider.id)} Using the rule-based parser instead.` });
    }
  }
  plan ??= await nlPlan(ctx, question);
  if (signal.aborted || w.closed) return;

  const queries: ChatPlanQuery[] = plan.queries.map((q, i) => ({ id: `q${i + 1}`, title: q.title, chart: q.chart, query: q.spec }));
  w.send("plan", { intent: plan.intent, queries, planner: plan.planner, ...(plan.notes.length ? { notes: plan.notes } : {}) });

  if (plan.intent === "clarify") {
    sendText(w, plan.clarification ?? "I couldn't map that to your advertising data. Try asking about a metric, a breakdown and a time range — for example one of the suggestions below.");
    w.send("suggestions", { prompts: plan.suggestions.slice(0, 4) });
    w.send("done", { model: demo || plan.planner === "nl-lite" ? null : provider.model });
    return;
  }

  // Run the queries.
  const results: { id: string; title: string; result: QueryResult }[] = [];
  for (const [index, q] of plan.queries.entries()) {
    if (signal.aborted || w.closed) return;
    try {
      const result = await runQuery(q.spec, ctx);
      const chart: ChatChart = { id: `q${index + 1}`, title: q.title, type: q.chart, query: q.spec };
      const rows = result.rows.slice(0, MAX_ROWS_TO_UI);
      w.send("result", { index, chart, result: { ...result, rows, meta: { ...result.meta, truncated: result.meta.truncated || result.rows.length > rows.length } } });
      results.push({ id: chart.id, title: q.title, result });
    } catch (err) {
      w.send("notice", { message: `“${q.title}” could not run: ${err instanceof QueryError ? err.message : "query failed"}` });
    }
  }
  if (!results.length) {
    sendText(w, "None of the queries could run, so I have no numbers to answer with. Try a simpler question or a different date range.");
    w.send("done", { model: null });
    return;
  }

  // Step 2 — answer.
  let answered = false;
  let model: string | null = null;
  if (!providerDown) {
    const snap = await buildSnapshot(ctx);
    const content = `${wrapData("user_context", question)}\n\n${results.map((r) => resultBlock(r.id, r.title, r.result, ctx)).join("\n\n")}\n\n${CHAT_ANSWER_RULES}`;
    // History already ends on either role; never send two user turns in a row (no assistant prefill either).
    const messages: ChatTurn[] = history.map((h) => ({ ...h }));
    const last = messages[messages.length - 1];
    if (last?.role === "user") last.content = `${last.content}\n\n${content}`;
    else messages.push({ role: "user", content });
    let streamedAny = false;
    for await (const chunk of provider.streamText({ feature: "chat-answer", system: systemBlocks(snap), messages, effort: effortFor("chat-answer"), signal })) {
      if (signal.aborted || w.closed) return;
      if (chunk.type === "text") {
        streamedAny = true;
        w.send("delta", { text: chunk.delta });
      } else if (chunk.type === "notice") w.send("notice", { message: chunk.message });
      else if (chunk.type === "done") {
        answered = true;
        model = chunk.model;
      } else {
        w.send("notice", { message: `${describeAiFailure(new AiError(chunk.code, chunk.message, chunk.detail), provider.id)} Showing a summary of the numbers instead.` });
        if (streamedAny) w.send("delta", { text: "\n\n" });
        break;
      }
    }
  }
  if (!answered) sendText(w, narrateResults(results, ctx.registry));

  const first = plan.queries[0];
  const prompts = plan.suggestions.length ? plan.suggestions : first ? followUps(first.spec.dimensions, first.spec.compare) : [];
  w.send("suggestions", { prompts: prompts.slice(0, 3) });
  w.send("done", { model: answered ? model : null });
}
