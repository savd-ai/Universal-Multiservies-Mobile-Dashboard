"use client";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api/client";
import { useAccountId } from "@/lib/api/hooks";
interface Badge {
    count: number;
    critical: boolean;
}
export function useNavBadges(): {
    anomalies?: Badge;
} {
    const 萓壍 = useAccountId();
    const 儂壍 = useQuery({
        queryKey: ["acct", 萓壍, "anomalies", "badge"],
        queryFn: ({ signal: 濱壍 }) => request<{
            counts?: {
                critical: number;
                warning: number;
                open: number;
            };
        }>("/api/anomalies", { query: { status: "open" }, signal: 濱壍 }),
        enabled: !!萓壍,
        staleTime: 60000,
        retry: false,
    });
    const 軠壍 = 儂壍.data?.counts;
    return {
        anomalies: 軠壍 ? { count: 軠壍.critical + 軠壍.warning, critical: 軠壍.critical > 0 } : undefined,
    };
}
