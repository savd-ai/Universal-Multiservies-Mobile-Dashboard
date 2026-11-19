"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import type { AccountInfo, DemoReason, Mode } from "@/lib/domain/types";
import { request } from "./client";
import { qk } from "./hooks";

// Data source page: Google Ads health check, manual refresh and the MCC account switcher. Switching accounts or
// refreshing changes every account-scoped answer, so both invalidate the whole cache.

export interface GoogleAdsHealth {
  mode: Mode;
  ok: boolean;
  reason?: DemoReason;
  reasonText?: string;
  apiVersion?: string;
  health: StatusResponse["googleAds"]["health"];
}

export interface AccountsResponse {
  accounts: AccountInfo[];
  active: string;
  manager: { id: string; name: string } | null;
  mode: Mode;
}

/** "Test connection": GET /api/google-ads/health (demo → reason, live → token + customer query). */
export function useTestGoogleAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<GoogleAdsHealth>("/api/google-ads/health"),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.status() }),
  });
}

/** "Refresh data": re-check credentials, drop cached report chunks and query results. */
export function useRefreshGoogleAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<{ ok: boolean; mode: Mode; dataThrough: string }>("/api/google-ads/refresh", { body: {} }),
    onSuccess: () => void qc.invalidateQueries(),
  });
}

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: ({ signal }) => request<AccountsResponse>("/api/accounts", { signal }), staleTime: 60_000 });
}

export function useSwitchAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => request<{ ok: true; accountId: string }>("/api/accounts/active", { method: "PUT", body: { accountId } }),
    onSuccess: () => void qc.invalidateQueries(),
  });
}
