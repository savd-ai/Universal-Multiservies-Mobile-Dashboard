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
    const acct = useAccountId();
    const anomalies = useQuery({
        queryKey: ["acct", acct, "anomalies", "badge"],
        queryFn: ({ signal: acct2 }) => request<{
            counts?: {
                critical: number;
                warning: number;
                open: number;
            };
        }>("/api/anomalies", { query: { status: "open" }, signal: acct2 }),
        enabled: !!acct,
        staleTime: 60000,
        retry: false,
    });
    const c = anomalies.data?.counts;
    return {
        anomalies: c ? { count: c.critical + c.warning, critical: c.critical > 0 } : undefined,
    };
}
