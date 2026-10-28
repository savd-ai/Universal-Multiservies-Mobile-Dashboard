import type { QuerySpecInput } from "@/lib/domain/query/spec";
export const qk = {
    status: () => ["status"] as const,
    me: () => ["me"] as const,
    catalog: () => ["catalog"] as const,
    settings: () => ["settings"] as const,
    query: (acct: string, spec: QuerySpecInput) => ["acct", acct, "query", JSON.stringify(spec)] as const,
    dashboards: () => ["dashboards"] as const,
    dashboard: (id: string) => ["dashboards", id] as const,
    templates: () => ["dashboard-templates"] as const,
    questions: () => ["questions"] as const,
    annotations: (acct: string, start: string, end: string, campaignId?: string) => ["acct", acct, "annotations", start, end, campaignId ?? ""] as const,
    acct: (acct: string) => ["acct", acct] as const,
    demo: () => ["demo"] as const,
};
