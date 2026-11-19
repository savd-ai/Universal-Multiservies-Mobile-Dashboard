"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BudgetPlan,
  BudgetPlanBody,
  BudgetTargetsBody,
  BudgetTargetsView,
  CurvesResponse,
  DraftLineInput,
  ForecastResult,
  OptimizeRequest,
  OptimizeResult,
  PlanSuggestRequest,
  PlanSuggestResult,
  ResponseCurve,
  ScenariosRequest,
  ScenariosResult,
} from "@/lib/domain/contracts/budget";
import type { GoogleEstimatesResponse } from "@/lib/domain/contracts/estimates";
import { ApiError, request, saveBlob } from "./client";
import { useAccountId } from "./hooks";

// Budget planner hooks: monthly targets (optimistic save), response curves, optimizer & scenario frontier (POST
// computations cached as queries), forecast, Google's simulators and recommendations, multi-month plans (+ draft
// lines, seasonal suggest) and exports.
// Keys live under ["acct", id, "budget", …] so a target save or a simulated budget change refreshes every view.

const noRetry4xx = (count: number, err: unknown) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2;

export const budgetKeys = {
  all: (acct: string) => ["acct", acct, "budget"] as const,
  pacing: (acct: string) => ["acct", acct, "budget", "pacing"] as const,
  targets: (acct: string, month: string) => ["acct", acct, "budget", "targets", month] as const,
  curves: (acct: string, objective: string) => ["acct", acct, "budget", "curves", objective] as const,
  optimize: (acct: string, body: unknown) => ["acct", acct, "budget", "optimize", JSON.stringify(body)] as const,
  scenarios: (acct: string, body: unknown) => ["acct", acct, "budget", "scenarios", JSON.stringify(body)] as const,
  forecast: (acct: string, metric: string, horizon: number, campaignId?: string) => ["acct", acct, "budget", "forecast", metric, horizon, campaignId ?? "all"] as const,
  googleEstimates: (acct: string, objective: string) => ["acct", acct, "budget", "google-estimates", objective] as const,
  plans: (acct: string) => ["acct", acct, "budget", "plans"] as const,
  thresholds: (acct: string) => ["acct", acct, "budget", "thresholds"] as const,
};

// ── Targets ──────────────────────────────────────────────────────────────────────────────────────────

export function useBudgetTargets(month: string | null) {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.targets(acct, month ?? ""),
    queryFn: ({ signal }) => request<BudgetTargetsView>("/api/budget/targets", { query: { month }, signal }),
    enabled: !!acct && !!month,
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

/** PUT targets with an optimistic cache update (rolled back on error); pacing and optimizer views refetch after. */
export function useSaveTargets() {
  const qc = useQueryClient();
  const acct = useAccountId();
  return useMutation({
    mutationFn: (body: BudgetTargetsBody) => request<BudgetTargetsView>("/api/budget/targets", { method: "PUT", body }),
    onMutate: async (body) => {
      const key = budgetKeys.targets(acct, body.month);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BudgetTargetsView>(key);
      if (prev) qc.setQueryData<BudgetTargetsView>(key, { ...prev, targets: { ...prev.defaults, ...body.targets }, locks: body.locks ?? {}, isDefault: false });
      return { prev, key };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (saved, body) => qc.setQueryData(budgetKeys.targets(acct, body.month), saved),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: budgetKeys.pacing(acct) });
      void qc.invalidateQueries({ queryKey: ["acct", acct, "budget", "optimize"] });
      void qc.invalidateQueries({ queryKey: ["acct", acct, "budget", "scenarios"] });
    },
  });
}

/** Pacing thresholds from the anomaly settings (the server's status uses the same values). */
export function usePacingThresholds(): { over: number; under: number } {
  const acct = useAccountId();
  const q = useQuery({
    queryKey: budgetKeys.thresholds(acct),
    queryFn: ({ signal }) => request<{ pacing?: { over?: number; under?: number } }>("/api/anomalies/settings", { signal }),
    enabled: !!acct,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { over: q.data?.pacing?.over ?? 1.05, under: q.data?.pacing?.under ?? 0.9 };
}

// ── Curves, optimizer, scenarios, forecast ───────────────────────────────────────────────────────────

export function useResponseCurves(objective: ResponseCurve["objective"]) {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.curves(acct, objective),
    queryFn: ({ signal }) => request<CurvesResponse>("/api/budget/curves", { query: { objective }, signal }),
    enabled: !!acct,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

export type OptimizeBody = Partial<OptimizeRequest> & Pick<OptimizeRequest, "objective" | "strategy">;

/** The optimizer is a pure computation, so it runs as a query keyed by its request body (null = don't run). */
export function useOptimize(body: OptimizeBody | null) {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.optimize(acct, body),
    queryFn: ({ signal }) => request<OptimizeResult>("/api/budget/optimize", { method: "POST", body, signal }),
    enabled: !!acct && !!body,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

export type ScenariosBody = Partial<ScenariosRequest> & Pick<ScenariosRequest, "objective" | "strategy">;

export function useScenarios(body: ScenariosBody | null) {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.scenarios(acct, body),
    queryFn: ({ signal }) => request<ScenariosResult>("/api/budget/scenarios", { method: "POST", body, signal }),
    enabled: !!acct && !!body,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

/** Typed forecast (history + 30-day points with the 80 % band, totals, backtest MAPE), optionally per campaign. */
export function useBudgetForecast(metric: ForecastResult["metric"], opts: { horizon?: number; campaignId?: string } = {}) {
  const acct = useAccountId();
  const horizon = opts.horizon ?? 30;
  return useQuery({
    queryKey: budgetKeys.forecast(acct, metric, horizon, opts.campaignId),
    queryFn: ({ signal }) => request<ForecastResult>("/api/budget/forecast", { query: { metric, horizon, campaignId: opts.campaignId }, signal }),
    enabled: !!acct,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

/** Google's budget / target simulations and budget recommendations next to our model, with the source policy. */
export function useGoogleEstimates(objective: ResponseCurve["objective"]) {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.googleEstimates(acct, objective),
    queryFn: ({ signal }) => request<GoogleEstimatesResponse>("/api/budget/google-estimates", { query: { objective }, signal }),
    enabled: !!acct,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: noRetry4xx,
  });
}

// ── Plans ────────────────────────────────────────────────────────────────────────────────────────────

export function usePlans() {
  const acct = useAccountId();
  return useQuery({
    queryKey: budgetKeys.plans(acct),
    queryFn: ({ signal }) => request<{ plans: BudgetPlan[] }>("/api/budget/plans", { signal }).then((r) => r.plans),
    enabled: !!acct,
    staleTime: 60_000,
    retry: noRetry4xx,
  });
}

function usePlanCache() {
  const qc = useQueryClient();
  const acct = useAccountId();
  const key = budgetKeys.plans(acct);
  return {
    upsert: (plan: BudgetPlan) => qc.setQueryData<BudgetPlan[]>(key, (list) => [plan, ...(list ?? []).filter((p) => p.id !== plan.id)]),
    remove: (id: string) => qc.setQueryData<BudgetPlan[]>(key, (list) => (list ?? []).filter((p) => p.id !== id)),
    refresh: () => void qc.invalidateQueries({ queryKey: key }),
  };
}

export function useCreatePlan() {
  const cache = usePlanCache();
  return useMutation({
    mutationFn: (body: BudgetPlanBody) => request<BudgetPlan>("/api/budget/plans", { body }),
    onSuccess: (plan) => cache.upsert(plan),
  });
}

/** PUT a whole plan; `version` enables the server's optimistic-concurrency check (409 on a stale copy). */
export function useUpdatePlan() {
  const cache = usePlanCache();
  return useMutation({
    mutationFn: ({ id, body, version }: { id: string; body: BudgetPlanBody; version?: number }) => request<BudgetPlan>(`/api/budget/plans/${encodeURIComponent(id)}`, { method: "PUT", body: { ...body, version } }),
    onSuccess: (plan) => cache.upsert(plan),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) cache.refresh();
    },
  });
}

export function useDeletePlan() {
  const cache = usePlanCache();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: true }>(`/api/budget/plans/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_r, id) => cache.remove(id),
  });
}

/** Add (or update, keyed by kind + refId) a draft line — an AI idea or a channel — to a plan. */
export function useAddPlanLine() {
  const cache = usePlanCache();
  return useMutation({
    mutationFn: ({ planId, line }: { planId: string; line: DraftLineInput }) => request<BudgetPlan>(`/api/budget/plans/${encodeURIComponent(planId)}/lines`, { body: line }),
    onSuccess: (plan) => cache.upsert(plan),
  });
}

/** Seasonal month totals allocated by the optimizer; the server saves the plan and returns the index used. */
export function useSuggestPlan() {
  const cache = usePlanCache();
  return useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: Partial<PlanSuggestRequest> }) => request<PlanSuggestResult>(`/api/budget/plans/${encodeURIComponent(planId)}/suggest`, { body }),
    onSuccess: (res) => cache.upsert(res.plan),
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────────────────────────────

export interface FileExport {
  body: string;
  contentType: string;
  filename: string;
  warnings: string[];
}

export function fetchPlanExport(planId: string, format: "csv" | "editor" | "changes", month?: string): Promise<FileExport> {
  return request<FileExport>(`/api/budget/plans/${encodeURIComponent(planId)}/export`, { query: { format, month, as: "json" } });
}

export function fetchBudgetExport(q: { month?: string; from: "recommended" | "targets"; format: "editor" | "csv" | "text" }): Promise<FileExport> {
  return request<FileExport>("/api/budget/export", { query: { ...q, as: "json" } });
}

export function saveExport(file: FileExport): void {
  saveBlob(new Blob([file.body], { type: file.contentType }), file.filename);
}
