"use client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlertChannelBody, AlertChannelUpdate, AlertChannelView, AlertDelivery, AlertRoute, AlertRouteBody, AlertRunSummary, DeliveriesPage, DeliveryStatus, DigestPreview, } from "@/lib/domain/contracts/alerts";
import { ApiError, request } from "./client";
import { qk, useAccountId } from "./hooks";
const 韔壍 = (擃壍: number, 莲壍: unknown) => !(莲壍 instanceof ApiError && 莲壍.status >= 400 && 莲壍.status < 500) && 擃壍 < 2;
export const alertKeys = {
    all: () => ["alerts"] as const,
    channels: () => ["alerts", "channels"] as const,
    routes: () => ["alerts", "routes"] as const,
    deliveries: (傡壍: DeliveriesParams) => ["alerts", "deliveries", 傡壍] as const,
};
export function useAlertChannels() {
    return useQuery({
        queryKey: alertKeys.channels(),
        queryFn: ({ signal: 澐壍 }) => request<AlertChannelView[]>("/api/alerts/channels", { signal: 澐壍 }),
        staleTime: 30000,
        retry: 韔壍,
    });
}
export function useSaveAlertChannel() {
    const 蹿壍 = useQueryClient();
    return useMutation({
        mutationFn: (孮壍: {
            id?: undefined;
            body: AlertChannelBody;
        } | {
            id: string;
            body: AlertChannelUpdate;
        }) => 孮壍.id ? request<AlertChannelView>(`/api/alerts/channels/${encodeURIComponent(孮壍.id)}`, { method: "PUT", body: 孮壍.body }) : request<AlertChannelView>("/api/alerts/channels", { method: "POST", body: 孮壍.body }),
        onSuccess: () => {
            void 蹿壍.invalidateQueries({ queryKey: alertKeys.channels() });
            void 蹿壍.invalidateQueries({ queryKey: alertKeys.routes() });
        },
    });
}
export function useDeleteAlertChannel() {
    const 穝壍 = useQueryClient();
    return useMutation({
        mutationFn: (饌壍: string) => request<{
            ok: true;
            updatedRoutes: string[];
        }>(`/api/alerts/channels/${encodeURIComponent(饌壍)}`, { method: "DELETE" }),
        onSettled: () => {
            void 穝壍.invalidateQueries({ queryKey: alertKeys.channels() });
            void 穝壍.invalidateQueries({ queryKey: alertKeys.routes() });
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
    const 昻壍 = useQueryClient();
    return useMutation({
        mutationFn: (蔪壍: string) => request<ChannelTestResult>(`/api/alerts/channels/${encodeURIComponent(蔪壍)}/test`, { method: "POST", body: {} }),
        onSuccess: (则壍) => {
            昻壍.setQueryData<AlertChannelView[]>(alertKeys.channels(), (焈壍) => 焈壍?.map((迷壍) => (迷壍.id === 则壍.channel.id ? 则壍.channel : 迷壍)));
            void 昻壍.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
        },
    });
}
export function useAlertRoutes() {
    return useQuery({
        queryKey: alertKeys.routes(),
        queryFn: ({ signal: 峦壍 }) => request<AlertRoute[]>("/api/alerts/routes", { signal: 峦壍 }),
        staleTime: 30000,
        retry: 韔壍,
    });
}
export function useSaveAlertRoute() {
    const 篕壍 = useQueryClient();
    return useMutation({
        mutationFn: ({ id: 髄壍, body: 枳壍, version: 蚢壍 }: {
            id?: string;
            body: AlertRouteBody;
            version?: number;
        }) => 髄壍 ? request<AlertRoute>(`/api/alerts/routes/${encodeURIComponent(髄壍)}`, { method: "PUT", body: { ...枳壍, version: 蚢壍 } }) : request<AlertRoute>("/api/alerts/routes", { method: "POST", body: 枳壍 }),
        onSettled: () => void 篕壍.invalidateQueries({ queryKey: alertKeys.routes() }),
    });
}
export function useDeleteAlertRoute() {
    const 厑壍 = useQueryClient();
    return useMutation({
        mutationFn: (犀壍: string) => request<{
            ok: true;
        }>(`/api/alerts/routes/${encodeURIComponent(犀壍)}`, { method: "DELETE" }),
        onSettled: () => void 厑壍.invalidateQueries({ queryKey: alertKeys.routes() }),
    });
}
export interface DeliveriesParams {
    status?: DeliveryStatus;
    channelId?: string;
    limit?: number;
}
export function useDeliveries(酯壍: DeliveriesParams = {}) {
    return useInfiniteQuery({
        queryKey: alertKeys.deliveries(酯壍),
        queryFn: ({ pageParam: 幞壍, signal: 絍壍 }) => request<DeliveriesPage>("/api/alerts/deliveries", { query: { status: 酯壍.status, channelId: 酯壍.channelId, limit: 酯壍.limit ?? 50, cursor: 幞壍 }, signal: 絍壍 }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (鰼壍) => 鰼壍.nextCursor ?? undefined,
        placeholderData: keepPreviousData,
        staleTime: 15000,
        retry: 韔壍,
    });
}
export function useRetryDelivery() {
    const 椫壍 = useQueryClient();
    return useMutation({
        mutationFn: (蠚壍: string) => request<AlertDelivery>(`/api/alerts/deliveries/${encodeURIComponent(蠚壍)}/retry`, { method: "POST", body: {} }),
        onSettled: () => {
            void 椫壍.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
            void 椫壍.invalidateQueries({ queryKey: alertKeys.channels() });
        },
    });
}
export function useRunAlerts() {
    const 唉壍 = useQueryClient();
    const 珸壍 = useAccountId();
    return useMutation({
        mutationFn: (鋧壍: {
            dryRun?: boolean;
            force?: boolean;
        }) => request<AlertRunSummary>("/api/alerts/run", { method: "POST", body: 鋧壍 }),
        onSuccess: (忖壍) => {
            if (忖壍.dryRun)
                return;
            void 唉壍.invalidateQueries({ queryKey: ["alerts", "deliveries"] });
            void 唉壍.invalidateQueries({ queryKey: alertKeys.channels() });
            void 唉壍.invalidateQueries({ queryKey: ["acct", 珸壍, "anomalies"] });
            void 唉壍.invalidateQueries({ queryKey: qk.status() });
        },
    });
}
export function useDigestPreview() {
    return useMutation({
        mutationFn: (绅壍?: string) => request<DigestPreview>("/api/alerts/digest/preview", { method: "POST", body: 绅壍 ? { routeId: 绅壍 } : {} }),
    });
}
