"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CustomMetric, CustomMetricBody, SavedQuestion, SavedQuestionBody } from "@/lib/domain/contracts/dashboard";
import type { PluginView } from "@/lib/domain/contracts/plugins";
import type { DateRangeSpec, QuerySpecInput } from "@/lib/domain/query/spec";
import { ApiError, download, request } from "./client";
import { qk, useQueryResult } from "./hooks";

// Hooks for Explore (06): custom metrics + formula validation, saved-question edits, the plugin sources that can
// be queried, filter value suggestions and exports. Custom metrics are global (not account-scoped); saving one
// invalidates the catalog and every cached query result.

const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;

export const exploreKeys = {
  customMetrics: () => ["metrics", "custom"] as const,
  validate: (key: string, formula: string) => ["metrics", "validate", key, formula] as const,
  plugins: () => ["plugins"] as const,
};

// ── Custom metrics ───────────────────────────────────────────────────────────────────────────────────

export function useCustomMetrics() {
  return useQuery({
    queryKey: exploreKeys.customMetrics(),
    queryFn: ({ signal }) => request<{ metrics: CustomMetric[] }>("/api/metrics/custom", { signal }).then((r) => r.metrics),
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

function useInvalidateMetrics() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["metrics"] });
    void qc.invalidateQueries({ queryKey: qk.catalog() });
    void qc.invalidateQueries({ queryKey: ["acct"] });
  };
}

export function useSaveCustomMetric() {
  const invalidate = useInvalidateMetrics();
  return useMutation({
    mutationFn: ({ body, id }: { body: CustomMetricBody; id?: string }) =>
      id ? request<CustomMetric>(`/api/metrics/custom/${encodeURIComponent(id)}`, { method: "PUT", body }) : request<CustomMetric>("/api/metrics/custom", { body }),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomMetric() {
  const invalidate = useInvalidateMetrics();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: boolean }>(`/api/metrics/custom/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export interface FormulaCheckResult {
  ok: boolean;
  identifiers: string[];
  unknown: string[];
  error?: { message: string; position: number };
  /** base measures the formula needs (decides which fact tables can compute it) */
  deps: string[];
}

/** POST /api/metrics/custom/validate — call with an already debounced formula. */
export function useFormulaCheck(formula: string, key: string | undefined) {
  return useQuery({
    queryKey: exploreKeys.validate(key ?? "", formula),
    queryFn: ({ signal }) => request<FormulaCheckResult>("/api/metrics/custom/validate", { body: { formula, key: key || undefined }, signal }),
    enabled: formula.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: noRetry4xx,
  });
}

// ── Saved questions (list/create live in hooks.ts) ───────────────────────────────────────────────────

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SavedQuestionBody }) => request<SavedQuestion>(`/api/questions/${encodeURIComponent(id)}`, { method: "PUT", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.questions() }),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: boolean }>(`/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.questions() }),
  });
}

// ── Sources ──────────────────────────────────────────────────────────────────────────────────────────

export interface SourcePlugin {
  id: string;
  name: string;
  category: string;
  abbr: string;
  mode: "live" | "demo" | "off";
}

/** Connected plugins that report metrics — each one is queryable as `plugin:<id>`. */
export function useSourcePlugins() {
  return useQuery({
    queryKey: exploreKeys.plugins(),
    queryFn: ({ signal }) => request<{ plugins: PluginView[] }>("/api/plugins", { signal }),
    select: (r): SourcePlugin[] =>
      (r.plugins ?? [])
        .filter((p) => p.connected && p.manifest?.capabilities?.includes("metrics.read"))
        .map((p) => ({ id: p.manifest.id, name: p.manifest.name, category: p.manifest.category, abbr: p.manifest.icon?.abbr ?? p.manifest.name.slice(0, 2).toUpperCase(), mode: p.mode })),
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

// ── Filter value suggestions ─────────────────────────────────────────────────────────────────────────

/** Distinct values of a dimension (top 200 by spend; time dimensions in calendar order) from one cheap query. */
export function useDimensionValues(source: string, dim: string | undefined, dateRange: DateRangeSpec, opts: { enabled?: boolean; time?: boolean } = {}) {
  const spec: QuerySpecInput | null =
    dim && opts.enabled !== false ? { source, metrics: ["cost"], dimensions: [dim as NonNullable<QuerySpecInput["dimensions"]>[number]], dateRange, ...(opts.time ? {} : { sort: [{ key: "cost", dir: "desc" as const }] }), limit: 200, totals: false } : null;
  const q = useQueryResult(spec);
  const values = useMemo(() => {
    const out: string[] = [];
    if (!dim || !q.data) return out;
    for (const r of q.data.rows) {
      const v = r[dim];
      if (v !== null && v !== undefined && v !== "" && !out.includes(String(v))) out.push(String(v));
    }
    return out;
  }, [dim, q.data]);
  return { values, isLoading: q.isLoading, error: q.error };
}

// ── Export ───────────────────────────────────────────────────────────────────────────────────────────

export function exportQuery(spec: QuerySpecInput, format: "csv" | "json", filename: string): Promise<void> {
  return download("/api/query/export", { spec, format, filename }, `${filename}.${format}`);
}
