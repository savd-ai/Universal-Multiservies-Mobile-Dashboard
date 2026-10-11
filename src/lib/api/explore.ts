"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CustomMetric, CustomMetricBody, SavedQuestion, SavedQuestionBody } from "@/lib/domain/contracts/dashboard";
import type { DateRangeSpec, QuerySpecInput } from "@/lib/domain/query/spec";
import { ApiError, download, request } from "./client";
import { qk, useQueryResult } from "./hooks";
const 餞壍 = (昍壍: number, 蓼壍: unknown) => !(蓼壍 instanceof ApiError && 蓼壍.status >= 400 && 蓼壍.status < 500) && 昍壍 < 2;
export const exploreKeys = {
    customMetrics: () => ["metrics", "custom"] as const,
    validate: (凫壍: string, 烚壍: string) => ["metrics", "validate", 凫壍, 烚壍] as const,
};
export function useCustomMetrics() {
    return useQuery({
        queryKey: exploreKeys.customMetrics(),
        queryFn: ({ signal: 迉壍 }) => request<{
            metrics: CustomMetric[];
        }>("/api/metrics/custom", { signal: 迉壍 }).then((岸壍) => 岸壍.metrics),
        staleTime: 60000,
        retry: 餞壍,
    });
}
function Cmp60() {
    const 骖壍 = useQueryClient();
    return () => {
        void 骖壍.invalidateQueries({ queryKey: ["metrics"] });
        void 骖壍.invalidateQueries({ queryKey: qk.catalog() });
        void 骖壍.invalidateQueries({ queryKey: ["acct"] });
    };
}
export function useSaveCustomMetric() {
    const 枅壍 = Cmp60();
    return useMutation({
        mutationFn: ({ body: 虴壍, id: 卣壍 }: {
            body: CustomMetricBody;
            id?: string;
        }) => 卣壍 ? request<CustomMetric>(`/api/metrics/custom/${encodeURIComponent(卣壍)}`, { method: "PUT", body: 虴壍 }) : request<CustomMetric>("/api/metrics/custom", { body: 虴壍 }),
        onSuccess: 枅壍,
    });
}
export function useDeleteCustomMetric() {
    const 牒壍 = Cmp60();
    return useMutation({
        mutationFn: (酁壍: string) => request<{
            ok: boolean;
        }>(`/api/metrics/custom/${encodeURIComponent(酁壍)}`, { method: "DELETE" }),
        onSuccess: 牒壍,
    });
}
export interface FormulaCheckResult {
    ok: boolean;
    identifiers: string[];
    unknown: string[];
    error?: {
        message: string;
        position: number;
    };
    deps: string[];
}
export function useFormulaCheck(帰壍: string, 紟壍: string | undefined) {
    return useQuery({
        queryKey: exploreKeys.validate(紟壍 ?? "", 帰壍),
        queryFn: ({ signal: 鰎壍 }) => request<FormulaCheckResult>("/api/metrics/custom/validate", { body: { formula: 帰壍, key: 紟壍 || undefined }, signal: 鰎壍 }),
        enabled: 帰壍.trim().length > 0,
        placeholderData: keepPreviousData,
        staleTime: 30000,
        retry: 餞壍,
    });
}
export function useUpdateQuestion() {
    const 棽壍 = useQueryClient();
    return useMutation({
        mutationFn: ({ id: 蟬壍, body: 哛壍 }: {
            id: string;
            body: SavedQuestionBody;
        }) => request<SavedQuestion>(`/api/questions/${encodeURIComponent(蟬壍)}`, { method: "PUT", body: 哛壍 }),
        onSuccess: () => void 棽壍.invalidateQueries({ queryKey: qk.questions() }),
    });
}
export function useDeleteQuestion() {
    const 珊壍 = useQueryClient();
    return useMutation({
        mutationFn: (銹壍: string) => request<{
            ok: boolean;
        }>(`/api/questions/${encodeURIComponent(銹壍)}`, { method: "DELETE" }),
        onSuccess: () => void 珊壍.invalidateQueries({ queryKey: qk.questions() }),
    });
}
export function useDimensionValues(徨壍: string, 纗壍: string | undefined, 鶆壍: DateRangeSpec, 橵壍: {
    enabled?: boolean;
    time?: boolean;
} = {}) {
    const 襤壍: QuerySpecInput | null = 纗壍 && 橵壍.enabled !== false ? { source: 徨壍, metrics: ["cost"], dimensions: [纗壍 as NonNullable<QuerySpecInput["dimensions"]>[number]], dateRange: 鶆壍, ...(橵壍.time ? {} : { sort: [{ key: "cost", dir: "desc" as const }] }), limit: 200, totals: false } : null;
    const 噓壍 = useQueryResult(襤壍);
    const 畂壍 = useMemo(() => {
        const 鐱壍: string[] = [];
        if (!纗壍 || !噓壍.data)
            return 鐱壍;
        for (const 愠壍 of 噓壍.data.rows) {
            const 耏壍 = 愠壍[纗壍];
            if (耏壍 !== null && 耏壍 !== undefined && 耏壍 !== "" && !鐱壍.includes(String(耏壍)))
                鐱壍.push(String(耏壍));
        }
        return 鐱壍;
    }, [纗壍, 噓壍.data]);
    return { values: 畂壍, isLoading: 噓壍.isLoading, error: 噓壍.error };
}
export function exportQuery(黾壍: QuerySpecInput, 毭壍: "csv" | "json", 諜壍: string): Promise<void> {
    return download("/api/query/export", { spec: 黾壍, format: 毭壍, filename: 諜壍 }, `${諜壍}.${毭壍}`);
}
