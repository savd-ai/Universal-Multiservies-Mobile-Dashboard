"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { AdCopyRequest, AdCopyResult, BlueprintRequest, BlueprintResult, IdeaSet, NegativesResult } from "@/lib/domain/contracts/ai";
import { ApiError, request } from "./client";
import { useAccountId } from "./hooks";

// AI studio endpoints that the shared analytics hooks don't cover: one idea set, blueprint, ad copy and negative
// keyword candidates. All AI calls are POSTs (they may reach a provider and count against the AI quota), so reads
// use long stale times and never retry 4xx (429 = quota).

const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1;

/** A single idea set (for links to sets older than the history list). */
export function useIdeaSet(id: string | null, opts: { enabled?: boolean } = {}) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "idea-sets", "one", id],
    queryFn: ({ signal }) => request<IdeaSet>(`/api/ai/idea-sets/${encodeURIComponent(id ?? "")}`, { signal }),
    enabled: !!acct && !!id && opts.enabled !== false,
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

export function useGenerateBlueprint() {
  return useMutation({ mutationFn: (body: BlueprintRequest) => request<BlueprintResult>("/api/ai/blueprint", { body: { ...body, format: "json" } }) });
}

export function useGenerateAdCopy() {
  return useMutation({ mutationFn: (body: Partial<AdCopyRequest>) => request<AdCopyResult>("/api/ai/ad-copy", { body }) });
}

export interface NegativesParams {
  range?: string;
  campaignId?: string;
}

export function useNegatives(params: NegativesParams) {
  const acct = useAccountId();
  return useQuery({
    queryKey: ["acct", acct, "ai", "negatives", params.range ?? "", params.campaignId ?? ""],
    queryFn: ({ signal }) => request<NegativesResult>("/api/ai/negatives", { body: { range: params.range || undefined, campaignId: params.campaignId || undefined }, signal }),
    enabled: !!acct,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}
