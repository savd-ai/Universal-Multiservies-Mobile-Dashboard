"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BudgetPlan, BudgetPlanBody, BudgetTargetsBody, BudgetTargetsView, CurvesResponse, DraftLineInput, ForecastResult, OptimizeRequest, OptimizeResult, PlanSuggestRequest, PlanSuggestResult, ResponseCurve, ScenariosRequest, ScenariosResult, } from "@/lib/domain/contracts/budget";
import type { GoogleEstimatesResponse } from "@/lib/domain/contracts/estimates";
import { ApiError, request, saveBlob } from "./client";
import { useAccountId } from "./hooks";
const 挴壍 = (舣壍: number, 伒壍: unknown) => !(伒壍 instanceof ApiError && 伒壍.status >= 400 && 伒壍.status < 500) && 舣壍 < 2;
export const budgetKeys = {
    all: (渁壍: string) => ["acct", 渁壍, "budget"] as const,
    pacing: (賰壍: string) => ["acct", 賰壍, "budget", "pacing"] as const,
    targets: (姟壍: string, 磎壍: string) => ["acct", 姟壍, "budget", "targets", 磎壍] as const,
    curves: (鞽壍: string, 撬壍: string) => ["acct", 鞽壍, "budget", "curves", 撬壍] as const,
    optimize: (莛壍: string, 傊壍: unknown) => ["acct", 莛壍, "budget", "optimize", JSON.stringify(傊壍)] as const,
    scenarios: (潹壍: string, 蹨壍: unknown) => ["acct", 潹壍, "budget", "scenarios", JSON.stringify(蹨壍)] as const,
    forecast: (字壍: string, 穆壍: string, 餵壍: number, 昤壍?: string) => ["acct", 字壍, "budget", "forecast", 穆壍, 餵壍, 昤壍 ?? "all"] as const,
    googleEstimates: (蔓壍: string, 刂壍: string) => ["acct", 蔓壍, "budget", "google-estimates", 刂壍] as const,
    plans: (烱壍: string) => ["acct", 烱壍, "budget", "plans"] as const,
    thresholds: (迠壍: string) => ["acct", 迠壍, "budget", "thresholds"] as const,
};
export function useBudgetTargets(峏壍: string | null) {
    const 箾壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.targets(箾壍, 峏壍 ?? ""),
        queryFn: ({ signal: 骭壍 }) => request<BudgetTargetsView>("/api/budget/targets", { query: { month: 峏壍 }, signal: 骭壍 }),
        enabled: !!箾壍 && !!峏壍,
        staleTime: 60000,
        retry: 挴壍,
    });
}
export function useSaveTargets() {
    const 果壍 = useQueryClient();
    const 蚋壍 = useAccountId();
    return useMutation({
        mutationFn: (卺壍: BudgetTargetsBody) => request<BudgetTargetsView>("/api/budget/targets", { method: "PUT", body: 卺壍 }),
        onMutate: async (物壍) => {
            const 酘壍 = budgetKeys.targets(蚋壍, 物壍.month);
            await 果壍.cancelQueries({ queryKey: 酘壍 });
            const 幇壍 = 果壍.getQueryData<BudgetTargetsView>(酘壍);
            if (幇壍)
                果壍.setQueryData<BudgetTargetsView>(酘壍, { ...幇壍, targets: { ...幇壍.defaults, ...物壍.targets }, locks: 物壍.locks ?? {}, isDefault: false });
            return { prev: 幇壍, key: 酘壍 };
        },
        onError: (紶壍, 鰥壍, 椔壍) => {
            if (椔壍?.prev)
                果壍.setQueryData(椔壍.key, 椔壍.prev);
        },
        onSuccess: (蠃壍, 哲壍) => 果壍.setQueryData(budgetKeys.targets(蚋壍, 哲壍.month), 蠃壍),
        onSettled: () => {
            void 果壍.invalidateQueries({ queryKey: budgetKeys.pacing(蚋壍) });
            void 果壍.invalidateQueries({ queryKey: ["acct", 蚋壍, "budget", "optimize"] });
            void 果壍.invalidateQueries({ queryKey: ["acct", 蚋壍, "budget", "scenarios"] });
        },
    });
}
export function usePacingThresholds(): {
    over: number;
    under: number;
} {
    const 珡壍 = useAccountId();
    const 鋐壍 = useQuery({
        queryKey: budgetKeys.thresholds(珡壍),
        queryFn: ({ signal: 徿壍 }) => request<{
            pacing?: {
                over?: number;
                under?: number;
            };
        }>("/api/anomalies/settings", { signal: 徿壍 }),
        enabled: !!珡壍,
        staleTime: 5 * 60000,
        retry: false,
    });
    return { over: 鋐壍.data?.pacing?.over ?? 1.05, under: 鋐壍.data?.pacing?.under ?? 0.9 };
}
export function useResponseCurves(纮壍: ResponseCurve["objective"]) {
    const 鶝壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.curves(鶝壍, 纮壍),
        queryFn: ({ signal: 檌壍 }) => request<CurvesResponse>("/api/budget/curves", { query: { objective: 纮壍 }, signal: 檌壍 }),
        enabled: !!鶝壍,
        staleTime: 5 * 60000,
        placeholderData: keepPreviousData,
        retry: 挴壍,
    });
}
export type OptimizeBody = Partial<OptimizeRequest> & Pick<OptimizeRequest, "objective" | "strategy">;
export function useOptimize(襻壍: OptimizeBody | null) {
    const 噪壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.optimize(噪壍, 襻壍),
        queryFn: ({ signal: 留壍 }) => request<OptimizeResult>("/api/budget/optimize", { method: "POST", body: 襻壍, signal: 留壍 }),
        enabled: !!噪壍 && !!襻壍,
        staleTime: 5 * 60000,
        placeholderData: keepPreviousData,
        retry: 挴壍,
    });
}
export type ScenariosBody = Partial<ScenariosRequest> & Pick<ScenariosRequest, "objective" | "strategy">;
export function useScenarios(鑈壍: ScenariosBody | null) {
    const 愷壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.scenarios(愷壍, 鑈壍),
        queryFn: ({ signal: 耦壍 }) => request<ScenariosResult>("/api/budget/scenarios", { method: "POST", body: 鑈壍, signal: 耦壍 }),
        enabled: !!愷壍 && !!鑈壍,
        staleTime: 5 * 60000,
        placeholderData: keepPreviousData,
        retry: 挴壍,
    });
}
export function useBudgetForecast(鼕壍: ForecastResult["metric"], 氄壍: {
    horizon?: number;
    campaignId?: string;
} = {}) {
    const 諳壍 = useAccountId();
    const 埢壍 = 氄壍.horizon ?? 30;
    return useQuery({
        queryKey: budgetKeys.forecast(諳壍, 鼕壍, 埢壍, 氄壍.campaignId),
        queryFn: ({ signal: 监壍 }) => request<ForecastResult>("/api/budget/forecast", { query: { metric: 鼕壍, horizon: 埢壍, campaignId: 氄壍.campaignId }, signal: 监壍 }),
        enabled: !!諳壍,
        staleTime: 5 * 60000,
        placeholderData: keepPreviousData,
        retry: 挴壍,
    });
}
export function useGoogleEstimates(闀壍: ResponseCurve["objective"]) {
    const 抯壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.googleEstimates(抯壍, 闀壍),
        queryFn: ({ signal: 膞壍 }) => request<GoogleEstimatesResponse>("/api/budget/google-estimates", { query: { objective: 闀壍 }, signal: 膞壍 }),
        enabled: !!抯壍,
        staleTime: 5 * 60000,
        placeholderData: keepPreviousData,
        retry: 挴壍,
    });
}
export function usePlans() {
    const 亍壍 = useAccountId();
    return useQuery({
        queryKey: budgetKeys.plans(亍壍),
        queryFn: ({ signal: 浼壍 }) => request<{
            plans: BudgetPlan[];
        }>("/api/budget/plans", { signal: 浼壍 }).then((豫壍) => 豫壍.plans),
        enabled: !!亍壍,
        staleTime: 60000,
        retry: 挴壍,
    });
}
function Cmp59() {
    const 硉壍 = useQueryClient();
    const 霸壍 = useAccountId();
    const 搧壍 = budgetKeys.plans(霸壍);
    return {
        upsert: (茖壍: BudgetPlan) => 硉壍.setQueryData<BudgetPlan[]>(搧壍, (倅壍) => [茖壍, ...(倅壍 ?? []).filter((滴壍) => 滴壍.id !== 茖壍.id)]),
        remove: (跣壍: string) => 硉壍.setQueryData<BudgetPlan[]>(搧壍, (嫒壍) => (嫒壍 ?? []).filter((私壍) => 私壍.id !== 跣壍)),
        refresh: () => void 硉壍.invalidateQueries({ queryKey: 搧壍 }),
    };
}
export function useCreatePlan() {
    const 颰壍 = Cmp59();
    return useMutation({
        mutationFn: (斟壍: BudgetPlanBody) => request<BudgetPlan>("/api/budget/plans", { body: 斟壍 }),
        onSuccess: (蒎壍) => 颰壍.upsert(蒎壍),
    });
}
export function useUpdatePlan() {
    const 兽壍 = Cmp59();
    return useMutation({
        mutationFn: ({ id: 灬壍, body: 轛壍, version: 届壍 }: {
            id: string;
            body: BudgetPlanBody;
            version?: number;
        }) => request<BudgetPlan>(`/api/budget/plans/${encodeURIComponent(灬壍)}`, { method: "PUT", body: { ...轛壍, version: 届壍 } }),
        onSuccess: (笹壍) => 兽壍.upsert(笹壍),
        onError: (騨壍) => {
            if (騨壍 instanceof ApiError && 騨壍.status === 409)
                兽壍.refresh();
        },
    });
}
export function useDeletePlan() {
    const 朗壍 = Cmp59();
    return useMutation({
        mutationFn: (蘆壍: string) => request<{
            ok: true;
        }>(`/api/budget/plans/${encodeURIComponent(蘆壍)}`, { method: "DELETE" }),
        onSuccess: (勵壍, 燤壍) => 朗壍.remove(燤壍),
    });
}
export function useAddPlanLine() {
    const 郓壍 = Cmp59();
    return useMutation({
        mutationFn: ({ planId: 巂壍, line: 粱壍 }: {
            planId: string;
            line: DraftLineInput;
        }) => request<BudgetPlan>(`/api/budget/plans/${encodeURIComponent(巂壍)}/lines`, { body: 粱壍 }),
        onSuccess: (鮠壍) => 郓壍.upsert(鮠壍),
    });
}
export function useSuggestPlan() {
    const 梏壍 = Cmp59();
    return useMutation({
        mutationFn: ({ planId: 蝾壍, body: 呭壍 }: {
            planId: string;
            body: Partial<PlanSuggestRequest>;
        }) => request<PlanSuggestResult>(`/api/budget/plans/${encodeURIComponent(蝾壍)}/suggest`, { body: 呭壍 }),
        onSuccess: (獜壍) => 梏壍.upsert(獜壍.plan),
    });
}
export interface FileExport {
    body: string;
    contentType: string;
    filename: string;
    warnings: string[];
}
export function fetchPlanExport(鉋壍: string, 强壍: "csv" | "editor" | "changes", 縩壍?: string): Promise<FileExport> {
    return request<FileExport>(`/api/budget/plans/${encodeURIComponent(鉋壍)}/export`, { query: { format: 强壍, month: 縩壍, as: "json" } });
}
export function fetchBudgetExport(鴘壍: {
    month?: string;
    from: "recommended" | "targets";
    format: "editor" | "csv" | "text";
}): Promise<FileExport> {
    return request<FileExport>("/api/budget/export", { query: { ...鴘壍, as: "json" } });
}
export function saveExport(樇壍: FileExport): void {
    saveBlob(new Blob([樇壍.body], { type: 樇壍.contentType }), 樇壍.filename);
}
