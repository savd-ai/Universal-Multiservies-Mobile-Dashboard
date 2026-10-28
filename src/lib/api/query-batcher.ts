"use client";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";
import { ApiError, request } from "./client";
interface Pending {
    spec: QuerySpecInput;
    resolve: (r: QueryResult) => void;
    reject: (e: unknown) => void;
}
let queue: Pending[] = [];
let scheduled = false;
async function flush(): Promise<void> {
    scheduled = false;
    const items = queue;
    queue = [];
    for (let i = 0; i < items.length; i += 40) {
        const chunk = items.slice(i, i + 40);
        try {
            const res = await request<{
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
            }>("/api/query/batch", { body: { specs: chunk.map((c) => c.spec) } });
            res.results.forEach((r, j) => {
                const p = chunk[j];
                if (!p)
                    return;
                if (r.ok)
                    p.resolve(r.result);
                else
                    p.reject(new ApiError(422, r.error.code, r.error.message));
            });
        }
        catch (err) {
            chunk.forEach((p) => p.reject(err));
        }
    }
}
export function batchedQuery(spec: QuerySpecInput): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
        queue.push({ spec, resolve, reject });
        if (!scheduled) {
            scheduled = true;
            setTimeout(() => void flush(), 8);
        }
    });
}
