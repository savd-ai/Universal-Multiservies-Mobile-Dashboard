"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiStatus, IdeaSet, IdeasRequest } from "@/lib/domain/contracts/ai";
import type { AnomalyFeedResponse, SignalAction, SignalView } from "@/lib/domain/contracts/anomaly";
import type { PacingReport } from "@/lib/domain/contracts/budget";
import type { PluginView } from "@/lib/domain/contracts/plugins";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";

// Hooks for the analytics, AI and channel endpoints. Keys live under ["acct", accountId, …] so an account switch
// never mixes data; mutations invalidate by prefix.

const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;

// ── Anomalies ────────────────────────────────────────────────────────────────────────────────────────

export interface AnomalyCounts {
  all: number;
  critical: number;
  warning: number;
  info: number;
  open: number;
}

export type AnomalyList = Omit<AnomalyFeedResponse, "settings" | "dataThrough" | "mode" | "preview" | "warnings" | "generatedAt"> & Partial<Pick<AnomalyFeedResponse, "settings" | "dataThrough" | "mode" | "preview" | "warnings" | "generatedAt">>;

export function useAnomalies(params: Record<string, string | undefined> = {}, opts: { enabled?: boolean } = {}) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "anomalies", "list", params],
    queryFn: ({ signal }) => request<AnomalyList>("/api/anomalies", { query: params, signal }),
    enabled: !!acct && opts.enabled !== false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

export function useSignalAction() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: SignalAction }) =>
      request<{ signal: SignalView | null } | SignalView>(`/api/anomalies/${encodeURIComponent(id)}`, { method: "PATCH", body: action }).then((r) => ("signal" in r ? r.signal : r)),
    onMutate: async ({ id, action }) => {
      const key = ["acct", acct, "anomalies"];
      await qc.cancelQueries({ queryKey: key });
      const status = action.action === "acknowledge" ? "acknowledged" : action.action === "snooze" ? "snoozed" : action.action === "resolve" ? "resolved" : "open";
      const snoozedUntil = action.action === "snooze" ? new Date(Date.now() + action.hours * 3_600_000).toISOString() : undefined;
      const at = new Date().toISOString();
      const snapshots = qc.getQueriesData<AnomalyList>({ queryKey: key });
      for (const [k, data] of snapshots) {
        if (!data || !Array.isArray((data as AnomalyList).signals)) continue;
        qc.setQueryData<AnomalyList>(k, { ...data, signals: data.signals.map((s) => (s.id === id ? { ...s, status, snoozedUntil, statusChangedAt: at } : s)) });
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["acct", acct, "anomalies"] }),
  });
}

// ── Budget ───────────────────────────────────────────────────────────────────────────────────────────

export function usePacing(month?: string) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "budget", "pacing", month ?? "current"],
    queryFn: ({ signal }) => request<PacingReport>("/api/budget/pacing", { query: { month }, signal }),
    enabled: !!acct,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

// ── AI ───────────────────────────────────────────────────────────────────────────────────────────────

export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: ({ signal }) => request<AiStatus & { remaining?: number }>("/api/ai/status", { signal }), staleTime: 60_000, retry: noRetry4xx });
}

function toIdeaSets(r: unknown): IdeaSet[] {
  if (Array.isArray(r)) return r as IdeaSet[];
  const o = r as { ideaSets?: IdeaSet[]; sets?: IdeaSet[]; items?: IdeaSet[] };
  return o.ideaSets ?? o.sets ?? o.items ?? [];
}

export function useIdeaSets() {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "idea-sets"],
    queryFn: ({ signal }) => request<unknown>("/api/ai/idea-sets", { signal }).then(toIdeaSets),
    enabled: !!acct,
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

export function useGenerateIdeas() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: (body: Partial<IdeasRequest>) => request<IdeaSet>("/api/ai/ideas", { body }),
    onSuccess: (set) => {
      qc.setQueryData<IdeaSet[]>(["acct", acct, "idea-sets"], (list) => [set, ...(list ?? []).filter((s) => s.id !== set.id)]);
      void qc.invalidateQueries({ queryKey: ["acct", acct, "idea-sets"] });
    },
  });
}

export function usePatchIdea() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: ({ setId, ideaId, patch }: { setId: string; ideaId: string; patch: { dismissed?: boolean; inPlan?: boolean } }) =>
      request<IdeaSet>(`/api/ai/idea-sets/${encodeURIComponent(setId)}`, { method: "PATCH", body: { ideaId, ...patch } }),
    onMutate: async ({ setId, ideaId, patch }) => {
      const key = ["acct", acct, "idea-sets"];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<IdeaSet[]>(key);
      if (prev) qc.setQueryData<IdeaSet[]>(key, prev.map((s) => (s.id !== setId ? s : { ...s, ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, ...patch } : i)) })));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["acct", acct, "idea-sets"], ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["acct", acct, "idea-sets"] });
      void qc.invalidateQueries({ queryKey: ["acct", acct, "budget"] });
    },
  });
}

export interface Narrative {
  headline: string;
  bullets: string[];
  nextSteps: string[];
  facts?: Record<string, unknown>;
  source?: string;
  model?: string | null;
  fallbackReason?: string;
  warnings?: string[];
}

export function useNarrative(range: string, opts: { enabled?: boolean } = {}) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "narrative", range],
    queryFn: ({ signal }) => request<Narrative>("/api/ai/narrative", { body: { range }, signal }),
    enabled: !!acct && opts.enabled !== false,
    staleTime: 10 * 60_000,
    retry: noRetry4xx,
  });
}

// ── Channels ─────────────────────────────────────────────────────────────────────────────────────────

export function usePlugins() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: ({ signal }) => request<{ plugins: PluginView[]; encryption: boolean }>("/api/plugins", { signal }),
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}
