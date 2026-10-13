"use client";
import { useQuery } from "@tanstack/react-query";
import type { DemoResponse } from "@/lib/domain/contracts/demo";
import { request } from "./client";
import { qk } from "./query-keys";
export function useDemo(account: string | null) {
    return useQuery({
        queryKey: [...qk.demo(), account ?? "default"],
        queryFn: ({ signal }) => request<DemoResponse>(`/api/demo${account ? `?account=${encodeURIComponent(account)}` : ""}`, { signal }),
        staleTime: 5 * 60000,
    });
}
