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
const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;
const NONE: CampaignRangeQuery = { compare: "none" };
export const campaignKeys = {
    all: (acct: string) => ["acct", acct, "campaigns"] as const,
    list: (acct: string, q: CampaignRangeQuery) => ["acct", acct, "campaigns", "list", q] as const,
    detail: (acct: string, id: string, q: CampaignRangeQuery) => ["acct", acct, "campaigns", "detail", id, q] as const,
    impact: (acct: string, id: string, eventId: string) => ["acct", acct, "campaigns", "impact", id, eventId] as const,
    changes: (acct: string, q: ChangeEventsQuery) => ["acct", acct, "campaigns", "changes", q] as const,
};
const rangeParams = (q: CampaignRangeQuery | null) => ({ range: q?.range, start: q?.start, end: q?.end, compare: q?.compare });
export function useCampaigns(q: CampaignRangeQuery | null) {
    const acct = useAccountId();
    return useQuery({
        queryKey: campaignKeys.list(acct, q ?? NONE),
        queryFn: ({ signal }) => request<CampaignListResponse>("/api/campaigns", { query: rangeParams(q), signal }),
        enabled: !!acct && !!q,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === acct ? prev : undefined),
        staleTime: 30000,
        retry: noRetry4xx,
    });
}
export function useCampaignDetail(id: string | null, q: CampaignRangeQuery | null) {
    const acct = useAccountId();
    const cid = id ?? "";
    return useQuery({
        queryKey: campaignKeys.detail(acct, cid, q ?? NONE),
        queryFn: ({ signal }) => request<CampaignDetail>(`/api/campaigns/${encodeURIComponent(cid)}`, { query: rangeParams(q), signal }),
        enabled: !!acct && !!id && !!q,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === acct && prevQuery.queryKey[4] === cid ? prev : undefined),
        staleTime: 30000,
        retry: noRetry4xx,
    });
}
export function useChangeImpact(campaignId: string, eventId: string | null) {
    const acct = useAccountId();
    return useQuery({
        queryKey: campaignKeys.impact(acct, campaignId, eventId ?? ""),
        queryFn: ({ signal }) => request<ChangeImpactResult>(`/api/campaigns/${encodeURIComponent(campaignId)}/impact`, { query: { eventId }, signal }),
        enabled: !!acct && !!eventId,
        staleTime: 5 * 60000,
        retry: noRetry4xx,
    });
}
export function useChangeEvents(q: ChangeEventsQuery | null) {
    const acct = useAccountId();
    return useQuery({
        queryKey: campaignKeys.changes(acct, q ?? { start: "", end: "" }),
        queryFn: ({ signal }) => request<ChangeEventsResponse>("/api/change-events", { query: { start: q?.start, end: q?.end, campaignId: q?.campaignId }, signal }),
        enabled: !!acct && !!q,
        placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === acct ? prev : undefined),
        staleTime: 60000,
        retry: noRetry4xx,
    });
}
export function useInvalidateCampaigns(): () => Promise<void> {
    const qc = useQueryClient();
    const acct = useAccountId();
    return () => qc.invalidateQueries({ queryKey: campaignKeys.all(acct) }, { cancelRefetch: false });
}
export function useCreateAnnotation() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: (body: AnnotationBody) => request<Annotation>("/api/annotations", { body }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["acct", acct, "annotations"] }),
    });
}
export function useDeleteAnnotation() {
    const qc = useQueryClient();
    const acct = useAccountId();
    return useMutation({
        mutationFn: (id: string) => request<{
            ok: boolean;
        }>(`/api/annotations/${encodeURIComponent(id)}`, { method: "DELETE" }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["acct", acct, "annotations"] }),
    });
}
