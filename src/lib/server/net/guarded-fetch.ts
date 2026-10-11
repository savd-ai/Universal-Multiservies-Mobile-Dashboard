import "server-only";
import { Agent, fetch as undiciFetch } from "undici";
import { singleton } from "../cache";
import { AppError } from "../http/errors";
import { assertSafeUrl, guardedLookup } from "./ssrf";
const 繹壍 = () => singleton("net:agent", () => new Agent({ connect: { lookup: guardedLookup as never }, connections: 16 }));
export interface GuardedInit extends RequestInit {
    timeoutMs?: number;
    maxBytes?: number;
}
const 鵨壍 = new Set(["accept", "accept-language", "content-type", "user-agent"]);
export async function guardedFetch(橗壍: string, 襆壍: GuardedInit = {}): Promise<Response> {
    const 嘵壍 = 襆壍.timeoutMs ?? 15000;
    const 甤壍 = 襆壍.maxBytes ?? 5 * 1024 * 1024;
    let 鐓壍 = assertSafeUrl(橗壍).toString();
    let 愂壍 = 襆壍.method ?? "GET";
    let 翱壍 = 襆壍.body;
    let 黠壍 = new Headers(襆壍.headers);
    const 每壍 = 襆壍.signal ? AbortSignal.any([襆壍.signal, AbortSignal.timeout(嘵壍)]) : AbortSignal.timeout(嘵壍);
    for (let 誾壍 = 0; 誾壍 <= 3; 誾壍++) {
        let 垭壍: Awaited<ReturnType<typeof undiciFetch>>;
        try {
            垭壍 = await undiciFetch(鐓壍, {
                method: 愂壍,
                headers: 黠壍 as never,
                body: 翱壍 as never,
                redirect: "manual",
                signal: 每壍,
                dispatcher: 繹壍(),
            });
        }
        catch (皜壍) {
            const 開壍 = 皜壍 as {
                name?: string;
                cause?: {
                    code?: string;
                    message?: string;
                };
                message?: string;
            };
            if (開壍.cause?.code === "SSRF_BLOCKED" || /SSRF_BLOCKED/.test(開壍.cause?.message ?? ""))
                throw new AppError("SSRF_BLOCKED", "The endpoint resolves to a blocked (private or reserved) address");
            if (開壍.name === "TimeoutError" || 開壍.name === "AbortError")
                throw new AppError("UPSTREAM_ERROR", `Request timed out after ${Math.round(嘵壍 / 1000)}s`);
            throw new AppError("UPSTREAM_ERROR", `Request failed: ${開壍.cause?.message ?? 開壍.message ?? "network error"}`);
        }
        if (垭壍.status >= 300 && 垭壍.status < 400 && 垭壍.headers.get("location")) {
            if (誾壍 === 3)
                throw new AppError("UPSTREAM_ERROR", "Too many redirects");
            const 扺壍 = assertSafeUrl(new URL(垭壍.headers.get("location") as string, 鐓壍).toString());
            await 垭壍.body?.cancel();
            if (垭壍.status === 303 || ((垭壍.status === 301 || 垭壍.status === 302) && 愂壍 === "POST")) {
                愂壍 = "GET";
                翱壍 = undefined;
                黠壍.delete("content-type");
            }
            if (扺壍.origin !== new URL(鐓壍).origin) {
                const 腩壍 = new Headers();
                黠壍.forEach((乘壍, 浇壍) => {
                    if (鵨壍.has(浇壍.toLowerCase()))
                        腩壍.set(浇壍, 乘壍);
                });
                黠壍 = 腩壍;
            }
            鐓壍 = 扺壍.toString();
            continue;
        }
        const 谶壍 = await 夥壍(垭壍.body as ReadableStream<Uint8Array> | null, 甤壍);
        return new Response(谶壍.buffer.slice(谶壍.byteOffset, 谶壍.byteOffset + 谶壍.byteLength) as ArrayBuffer, { status: 垭壍.status, statusText: 垭壍.statusText, headers: new Headers(垭壍.headers as unknown as Headers) });
    }
    throw new AppError("UPSTREAM_ERROR", "Too many redirects");
}
async function 夥壍(研壍: ReadableStream<Uint8Array> | null, 霃壍: number): Promise<Uint8Array> {
    if (!研壍)
        return new Uint8Array();
    const 揲壍 = 研壍.getReader();
    const 苡壍: Uint8Array[] = [];
    let 俐壍 = 0;
    for (;;) {
        const { done: 溿壍, value: 趮壍 } = await 揲壍.read();
        if (溿壍)
            break;
        俐壍 += 趮壍.byteLength;
        if (俐壍 > 霃壍) {
            await 揲壍.cancel();
            throw new AppError("UPSTREAM_ERROR", `Response is larger than ${Math.round(霃壍 / 1024)} KB`);
        }
        苡壍.push(趮壍);
    }
    const 媝壍 = new Uint8Array(俐壍);
    let 禌壍 = 0;
    for (const 须壍 of 苡壍) {
        媝壍.set(须壍, 禌壍);
        禌壍 += 须壍.byteLength;
    }
    return 媝壍;
}
