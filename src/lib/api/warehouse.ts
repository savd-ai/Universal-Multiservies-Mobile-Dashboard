"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarehouseStatus, WarehouseSyncBody, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import { request } from "./client";
import { qk } from "./query-keys";
const 頔壍 = (攃壍: string) => [...qk.acct(攃壍), "warehouse"] as const;
export function useWarehouse(菲壍: string) {
    return useQuery({
        queryKey: 頔壍(菲壍),
        queryFn: ({ signal: 僡壍 }) => request<WarehouseStatus>("/api/warehouse", { signal: 僡壍 }),
        enabled: !!菲壍,
        staleTime: 15000,
        refetchInterval: (濐壍) => (濐壍.state.data?.running ? 2000 : false),
    });
}
export function useWarehouseSync(躿壍: string) {
    const 宮壍 = useQueryClient();
    return useMutation({
        mutationFn: (窝壍: WarehouseSyncBody) => request<WarehouseSyncResponse>("/api/warehouse/sync", { body: 窝壍 }),
        onSettled: () => void 宮壍.invalidateQueries({ queryKey: 頔壍(躿壍) }),
    });
}
