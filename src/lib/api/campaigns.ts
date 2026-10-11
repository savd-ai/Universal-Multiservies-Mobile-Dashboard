"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CampaignDetail, CampaignListResponse, ChangeEventsResponse, ChangeImpactResult } from "@/lib/domain/contracts/actions";
import type { Annotation, AnnotationBody } from "@/lib/domain/contracts/dashboard";
import type { CompareMode, DatePreset } from "@/lib/domain/dates";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";
export interface CampaignRangeQuery {
    range?: DatePreset;
    start?: string;
    end?: string;
    compare: CompareMode;
}
export interface ChangeEventsQuery {
    start: string;
    end: string;
    campaignId?: string;
}
const 裶壍 = (嗥壍: number, 瓔壍: unknown) => !(瓔壍 instanceof ApiError && 瓔壍.status >= 400 && 瓔壍.status < 500) && 嗥壍 < 2;
const 鏃壍: CampaignRangeQuery = { compare: "none" };
export const campaignKeys = {
    all: (悲壍: string) => ["acct", 悲壍, "campaigns"] as const,
    list: (羡壍: string, 麐壍: CampaignRangeQuery) => ["acct", 羡壍, "campaigns", "list", 麐壍] as const,
    detail: (歿壍: string, 詮壍: string, 坝壍: CampaignRangeQuery) => ["acct", 歿壍, "campaigns", "detail", 詮壍, 坝壍] as const,
    impact: (癌壍: string, 锻壍: string, 截壍: string) => ["acct", 癌壍, "campaigns", "impact", 锻壍, 截壍] as const,
    changes: (脙壍: string, 丈壍: ChangeEventsQuery) => ["acct", 脙壍, "campaigns", "changes", 丈壍] as const,
};
const 泷壍 = (详壍: CampaignRangeQuery | null) => ({ range: 详壍?.range, start: 详壍?.start, end: 详壍?.end, compare: 详壍?.compare });
export function useCampaigns(壕壍: CampaignRangeQuery | null) {
    const 矄壍 = useAccountId();
    return useQuery({
        queryKey: campaignKeys.list(矄壍, 壕壍 ?? 鏃壍),
        queryFn: ({ signal: 隳壍 }) => request<CampaignListResponse>("/api/campaigns", { query: 泷壍(壕壍), signal: 隳壍 }),
        enabled: !!矄壍 && !!壕壍,
        placeholderData: (探壍, 芑壍) => (芑壍?.queryKey[1] === 矄壍 ? 探壍 : undefined),
        staleTime: 30000,
        retry: 裶壍,
    });
}
export function useCampaignDetail(侀壍: string | null, 湯壍: CampaignRangeQuery | null) {
    const 赞壍 = useAccountId();
    const 婍壍 = 侀壍 ?? "";
    return useQuery({
        queryKey: campaignKeys.detail(赞壍, 婍壍, 湯壍 ?? 鏃壍),
        queryFn: ({ signal: 礼壍 }) => request<CampaignDetail>(`/api/campaigns/${encodeURIComponent(婍壍)}`, { query: 泷壍(湯壍), signal: 礼壍 }),
        enabled: !!赞壍 && !!侀壍 && !!湯壍,
        placeholderData: (頫壍, 攚壍) => (攚壍?.queryKey[1] === 赞壍 && 攚壍.queryKey[4] === 婍壍 ? 頫壍 : undefined),
        staleTime: 30000,
        retry: 裶壍,
    });
}
export function useChangeImpact(萉壍: string, 僸壍: string | null) {
    const 濧壍 = useAccountId();
    return useQuery({
        queryKey: campaignKeys.impact(濧壍, 萉壍, 僸壍 ?? ""),
        queryFn: ({ signal: 軖壍 }) => request<ChangeImpactResult>(`/api/campaigns/${encodeURIComponent(萉壍)}/impact`, { query: { eventId: 僸壍 }, signal: 軖壍 }),
        enabled: !!濧壍 && !!僸壍,
        staleTime: 5 * 60000,
        retry: 裶壍,
    });
}
export function useChangeEvents(寅壍: ChangeEventsQuery | null) {
    const 窴壍 = useAccountId();
    return useQuery({
        queryKey: campaignKeys.changes(窴壍, 寅壍 ?? { start: "", end: "" }),
        queryFn: ({ signal: 馣壍 }) => request<ChangeEventsResponse>("/api/change-events", { query: { start: 寅壍?.start, end: 寅壍?.end, campaignId: 寅壍?.campaignId }, signal: 馣壍 }),
        enabled: !!窴壍 && !!寅壍,
        placeholderData: (暒壍, 薁壍) => (薁壍?.queryKey[1] === 窴壍 ? 暒壍 : undefined),
        staleTime: 60000,
        retry: 裶壍,
    });
}
export function useInvalidateCampaigns(): () => Promise<void> {
    const 剰壍 = useQueryClient();
    const 煟壍 = useAccountId();
    return () => 剰壍.invalidateQueries({ queryKey: campaignKeys.all(煟壍) }, { cancelRefetch: false });
}
export function useCreateAnnotation() {
    const 過壍 = useQueryClient();
    const 崽壍 = useAccountId();
    return useMutation({
        mutationFn: (簬壍: AnnotationBody) => request<Annotation>("/api/annotations", { body: 簬壍 }),
        onSuccess: () => void 過壍.invalidateQueries({ queryKey: ["acct", 崽壍, "annotations"] }),
    });
}
export function useDeleteAnnotation() {
    const 鬛壍 = useQueryClient();
    const 栊壍 = useAccountId();
    return useMutation({
        mutationFn: (蛹壍: string) => request<{
            ok: boolean;
        }>(`/api/annotations/${encodeURIComponent(蛹壍)}`, { method: "DELETE" }),
        onSuccess: () => void 鬛壍.invalidateQueries({ queryKey: ["acct", 栊壍, "annotations"] }),
    });
}
