import "server-only";
import { randomUUID } from "node:crypto";
import { CHANGE_HISTORY_DAYS, detectSignals, DETECTION_LOOKBACK_DAYS, previewThresholdRule, type DetectionResult } from "@/lib/domain/anomaly";
import { isSignalId, scopeKey, windowEndOf } from "@/lib/domain/anomaly/ids";
import { addNote, applySignalAction as applyActionPure, indexStates, initialDraft, joinSignals, planEvaluation, resolvedView, type StateDraft } from "@/lib/domain/anomaly/lifecycle";
import { pacingDetail } from "@/lib/domain/budget/pacing";
import {
  anomalySettingsSchema,
  defaultAnomalySettings,
  thresholdRuleSchema,
  type AnomalySettings,
  type RulePreviewResult,
  type Signal,
  type SignalAction,
  type SignalState,
  type SignalView,
  type ThresholdRule,
} from "@/lib/domain/contracts/anomaly";
import { addDays, monthKey } from "@/lib/domain/dates";
import type { Severity } from "@/lib/domain/types";
import type { z } from "zod";
import { loadCampaignDaily, loadCampaigns, loadChangeHistory, targetsId } from "../budget/data";
import { singleton } from "../cache";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { getStore } from "../store";

// Anomaly service. Detection is stateless (lib/domain/anomaly); this module loads data, applies persisted
// settings (plus non-persisted preview overrides), joins lifecycle states and persists evaluations.
// Contract used by the alerts dispatcher, AI features and the UI:

export interface ListSignalsOptions {
  /** include acknowledged / snoozed / resolved signals (default: true — the UI filters) */
  includeInactive?: boolean;
  /** preview-only settings overrides from the Anomalies page (not persisted) */
  overrides?: Partial<AnomalySettings>;
}

export interface EvaluationResult {
  signals: SignalView[];
  /** signals that are new or escalated in severity since the last evaluation (alert candidates) */
  newOrEscalated: SignalView[];
  /** signals auto-resolved in this evaluation */
  resolved: SignalView[];
}

// ── Settings ──────────────────────────────────────────────────────────────────────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Objects merge recursively; arrays and primitives replace; undefined is ignored. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k === "__proto__" || k === "constructor" || k === "prototype") continue;
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export async function getAnomalySettings(): Promise<AnomalySettings> {
  const raw = await getStore().anomalySettings.get();
  const parsed = anomalySettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultAnomalySettings();
}

/** Deep-merge a (partial) settings body over the stored settings, validate and persist. */
export async function updateAnomalySettings(patch: unknown): Promise<AnomalySettings> {
  const merged = anomalySettingsSchema.parse(deepMerge(await getAnomalySettings(), patch));
  await getStore().anomalySettings.set(merged);
  return merged;
}

function effectiveSettings(base: AnomalySettings, overrides?: Partial<AnomalySettings>): AnomalySettings {
  if (!overrides) return base;
  const parsed = anomalySettingsSchema.safeParse(deepMerge(base, overrides));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid anomaly settings override", parsed.error.issues.slice(0, 5));
  return parsed.data;
}

// ── Detection ─────────────────────────────────────────────────────────────────────────────────────────

async function detect(ctx: RequestContext, settings: AnomalySettings): Promise<DetectionResult> {
  const warnings: string[] = [];
  const range = { start: addDays(ctx.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1)), end: ctx.dataThrough };
  const month = monthKey(ctx.dataThrough);
  const [rows, campaigns, history, targets] = await Promise.all([
    loadCampaignDaily(ctx, range),
    loadCampaigns(ctx),
    // Live stays clamped to Google's 30-day change log; `from` tells detection how far back it can vouch.
    loadChangeHistory(ctx, { start: addDays(ctx.dataThrough, -(CHANGE_HISTORY_DAYS - 1)), end: ctx.dataThrough }, warnings),
    getStore().budgetTargets.get(targetsId(ctx, month)),
  ]);
  const { report } = pacingDetail({
    month,
    dataThrough: ctx.dataThrough,
    campaigns,
    rows,
    targets: targets?.targets,
    locks: targets?.locks,
    currency: ctx.account.currency,
    thresholds: { over: settings.pacing.over, under: settings.pacing.under },
  });
  const res = detectSignals({
    accountId: ctx.accountId,
    accountName: ctx.account.name,
    mode: ctx.source.mode,
    currency: ctx.account.currency,
    dataThrough: ctx.dataThrough,
    now: now().toISOString(),
    settings,
    campaigns,
    rows,
    changeEvents: history.events,
    changeHistoryAvailable: history.available,
    changeHistoryFrom: history.from,
    pacing: report,
    registry: ctx.registry,
    conversionLag: ctx.source.mode === "live",
  });
  return { signals: res.signals, warnings: [...warnings, ...res.warnings] };
}

const scopeOf = (ctx: RequestContext) => scopeKey(ctx.source.mode, ctx.accountId);

async function statesFor(ctx: RequestContext): Promise<SignalState[]> {
  const scope = scopeOf(ctx);
  return getStore().signalStates.list((s) => s.scopeKey === scope);
}

export interface AnomalyFeed {
  signals: SignalView[];
  warnings: string[];
  settings: AnomalySettings;
}

/** Signals + warnings + the effective settings (persisted merged with preview overrides). */
export async function getAnomalyFeed(ctx: RequestContext, opts: ListSignalsOptions = {}): Promise<AnomalyFeed> {
  const settings = effectiveSettings(await getAnomalySettings(), opts.overrides);
  const [{ signals, warnings }, states] = await Promise.all([detect(ctx, settings), statesFor(ctx)]);
  let views = joinSignals(signals, states, now().toISOString());
  if (opts.includeInactive === false) views = views.filter((v) => v.status === "open");
  return { signals: views, warnings, settings };
}

/** Detect signals for the context's account and join their lifecycle state. */
export async function listSignals(ctx: RequestContext, opts: ListSignalsOptions = {}): Promise<SignalView[]> {
  return (await getAnomalyFeed(ctx, opts)).signals;
}

// One evaluation at a time per account scope (cron and manual runs may overlap).
const locks = () => singleton("anomaly:evaluate-locks", () => new Map<string, Promise<unknown>>());

async function withScopeLock<T>(scope: string, fn: () => Promise<T>): Promise<T> {
  const map = locks();
  const prev = map.get(scope) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  map.set(
    scope,
    run.catch(() => undefined),
  );
  return run;
}

const persistDraft = (d: StateDraft) => getStore().signalStates.upsert(d as Omit<SignalState, "createdAt" | "updatedAt" | "version">);

/**
 * Write an evaluation plan without losing concurrent user actions: when a state changed after the plan was made
 * (an ack or snooze landed meanwhile), only the evaluation fields are refreshed and the user's status is kept.
 */
async function persistEvaluation(drafts: readonly StateDraft[], planned: ReadonlyMap<string, SignalState>): Promise<void> {
  const store = getStore();
  for (const d of drafts) {
    const before = planned.get(d.id);
    const current = await store.signalStates.get(d.id);
    if (!current) {
      await persistDraft(d);
      continue;
    }
    const stale = !before || current.version !== before.version;
    try {
      await store.signalStates.update(d.id, (cur) =>
        stale ? { ...cur, lastSeenAt: d.lastSeenAt, lastSeverity: d.lastSeverity, missedEvaluations: d.missedEvaluations, snapshot: d.snapshot ?? cur.snapshot, supersededBy: d.supersededBy ?? cur.supersededBy } : ({ ...cur, ...d } as SignalState),
      );
    } catch (err) {
      if (!(err instanceof AppError && err.code === "NOT_FOUND")) throw err; // deleted meanwhile
    }
  }
}

/** Detect, persist lifecycle state (first/last seen, auto-resolve) and report alert candidates. */
export async function evaluateAndPersist(ctx: RequestContext): Promise<EvaluationResult> {
  const scope = scopeOf(ctx);
  return withScopeLock(scope, async () => {
    const settings = await getAnomalySettings();
    const { signals } = await detect(ctx, settings);
    const store = getStore();
    const nowIso = now().toISOString();
    const states = await statesFor(ctx);
    const plan = planEvaluation(signals, states, scope, nowIso);
    await persistEvaluation(plan.upserts, new Map(states.map((st) => [st.id, st])));
    for (const id of plan.deletes) await store.signalStates.delete(id);
    const views = joinSignals(signals, await statesFor(ctx), nowIso);
    const alertIds = new Set(plan.newOrEscalated);
    return {
      signals: views,
      newOrEscalated: views.filter((v) => alertIds.has(v.id)),
      resolved: plan.resolved.map(resolvedView).filter((v): v is SignalView => v !== null),
    };
  });
}

// ── Lifecycle actions ─────────────────────────────────────────────────────────────────────────────────

export interface SignalActionResult {
  /** the updated signal, or null when it is not detected with the saved settings (e.g. a preview-only signal) */
  signal: SignalView | null;
  state: SignalState;
}

async function draftFor(ctx: RequestContext, id: string): Promise<{ draft: StateDraft; signal: Signal | null }> {
  const settings = await getAnomalySettings();
  const [{ signals }, states] = await Promise.all([detect(ctx, settings), statesFor(ctx)]);
  const index = indexStates(states);
  const nowIso = now().toISOString();
  const signal = signals.find((s) => s.id === id) ?? null;
  if (signal) return { draft: initialDraft(signal, scopeOf(ctx), index, nowIso), signal };
  const exact = index.byId.get(id);
  if (exact) return { draft: exact, signal: null };
  // Signals only visible with preview overrides can still be acknowledged for the current data day.
  if (isSignalId(id) && windowEndOf(id) === ctx.dataThrough) {
    return {
      draft: { id, scopeKey: scopeOf(ctx), status: "open", firstSeenAt: nowIso, lastSeenAt: nowIso, lastSeverity: "info", notes: [], history: [], missedEvaluations: 0 },
      signal: null,
    };
  }
  throw notFound("Signal");
}

function lifecycle(state: SignalState): Pick<SignalView, "statusChangedAt" | "history"> {
  const history = (state.history ?? []).slice(-20);
  return { history, statusChangedAt: history.at(-1)?.at ?? state.firstSeenAt };
}

function viewOf(signal: Signal | null, state: SignalState): SignalView | null {
  if (!signal) return state.snapshot ? { ...state.snapshot, series: [], status: state.status, snoozedUntil: state.snoozedUntil, notes: state.notes, firstSeenAt: state.firstSeenAt, ...lifecycle(state) } : null;
  return { ...signal, status: state.status, snoozedUntil: state.status === "snoozed" ? state.snoozedUntil : undefined, notes: state.notes, firstSeenAt: state.firstSeenAt, ...lifecycle(state) };
}

export async function applySignalAction(ctx: RequestContext, id: string, action: SignalAction): Promise<SignalActionResult> {
  const { draft, signal } = await draftFor(ctx, id);
  const state = await persistDraft(applyActionPure(draft, action, now().toISOString()));
  return { signal: viewOf(signal, state), state };
}

export async function addSignalNote(ctx: RequestContext, id: string, text: string): Promise<SignalActionResult> {
  const { draft, signal } = await draftFor(ctx, id);
  const state = await persistDraft(addNote(draft, text, now().toISOString()));
  return { signal: viewOf(signal, state), state };
}

/** Alert bookkeeping for the dispatcher: remember when and at which severity a signal was last sent. */
export async function markAlerted(ctx: RequestContext, id: string, severity: Severity): Promise<void> {
  const store = getStore();
  const existing = await store.signalStates.get(id);
  const at = now().toISOString();
  if (existing) {
    await store.signalStates.update(id, (prev) => ({ ...prev, lastAlerted: { at, severity } }));
    return;
  }
  await store.signalStates.upsert({ id, scopeKey: scopeOf(ctx), status: "open", firstSeenAt: at, lastSeenAt: at, lastSeverity: severity, notes: [], history: [], lastAlerted: { at, severity } });
}

// ── Threshold rules (stored inside anomalySettings.thresholdRules) ───────────────────────────────────────

export type ThresholdRuleInput = z.input<typeof thresholdRuleSchema>;

export async function listRules(): Promise<ThresholdRule[]> {
  return (await getAnomalySettings()).thresholdRules as ThresholdRule[];
}

export async function createRule(input: z.infer<typeof thresholdRuleSchema>): Promise<ThresholdRule> {
  const settings = await getAnomalySettings();
  let id = (input.id ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
  if (!id || settings.thresholdRules.some((r) => r.id === id)) id = `rule-${randomUUID().slice(0, 8)}`;
  const rule = { ...input, id } as ThresholdRule;
  if (settings.thresholdRules.length >= 100) throw new AppError("VALIDATION_ERROR", "At most 100 threshold rules");
  await getStore().anomalySettings.set(anomalySettingsSchema.parse({ ...settings, thresholdRules: [...settings.thresholdRules, rule] }));
  return rule;
}

export async function updateRule(id: string, input: z.infer<typeof thresholdRuleSchema>): Promise<ThresholdRule> {
  const settings = await getAnomalySettings();
  if (!settings.thresholdRules.some((r) => r.id === id)) throw notFound("Rule");
  const rule = { ...input, id } as ThresholdRule;
  await getStore().anomalySettings.set(anomalySettingsSchema.parse({ ...settings, thresholdRules: settings.thresholdRules.map((r) => (r.id === id ? rule : r)) }));
  return rule;
}

export async function deleteRule(id: string): Promise<void> {
  const settings = await getAnomalySettings();
  if (!settings.thresholdRules.some((r) => r.id === id)) throw notFound("Rule");
  await getStore().anomalySettings.set({ ...settings, thresholdRules: settings.thresholdRules.filter((r) => r.id !== id) });
}

/** Rule editor preview: the days in the last `days` on which the rule would have fired. */
export async function previewRule(ctx: RequestContext, input: z.infer<typeof thresholdRuleSchema>, days = 30): Promise<RulePreviewResult> {
  const rule = { ...input, id: input.id ?? "preview" } as ThresholdRule;
  const settings = await getAnomalySettings();
  const [rows, campaigns] = await Promise.all([loadCampaignDaily(ctx, { start: addDays(ctx.dataThrough, -(DETECTION_LOOKBACK_DAYS - 1)), end: ctx.dataThrough }), loadCampaigns(ctx)]);
  if (!ctx.registry.get(rule.metric) || !ctx.registry.availableIn(rule.metric).includes("campaign_daily")) throw new AppError("VALIDATION_ERROR", `Metric ${rule.metric} is not available for rules`);
  const out = previewThresholdRule(
    { accountId: ctx.accountId, accountName: ctx.account.name, mode: ctx.source.mode, currency: ctx.account.currency, dataThrough: ctx.dataThrough, now: now().toISOString(), settings, campaigns, rows, registry: ctx.registry },
    rule,
    days,
  );
  return {
    ruleId: rule.id,
    days: out.map((d) => ({ date: d.date, hits: d.hits.map((h) => ({ ...h, severity: rule.severity })) })),
    totalHits: out.reduce((s, d) => s + d.hits.length, 0),
  };
}
