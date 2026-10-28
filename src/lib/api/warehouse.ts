"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarehouseStatus, WarehouseSyncBody, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import { request } from "./client";
import { qk } from "./query-keys";
const key = (accountId: string) => [...qk.acct(accountId), "warehouse"] as const;
export function useWarehouse(accountId: string) {
    return useQuery({
        queryKey: key(accountId),
        queryFn: ({ signal }) => request<WarehouseStatus>("/api/warehouse", { signal }),
        enabled: !!accountId,
        staleTime: 15000,
        refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
    });
}
export function useWarehouseSync(accountId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WarehouseSyncBody) => request<WarehouseSyncResponse>("/api/warehouse/sync", { body }),
        onSettled: () => void qc.invalidateQueries({ queryKey: key(accountId) }),
    });
}
