"use client";
import { useQuery } from "@tanstack/react-query";
import type { HistorySummary } from "@/lib/domain/contracts/history";
import { request } from "./client";
import { qk } from "./query-keys";

export interface HistoryStatus {
  available: boolean;
  reason: string | null;
  file: string;
  schemaVersion: number;
  sqliteVersion: string | null;
  bytes: number | null;
  counts: Record<string, number> | null;
}

export function useHistoryStatus(enabled: boolean) {
  return useQuery({ queryKey: ["history-status"], queryFn: ({ signal }) => request<HistoryStatus>("/api/history/status", { signal }), enabled, staleTime: 15000 });
}

export function useHistorySummary(accountId: string) {
  return useQuery({
    queryKey: [...qk.acct(accountId), "history-summary"],
    queryFn: ({ signal }) => request<HistorySummary>("/api/history/summary?months=6&scope=all", { signal }),
    enabled: !!accountId,
    staleTime: 30000,
  });
}
