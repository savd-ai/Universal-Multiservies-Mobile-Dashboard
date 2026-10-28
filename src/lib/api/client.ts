"use client";
import type { z } from "zod";
import { hardNavigate } from "@/lib/navigation";
export class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown, public readonly retryAfterSec?: number) {
        super(message);
        this.name = "ApiError";
    }
}
interface RequestOptions<T> {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    schema?: z.ZodType<T>;
    signal?: AbortSignal;
}
let activeAccount: string | null = null;
let redirecting = false;
function sessionExpired(): void {
    if (typeof window === "undefined" || redirecting || window.location.pathname.startsWith("/login"))
        return;
    redirecting = true;
    hardNavigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}
export function setActiveAccount(id: string | null): void {
    activeAccount = id;
}
export async function request<T = unknown>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
    const url = new URL(path, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    for (const [k, v] of Object.entries(opts.query ?? {}))
        if (v !== undefined && v !== null && v !== "")
            url.searchParams.set(k, String(v));
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    const body = opts.body !== undefined ? opts.body : method === "POST" || method === "PUT" || method === "PATCH" ? {} : undefined;
    const headers: Record<string, string> = {};
    if (body !== undefined)
        headers["Content-Type"] = "application/json";
    if (activeAccount)
        headers["x-savd-account"] = activeAccount;
    let res: Response;
    try {
        res = await fetch(url.pathname + url.search, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: opts.signal,
            cache: "no-store",
        });
    }
    catch (err) {
        if ((err as Error).name === "AbortError")
            throw err;
        throw new ApiError(0, "network", "Network error — is the dashboard server running?");
    }
    const text = await res.text();
    let json: unknown = null;
    if (text) {
        try {
            json = JSON.parse(text);
        }
        catch {
            json = text;
        }
    }
    if (!res.ok) {
        const e = (json as {
            error?: {
                code?: string;
                message?: string;
                details?: unknown;
                retryAfterSec?: number;
            };
        } | null)?.error;
        if (res.status === 401 && !path.startsWith("/api/auth/"))
            sessionExpired();
        throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? res.statusText, e?.details, e?.retryAfterSec);
    }
    if (opts.schema) {
        const parsed = opts.schema.safeParse(json);
        if (!parsed.success) {
            if (process.env.NODE_ENV !== "production")
                console.warn(`[api] ${path} response did not match schema`, parsed.error.issues.slice(0, 3));
            return json as T;
        }
        return parsed.data;
    }
    return json as T;
}
export async function download(path: string, body: unknown, fallbackName: string): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (activeAccount)
        headers["x-savd-account"] = activeAccount;
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok)
        throw new ApiError(res.status, `HTTP_${res.status}`, "Export failed");
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") ?? "";
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
    saveBlob(blob, name);
}
export function saveBlob(blob: Blob, name: string): void {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 0);
}
