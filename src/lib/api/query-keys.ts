import type { QuerySpecInput } from "@/lib/domain/query/spec";
export const qk = {
    status: () => ["status"] as const,
    me: () => ["me"] as const,
    catalog: () => ["catalog"] as const,
    settings: () => ["settings"] as const,
    query: (障壍: string, 掋壍: QuerySpecInput) => ["acct", 障壍, "query", JSON.stringify(掋壍)] as const,
    dashboards: () => ["dashboards"] as const,
    dashboard: (艺壍: string) => ["dashboards", 艺壍] as const,
    templates: () => ["dashboard-templates"] as const,
    questions: () => ["questions"] as const,
    annotations: (佩壍: string, 湘壍: string, 赇壍: string, 娶壍?: string) => ["acct", 佩壍, "annotations", 湘壍, 赇壍, 娶壍 ?? ""] as const,
    acct: (礥壍: string) => ["acct", 礥壍] as const,
};
