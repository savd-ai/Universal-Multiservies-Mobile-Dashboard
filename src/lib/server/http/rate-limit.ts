import "server-only";
interface Bucket {
    tokens: number;
    updated: number;
}
const g = globalThis as unknown as {
    __savdBuckets?: Map<string, Bucket>;
    __savdDaily?: Map<string, {
        day: string;
        count: number;
    }>;
};
const buckets = (g.__savdBuckets ??= new Map());
const daily = (g.__savdDaily ??= new Map());
export interface RateLimitResult {
    ok: boolean;
    retryAfterSec: number;
    remaining: number;
}
export function takeToken(key: string, perMinute: number, burst = perMinute): RateLimitResult {
    const now = Date.now();
    const rate = perMinute / 60000;
    const b = buckets.get(key) ?? { tokens: burst, updated: now };
    b.tokens = Math.min(burst, b.tokens + (now - b.updated) * rate);
    b.updated = now;
    if (b.tokens >= 1) {
        b.tokens -= 1;
        buckets.set(key, b);
        return { ok: true, retryAfterSec: 0, remaining: Math.floor(b.tokens) };
    }
    buckets.set(key, b);
    if (buckets.size > 5000) {
        for (const [k, v] of buckets)
            if (now - v.updated > 600000)
                buckets.delete(k);
    }
    return { ok: false, retryAfterSec: Math.ceil((1 - b.tokens) / rate / 1000), remaining: 0 };
}
export function takeDaily(key: string, limit: number): RateLimitResult {
    const day = new Date().toISOString().slice(0, 10);
    const cur = daily.get(key);
    const entry = cur && cur.day === day ? cur : { day, count: 0 };
    if (entry.count >= limit)
        return { ok: false, retryAfterSec: 3600, remaining: 0 };
    entry.count++;
    daily.set(key, entry);
    return { ok: true, retryAfterSec: 0, remaining: limit - entry.count };
}
export function clientKey(req: Request, trustProxy: boolean): string {
    if (trustProxy) {
        const fwd = req.headers.get("x-forwarded-for");
        if (fwd)
            return fwd.split(",")[0]?.trim() ?? "anon";
    }
    return req.headers.get("x-real-ip") ?? "local";
}
