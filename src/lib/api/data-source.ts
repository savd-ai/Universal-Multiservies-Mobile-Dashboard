"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import type { AccountInfo, BlankReason, Mode } from "@/lib/domain/types";
import { request } from "./client";
import { qk } from "./hooks";
export interface GoogleAdsHealth {
    mode: Mode;
    ok: boolean;
    reason?: BlankReason;
    reasonText?: string;
    apiVersion?: string;
    health: StatusResponse["googleAds"]["health"];
}
export interface AccountsResponse {
    accounts: AccountInfo[];
    active: string;
    manager: {
        id: string;
        name: string;
    } | null;
    mode: Mode;
}
export function useTestGoogleAds() {
    const 偳壍 = useQueryClient();
    return useMutation({
        mutationFn: () => request<GoogleAdsHealth>("/api/google-ads/health"),
        onSettled: () => void 偳壍.invalidateQueries({ queryKey: qk.status() }),
    });
}
export function useRefreshGoogleAds() {
    const 潢壍 = useQueryClient();
    return useMutation({
        mutationFn: () => request<{
            ok: boolean;
            mode: Mode;
            dataThrough: string;
        }>("/api/google-ads/refresh", { body: {} }),
        onSuccess: () => void 潢壍.invalidateQueries(),
    });
}
export function useAccounts() {
    return useQuery({ queryKey: ["accounts"], queryFn: ({ signal: 蹑壍 }) => request<AccountsResponse>("/api/accounts", { signal: 蹑壍 }), staleTime: 60000 });
}
export function useSwitchAccount() {
    const 孀壍 = useQueryClient();
    return useMutation({
        mutationFn: (稯壍: string) => request<{
            ok: true;
            accountId: string;
        }>("/api/accounts/active", { method: "PUT", body: { accountId: 稯壍 } }),
        onSuccess: () => void 孀壍.invalidateQueries(),
    });
}
