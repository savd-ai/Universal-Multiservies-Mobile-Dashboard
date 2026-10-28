"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CustomMetric, CustomMetricBody, SavedQuestion, SavedQuestionBody } from "@/lib/domain/contracts/dashboard";
import type { DateRangeSpec, QuerySpecInput } from "@/lib/domain/query/spec";
import { ApiError, download, request } from "./client";
import { qk, useQueryResult } from "./hooks";
const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;
export const exploreKeys = {
    customMetrics: () => ["metrics", "custom"] as const,
    validate: (key: string, formula: string) => ["metrics", "validate", key, formula] as const,
};
export function useCustomMetrics() {
    return useQuery({
        queryKey: exploreKeys.customMetrics(),
        queryFn: ({ signal }) => request<{
            metrics: CustomMetric[];
        }>("/api/metrics/custom", { signal }).then((r) => r.metrics),
        staleTime: 60000,
        retry: noRetry4xx,
    });
}
function useInvalidateMetrics() {
    const qc = useQueryClient();
    return () => {
        void qc.invalidateQueries({ queryKey: ["metrics"] });
        void qc.invalidateQueries({ queryKey: qk.catalog() });
        void qc.invalidateQueries({ queryKey: ["acct"] });
    };
}
export function useSaveCustomMetric() {
    const invalidate = useInvalidateMetrics();
    return useMutation({
        mutationFn: ({ body, id }: {
            body: CustomMetricBody;
            id?: string;
        }) => id ? request<CustomMetric>(`/api/metrics/custom/${encodeURIComponent(id)}`, { method: "PUT", body }) : request<CustomMetric>("/api/metrics/custom", { body }),
        onSuccess: invalidate,
    });
}
export function useDeleteCustomMetric() {
    const invalidate = useInvalidateMetrics();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: boolean;
        }>(`/api/metrics/custom/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSuccess: invalidate,
    });
}
export interface FormulaCheckResult {
    ok: boolean;
    identifiers: string[];
    unknown: string[];
    error?: {
        message: string;
        position: number;
    };
    deps: string[];
}
export function useFormulaCheck(formula: string, key: string | undefined) {
    return useQuery({
        queryKey: exploreKeys.validate(key ?? "", formula),
        queryFn: ({ signal }) => request<FormulaCheckResult>("/api/metrics/custom/validate", { body: { formula, key: key || undefined }, signal }),
        enabled: formula.trim().length > 0,
        placeholderData: keepPreviousData,
        staleTime: 30000,
        retry: noRetry4xx,
    });
}
export function useUpdateQuestion() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: {
            id: string;
            body: SavedQuestionBody;
        }) => request<SavedQuestion>(`/api/questions/${encodeURIComponent(id)}`, { method: "PUT", body }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.questions() }),
    });
}
export function useDeleteQuestion() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: boolean;
        }>(`/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.questions() }),
    });
}
export function useDimensionValues(source: string, dim: string | undefined, dateRange: DateRangeSpec, opts: {
    enabled?: boolean;
    time?: boolean;
} = {}) {
    const spec: QuerySpecInput | null = dim && opts.enabled !== false ? { source, metrics: ["cost"], dimensions: [dim as NonNullable<QuerySpecInput["dimensions"]>[number]], dateRange, ...(opts.time ? {} : { sort: [{ key: "cost", dir: "desc" as const }] }), limit: 200, totals: false } : null;
    const q = useQueryResult(spec);
    const values = useMemo(() => {
        const out: string[] = [];
        if (!dim || !q.data)
            return out;
        for (const r of q.data.rows) {
            const v = r[dim];
            if (v !== null && v !== undefined && v !== "" && !out.includes(String(v)))
                out.push(String(v));
        }
        return out;
    }, [dim, q.data]);
    return { values, isLoading: q.isLoading, error: q.error };
}
export function exportQuery(spec: QuerySpecInput, format: "csv" | "json", filename: string): Promise<void> {
    return download("/api/query/export", { spec, format, filename }, `${filename}.${format}`);
}
