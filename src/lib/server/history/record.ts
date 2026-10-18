import "server-only";
import { randomUUID } from "node:crypto";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import type { NotificationEvent } from "@/lib/domain/contracts/history";
import type { Severity } from "@/lib/domain/types";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { historyConfig } from "../env/config";
import { log } from "../log";
import { getHistory, historyMode } from "./index";
import type { NotificationDraft, ObservedSignal } from "./repo";

const SEVERITY_WORD: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Opportunity" };
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Phone-sized copy for one signal event. Names, not ids; the numbers are the engine's own text. */
export function notificationCopy(signal: Pick<SignalView, "title" | "summary" | "entity" | "severity" | "polarity">, event: NotificationEvent): { title: string; body: string } {
  if (event === "resolved") return { title: clip(`Back to normal · ${signal.title}`, 90), body: clip(`${signal.entity.name}: no longer outside its expected range.`, 180) };
  const word = signal.polarity === "good" ? "Opportunity" : SEVERITY_WORD[signal.severity];
  const prefix = event === "escalated" ? `${word} (escalated)` : word;
  return { title: clip(`${prefix} · ${signal.title}`, 90), body: clip(`${signal.entity.name}: ${signal.summary}`, 180) };
}

export interface EvaluationOutcome {
  signals: SignalView[];
  newOrEscalated: SignalView[];
  resolved: SignalView[];
}

/**
 * Stores one anomaly evaluation in the history database and turns its new, escalated and resolved signals into
 * notifications for the phone app. Never throws: history is a record of the dashboard, not part of answering it.
 * Resolved notices are only made for problems (bad polarity, warning or worse) — "back to normal" matters for those.
 */
export function recordEvaluation(ctx: Pick<RequestContext, "source" | "accountId" | "account" | "dataThrough">, outcome: EvaluationOutcome, startedAt: string): { runId: string; notifications: number[] } | null {
  const repo = getHistory();
  if (!repo) return null;
  try {
    const mode = historyMode(ctx.source);
    const finishedAt = now().toISOString();
    const runId = randomUUID();
    const observed: ObservedSignal[] = outcome.signals.map(({ series: _series, ...signal }) => ({ signal, status: signal.status, firstSeenAt: signal.firstSeenAt ?? finishedAt }));
    const known = repo.knownSignals(mode, outcome.newOrEscalated.map((signal) => signal.id));
    const path = `/anomalies?acct=${encodeURIComponent(ctx.accountId)}`;
    const drafts: NotificationDraft[] = [];
    for (const signal of outcome.newOrEscalated) {
      const event: NotificationEvent = known.has(signal.id) ? "escalated" : "new";
      drafts.push({ accountId: ctx.accountId, accountName: ctx.account.name, signalId: signal.id, event, severity: signal.severity, polarity: signal.polarity, path, ...notificationCopy(signal, event) });
    }
    for (const signal of outcome.resolved) {
      if (signal.polarity !== "bad" || signal.severity === "info") continue;
      drafts.push({ accountId: ctx.accountId, accountName: ctx.account.name, signalId: signal.id, event: "resolved", severity: signal.severity, polarity: signal.polarity, path, ...notificationCopy(signal, "resolved") });
    }
    const notifications = repo.recordRun(
      {
        id: runId,
        mode,
        accountId: ctx.accountId,
        accountName: ctx.account.name,
        dataThrough: ctx.dataThrough,
        startedAt,
        finishedAt,
        signals: outcome.signals.length,
        newOrEscalated: outcome.newOrEscalated.length,
        resolved: outcome.resolved.length,
      },
      observed,
      outcome.resolved.map((signal) => signal.id),
      drafts,
    );
    const retention = historyConfig().retentionDays;
    if (retention > 0) repo.prune(new Date(Date.parse(finishedAt) - retention * 86400000).toISOString());
    return { runId, notifications };
  } catch (error) {
    log.warn("Could not store the anomaly evaluation in the history database", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
