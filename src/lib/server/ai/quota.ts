import "server-only";
import { singleton } from "../cache";
import { now } from "../clock";
import { AppError } from "../http/errors";
import { aiLimits, resolveAiProvider } from "./config";

// AI cost guard: a per-client token bucket (AI_RATE_LIMIT_PER_MIN, burst 5) and a process-wide daily cap
// (AI_DAILY_REQUEST_LIMIT) for requests that may reach a paid provider. Demo-engine requests only get a lenient
// abuse limit. Kept separate from http/rate-limit so GET /api/ai/status can report what is left without taking.

const DEMO_LIMIT = { perMinute: 120, burst: 30 };

interface Bucket {
  tokens: number;
  updated: number;
}

const state = () => singleton("ai:quota", () => ({ buckets: new Map<string, Bucket>(), daily: { day: "", count: 0 } }));

function refill(key: string, perMinute: number, burst: number, at: number): Bucket {
  const s = state();
  const b = s.buckets.get(key) ?? { tokens: burst, updated: at };
  b.tokens = Math.min(burst, b.tokens + ((at - b.updated) * perMinute) / 60_000);
  b.updated = at;
  s.buckets.set(key, b);
  if (s.buckets.size > 5000) for (const [k, v] of s.buckets) if (at - v.updated > 600_000) s.buckets.delete(k);
  return b;
}

function today(): string {
  return now().toISOString().slice(0, 10);
}

function dailyCount(): number {
  const d = state().daily;
  return d.day === today() ? d.count : 0;
}

/** Remaining quota for a client without consuming it (null = not limited). */
export function peekAiQuota(client: string): { minute: number | null; daily: number | null } {
  if (resolveAiProvider().id === "demo") return { minute: null, daily: null };
  const l = aiLimits();
  const b = refill(`live:${client}`, l.perMinute, l.burst, now().getTime());
  return { minute: Math.floor(b.tokens), daily: Math.max(0, l.daily - dailyCount()) };
}

/** Take one AI request from the client's quota or throw RATE_LIMITED (429 + Retry-After). */
export function takeAiQuota(client: string): void {
  const at = now().getTime();
  const demo = resolveAiProvider().id === "demo";
  const l = demo ? { ...DEMO_LIMIT, daily: Infinity } : aiLimits();
  const b = refill(`${demo ? "demo" : "live"}:${client}`, l.perMinute, l.burst, at);
  if (b.tokens < 1) {
    const retryAfterSec = Math.max(1, Math.ceil(((1 - b.tokens) * 60) / l.perMinute));
    throw new AppError("RATE_LIMITED", "Too many AI requests — try again shortly.", { limit: l.perMinute, window: "1m" }, retryAfterSec);
  }
  if (!demo) {
    const d = state().daily;
    const day = today();
    if (d.day !== day) {
      d.day = day;
      d.count = 0;
    }
    if (d.count >= l.daily) {
      const midnight = new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000;
      throw new AppError("RATE_LIMITED", `The daily AI request cap (${l.daily}) is reached. It resets at 00:00 UTC.`, { limit: l.daily, window: "1d" }, Math.max(60, Math.ceil((midnight - at) / 1000)));
    }
    d.count++;
  }
  b.tokens -= 1;
}

export function resetAiQuotaForTests(): void {
  const s = state();
  s.buckets.clear();
  s.daily = { day: "", count: 0 };
}
