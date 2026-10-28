"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnomalyFeedResponse, SignalAction, SignalView } from "@/lib/domain/contracts/anomaly";
import type { PacingReport } from "@/lib/domain/contracts/budget";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";
const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;
export interface AnomalyCounts {
    all: number;
    critical: number;
    warning: number;
    info: number;
    open: number;
}
export type AnomalyList = Omit<AnomalyFeedResponse, "settings" | "dataThrough" | "mode" | "preview" | "warnings" | "generatedAt"> & Partial<Pick<AnomalyFeedResponse, "settings" | "dataThrough" | "mode" | "preview" | "warnings" | "generatedAt">>;
export function useAnomalies(params: Record<string, string | undefined> = {}, opts: {
    enabled?: boolean;
} = {}) {
    const acct = useAccountId();
    return useQuery({
        queryKey: ["acct", acct, "anomalies", "list", params],
        queryFn: ({ signal }) => request<AnomalyList>("/api/anomalies", { query: params, signal }),
        enabled: !!acct && opts.enabled !== false,
        staleTime: 60000,
        placeholderData: keepPreviousData,
        retry: noRetry4xx,
    });
}
export function useSignalAction() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: ({ id, action }: {
            id: string;
            action: SignalAction;
        }) => request<{
            signal: SignalView | null;
        } | SignalView>(`/api/anomalies/${encodeURIComponent(id)}`, { method: "PATCH", body: action }).then((r) => ("signal" in r ? r.signal : r)),
        onMutate: async ({ id, action }) => {
            const key = ["acct", acct, "anomalies"];
            await qc.cancelQueries({ queryKey: key });
            const status = action.action === "acknowledge" ? "acknowledged" : action.action === "snooze" ? "snoozed" : action.action === "resolve" ? "resolved" : "open";
            const snoozedUntil = action.action === "snooze" ? new Date(Date.now() + action.hours * 3600000).toISOString() : undefined;
            const at = new Date().toISOString();
            const snapshots = qc.getQueriesData<AnomalyList>({ queryKey: key });
            for (const [k, data] of snapshots) {
                if (!data || !Array.isArray((data as AnomalyList).signals))
                    continue;
                qc.setQueryData<AnomalyList>(k, { ...data, signals: data.signals.map((s) => (s.id === id ? { ...s, status, snoozedUntil, statusChangedAt: at } : s)) });
            }
            return { snapshots };
        },
        onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([k, d]) => qc.setQueryData(k, d)),
        onSettled: () => void qc.invalidateQueries({ queryKey: ["acct", acct, "anomalies"] }),
    });
}
export function usePacing(month?: string) {
    const acct = useAccountId();
    return useQuery({
        queryKey: ["acct", acct, "budget", "pacing", month ?? "current"],
        queryFn: ({ signal }) => request<PacingReport>("/api/budget/pacing", { query: { month }, signal }),
        enabled: !!acct,
        staleTime: 60000,
        placeholderData: keepPreviousData,
        retry: noRetry4xx,
    });
}
