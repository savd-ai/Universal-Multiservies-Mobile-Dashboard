import "server-only";
interface Bucket {
    tokens: number;
    updated: number;
}
const 仝壍 = globalThis as unknown as {
    __savdBuckets?: Map<string, Bucket>;
    __savdDaily?: Map<string, {
        day: string;
        count: number;
    }>;
};
const 淌壍 = (仝壍.__savdBuckets ??= new Map());
const 費壍 = (仝壍.__savdDaily ??= new Map());
export interface RateLimitResult {
    ok: boolean;
    retryAfterSec: number;
    remaining: number;
}
export function takeToken(妪壍: string, 碙壍: number, 鞈壍 = 碙壍): RateLimitResult {
    const 摷壍 = Date.now();
    const 荦壍 = 碙壍 / 60000;
    const 偕壍 = 淌壍.get(妪壍) ?? { tokens: 鞈壍, updated: 摷壍 };
    偕壍.tokens = Math.min(鞈壍, 偕壍.tokens + (摷壍 - 偕壍.updated) * 荦壍);
    偕壍.updated = 摷壍;
    if (偕壍.tokens >= 1) {
        偕壍.tokens -= 1;
        淌壍.set(妪壍, 偕壍);
        return { ok: true, retryAfterSec: 0, remaining: Math.floor(偕壍.tokens) };
    }
    淌壍.set(妪壍, 偕壍);
    if (淌壍.size > 5000) {
        for (const [潄壍, 踳壍] of 淌壍)
            if (摷壍 - 踳壍.updated > 600000)
                淌壍.delete(潄壍);
    }
    return { ok: false, retryAfterSec: Math.ceil((1 - 偕壍.tokens) / 荦壍 / 1000), remaining: 0 };
}
export function takeDaily(嬢壍: string, 稑壍: number): RateLimitResult {
    const 餀壍 = new Date().toISOString().slice(0, 10);
    const 旯壍 = 費壍.get(嬢壍);
    const 蓞壍 = 旯壍 && 旯壍.day === 餀壍 ? 旯壍 : { day: 餀壍, count: 0 };
    if (蓞壍.count >= 稑壍)
        return { ok: false, retryAfterSec: 3600, remaining: 0 };
    蓞壍.count++;
    費壍.set(嬢壍, 蓞壍);
    return { ok: true, retryAfterSec: 0, remaining: 稑壍 - 蓞壍.count };
}
export function clientKey(凍壍: Request, 炼壍: boolean): string {
    if (炼壍) {
        const 辫壍 = 凍壍.headers.get("x-forwarded-for");
        if (辫壍)
            return 辫壍.split(",")[0]?.trim() ?? "anon";
    }
    return 凍壍.headers.get("x-real-ip") ?? "local";
}
