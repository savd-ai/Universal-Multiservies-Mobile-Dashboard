"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadOnlyAlternatives, SimulateRequest, SimulateResponse, SimulatedAction } from "@/lib/domain/contracts/actions";
import { ApiError, request } from "./client";
import { useAccountId, useStatus } from "./hooks";

// Write actions. Google Ads is READ-ONLY: in demo mode actions are simulated server-side (a revertible overlay the
// demo source applies, plus an audit entry); in live mode the server answers 409 READ_ONLY_LIVE with deep links,
// a change list and an Ads Editor CSV instead. UI surfaces go through these hooks + <LiveGuard>.

export function useIsLive(): boolean {
  return useStatus().data?.mode === "live";
}

export class ReadOnlyLiveError extends Error {
  constructor(public readonly alternatives: ReadOnlyAlternatives | null) {
    super("This dashboard is read-only for Google Ads");
    this.name = "ReadOnlyLiveError";
  }
}

export function useSimulateAction() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: async (body: SimulateRequest) => {
      try {
        const res = await request<SimulateResponse | SimulatedAction>("/api/actions/simulate", { body });
        return "action" in res ? res.action : res;
      } catch (err) {
        if (err instanceof ApiError && err.code === "READ_ONLY_LIVE") throw new ReadOnlyLiveError((err.details as ReadOnlyAlternatives | undefined) ?? null);
        throw err;
      }
    },
    onSuccess: () => {
      // simulated overlays change dims (status, budgets) → every account-scoped query may change
      void qc.invalidateQueries({ queryKey: ["acct", acct] });
      void qc.invalidateQueries({ queryKey: ["actions"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useActions() {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["actions", acct],
    queryFn: ({ signal }) => request<{ actions: SimulatedAction[] } | SimulatedAction[]>("/api/actions", { signal }).then((r) => (Array.isArray(r) ? r : r.actions ?? [])),
    enabled: !!acct,
    staleTime: 30_000,
  });
}

export function useRevertAction() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: (id: string) => request<SimulatedAction>(`/api/actions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["acct", acct] });
      void qc.invalidateQueries({ queryKey: ["actions"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export interface AuditRow {
  ts: string;
  actor: string;
  action: string;
  summary?: string;
  target?: string;
  accountId?: string;
  mode?: string;
  details?: Record<string, unknown>;
}

export function useAudit(limit = 100) {
  return useQuery({
    queryKey: ["audit", limit],
    queryFn: ({ signal }) => request<{ entries: AuditRow[] }>("/api/audit", { query: { limit }, signal }).then((r) => r.entries ?? []),
    staleTime: 15_000,
  });
}
