import type { QuerySpecInput } from "@/lib/domain/query/spec";

// Query keys, shared by client hooks and the server layout that prefetches status + dashboards (a plain module,
// not "use client", so Server Components get the real functions). Account-scoped data lives under
// ["acct", accountId, …] so switching accounts never mixes caches.

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
};
