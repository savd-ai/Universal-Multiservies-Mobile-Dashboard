import "server-only";
import type { HistorySignal, HistorySummary } from "@/lib/domain/contracts/history";
import { summarizeHistory } from "@/lib/domain/history/summary";
import type { Severity } from "@/lib/domain/types";
import { now } from "../clock";
import type { RequestContext } from "../context";
import { getHistory, historyMode, historyUnavailableReason } from "./index";

function accountsFor(ctx: RequestContext, scope: "account" | "all"): string[] {
  return scope === "all" ? ctx.accounts.filter((account) => !account.isManager).map((account) => account.id) : [ctx.accountId];
}

function monthsBack(to: Date, months: number): string {
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - (months - 1), 1));
  return from.toISOString();
}

/** Long-term analysis of the stored signals and notifications for the active account (or every visible one). */
export function historySummary(ctx: RequestContext, options: { months?: number; scope?: "account" | "all" }): HistorySummary {
  const scope = options.scope ?? "account";
  const months = options.months ?? 6;
  const mode = historyMode(ctx.source);
  const accountIds = accountsFor(ctx, scope);
  const to = now();
  const from = monthsBack(to, months);
  const history = getHistory();
  const body = summarizeHistory({
    from,
    to: to.toISOString(),
    signals: history?.summarySignals(mode, accountIds, from) ?? [],
    notifications: history?.summaryNotifications(mode, accountIds, from) ?? [],
    runs: history?.summaryRuns(mode, accountIds, from) ?? { count: 0, lastRunAt: null },
  });
  return { mode, available: !!history, note: history ? null : historyUnavailableReason(), scope, accountIds, ...body };
}

export function historySignals(ctx: RequestContext, options: { limit?: number; before?: string; severity?: Severity }): { mode: string; available: boolean; signals: HistorySignal[] } {
  const history = getHistory();
  const mode = historyMode(ctx.source);
  return { mode, available: !!history, signals: history?.signals(mode, [ctx.accountId], { limit: options.limit ?? 50, before: options.before, severity: options.severity }) ?? [] };
}
