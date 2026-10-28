"use client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlertChannelBody, AlertChannelUpdate, AlertChannelView, AlertDelivery, AlertRoute, AlertRouteBody, AlertRunSummary, DeliveriesPage, DeliveryStatus, DigestPreview, } from "@/lib/domain/contracts/alerts";
import { ApiError, request } from "./client";
import { qk, useAccountId } from "./hooks";
const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;
export const alertKeys = {
    all: () => ["alerts"] as const,
    channels: () => ["alerts", "channels"] as const,
    routes: () => ["alerts", "routes"] as const,
    deliveries: (params: DeliveriesParams) => ["alerts", "deliveries", params] as const,
};
export function useAlertChannels() {
    return useQuery({
        queryKey: alertKeys.channels(),
        queryFn: ({ signal }) => request<AlertChannelView[]>("/api/alerts/channels", { signal }),
        staleTime: 30000,
        retry: noRetry4xx,
    });
}
export function useSaveAlertChannel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: {
            id?: undefined;
            body: AlertChannelBody;
        } | {
            id: string;
            body: AlertChannelUpdate;
        }) => v.id ? request<AlertChannelView>(`/api/alerts/channels/${encodeURIComponent(v.id)}`, { method: "PUT", body: v.body }) : request<AlertChannelView>("/api/alerts/channels", { method: "POST", body: v.body }),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: alertKeys.channels() });
            void qc.invalidateQueries({ queryKey: alertKeys.routes() });
        },
    });
}
export function useDeleteAlertChannel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: true;
            updatedRoutes: string[];
        }>(`/api/alerts/channels/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: alertKeys.channels() });
            void qc.invalidateQueries({ queryKey: alertKeys.routes() });
        },
    });
}
export interface ChannelTestResult {
    ok: boolean;
    status: number | null;
    error: string | null;
    delivery: AlertDelivery;
    channel: AlertChannelView;
}
export function useTestAlertChannel() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<ChannelTestResult>(`/api/alerts/channels/${encodeURIComponent(id)}/test`, { method: "POST", body: {} }),
        onSuccess: (res) => {
            qc.setQueryData<AlertChannelView[]>(alertKeys.channels(), (list) => list?.map((c) => (c.id === res.channel.id ? res.channel : c)));
            void qc.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
        },
    });
}
export function useAlertRoutes() {
    return useQuery({
        queryKey: alertKeys.routes(),
        queryFn: ({ signal }) => request<AlertRoute[]>("/api/alerts/routes", { signal }),
        staleTime: 30000,
        retry: noRetry4xx,
    });
}
export function useSaveAlertRoute() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body, version }: {
            id?: string;
            body: AlertRouteBody;
            version?: number;
        }) => id ? request<AlertRoute>(`/api/alerts/routes/${encodeURIComponent(id)}`, { method: "PUT", body: { ...body, version } }) : request<AlertRoute>("/api/alerts/routes", { method: "POST", body }),
        onSettled: () => void qc.invalidateQueries({ queryKey: alertKeys.routes() }),
    });
}
export function useDeleteAlertRoute() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: true;
        }>(`/api/alerts/routes/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSettled: () => void qc.invalidateQueries({ queryKey: alertKeys.routes() }),
    });
}
export interface DeliveriesParams {
    status?: DeliveryStatus;
    channelId?: string;
    limit?: number;
}
export function useDeliveries(params: DeliveriesParams = {}) {
    return useInfiniteQuery({
        queryKey: alertKeys.deliveries(params),
        queryFn: ({ pageParam, signal }) => request<DeliveriesPage>("/api/alerts/deliveries", { query: { status: params.status, channelId: params.channelId, limit: params.limit ?? 50, cursor: pageParam }, signal }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        placeholderData: keepPreviousData,
        staleTime: 15000,
        retry: noRetry4xx,
    });
}
export function useRetryDelivery() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => request<AlertDelivery>(`/api/alerts/deliveries/${encodeURIComponent(id)}/retry`, { method: "POST", body: {} }),
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
            void qc.invalidateQueries({ queryKey: alertKeys.channels() });
        },
    });
}
export function useRunAlerts() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: (body: {
            dryRun?: boolean;
            force?: boolean;
        }) => request<AlertRunSummary>("/api/alerts/run", { method: "POST", body }),
        onSuccess: (res) => {
            if (res.dryRun)
                return;
            void qc.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
            void qc.invalidateQueries({ queryKey: alertKeys.channels() });
            void qc.invalidateQueries({ queryKey: ["acct", acct, "anomalies"] });
            void qc.invalidateQueries({ queryKey: qk.status() });
        },
    });
}
export function useDigestPreview() {
    return useMutation({
        mutationFn: (routeId?: string) => request<DigestPreview>("/api/alerts/digest/preview", { method: "POST", body: routeId ? { routeId } : {} }),
    });
}
