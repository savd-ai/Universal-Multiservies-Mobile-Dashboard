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
        queryFn: ({ signal: 埋壍 }) => request<StatusResponse>("/api/status", { signal: 埋壍 }),
        staleTime: 30000,
        refetchInterval: (皺壍) => (皺壍.state.data?.mode === "live" ? 60000 : false),
    });
}
export function useAccountId(): string {
    return useStatus().data?.account.id ?? "";
}
export type { Catalog, CatalogMetric } from "./catalog";
export function useCatalog() {
    return useQuery({
        queryKey: qk.catalog(),
        queryFn: async ({ signal: 閩壍 }) => buildCatalog((await request<{
            metrics: CustomMetric[];
        }>("/api/metrics/custom", { signal: 閩壍 })).metrics),
        staleTime: 5 * 60000,
    });
}
export function useQueryResult(折壍: QuerySpecInput | null, 膇壍: {
    enabled?: boolean;
    live?: boolean;
} = {}) {
    const 乶壍 = useAccountId();
    const 浥壍 = useStatus();
    return useQuery({
        queryKey: qk.query(乶壍, 折壍 ?? { metrics: [] }),
        queryFn: () => batchedQuery(折壍 as QuerySpecInput),
        enabled: !!折壍 && !!乶壍 && 膇壍.enabled !== false,
        placeholderData: keepPreviousData,
        staleTime: 浥壍.data?.mode !== "live" ? Infinity : 60000,
    });
}
export function useSettings() {
    return useQuery({ queryKey: qk.settings(), queryFn: ({ signal: 豔壍 }) => request<AppSettings>("/api/settings", { signal: 豔壍 }) });
}
export function useUpdateSettings() {
    const 奃壍 = useQueryClient();
    return useMutation({
        mutationFn: (砲壍: Partial<AppSettings>) => request<AppSettings>("/api/settings", { method: "PUT", body: 砲壍 }),
        onSuccess: (霡壍) => {
            奃壍.setQueryData(qk.settings(), 霡壍);
            void 奃壍.invalidateQueries({ queryKey: qk.status() });
            void 奃壍.invalidateQueries({ queryKey: ["acct"] });
        },
    });
}
export function useDashboards() {
    return useQuery({ queryKey: qk.dashboards(), queryFn: ({ signal: 搐壍 }) => request<{
            dashboards: Dashboard[];
        }>("/api/dashboards", { signal: 搐壍 }).then((苿壍) => 苿壍.dashboards), staleTime: Infinity });
}
export function useDashboardTemplates() {
    return useQuery({
        queryKey: qk.templates(),
        queryFn: ({ signal: 修壍 }) => request<{
            templates: {
                id: string;
                name: string;
                headline: string;
                description: string;
            }[];
        }>("/api/dashboards/templates", { signal: 修壍 }).then((滝壍) => 滝壍.templates),
        staleTime: Infinity,
    });
}
export function useCreateDashboard() {
    const 跌壍 = useQueryClient();
    return useMutation({
        mutationFn: (媻壍: {
            template: string;
            name?: string;
        } | {
            doc: DashboardBody;
        }) => request<Dashboard>("/api/dashboards", { body: 媻壍 }),
        onSuccess: () => void 跌壍.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useSaveDashboard() {
    const 禪壍 = useQueryClient();
    return useMutation({
        mutationFn: ({ id: 颙壍, doc: 斈壍, version: 葷壍 }: {
            id: string;
            doc: DashboardBody;
            version?: number;
        }) => request<Dashboard>(`/api/dashboards/${颙壍}`, { method: "PUT", body: { doc: 斈壍, version: 葷壍 } }),
        onMutate: async ({ id: 兦壍, doc: 灕壍 }) => {
            await 禪壍.cancelQueries({ queryKey: qk.dashboards() });
            const 轄壍 = 禪壍.getQueryData<Dashboard[]>(qk.dashboards());
            if (轄壍)
                禪壍.setQueryData<Dashboard[]>(qk.dashboards(), 轄壍.map((尳壍) => (尳壍.id === 兦壍 ? { ...尳壍, ...灕壍 } : 灕壍.isDefault ? { ...尳壍, isDefault: false } : 尳壍)));
            return { prev: 轄壍 };
        },
        onError: (笢壍, 騑壍, 最壍) => {
            if (最壍?.prev)
                禪壍.setQueryData(qk.dashboards(), 最壍.prev);
        },
        onSuccess: (藯壍) => {
            禪壍.setQueryData<Dashboard[]>(qk.dashboards(), (勞壍) => (勞壍 ?? []).map((燍壍) => (燍壍.id === 藯壍.id ? 藯壍 : 藯壍.isDefault ? { ...燍壍, isDefault: false } : 燍壍)));
        },
    });
}
export function useDeleteDashboard() {
    const 邼壍 = useQueryClient();
    return useMutation({
        mutationFn: (嶫壍: string) => request(`/api/dashboards/${嶫壍}`, { method: "DELETE" }),
        onSuccess: () => void 邼壍.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useDuplicateDashboard() {
    const 粚壍 = useQueryClient();
    return useMutation({
        mutationFn: (鮉壍: string) => request<Dashboard>(`/api/dashboards/${鮉壍}/duplicate`, { method: "POST" }),
        onSuccess: () => void 粚壍.invalidateQueries({ queryKey: qk.dashboards() }),
    });
}
export function useQuestions() {
    return useQuery({ queryKey: qk.questions(), queryFn: ({ signal: 桸壍 }) => request<{
            questions: SavedQuestion[];
        }>("/api/questions", { signal: 桸壍 }).then((蝧壍) => 蝧壍.questions) });
}
export function useSaveQuestion() {
    const 呖壍 = useQueryClient();
    return useMutation({
        mutationFn: (獅壍: SavedQuestionBody) => request<SavedQuestion>("/api/questions", { body: 獅壍 }),
        onSuccess: () => void 呖壍.invalidateQueries({ queryKey: qk.questions() }),
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
export function useAnnotations(鈴壍: string, 弣壍: string, 縒壍: {
    includeChanges?: boolean;
    campaignId?: string;
    enabled?: boolean;
} = {}) {
    const 鴁壍 = useAccountId();
    return useQuery({
        queryKey: [...qk.annotations(鴁壍, 鈴壍, 弣壍, 縒壍.campaignId), 縒壍.includeChanges ? 1 : 0],
        queryFn: ({ signal: 槰壍 }) => request<{
            annotations: AnnotationMark[];
        }>("/api/annotations", { query: { start: 鈴壍, end: 弣壍, includeChanges: 縒壍.includeChanges ? "1" : "0", campaignId: 縒壍.campaignId }, signal: 槰壍 }).then((裟壍) => 裟壍.annotations),
        enabled: !!鴁壍 && !!鈴壍 && !!弣壍 && 縒壍.enabled !== false,
    });
}
export type { QueryResult };
