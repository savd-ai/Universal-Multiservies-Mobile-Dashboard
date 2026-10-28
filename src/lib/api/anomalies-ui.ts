"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnomalySettings, RulePreviewResult, SignalState, SignalView, ThresholdRule } from "@/lib/domain/contracts/anomaly";
import type { CampaignType } from "@/lib/domain/types";
import type { AnomalyList } from "./analytics";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";
const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;
export const anomalyUiKeys = {
    settings: () => ["anomaly-settings"] as const,
    rules: () => ["anomaly-rules"] as const,
    feed: (acct: string) => ["acct", acct, "anomalies"] as const,
    campaigns: (acct: string) => ["acct", acct, "anomalies-ui", "campaign-options"] as const,
};
export function useAnomalySettings() {
    return useQuery({
        queryKey: anomalyUiKeys.settings(),
        queryFn: ({ signal }) => request<AnomalySettings>("/api/anomalies/settings", { signal }),
        staleTime: 60000,
        retry: noRetry4xx,
    });
}
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
export interface EvaluateResponse {
    evaluatedAt: string;
    dataThrough: string;
    counts: {
        signals: number;
        newOrEscalated: number;
        resolved: number;
    };
}
export function useEvaluateAnomalies() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: () => request<EvaluateResponse>("/api/anomalies/evaluate", { method: "POST", body: {} }),
        onSettled: () => void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) }),
    });
}
export function useAddSignalNote() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: ({ id, text }: {
            id: string;
            text: string;
        }) => request<{
            signal: SignalView | null;
            state: SignalState;
        }>(`/api/anomalies/${encodeURIComponent(id)}/notes`, { method: "POST", body: { text } }),
        onMutate: async ({ id, text }) => {
            const key = anomalyUiKeys.feed(acct);
            await qc.cancelQueries({ queryKey: key });
            const snapshots = qc.getQueriesData<AnomalyList>({ queryKey: key });
            const note = { at: new Date().toISOString(), text: text.trim() };
            for (const [k, data] of snapshots) {
                if (!data || !Array.isArray(data.signals))
                    continue;
                qc.setQueryData<AnomalyList>(k, { ...data, signals: data.signals.map((s) => (s.id === id ? { ...s, notes: [...s.notes, note] } : s)) });
            }
            return { snapshots };
        },
        onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([k, d]) => qc.setQueryData(k, d)),
        onSettled: () => void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) }),
    });
}
export function useThresholdRules() {
    return useQuery({
        queryKey: anomalyUiKeys.rules(),
        queryFn: ({ signal }) => request<{
            rules: ThresholdRule[];
        }>("/api/anomalies/rules", { signal }).then((r) => r.rules),
        staleTime: 60000,
        retry: noRetry4xx,
    });
}
type RuleInput = Omit<ThresholdRule, "id"> & {
    id?: string;
};
function useRuleInvalidation() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return () => {
        void qc.invalidateQueries({ queryKey: anomalyUiKeys.rules() });
        void qc.invalidateQueries({ queryKey: anomalyUiKeys.settings() });
        void qc.invalidateQueries({ queryKey: anomalyUiKeys.feed(acct) });
    };
}
export function useSaveThresholdRule() {
    const qc = useQueryClient();
    const invalidate = useRuleInvalidation();
    return useMutation({
        mutationFn: ({ id, rule }: {
            id?: string;
            rule: RuleInput;
        }) => id ? request<ThresholdRule>(`/api/anomalies/rules/${encodeURIComponent(id)}`, { method: "PUT", body: rule }) : request<ThresholdRule>("/api/anomalies/rules", { method: "POST", body: rule }),
        onMutate: async ({ id, rule }) => {
            if (!id)
                return { prev: undefined };
            await qc.cancelQueries({ queryKey: anomalyUiKeys.rules() });
            const prev = qc.getQueryData<ThresholdRule[]>(anomalyUiKeys.rules());
            if (prev)
                qc.setQueryData<ThresholdRule[]>(anomalyUiKeys.rules(), prev.map((r) => (r.id === id ? { ...rule, id } : r)));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev)
                qc.setQueryData(anomalyUiKeys.rules(), ctx.prev);
        },
        onSettled: invalidate,
    });
}
export function useDeleteThresholdRule() {
    const invalidate = useRuleInvalidation();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: true;
        }>(`/api/anomalies/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSettled: invalidate,
    });
}
export function useRulePreview() {
    return useMutation({
        mutationFn: ({ rule, days = 30 }: {
            rule: RuleInput;
            days?: number;
        }) => request<RulePreviewResult>("/api/anomalies/rules/preview", { method: "POST", body: { rule, days } }),
    });
}
export interface CampaignOption {
    id: string;
    name: string;
    type: CampaignType;
    status: string;
}
export function useCampaignOptions() {
    const acct = useAccountId();
    return useQuery({
        queryKey: anomalyUiKeys.campaigns(acct),
        queryFn: ({ signal }) => request<{
            rows: {
                id: string;
                name: string;
                type: CampaignType;
                status: string;
            }[];
        }>("/api/campaigns", { signal }).then((r) => (r.rows ?? []).map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status })).sort((a, b) => a.name.localeCompare(b.name))),
        enabled: !!acct,
        staleTime: 5 * 60000,
        retry: noRetry4xx,
    });
}
