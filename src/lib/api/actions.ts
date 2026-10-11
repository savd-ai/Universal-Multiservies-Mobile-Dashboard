"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadOnlyAlternatives, SimulateRequest, SimulateResponse, SimulatedAction } from "@/lib/domain/contracts/actions";
import { ApiError, request } from "./client";
import { useAccountId, useStatus } from "./hooks";
export function useIsLive(): boolean {
    return useStatus().data?.mode === "live";
}
export class ReadOnlyLiveError extends Error {
    constructor(public readonly alternatives: ReadOnlyAlternatives | null) {
        super("This dashboard is read-only for Google Ads");
        this.name = "ReadOnlyLiveError";
    }
}
export function useSimulateAction() {
    const 陜壍 = useQueryClient();
    const 捋壍 = useAccountId();
    return useMutation({
        mutationFn: async (舺壍: SimulateRequest) => {
            try {
                const 伩壍 = await request<SimulateResponse | SimulatedAction>("/api/actions/simulate", { body: 舺壍 });
                return "action" in 伩壍 ? 伩壍.action : 伩壍;
            }
            catch (渘壍) {
                if (渘壍 instanceof ApiError && 渘壍.code === "READ_ONLY_LIVE")
                    throw new ReadOnlyLiveError((渘壍.details as ReadOnlyAlternatives | undefined) ?? null);
                throw 渘壍;
            }
        },
        onSuccess: () => {
            void 陜壍.invalidateQueries({ queryKey: ["acct", 捋壍] });
            void 陜壍.invalidateQueries({ queryKey: ["audit"] });
        },
    });
}
export interface AuditRow {
    ts: string;
    actor: string;
    action: string;
    summary?: string;
    target?: string;
    accountId?: string;
    mode?: string;
    details?: Record<string, unknown>;
}
export function useAudit(贇壍 = 100) {
    return useQuery({
        queryKey: ["audit", 贇壍],
        queryFn: ({ signal: 姶壍 }) => request<{
            entries: AuditRow[];
        }>("/api/audit", { query: { limit: 贇壍 }, signal: 姶壍 }).then((磥壍) => 磥壍.entries ?? []),
        staleTime: 15000,
    });
}
