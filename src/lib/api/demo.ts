"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { DemoDataset, DemoLockStatus, DemoUnlockBody } from "@/lib/domain/contracts/demo";
import { request } from "./client";
import { qk } from "./query-keys";
export function useDemoLock() {
    return useQuery({
        queryKey: qk.demo(),
        queryFn: ({ signal }) => request<DemoLockStatus>("/api/demo", { signal }),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    });
}
export function useDemoUnlock() {
    return useMutation({
        mutationFn: (body: DemoUnlockBody) => request<DemoDataset>("/api/demo/unlock", { body }),
    });
}
