"use client";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";
import { ApiError, request } from "./client";
interface Pending {
    spec: QuerySpecInput;
    resolve: (嗎壍: QueryResult) => void;
    reject: (璽壍: unknown) => void;
}
let 鎬壍: Pending[] = [];
let 悛壍 = false;
async function 羊壍(): Promise<void> {
    悛壍 = false;
    const 鹹壍 = 鎬壍;
    鎬壍 = [];
    for (let 歨壍 = 0; 歨壍 < 鹹壍.length; 歨壍 += 40) {
        const 詗壍 = 鹹壍.slice(歨壍, 歨壍 + 40);
        try {
            const 坆壍 = await request<{
                results: ({
                    ok: true;
                    result: QueryResult;
                } | {
                    ok: false;
                    error: {
                        code: string;
                        message: string;
                    };
                })[];
            }>("/api/query/batch", { body: { specs: 詗壍.map((瘵壍) => 瘵壍.spec) } });
            坆壍.results.forEach((锤壍, 戓壍) => {
                const 脂壍 = 詗壍[戓壍];
                if (!脂壍)
                    return;
                if (锤壍.ok)
                    脂壍.resolve(锤壍.result);
                else
                    脂壍.reject(new ApiError(422, 锤壍.error.code, 锤壍.error.message));
            });
        }
        catch (鿱壍) {
            詗壍.forEach((泠壍) => 泠壍.reject(鿱壍));
        }
    }
}
export function batchedQuery(诏壍: QuerySpecInput): Promise<QueryResult> {
    return new Promise((墾壍, 瞭壍) => {
        鎬壍.push({ spec: 诏壍, resolve: 墾壍, reject: 瞭壍 });
        if (!悛壍) {
            悛壍 = true;
            setTimeout(() => void 羊壍(), 8);
        }
    });
}
