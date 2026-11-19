"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExplainResult } from "@/lib/domain/contracts/ai";
import type { AnomalySettings, RulePreviewResult, SignalState, SignalView, ThresholdRule } from "@/lib/domain/contracts/anomaly";
import type { CampaignType } from "@/lib/domain/types";
import type { AnomalyList } from "./analytics";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";

// Hooks for the Anomalies pages beyond the shared feed (useAnomalies / useSignalAction live in ./analytics):
// detector settings, evaluation, notes, explanations, threshold rules and a campaign picker list. Settings and
// rules are global (not per account); signal data is keyed under ["acct", accountId, …].

const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;

export const anomalyUiKeys = {
  settings: () => ["anomaly-settings"] as const,
  rules: () => ["anomaly-rules"] as const,
  feed: (acct: string) => ["acct", acct, "anomalies"] as const,
  explain: (acct: string, id: string) => ["acct", acct, "signal-explain", id] as const,
  campaigns: (acct: string) => ["acct", acct, "anomalies-ui", "campaign-options"] as const,
};

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────────

export function useAnomalySettings() {
  return useQuery({
    queryKey: anomalyUiKeys.settings(),
    queryFn: ({ signal }) => request<AnomalySettings>("/api/anomalies/settings", { signal }),
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

/** PUT /api/anomalies/settings — the body is deep-merged over the stored settings on the server. */
export function useUpdateAnomalySettings() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => request<AnomalySettings>("/api/anomalies/settings", { method: "PUT", body: patch }),
    onSuccess: (saved) => {
      qc.setQueryData(anomalyUiKeys.settings(), saved);
      qc.setQueryData(anomalyUiKeys.rules(), saved.thresholdRules);
      void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) });
    },
  });
}

// ── Evaluation, notes, explanations ─────────────────────────────────────────────────────────────────

export interface EvaluateResponse {
  evaluatedAt: string;
  dataThrough: string;
  counts: { signals: number; newOrEscalated: number; resolved: number };
}

export function useEvaluateAnomalies() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: () => request<EvaluateResponse>("/api/anomalies/evaluate", { method: "POST", body: {} }),
    onSettled: () => void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) }),
  });
}

/** POST /api/anomalies/[id]/notes — optimistic: the note shows on every cached copy of the signal at once. */
export function useAddSignalNote() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => request<{ signal: SignalView | null; state: SignalState }>(`/api/anomalies/${encodeURIComponent(id)}/notes`, { method: "POST", body: { text } }),
    onMutate: async ({ id, text }) => {
      const key = anomalyUiKeys.feed(acct);
      await qc.cancelQueries({ queryKey: key });
      const snapshots = qc.getQueriesData<AnomalyList>({ queryKey: key });
      const note = { at: new Date().toISOString(), text: text.trim() };
      for (const [k, data] of snapshots) {
        if (!data || !Array.isArray(data.signals)) continue;
        qc.setQueryData<AnomalyList>(k, { ...data, signals: data.signals.map((s) => (s.id === id ? { ...s, notes: [...s.notes, note] } : s)) });
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) }),
  });
}

/**
 * Server facts + AI (or rule-library) causes for one signal. Cached for the session so reopening the drawer never
 * spends AI quota twice; kept outside the feed prefix so signal actions don't refetch it.
 */
export function useSignalExplain(id: string | null) {
  const acct = useAccountId();
  return useQuery({
    queryKey: anomalyUiKeys.explain(acct, id ?? ""),
    queryFn: ({ signal }) => request<ExplainResult>(`/api/anomalies/${encodeURIComponent(id ?? "")}/explain`, { method: "POST", body: {}, signal }),
    enabled: !!acct && !!id,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

// ── Threshold rules ──────────────────────────────────────────────────────────────────────────────────

export function useThresholdRules() {
  return useQuery({
    queryKey: anomalyUiKeys.rules(),
    queryFn: ({ signal }) => request<{ rules: ThresholdRule[] }>("/api/anomalies/rules", { signal }).then((r) => r.rules),
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

type RuleInput = Omit<ThresholdRule, "id"> & { id?: string };

function useRuleInvalidation() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return () => {
    void qc.invalidateQueries({ queryKey: anomalyUiKeys.rules() });
    void qc.invalidateQueries({ queryKey: anomalyUiKeys.settings() });
    void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) });
  };
}

/** Create (no id) or replace (id) a threshold rule; replacements show in the list immediately. */
export function useSaveThresholdRule() {
  const qc = useQueryClient();
  const invalidate = useRuleInvalidation();
  return useMutation({
    mutationFn: ({ id, rule }: { id?: string; rule: RuleInput }) =>
      id ? request<ThresholdRule>(`/api/anomalies/rules/${encodeURIComponent(id)}`, { method: "PUT", body: rule }) : request<ThresholdRule>("/api/anomalies/rules", { method: "POST", body: rule }),
    onMutate: async ({ id, rule }) => {
      if (!id) return { prev: undefined };
      await qc.cancelQueries({ queryKey: anomalyUiKeys.rules() });
      const prev = qc.getQueryData<ThresholdRule[]>(anomalyUiKeys.rules());
      if (prev) qc.setQueryData<ThresholdRule[]>(anomalyUiKeys.rules(), prev.map((r) => (r.id === id ? { ...rule, id } : r)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(anomalyUiKeys.rules(), ctx.prev);
    },
    onSettled: invalidate,
  });
}

export function useDeleteThresholdRule() {
  const invalidate = useRuleInvalidation();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: true }>(`/api/anomalies/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSettled: invalidate,
  });
}

/** "Preview last 30 days" for an unsaved rule. */
export function useRulePreview() {
  return useMutation({
    mutationFn: ({ rule, days = 30 }: { rule: RuleInput; days?: number }) => request<RulePreviewResult>("/api/anomalies/rules/preview", { method: "POST", body: { rule, days } }),
  });
}

// ── Campaign picker ──────────────────────────────────────────────────────────────────────────────────

export interface CampaignOption {
  id: string;
  name: string;
  type: CampaignType;
  status: string;
}

/** Id/name/type of every campaign (for scope pickers, excluded campaigns and delivery labels). */
export function useCampaignOptions() {
  const acct = useAccountId();
  return useQuery({
    queryKey: anomalyUiKeys.campaigns(acct),
    queryFn: ({ signal }) =>
      request<{ rows: { id: string; name: string; type: CampaignType; status: string }[] }>("/api/campaigns", { signal }).then((r) =>
        (r.rows ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status })).sort((a, b) => a.name.localeCompare(b.name)),
      ),
    enabled: !!acct,
    staleTime: 5 * 60_000,
    retry: noRetry4xx,
  });
}
