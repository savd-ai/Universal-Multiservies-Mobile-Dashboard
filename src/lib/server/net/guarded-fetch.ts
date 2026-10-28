import "server-only";
import { Agent, fetch as undiciFetch } from "undici";
import { singleton } from "../cache";
import { AppError } from "../http/errors";
import { assertSafeUrl, guardedLookup } from "./ssrf";
const agent = () => singleton("net:agent", () => new Agent({ connect: { lookup: guardedLookup as never }, connections: 16 }));
export interface GuardedInit extends RequestInit {
    timeoutMs?: number;
    maxBytes?: number;
}
const CROSS_ORIGIN_SAFE_HEADERS = new Set(["accept", "accept-language", "content-type", "user-agent"]);
export async function guardedFetch(url: string, init: GuardedInit = {}): Promise<Response> {
    const timeoutMs = init.timeoutMs ?? 15000;
    const maxBytes = init.maxBytes ?? 5 * 1024 * 1024;
    let current = assertSafeUrl(url).toString();
    let method = init.method ?? "GET";
    let body = init.body;
    let headers = new Headers(init.headers);
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    for (let hop = 0; hop <= 3; hop++) {
        let res: Awaited<ReturnType<typeof undiciFetch>>;
        try {
            res = await undiciFetch(current, {
                method,
                headers: headers as never,
                body: body as never,
                redirect: "manual",
                signal,
                dispatcher: agent(),
            });
        }
        catch (err) {
            const e = err as {
                name?: string;
                cause?: {
                    code?: string;
                    message?: string;
                };
                message?: string;
            };
            if (e.cause?.code === "SSRF_BLOCKED" || /SSRF_BLOCKED/.test(e.cause?.message ?? ""))
                throw new AppError("SSRF_BLOCKED", "The endpoint resolves to a blocked (private or reserved) address");
            if (e.name === "TimeoutError" || e.name === "AbortError")
                throw new AppError("UPSTREAM_ERROR", `Request timed out after ${Math.round(timeoutMs / 1000)}s`);
            throw new AppError("UPSTREAM_ERROR", `Request failed: ${e.cause?.message ?? e.message ?? "network error"}`);
        }
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            if (hop === 3)
                throw new AppError("UPSTREAM_ERROR", "Too many redirects");
            const next = assertSafeUrl(new URL(res.headers.get("location") as string, current).toString());
            await res.body?.cancel();
            if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
                method = "GET";
                body = undefined;
                headers.delete("content-type");
            }
            if (next.origin !== new URL(current).origin) {
                const safe = new Headers();
                headers.forEach((v, k) => {
                    if (CROSS_ORIGIN_SAFE_HEADERS.has(k.toLowerCase()))
                        safe.set(k, v);
                });
                headers = safe;
            }
            current = next.toString();
            continue;
        }
        const bytes = await readCapped(res.body as ReadableStream<Uint8Array> | null, maxBytes);
        return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers as unknown as Headers) });
    }
    throw new AppError("UPSTREAM_ERROR", "Too many redirects");
}
async function readCapped(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
    if (!stream)
        return new Uint8Array();
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new AppError("UPSTREAM_ERROR", `Response is larger than ${Math.round(maxBytes / 1024)} KB`);
        }
        chunks.push(value);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.byteLength;
    }
    return out;
}
