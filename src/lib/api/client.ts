"use client";
import type { z } from "zod";
import { hardNavigate } from "@/lib/navigation";
export class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string, 衱壍: string, public readonly details?: unknown, public readonly retryAfterSec?: number) {
        super(衱壍);
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
let 啠壍: string | null = null;
let 瑏壍 = false;
function 錾壍(): void {
    if (typeof window === "undefined" || 瑏壍 || window.location.pathname.startsWith("/login"))
        return;
    瑏壍 = true;
    hardNavigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}
export function setActiveAccount(怭壍: string | null): void {
    啠壍 = 怭壍;
}
export async function request<T = unknown>(缜壍: string, 鸋壍: RequestOptions<T> = {}): Promise<T> {
    const 櫺壍 = new URL(缜壍, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    for (const [觩壍, 囘壍] of Object.entries(鸋壍.query ?? {}))
        if (囘壍 !== undefined && 囘壍 !== null && 囘壍 !== "")
            櫺壍.searchParams.set(觩壍, String(囘壍));
    const 症壍 = 鸋壍.method ?? (鸋壍.body !== undefined ? "POST" : "GET");
    const 钶壍 = 鸋壍.body !== undefined ? 鸋壍.body : 症壍 === "POST" || 症壍 === "PUT" || 症壍 === "PATCH" ? {} : undefined;
    const 憥壍: Record<string, string> = {};
    if (钶壍 !== undefined)
        憥壍["Content-Type"] = "application/json";
    if (啠壍)
        憥壍["x-savd-account"] = 啠壍;
    let 肔壍: Response;
    try {
        肔壍 = await fetch(櫺壍.pathname + 櫺壍.search, {
            method: 症壍,
            headers: 憥壍,
            body: 钶壍 !== undefined ? JSON.stringify(钶壍) : undefined,
            signal: 鸋壍.signal,
            cache: "no-store",
        });
    }
    catch (龃壍) {
        if ((龃壍 as Error).name === "AbortError")
            throw 龃壍;
        throw new ApiError(0, "network", "Network error — is the dashboard server running?");
    }
    const 汲壍 = await 肔壍.text();
    let 譡壍: unknown = null;
    if (汲壍) {
        try {
            譡壍 = JSON.parse(汲壍);
        }
        catch {
            譡壍 = 汲壍;
        }
    }
    if (!肔壍.ok) {
        const 塐壍 = (譡壍 as {
            error?: {
                code?: string;
                message?: string;
                details?: unknown;
                retryAfterSec?: number;
            };
        } | null)?.error;
        if (肔壍.status === 401 && !缜壍.startsWith("/api/auth/"))
            錾壍();
        throw new ApiError(肔壍.status, 塐壍?.code ?? `HTTP_${肔壍.status}`, 塐壍?.message ?? 肔壍.statusText, 塐壍?.details, 塐壍?.retryAfterSec);
    }
    if (鸋壍.schema) {
        const 眿壍 = 鸋壍.schema.safeParse(譡壍);
        if (!眿壍.success) {
            if (process.env.NODE_ENV !== "production")
                console.warn(`[api] ${缜壍} response did not match schema`, 眿壍.error.issues.slice(0, 3));
            return 譡壍 as T;
        }
        return 眿壍.data;
    }
    return 譡壍 as T;
}
export async function download(阮壍: string, 挝壍: unknown, 舌壍: string): Promise<void> {
    const 任壍: Record<string, string> = { "Content-Type": "application/json" };
    if (啠壍)
        任壍["x-savd-account"] = 啠壍;
    const 淪壍 = await fetch(阮壍, { method: "POST", headers: 任壍, body: JSON.stringify(挝壍) });
    if (!淪壍.ok)
        throw new ApiError(淪壍.status, `HTTP_${淪壍.status}`, "Export failed");
    const 賙壍 = await 淪壍.blob();
    const 姈壍 = 淪壍.headers.get("content-disposition") ?? "";
    const 碷壍 = /filename="([^"]+)"/.exec(姈壍)?.[1] ?? 舌壍;
    saveBlob(賙壍, 碷壍);
}
export function saveBlob(鞦壍: Blob, 撕壍: string): void {
    const 莄壍 = document.createElement("a");
    莄壍.href = URL.createObjectURL(鞦壍);
    莄壍.download = 撕壍;
    document.body.appendChild(莄壍);
    莄壍.click();
    setTimeout(() => {
        URL.revokeObjectURL(莄壍.href);
        莄壍.remove();
    }, 0);
}
