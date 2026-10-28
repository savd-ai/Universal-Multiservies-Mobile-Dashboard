"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomMetric, Dashboard, DashboardBody, SavedQuestion, SavedQuestionBody } from "@/lib/domain/contracts/dashboard";
import type { AppSettings } from "@/lib/domain/contracts/settings";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";
import { buildCatalog } from "./catalog";
import { request } from "./client";
import { batchedQuery } from "./query-batcher";
import { qk } from "./query-keys";
export { qk } from "./query-keys";
export function useStatus() {
    return useQuery({
        queryKey: qk.status(),
        queryFn: ({ signal }) => request<StatusResponse>("/api/status", { signal }),
        staleTime: 30000,
        refetchInterval: (q) => (q.state.data?.mode === "live" ? 60000 : false),
    });
}
export function useAccountId(): string {
    return useStatus().data?.account.id ?? "";
}
export type { Catalog, CatalogMetric } from "./catalog";
export function useCatalog() {
    return useQuery({
        queryKey: qk.catalog(),
        queryFn: async ({ signal }) => buildCatalog((await request<{
            metrics: CustomMetric[];
        }>("/api/metrics/custom", { signal })).metrics),
        staleTime: 5 * 60000,
    });
}
export function useQueryResult(spec: QuerySpecInput | null, opts: {
    enabled?: boolean;
    live?: boolean;
} = {}) {
    const acct = useAccountId();
    const status = useStatus();
    return useQuery({
        queryKey: qk.query(acct, spec ?? { metrics: [] }),
        queryFn: () => batchedQuery(spec as QuerySpecInput),
        enabled: !!spec && !!acct && opts.enabled !== false,
        placeholderData: keepPreviousData,
        staleTime: status.data?.mode !== "live" ? Infinity : 60000,
    });
}
export function useSettings() {
    return useQuery({ queryKey: qk.settings(), queryFn: ({ signal }) => request<AppSettings>("/api/settings", { signal }) });
}
export function useUpdateSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (patch: Partial<AppSettings>) => request<AppSettings>("/api/settings", { method: "PUT", body: patch }),
        onSuccess: (data) => {
            qc.setQueryData(qk.settings(), data);
            void qc.invalidateQueries({ queryKey: qk.status() });
            void qc.invalidateQueries({ queryKey: ["acct"] });
        },
    });
}
export function useDashboards() {
    return useQuery({ queryKey: qk.dashboards(), queryFn: ({ signal }) => request<{
            dashboards: Dashboard[];
        }>("/api/dashboards", { signal }).then((r) => r.dashboards), staleTime: Infinity });
}
export function useDashboardTemplates() {
    return useQuery({
        queryKey: qk.templates(),
        queryFn: ({ signal }) => request<{
            templates: {
                id: string;
                name: string;
                headline: string;
                description: string;
            }[];
        }>("/api/dashboards/templates", { signal }).then((r) => r.templates),
        staleTime: Infinity,
    });
}
export function useCreateDashboard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: {
            template: string;
            name?: string;
        } | {
            doc: DashboardBody;
        }) => request<Dashboard>("/api/dashboards", { body }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useSaveDashboard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, doc, version }: {
            id: string;
            doc: DashboardBody;
            version?: number;
        }) => request<Dashboard>(`/api/dashboards/${id}`, { method: "PUT", body: { doc, version } }),
        onMutate: async ({ id, doc }) => {
            await qc.cancelQueries({ queryKey: qk.dashboards() });
            const prev = qc.getQueryData<Dashboard[]>(qk.dashboards());
            if (prev)
                qc.setQueryData<Dashboard[]>(qk.dashboards(), prev.map((d) => (d.id === id ? { ...d, ...doc } : doc.isDefault ? { ...d, isDefault: false } : d)));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev)
                qc.setQueryData(qk.dashboards(), ctx.prev);
        },
        onSuccess: (saved) => {
            qc.setQueryData<Dashboard[]>(qk.dashboards(), (list) => (list ?? []).map((d) => (d.id === saved.id ? saved : saved.isDefault ? { ...d, isDefault: false } : d)));
        },
    });
}
export function useDeleteDashboard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request(`/api/dashboards/${id}`, { method: "DELETE" }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useDuplicateDashboard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<Dashboard>(`/api/dashboards/${id}/duplicate`, { method: "POST" }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useQuestions() {
    return useQuery({ queryKey: qk.questions(), queryFn: ({ signal }) => request<{
            questions: SavedQuestion[];
        }>("/api/questions", { signal }).then((r) => r.questions) });
}
export function useSaveQuestion() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: SavedQuestionBody) => request<SavedQuestion>("/api/questions", { body }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: qk.questions() }),
    });
}
export interface AnnotationMark {
    id: string;
    date: string;
    text: string;
    kind: string;
    campaignId?: string;
    source: "note" | "change";
}
export function useAnnotations(start: string, end: string, opts: {
    includeChanges?: boolean;
    campaignId?: string;
    enabled?: boolean;
} = {}) {
    const acct = useAccountId();
    return useQuery({
        queryKey: [...qk.annotations(acct, start, end, opts.campaignId), opts.includeChanges ? 1 : 0],
        queryFn: ({ signal }) => request<{
            annotations: AnnotationMark[];
        }>("/api/annotations", { query: { start, end, includeChanges: opts.includeChanges ? "1" : "0", campaignId: opts.campaignId }, signal }).then((r) => r.annotations),
        enabled: !!acct && !!start && !!end && opts.enabled !== false,
    });
}
export type { QueryResult };
