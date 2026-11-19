"use client";

import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api/client";
import { useAccountId } from "@/lib/api/hooks";

// Sidebar badges: open non-info anomaly signals (red when any is critical) and AI draft lines in the plan.

interface Badge {
  count: number;
  critical: boolean;
}

export function useNavBadges(): { anomalies?: Badge; budget?: Badge } {
  const acct = useAccountId();
  const anomalies = useQuery({
    queryKey: ["acct", acct, "anomalies", "badge"],
    queryFn: ({ signal }) => request<{ counts?: { critical: number; warning: number; open: number } }>("/api/anomalies", { query: { status: "open" }, signal }),
    enabled: !!acct,
    staleTime: 60_000,
    retry: false,
  });
  const ideas = useQuery({
    queryKey: ["acct", acct, "idea-sets", "badge"],
    queryFn: ({ signal }) => request<{ ideaSets?: { ideas: { inPlan?: boolean }[] }[] }>("/api/ai/idea-sets", { signal }),
    enabled: !!acct,
    staleTime: 60_000,
    retry: false,
  });
  const c = anomalies.data?.counts;
  const inPlan = ideas.data?.ideaSets?.[0]?.ideas.filter((i) => i.inPlan).length ?? 0;
  return {
    anomalies: c ? { count: c.critical + c.warning, critical: c.critical > 0 } : undefined,
    budget: inPlan ? { count: inPlan, critical: false } : undefined,
  };
}
